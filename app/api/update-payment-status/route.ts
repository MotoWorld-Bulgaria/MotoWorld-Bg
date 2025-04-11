import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAuthToken } from "@/lib/verify-auth"
import { sendOrderConfirmationEmail } from "@/lib/email-service"
import Stripe from "stripe"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

export async function POST(request: Request) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 })
    }

    const decodedToken = await verifyAuthToken(authHeader)

    const { paymentIntentId, orderId } = await request.json()

    if (!paymentIntentId || !orderId) {
      return NextResponse.json({ error: "Payment Intent ID and Order ID are required" }, { status: 400 })
    }

    // Get the order from Firestore
    const orderRef = adminDb.collection("orders").doc(orderId)
    const orderDoc = await orderRef.get()

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const orderData = orderDoc.data()

    if (!orderData) {
      return NextResponse.json({ error: "Order data is missing" }, { status: 500 })
    }

    // Verify user matches token
    if (decodedToken.uid !== orderData.userId && decodedToken.uid !== orderData.customer?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status === "succeeded") {
      // Update order with payment success
      const updateData = {
        status: "processing",
        paymentStatus: "completed",
        paymentCompletedAt: new Date().toISOString(),
        amountPaid: paymentIntent.amount / 100,
        paymentMethod: "card",
        updatedAt: new Date().toISOString(),
        "paymentDetails.status": "completed",
        "paymentDetails.paymentDate": new Date().toISOString(),
      }

      await orderRef.update(updateData)

      // Send order confirmation email
      try {
        if (orderData.customer?.email) {
          await sendOrderConfirmationEmail(orderData.customer.email, {
            orderNumber: orderData.orderNumber || orderId.substring(0, 8),
            customerName: `${orderData.customer.firstName || ""} ${orderData.customer.lastName || ""}`.trim(),
            orderTotal: orderData.totalAmount,
            paymentMethod: "card",
            orderDate: new Date().toISOString(),
          })
        }
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError)
        // Continue processing even if email fails
      }

      return NextResponse.json({
        success: true,
        status: "completed",
        message: "Payment completed successfully",
        order: {
          id: orderId,
          ...updateData,
        },
      })
    } else if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
      // Update order with payment status that requires additional action
      await orderRef.update({
        "paymentDetails.status": "processing",
        "paymentDetails.lastAction": paymentIntent.status,
        updatedAt: new Date().toISOString(),
      })

      return NextResponse.json({
        success: false,
        status: paymentIntent.status,
        message: "Payment requires additional action",
      })
    } else {
      // Update order with payment status
      await orderRef.update({
        "paymentDetails.status": paymentIntent.status === "requires_payment_method" ? "failed" : paymentIntent.status,
        updatedAt: new Date().toISOString(),
      })

      return NextResponse.json({
        success: false,
        status: paymentIntent.status,
        message: "Payment not completed",
      })
    }
  } catch (error: any) {
    console.error("Error updating payment status:", error)
    return NextResponse.json({ error: "Failed to update payment status", message: error.message }, { status: 500 })
  }
}
