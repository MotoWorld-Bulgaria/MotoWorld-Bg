import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAuthToken } from "@/lib/verify-auth"
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

    const { orderId, returnUrl } = await request.json()

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

    if (!orderData) {
      return NextResponse.json({ error: "Order data is missing" }, { status: 500 })
    }

    // Verify user matches token
    if (decodedToken.uid !== orderData.userId && decodedToken.uid !== orderData.customer?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Calculate amount in cents
    const amount = Math.round(orderData.totalAmount * 100)

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "bgn",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId: orderId,
        orderNumber: orderData.orderNumber || "",
        userId: decodedToken.uid,
      },
      receipt_email: orderData.customer?.email,
      description: `Поръчка #${orderData.orderNumber || orderId}`,
    })

    // Update order with payment intent ID
    await orderRef.update({
      "paymentDetails.transactionId": paymentIntent.id,
      "paymentDetails.status": "processing",
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderNumber: orderData.orderNumber || "",
      amount: orderData.totalAmount,
    })
  } catch (error: any) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent", message: error.message }, { status: 500 })
  }
}
