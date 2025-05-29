import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAuthToken } from "@/lib/verify-auth"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: Request) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 })
    }

    const decodedToken = await verifyAuthToken(authHeader)

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

    // Verify user matches token
    if (decodedToken.uid !== userData.uid) {
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
    const orderRef = await adminDb.collection("orders").add(orderData)

    // Check and update motorcycle inventory
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
      }
    }

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      orderNumber,
    })
  } catch (error) {
    console.error("Error creating order:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
