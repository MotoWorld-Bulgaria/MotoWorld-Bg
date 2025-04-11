import { NextResponse } from "next/server"
import { Stripe } from "stripe"
import { adminDb } from "@/lib/firebase-admin"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    // Get the order from Firestore
    const orderDoc = await adminDb.collection("orders").doc(orderId).get()

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const orderData = orderDoc.data()

    if (!orderData) {
      return NextResponse.json({ error: "Order data is missing" }, { status: 500 })
    }

    // Create a payment link
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order-success?order_id=${orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account`,
      customer_email: orderData.customer?.email,
      client_reference_id: orderData.userId,
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: (orderData.shippingCost || 0) * 100, // Convert to cents
              currency: "bgn",
            },
            display_name: orderData.shippingDetails?.method || "Стандартна доставка",
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: 1,
              },
              maximum: {
                unit: "business_day",
                value: 5,
              },
            },
          },
        },
      ],
      line_items:
        orderData.items?.map((item: any) => {
          const unitAmount = Math.round(
            (typeof item.price === "string" ? Number.parseFloat(item.price) : item.price) * 100,
          )

          return {
            price_data: {
              currency: "bgn",
              product_data: {
                name: item.name,
                description: `${item.manufacturer || ""} ${item.horsepower ? `- ${item.horsepower}hp` : ""}`,
                images: item.image ? [item.image] : [],
              },
              unit_amount: unitAmount,
            },
            quantity: item.quantity,
          }
        }) || [],
      metadata: {
        orderId: orderId,
        orderNumber: orderData.orderNumber,
      },
    })

    // Update the order with the new checkout session ID
    await adminDb.collection("orders").doc(orderId).update({
      checkoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error("Error creating payment link:", error)
    return NextResponse.json({ error: "Failed to create payment link", message: error.message }, { status: 500 })
  }
}
