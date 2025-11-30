import { NextResponse } from "next/server"
import { adminDb, initError } from "@/lib/firebase-admin"
import { verifyAuthToken } from "@/lib/verify-auth"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: Request) {
  try {
    console.log("=== Create Order API ===")
    console.log("Firebase Init Error:", initError?.message || "None")
    console.log("Firestore initialized:", !!adminDb)
    
    // Check if Firebase Admin initialization had an error
    if (initError) {
      console.error("Firebase initialization failed:", initError.message)
      return NextResponse.json(
        { 
          error: "Firebase initialization failed",
          details: initError.message,
          type: "ConfigurationError"
        }, 
        { status: 500 }
      )
    }

    // Check if Firebase Admin is initialized
    if (!adminDb) {
      console.error("Firestore not initialized - adminDb is null")
      return NextResponse.json(
        { 
          error: "Firebase not initialized",
          details: "Firestore database is not available. Check server logs.",
          type: "ConfigurationError"
        }, 
        { status: 500 }
      )
    }

    // Verify authentication
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return NextResponse.json({ error: "No authorization header" }, { status: 401 })
    }

    let decodedToken
    try {
      decodedToken = await verifyAuthToken(authHeader)
      console.log("✓ Token verified for user:", decodedToken.uid)
    } catch (tokenError) {
      console.error("Token verification failed:", tokenError)
      return NextResponse.json(
        { 
          error: "Authentication failed",
          details: tokenError instanceof Error ? tokenError.message : String(tokenError)
        }, 
        { status: 401 }
      )
    }

    const {
      items,
      userData,
      shippingOption,
      paymentDetails,
      orderTotal,
      subtotal,
      discountAmount = 0,
      promoCode = null,
      directPurchase = false,
    } = await request.json()

    if (!items || !userData || !shippingOption || !paymentDetails) {
      console.error("Missing required fields:", { items: !!items, userData: !!userData, shippingOption: !!shippingOption, paymentDetails: !!paymentDetails })
      return NextResponse.json(
        { 
          error: "Missing required fields",
          details: "items, userData, shippingOption, and paymentDetails are required"
        }, 
        { status: 400 }
      )
    }

    // Verify user matches token
    if (decodedToken.uid !== userData.uid) {
      console.error("User ID mismatch:", decodedToken.uid, "vs", userData.uid)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Generate a unique order number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${uuidv4().slice(0, 4)}`.toUpperCase()

    // Create comprehensive order document
    const orderData = {
      orderNumber,
      userId: userData.uid,
      orderDate: new Date().toISOString(),
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Customer information
      customer: {
        uid: userData.uid,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        displayName: `${userData.firstName} ${userData.lastName}`,
      },

      // Shipping information
      shippingDetails: {
        address: userData.address,
        city: userData.city,
        postalCode: userData.postalCode,
        country: userData.country,
        method: shippingOption.name,
        price: shippingOption.price,
        estimatedDays: shippingOption.estimatedDays,
      },

      // Payment information
      paymentDetails: {
        method: paymentDetails.method,
        status: paymentDetails.status,
        amount: orderTotal,
        currency: "BGN",
        paymentDate: null,
      },

      // Order items
      items: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        manufacturer: item.manufacturer,
        price: typeof item.price === "string" ? Number.parseFloat(item.price) : item.price,
        quantity: item.quantity,
        totalPrice: (typeof item.price === "string" ? Number.parseFloat(item.price) : item.price) * item.quantity,
        image: item.image || null,
        horsepower: item.horsepower || null,
        maxSpeed: item.maxSpeed || null,
        torque: item.torque || null,
      })),

      // Product details (for single item orders or first item)
      productDetails: {
        id: items[0].id,
        name: items[0].name,
        manufacturer: items[0].manufacturer,
        price: typeof items[0].price === "string" ? Number.parseFloat(items[0].price) : items[0].price,
        image: items[0].image || null,
      },

      // Order totals with promo code support
      subtotal:
        subtotal ||
        items.reduce((sum: number, item: any) => {
          const itemPrice = typeof item.price === "string" ? Number.parseFloat(item.price) : item.price
          return sum + itemPrice * item.quantity
        }, 0),
      shippingCost: shippingOption.price,
      discountAmount: discountAmount,
      promoCode: promoCode,
      taxAmount: 0, // Can be calculated if needed
      totalAmount: orderTotal,

      // Additional metadata
      directPurchase,
      notes: "",
      trackingNumber: null,
      estimatedDeliveryDate: null,
    }

    // Add order to Firestore
    let orderRef
    try {
      orderRef = await adminDb.collection("orders").add(orderData)
      console.log("Order created successfully:", orderRef.id)
    } catch (firestoreError) {
      console.error("Firestore add failed:", firestoreError)
      throw new Error(`Failed to add order to Firestore: ${firestoreError instanceof Error ? firestoreError.message : String(firestoreError)}`)
    }

    // Check and update motorcycle inventory
    try {
      for (const item of items) {
        const motorcycleRef = adminDb.collection("motors").doc(item.id)
        const motorcycleDoc = await motorcycleRef.get()

        if (motorcycleDoc.exists) {
          const currentInventory = motorcycleDoc.data()?.inventory || 10 // Default to 10 if not set
          const newInventory = Math.max(0, currentInventory - item.quantity)

          await motorcycleRef.update({
            inventory: newInventory,
            updatedAt: new Date().toISOString(),
          })
          console.log(`Updated inventory for ${item.id}: ${currentInventory} -> ${newInventory}`)
        } else {
          console.warn(`Motorcycle ${item.id} not found in database`)
        }
      }
    } catch (inventoryError) {
      console.error("Inventory update failed:", inventoryError)
      // Don't fail the entire order if inventory update fails
      console.warn("Continuing despite inventory update error")
    }

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      orderNumber,
    })
  } catch (error) {
    console.error("Error creating order:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return NextResponse.json(
      { 
        error: "Failed to create order",
        details: errorMessage,
        type: error instanceof Error ? error.constructor.name : typeof error
      }, 
      { status: 500 }
    )
  }
}
