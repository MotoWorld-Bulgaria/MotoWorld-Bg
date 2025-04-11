import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAuthToken } from "@/lib/verify-auth"

export async function POST(request: Request) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 })
    }

    const decodedToken = await verifyAuthToken(authHeader)

    // Check if user is admin
    if (decodedToken.uid !== "ZXduWaLnwuVPlKPvZm0FyoDeaXs2") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    // Get the order from Firestore
    const orderRef = adminDb.collection("orders").doc(orderId)
    const orderDoc = await orderRef.get()

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const orderData = orderDoc.data()

    // Check if there's a checkout session ID
    if (!orderData?.checkoutSessionId) {
      return NextResponse.json({ error: "No checkout session ID found" }, { status: 400 })
    }

    // Fetch the session from Stripe
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(orderData.checkoutSessionId)

    // Update the order based on the session status
    if (session.payment_status === "paid") {
      await orderRef.update({
        status: "processing",
        paymentStatus: session.payment_status,
        paymentCompletedAt: new Date().toISOString(),
        amountPaid: session.amount_total ? session.amount_total / 100 : 0,
        paymentMethod: session.payment_method_types?.[0] || "card",
        updatedAt: new Date().toISOString(),
        "paymentDetails.status": "completed",
        "paymentDetails.paymentDate": new Date().toISOString(),
        "paymentDetails.transactionId": session.payment_intent,
      })

      // Mark any failed payment update records as processed
      const failedUpdatesRef = adminDb.collection("failedPaymentUpdates")
      const failedUpdatesSnapshot = await failedUpdatesRef.where("orderId", "==", orderId).get()

      const batch = adminDb.batch()
      failedUpdatesSnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          processed: true,
          processedAt: new Date().toISOString(),
          processedBy: decodedToken.uid,
        })
      })

      await batch.commit()

      return NextResponse.json({ success: true, status: "completed" })
    } else if (session.payment_status === "unpaid") {
      await orderRef.update({
        "paymentDetails.status": "pending",
        updatedAt: new Date().toISOString(),
      })

      return NextResponse.json({ success: true, status: "pending" })
    } else {
      await orderRef.update({
        "paymentDetails.status": "failed",
        updatedAt: new Date().toISOString(),
      })

      return NextResponse.json({ success: true, status: "failed" })
    }
  } catch (error: any) {
    console.error("Error retrying payment update:", error)
    return NextResponse.json({ error: "Failed to retry payment update", message: error.message }, { status: 500 })
  }
}
