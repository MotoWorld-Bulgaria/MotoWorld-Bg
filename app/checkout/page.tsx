"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useGarage } from "@/lib/garage-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Navbar from "@/components/navbar"
import StripePaymentModal from "@/components/stripe-payment-modal"
import type { ShippingOption, UserData } from "@/lib/types"
import { toast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CreditCard, Truck, MapPin, User, ShoppingBag, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getAuth } from "firebase/auth"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import type { CartItem } from "@/lib/types"

// Shipping options
const shippingOptions: ShippingOption[] = [
  {
    id: "standard",
    name: "Стандартна доставка",
    price: 0,
    estimatedDays: "3-5",
    description: "Доставка до адрес в рамките на 3-5 работни дни",
  },
  {
    id: "express",
    name: "Експресна доставка",
    price: 15,
    estimatedDays: "1-2",
    description: "Доставка до адрес в рамките на 1-2 работни дни",
  },
  {
    id: "pickup",
    name: "Взимане от магазин",
    price: 0,
    estimatedDays: "1",
    description: "Вземете поръчката си от нашия магазин в София",
  },
]

export default function CheckoutPage() {
  const { user } = useAuth()
  const { cartItems, loading: cartLoading, error: cartError, clearGarage } = useGarage()
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [currentStep, setCurrentStep] = useState<"shipping" | "payment" | "review">("shipping")
  const [selectedShipping, setSelectedShipping] = useState<string>("standard")
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [directPurchaseItem, setDirectPurchaseItem] = useState<CartItem | null>(null)

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState("")
  const [orderId, setOrderId] = useState("")
  const [orderNumber, setOrderNumber] = useState("")

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "Bulgaria",
  })

  // Redirect if not logged in or cart is empty
  useEffect(() => {
    if (!cartLoading) {
      if (!user) {
        router.push("/")
        return
      }

      // Check for direct purchase item
      const directItemJson = localStorage.getItem("directPurchaseItem")
      if (directItemJson) {
        try {
          const directItem = JSON.parse(directItemJson)
          setDirectPurchaseItem(directItem)
          // Remove from localStorage to prevent duplicate processing
          localStorage.removeItem("directPurchaseItem")
          setLoading(false)
          return
        } catch (error) {
          console.error("Error parsing direct purchase item:", error)
        }
      }

      // If no direct purchase item, check cart as usual
      if (cartItems.length === 0) {
        router.push("/cart")
        return
      }

      setLoading(false)
    }
  }, [user, cartItems, cartLoading, router])

  // Fetch user data
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          const userDocRef = doc(db, "users", user.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const data = userDoc.data() as UserData
            setUserData(data)

            // Pre-fill form with user data
            setFormData((prev) => ({
              ...prev,
              firstName: data.firstName || "",
              lastName: data.lastName || "",
              email: user.email || "",
              phone: data.phone || "",
              address: data.address || "",
              city: data.city || "",
              postalCode: data.postalCode || "",
              country: data.country || "Bulgaria",
            }))
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      }

      fetchUserData()
    }
  }, [user])

  // Check inventory availability
  useEffect(() => {
    const checkInventory = async () => {
      try {
        const productIds = cartItems.map((item) => `${item.id}:${item.quantity}`).join(",")
        const response = await fetch(`/api/check-inventory?products=${productIds}`)
        const data = await response.json()

        if (!data.available) {
          setInventoryError(data.message)
        } else {
          setInventoryError(null)
        }
      } catch (error) {
        console.error("Error checking inventory:", error)
      }
    }

    if (cartItems.length > 0) {
      checkInventory()
    }
  }, [cartItems])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // Calculate order subtotal
  const calculateSubtotal = () => {
    if (directPurchaseItem) {
      const price =
        typeof directPurchaseItem.price === "string"
          ? Number.parseFloat(directPurchaseItem.price)
          : directPurchaseItem.price
      return price * directPurchaseItem.quantity
    }

    return cartItems.reduce((total, item) => {
      const price = typeof item.price === "string" ? Number.parseFloat(item.price) : item.price
      return total + price * item.quantity
    }, 0)
  }

  // Get selected shipping option
  const getSelectedShippingOption = () => {
    return shippingOptions.find((option) => option.id === selectedShipping) || shippingOptions[0]
  }

  // Calculate order total
  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const shippingCost = getSelectedShippingOption().price
    return subtotal + shippingCost
  }

  // Validate shipping form
  const validateShippingForm = () => {
    const requiredFields = ["firstName", "lastName", "email", "phone", "address", "city", "postalCode"]
    const missingFields = requiredFields.filter((field) => !formData[field as keyof typeof formData])

    if (missingFields.length > 0) {
      toast({
        title: "Непопълнени полета",
        description: "Моля, попълнете всички задължителни полета.",
        variant: "destructive",
      })
      return false
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Невалиден имейл",
        description: "Моля, въведете валиден имейл адрес.",
        variant: "destructive",
      })
      return false
    }

    // Validate phone format (simple validation)
    const phoneRegex = /^[0-9+\s()-]{8,15}$/
    if (!phoneRegex.test(formData.phone)) {
      toast({
        title: "Невалиден телефон",
        description: "Моля, въведете валиден телефонен номер.",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  // Handle next step
  const handleNextStep = () => {
    if (currentStep === "shipping") {
      if (!validateShippingForm()) return
      setCurrentStep("payment")
    } else if (currentStep === "payment") {
      setCurrentStep("review")
    }
  }

  // Handle previous step
  const handlePrevStep = () => {
    if (currentStep === "payment") {
      setCurrentStep("shipping")
    } else if (currentStep === "review") {
      setCurrentStep("payment")
    }
  }

  // Create order and initiate payment
  const handleCheckout = async () => {
    if (!user || inventoryError) return

    setProcessingPayment(true)

    try {
      const auth = getAuth()
      const user = auth.currentUser

      if (!user) throw new Error("User not authenticated")

      const idToken = await user.getIdToken()

      // Prepare items array - either direct purchase item or cart items
      const itemsToOrder = directPurchaseItem ? [directPurchaseItem] : cartItems

      // First create the order in Firebase
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: itemsToOrder,
          userData: {
            ...formData,
            uid: user.uid,
          },
          shippingOption: getSelectedShippingOption(),
          paymentDetails: {
            method: "stripe",
            status: "pending",
          },
          orderTotal: calculateTotal(),
          directPurchase: !!directPurchaseItem,
        }),
      })

      const orderResult = await orderResponse.json()
      if (orderResult.error) throw new Error(orderResult.error)

      // Store the order ID for later use
      setOrderId(orderResult.orderId)
      setOrderNumber(orderResult.orderNumber)

      // Create a payment intent
      const paymentIntentResponse = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orderId: orderResult.orderId,
          returnUrl: `${window.location.origin}/order-success`,
        }),
      })

      const paymentIntentResult = await paymentIntentResponse.json()

      if (paymentIntentResult.error) {
        throw new Error(paymentIntentResult.error)
      }

      // Set the client secret and open the payment modal
      setClientSecret(paymentIntentResult.clientSecret)
      setIsPaymentModalOpen(true)
    } catch (error) {
      console.error("Error processing checkout:", error)
      toast({
        title: "Грешка при обработката",
        description: "Възникна проблем при създаването на поръчката. Моля, опитайте отново.",
        variant: "destructive",
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      const auth = getAuth()
      const user = auth.currentUser

      if (!user) throw new Error("User not authenticated")

      const idToken = await user.getIdToken()

      // Update the order with payment success
      const updateResponse = await fetch("/api/update-payment-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          paymentIntentId,
          orderId,
        }),
      })

      const updateResult = await updateResponse.json()

      if (updateResult.success) {
        // Clear the cart if not a direct purchase
        if (!directPurchaseItem) {
          await clearGarage()
        }

        // Close the modal and redirect to success page
        setTimeout(() => {
          setIsPaymentModalOpen(false)
          router.push(`/order-success?order_id=${orderId}`)
        }, 2000)
      } else {
        throw new Error(updateResult.message || "Failed to update payment status")
      }
    } catch (error) {
      console.error("Error handling payment success:", error)
      toast({
        title: "Грешка при обработката",
        description: "Плащането е успешно, но възникна проблем при обновяването на поръчката.",
        variant: "destructive",
      })
    }
  }

  // Handle payment error
  const handlePaymentError = (error: string) => {
    console.error("Payment error:", error)
    toast({
      title: "Грешка при плащането",
      description: "Възникна проблем при обработката на плащането. Моля, опитайте отново.",
      variant: "destructive",
    })
  }

  if (loading || cartLoading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
        </div>
      </>
    )
  }

  if (cartError) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Alert variant="destructive">
            <AlertTitle>Грешка при зареждане на гаража</AlertTitle>
            <AlertDescription>
              Възникна проблем при зареждането на вашия гараж. Моля, опитайте отново по-късно.
            </AlertDescription>
          </Alert>
          <div className="text-center mt-8">
            <Button asChild>
              <Link href="/cart">Обратно към гаража</Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center mb-8">
            <Link href="/cart" className="flex items-center text-gray-600 hover:text-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Обратно към гаража</span>
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-8 text-center">Завършване на поръчката</h1>

          {/* Checkout Steps */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div
                className={`flex flex-col items-center ${currentStep === "shipping" ? "text-black" : "text-gray-400"}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${currentStep === "shipping" ? "bg-black text-white" : "bg-gray-200 text-gray-500"}`}
                >
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-sm">Доставка</span>
              </div>

              <div className="flex-1 h-1 mx-2 bg-gray-200">
                <div
                  className={`h-full bg-black ${currentStep === "shipping" ? "w-0" : currentStep === "payment" ? "w-1/2" : "w-full"} transition-all duration-300`}
                ></div>
              </div>

              <div
                className={`flex flex-col items-center ${currentStep === "payment" ? "text-black" : currentStep === "review" ? "text-black" : "text-gray-400"}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${currentStep === "payment" || currentStep === "review" ? "bg-black text-white" : "bg-gray-200 text-gray-500"}`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-sm">Плащане</span>
              </div>

              <div className="flex-1 h-1 mx-2 bg-gray-200">
                <div
                  className={`h-full bg-black ${currentStep === "review" ? "w-full" : "w-0"} transition-all duration-300`}
                ></div>
              </div>

              <div
                className={`flex flex-col items-center ${currentStep === "review" ? "text-black" : "text-gray-400"}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${currentStep === "review" ? "bg-black text-white" : "bg-gray-200 text-gray-500"}`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-sm">Преглед</span>
              </div>
            </div>
          </div>

          {inventoryError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Проблем с наличността</p>
                <p className="text-sm">{inventoryError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Shipping Information Step */}
                {currentStep === "shipping" && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center">
                      <MapPin className="w-5 h-5 mr-2" />
                      Информация за доставка
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <Label htmlFor="firstName">Име *</Label>
                        <Input
                          type="text"
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="lastName">Фамилия *</Label>
                        <Input
                          type="text"
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">Имейл *</Label>
                        <Input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone">Телефон *</Label>
                        <Input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="address">Адрес *</Label>
                        <Input
                          type="text"
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="city">Град *</Label>
                        <Input
                          type="text"
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="postalCode">Пощенски код *</Label>
                        <Input
                          type="text"
                          id="postalCode"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="country">Държава *</Label>
                        <select
                          id="country"
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-black focus:border-transparent"
                          required
                        >
                          <option value="Bulgaria">България</option>
                          <option value="Romania">Румъния</option>
                          <option value="Greece">Гърция</option>
                          <option value="Serbia">Сърбия</option>
                          <option value="North Macedonia">Северна Македония</option>
                        </select>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Truck className="w-5 h-5 mr-2" />
                      Метод на доставка
                    </h3>

                    <RadioGroup value={selectedShipping} onValueChange={setSelectedShipping} className="mb-6">
                      {shippingOptions.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-start space-x-2 p-3 rounded border mb-2 hover:bg-gray-50"
                        >
                          <RadioGroupItem value={option.id} id={`shipping-${option.id}`} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={`shipping-${option.id}`} className="flex justify-between cursor-pointer">
                              <span>{option.name}</span>
                              <span>{option.price > 0 ? `${option.price.toFixed(2)} лв.` : "Безплатно"}</span>
                            </Label>
                            <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                            <p className="text-sm text-gray-500">
                              Очаквана доставка: {option.estimatedDays} {option.estimatedDays === "1" ? "ден" : "дни"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>

                    <div className="flex justify-end">
                      <Button onClick={handleNextStep} disabled={inventoryError !== null}>
                        Продължи към плащане
                      </Button>
                    </div>
                  </div>
                )}

                {/* Payment Method Step */}
                {currentStep === "payment" && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center">
                      <CreditCard className="w-5 h-5 mr-2" />
                      Метод на плащане
                    </h2>

                    <div className="bg-gray-50 p-4 rounded border">
                      <RadioGroup value="card" onValueChange={() => {}}>
                        <div className="flex items-center mb-4">
                          <RadioGroupItem value="card" id="payment-card" className="mr-2" />
                          <Label htmlFor="payment-card" className="cursor-pointer">
                            Кредитна/Дебитна карта
                          </Label>
                        </div>
                      </RadioGroup>

                      <p className="text-sm text-gray-600 mb-4">
                        Сигурно плащане чрез Stripe. Вашите данни за плащане са защитени и никога не се съхраняват на
                        нашите сървъри.
                      </p>

                      <div className="flex space-x-2 mt-3">
                        <img src="/images/payment/visa.png" alt="Visa" className="h-8" />
                        <img src="/images/payment/mastercard.png" alt="Mastercard" className="h-8" />
                      </div>
                    </div>

                    <div className="flex justify-between mt-6">
                      <Button variant="outline" onClick={handlePrevStep}>
                        Назад
                      </Button>
                      <Button onClick={handleNextStep} disabled={inventoryError !== null}>
                        Продължи към преглед
                      </Button>
                    </div>
                  </div>
                )}

                {/* Review Order Step */}
                {currentStep === "review" && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Преглед на поръчката
                    </h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium flex items-center mb-2">
                          <User className="w-4 h-4 mr-2" />
                          Информация за клиента
                        </h3>
                        <div className="bg-gray-50 p-3 rounded">
                          <p>
                            {formData.firstName} {formData.lastName}
                          </p>
                          <p>{formData.email}</p>
                          <p>{formData.phone}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium flex items-center mb-2">
                          <MapPin className="w-4 h-4 mr-2" />
                          Адрес за доставка
                        </h3>
                        <div className="bg-gray-50 p-3 rounded">
                          <p>{formData.address}</p>
                          <p>
                            {formData.city}, {formData.postalCode}
                          </p>
                          <p>{formData.country}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium flex items-center mb-2">
                          <Truck className="w-4 h-4 mr-2" />
                          Метод на доставка
                        </h3>
                        <div className="bg-gray-50 p-3 rounded">
                          <p>{getSelectedShippingOption().name}</p>
                          <p className="text-sm text-gray-500">
                            Очаквана доставка: {getSelectedShippingOption().estimatedDays}{" "}
                            {getSelectedShippingOption().estimatedDays === "1" ? "ден" : "дни"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium flex items-center mb-2">
                          <CreditCard className="w-4 h-4 mr-2" />
                          Метод на плащане
                        </h3>
                        <div className="bg-gray-50 p-3 rounded">
                          <div className="flex items-center">
                            <span>Кредитна/Дебитна карта</span>
                            <div className="flex space-x-2 ml-2">
                              <img src="/images/payment/visa.png" alt="Visa" className="h-6" />
                              <img src="/images/payment/mastercard.png" alt="Mastercard" className="h-6" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium flex items-center mb-2">
                          <ShoppingBag className="w-4 h-4 mr-2" />
                          Продукти
                        </h3>
                        <div className="bg-gray-50 p-3 rounded">
                          {directPurchaseItem ? (
                            <div className="flex justify-between py-2">
                              <div className="flex items-center">
                                <span className="font-medium">{directPurchaseItem.name}</span>
                                <span className="text-gray-500 text-sm ml-2">x{directPurchaseItem.quantity}</span>
                              </div>
                              <span>
                                {(
                                  (typeof directPurchaseItem.price === "string"
                                    ? Number.parseFloat(directPurchaseItem.price)
                                    : directPurchaseItem.price) * directPurchaseItem.quantity
                                ).toFixed(2)}{" "}
                                лв.
                              </span>
                            </div>
                          ) : (
                            cartItems.map((item) => (
                              <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
                                <div className="flex items-center">
                                  <span className="font-medium">{item.name}</span>
                                  <span className="text-gray-500 text-sm ml-2">x{item.quantity}</span>
                                </div>
                                <span>{(item.price * item.quantity).toFixed(2)} лв.</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between mt-6">
                      <Button variant="outline" onClick={handlePrevStep}>
                        Назад
                      </Button>
                      <Button onClick={handleCheckout} disabled={processingPayment || inventoryError !== null}>
                        {processingPayment ? (
                          <>
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            Обработка...
                          </>
                        ) : (
                          "Завърши поръчката"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
                <h2 className="text-xl font-semibold mb-4">Резюме на поръчката</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between">
                    <span>Брой продукти:</span>
                    <span>
                      {directPurchaseItem
                        ? directPurchaseItem.quantity
                        : cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Междинна сума:</span>
                    <span>{calculateSubtotal().toFixed(2)} лв.</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Доставка:</span>
                    <span>
                      {getSelectedShippingOption().price > 0
                        ? `${getSelectedShippingOption().price.toFixed(2)} лв.`
                        : "Безплатно"}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center font-bold text-lg mt-4">
                    <span>Общо:</span>
                    <span>{calculateTotal().toFixed(2)} лв.</span>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      ></path>
                    </svg>
                    Защитено плащане
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stripe Payment Modal */}
      {isPaymentModalOpen && clientSecret && (
        <StripePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          clientSecret={clientSecret}
          orderData={{
            orderId,
            orderNumber,
            amount: calculateTotal(),
            returnUrl: `${window.location.origin}/order-success`,
          }}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
        />
      )}
    </>
  )
}
