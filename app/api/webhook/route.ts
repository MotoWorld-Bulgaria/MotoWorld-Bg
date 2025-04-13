import { type NextRequest, NextResponse } from "next/server"
import { Stripe } from "stripe"
import { adminDb } from "@/lib/firebase-admin"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil",
})

// Maximum number of retries for database operations
const MAX_RETRIES = 3

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature") as string

  let event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "")
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 })
  }

  // Handle the event
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object)
        break
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object)
        break
      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error)
    return NextResponse.json({ error: "Error processing webhook" }, { status: 500 })
  }
}

/**
 * Handle the payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Find the order by payment intent ID
  try {
    const orderId = paymentIntent.metadata.orderId

    if (!orderId) {
      console.error("No order ID found in payment intent metadata")
      return
    }

    let retries = 0
    let success = false

    while (!success && retries < MAX_RETRIES) {
      try {
        // Get the order from Firestore
        const orderRef = adminDb.collection("orders").doc(orderId)
        const orderDoc = await orderRef.get()

        if (!orderDoc.exists) {
          console.error("Order not found:", orderId)
          return
        }

        const orderData = orderDoc.data()

        // Update order status
        await orderRef.update({
          status: "processing", // Change status from 'pending' to 'processing'
          paymentStatus: "completed",
          paymentCompletedAt: new Date().toISOString(),
          amountPaid: paymentIntent.amount / 100,
          paymentMethod: "card",
          updatedAt: new Date().toISOString(),
          "paymentDetails.status": "completed",
          "paymentDetails.paymentDate": new Date().toISOString(),
        })

        // Update inventory for each item
        if (orderData?.items && Array.isArray(orderData.items)) {
          for (const item of orderData.items) {
            try {
              const productRef = adminDb.collection("motors").doc(item.id)
              const productDoc = await productRef.get()

              if (productDoc.exists) {
                const productData = productDoc.data()
                if (!productData) {
                  console.error(`No data found for product ${item.id}`)
                  continue
                }
                const currentInventory = productData.inventory || 10
                const newInventory = Math.max(0, currentInventory - item.quantity)

                await productRef.update({
                  inventory: newInventory,
                  updatedAt: new Date().toISOString(),
                })
              }
            } catch (inventoryError) {
              console.error(`Error updating inventory for product ${item.id}:`, inventoryError)
              // Continue with other items even if one fails
            }
          }
        }

        success = true
        console.log(`Successfully processed payment for order ${orderId}`)
      } catch (error) {
        retries++
        console.error(`Error updating order ${orderId} (attempt ${retries}/${MAX_RETRIES}):`, error)

        if (retries < MAX_RETRIES) {
          // Exponential backoff: wait longer between each retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)))
        } else {
          // Log the final failure
          console.error(`Failed to update order ${orderId} after ${MAX_RETRIES} attempts`)

          // Create a record in a separate collection for failed updates that need manual review
          try {
            await adminDb.collection("failedPaymentUpdates").add({
              orderId,
              paymentIntentId: paymentIntent.id,
              paymentStatus: paymentIntent.status,
              amount: paymentIntent.amount,
              error: JSON.stringify(error),
              createdAt: new Date().toISOString(),
              processed: false,
            })
          } catch (logError) {
            console.error("Error logging failed payment update:", logError)
          }
        }
      }
    }
  } catch (error) {
    console.error("Error handling payment_intent.succeeded:", error)
    throw error
  }
}

/**
 * Handle the payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId

    if (!orderId) {
      console.error("No order ID found in payment intent metadata")
      return
    }

    const orderRef = adminDb.collection("orders").doc(orderId)
    const orderDoc = await orderRef.get()

    if (!orderDoc.exists) {
      console.error("Order not found for failed payment intent:", orderId)
      return
    }

    // Update the order with failed payment status
    await orderRef.update({
      "paymentDetails.status": "failed",
      "paymentDetails.lastError": paymentIntent.last_payment_error?.message || "Payment failed",
      updatedAt: new Date().toISOString(),
    })

    console.log(`Updated order ${orderId} with failed payment status`)
  } catch (error) {
    console.error("Error handling payment_intent.payment_failed:", error)
    throw error
  }
}
