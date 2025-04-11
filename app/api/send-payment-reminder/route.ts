import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import nodemailer from "nodemailer"

export async function POST(request: Request) {
  try {
    const { orderId, email, orderNumber } = await request.json()

    if (!orderId || !email) {
      return NextResponse.json({ error: "Order ID and email are required" }, { status: 400 })
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
    const paymentLinkResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/create-payment-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    })

    if (!paymentLinkResponse.ok) {
      throw new Error("Failed to create payment link")
    }

    const { url: paymentUrl } = await paymentLinkResponse.json()

    // Send email reminder
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: process.env.EMAIL_SERVER_SECURE === "true",
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Напомняне за плащане на поръчка #${orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Напомняне за плащане</h2>
          <p>Здравейте,</p>
          <p>Бихме искали да ви напомним, че имате неплатена поръчка с номер <strong>#${orderNumber}</strong>.</p>
          <p>За да завършите плащането и да продължим с обработката на вашата поръчка, моля, използвайте линка по-долу:</p>
          <p style="margin: 20px 0;">
            <a href="${paymentUrl}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Завърши плащането</a>
          </p>
          <p>Ако вече сте платили тази поръчка, моля, игнорирайте това съобщение.</p>
          <p>Благодарим ви за вашата поръчка!</p>
          <p>С уважение,<br>Екипът на MotoWorld</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)

    // Update the order to indicate a reminder was sent
    await adminDb.collection("orders").doc(orderId).update({
      reminderSent: true,
      reminderSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error sending payment reminder:", error)
    return NextResponse.json({ error: "Failed to send payment reminder", message: error.message }, { status: 500 })
  }
}
