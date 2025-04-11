import { NextResponse } from "next/server"
import { Stripe } from "stripe"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Return the payment status and other relevant information
    return NextResponse.json({
      id: session.id,
      status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_email,
      payment_method_types: session.payment_method_types,
      created: new Date(session.created * 1000).toISOString(),
    })
  } catch (error: any) {
    console.error("Error retrieving payment status:", error)
    return NextResponse.json({ error: "Failed to retrieve payment status", message: error.message }, { status: 500 })
  }
}
