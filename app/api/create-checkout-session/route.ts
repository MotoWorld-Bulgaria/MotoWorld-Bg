import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import { initializeApp, cert, getApps } from "firebase-admin/app"
import Stripe from "stripe"

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

const adminDb = getFirestore()

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

export async function POST(request: Request) {
  try {
    // Get authorization token
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Invalid authorization header" }, { status: 401 })
    }

    // Verify Firebase token
    const idToken = authHeader.split("Bearer ")[1]
    const decodedToken = await getAuth().verifyIdToken(idToken)
    const userId = decodedToken.uid

    // Parse request body
    const { items, orderId, userData, shippingOption, returnUrl } = await request.json()

    // Verify user matches token
    if (userId !== userData.uid) {
      return NextResponse.json({ error: "User authentication mismatch" }, { status: 403 })
    }

    // Get order from Firestore to ensure it exists
    const orderDoc = await adminDb.collection("orders").doc(orderId).get()
    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/checkout?canceled=true`,
      customer_email: userData.email,
      client_reference_id: userId,
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: shippingOption.price * 100, // Convert to cents
              currency: "bgn",
            },
            display_name: shippingOption.name,
            delivery_estimate: {
              minimum: {
                unit: "business_day",
                value: Number.parseInt(shippingOption.estimatedDays.split("-")[0]),
              },
              maximum: {
                unit: "business_day",
                value: Number.parseInt(shippingOption.estimatedDays.split("-")[1] || shippingOption.estimatedDays),
              },
            },
          },
        },
      ],
      line_items: items.map((item: any) => {
        const unitAmount = Math.round(
          (typeof item.price === "string" ? Number.parseFloat(item.price) : item.price) * 100,
        )

        return {
          price_data: {
            currency: "bgn",
            product_data: {
              name: item.name,
              description: `${item.manufacturer} - ${item.horsepower}hp`,
              images: item.image ? [item.image] : [],
            },
            unit_amount: unitAmount,
          },
          quantity: item.quantity,
        }
      }),
      metadata: {
        orderId: orderId,
        userId: userId,
      },
    })

    // Update order with checkout session ID
    await adminDb.collection("orders").doc(orderId).update({
      checkoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error("Error creating checkout session:", error)
    return NextResponse.json({ error: "Failed to create checkout session", message: error.message }, { status: 500 })
  }
}
