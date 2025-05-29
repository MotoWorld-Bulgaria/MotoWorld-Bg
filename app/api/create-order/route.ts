import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const {
      items,
      userData,
      shippingOption,
      paymentDetails,
      orderTotal,
      subtotal,
      discountAmount,
      promoCode,
      directPurchase,
    } = await request.json()

    const orderNumber = uuidv4()

    const orderData = {
      orderNumber: orderNumber,
      status: "pending",
      createdAt: new Date().toISOString(),
      customer: {
        uid: userData.uid,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
      },
      items: items,
      shippingDetails: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        address: userData.address,
        city: userData.city,
        postalCode: userData.postalCode,
        country: userData.country,
        phone: userData.phone,
        method: shippingOption.name,
      },
      shippingCost: shippingOption.price,
      paymentDetails: paymentDetails,
      subtotal: subtotal || orderTotal,
      totalAmount: orderTotal,
      discountAmount: discountAmount || 0,
      promoCode: promoCode || null,
      directPurchase: directPurchase || false,
    }

    const order = await db.order.create({
      data: orderData,
    })

    return NextResponse.json({ orderNumber: order.orderNumber }, { status: 201 })
  } catch (error) {
    console.error("[CREATE_ORDER_POST]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}
