"use client"

import type React from "react"

import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertCircle, CreditCard } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)

interface StripePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  clientSecret: string
  orderData: {
    orderId: string
    orderNumber: string
    amount: number
    returnUrl: string
  }
  onPaymentSuccess: (paymentIntentId: string) => void
  onPaymentError: (error: string) => void
}

export default function StripePaymentModal({
  isOpen,
  onClose,
  clientSecret,
  orderData,
  onPaymentSuccess,
  onPaymentError,
}: StripePaymentModalProps) {
  if (!clientSecret) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] p-0 bg-white max-h-[80vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-2 sticky top-0 bg-white z-10 border-b">
          <DialogTitle className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5" />
            Завършване на плащането
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#000000",
                  colorBackground: "#ffffff",
                  colorText: "#000000",
                  colorDanger: "#ef4444",
                  fontFamily: "system-ui, sans-serif",
                  borderRadius: "4px",
                },
              },
            }}
          >
            <CheckoutForm
              orderData={orderData}
              onPaymentSuccess={onPaymentSuccess}
              onPaymentError={onPaymentError}
              onClose={onClose}
            />
          </Elements>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Update the CheckoutForm component to better handle payment status updates
function CheckoutForm({
  orderData,
  onPaymentSuccess,
  onPaymentError,
  onClose,
}: {
  orderData: {
    orderId: string
    orderNumber: string
    amount: number
    returnUrl: string
  }
  onPaymentSuccess: (paymentIntentId: string) => void
  onPaymentError: (error: string) => void
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!stripe || !elements) {
      // Stripe.js hasn't loaded yet
      return
    }

    setIsProcessing(true)
    setPaymentStatus("processing")

    try {
      // Confirm the payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: orderData.returnUrl,
        },
        redirect: "if_required",
      })

      if (error) {
        setErrorMessage(error.message || "Възникна проблем при обработката на плащането.")
        setPaymentStatus("error")
        onPaymentError(error.message || "Payment failed")
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        setPaymentStatus("success")
        onPaymentSuccess(paymentIntent.id)
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
        // Handle 3D Secure authentication if needed
        setErrorMessage("Необходима е допълнителна автентикация. Моля, следвайте инструкциите.")
        setPaymentStatus("processing")
      } else {
        // Handle other statuses or implement polling for pending payments
        setPaymentStatus("error")
        setErrorMessage("Плащането е в процес на обработка. Моля, проверете статуса на поръчката си по-късно.")
        onPaymentError("Payment is pending or requires additional steps")
      }
    } catch (err: any) {
      setPaymentStatus("error")
      setErrorMessage(err.message || "Възникна неочаквана грешка.")
      onPaymentError(err.message || "Unexpected error")
    } finally {
      setIsProcessing(false)
    }
  }

  if (paymentStatus === "success") {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Плащането е успешно!</h3>
        <p className="text-gray-600 mb-6">Вашата поръчка #{orderData.orderNumber} е обработена успешно.</p>
        <Button onClick={onClose}>Затвори</Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-md mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Поръчка:</span>
          <span className="font-medium">#{orderData.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Сума за плащане:</span>
          <span className="font-bold">{orderData.amount.toFixed(2)} лв.</span>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <PaymentElement />
      </div>

      <Button type="submit" disabled={!stripe || !elements || isProcessing} className="w-full">
        {isProcessing ? (
          <div className="flex items-center">
            <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            Обработка...
          </div>
        ) : (
          `Плати ${orderData.amount.toFixed(2)} лв.`
        )}
      </Button>
    </form>
  )
}
