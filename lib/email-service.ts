import nodemailer from "nodemailer"

interface OrderConfirmationData {
  orderNumber: string
  customerName: string
  orderTotal: number
  paymentMethod: string
  orderDate: string
}

/**
 * Send an order confirmation email to the customer
 */
export async function sendOrderConfirmationEmail(email: string, orderData: OrderConfirmationData) {
  // Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    secure: process.env.EMAIL_SERVER_SECURE === "true",
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  })

  // Format the date
  const formattedDate = new Date(orderData.orderDate).toLocaleDateString("bg-BG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  // Create the email content
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Потвърждение на поръчка #${orderData.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #000; color: #fff; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Потвърждение на поръчка</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #eee; background-color: #fff;">
          <p>Здравейте, ${orderData.customerName},</p>
          
          <p>Благодарим Ви за Вашата поръчка! Плащането беше успешно обработено и поръчката Ви е в процес на обработка.</p>
          
          <div style="background-color: #f9f9f9; border: 1px solid #eee; padding: 15px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333; font-size: 18px;">Детайли на поръчката</h2>
            <p><strong>Номер на поръчка:</strong> #${orderData.orderNumber}</p>
            <p><strong>Дата:</strong> ${formattedDate}</p>
            <p><strong>Метод на плащане:</strong> ${orderData.paymentMethod === "card" ? "Кредитна/Дебитна карта" : orderData.paymentMethod}</p>
            <p><strong>Обща сума:</strong> ${orderData.orderTotal.toFixed(2)} лв.</p>
          </div>
          
          <p>Можете да проследите статуса на Вашата поръчка в секция "Моите поръчки" във Вашия акаунт.</p>
          
          <p>Ако имате въпроси относно Вашата поръчка, моля, свържете се с нас на <a href="mailto:motoworldbulgaria@gmail.com">motoworldbulgaria@gmail.com</a>.</p>
          
          <p>С уважение,<br>Екипът на MotoWorld</p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>© ${new Date().getFullYear()} MotoWorld. Всички права запазени.</p>
        </div>
      </div>
    `,
  }

  // Send the email
  return transporter.sendMail(mailOptions)
}
