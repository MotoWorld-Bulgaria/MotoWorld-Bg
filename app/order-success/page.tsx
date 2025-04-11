"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Navbar from "@/components/navbar"
import {
  CheckCircle2,
  Truck,
  MapPin,
  CreditCard,
  Package,
  ArrowRight,
  Download,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import type { Order } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { getAuth } from "firebase/auth"

export default function OrderSuccessPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const paymentIntentId = searchParams.get("payment_intent")

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pollingCount, setPollingCount] = useState(0)

  useEffect(() => {
    if (!user) {
      router.push("/")
      return
    }

    const fetchOrder = async () => {
      try {
        setLoading(true)

        // If we have an order ID, fetch it directly
        if (orderId) {
          const orderDoc = await getDoc(doc(db, "orders", orderId))

          if (orderDoc.exists()) {
            const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order
            setOrder(orderData)
            setPaymentStatus(orderData.paymentDetails?.status || null)
          } else {
            setError("Order not found")
          }
        }
        // If we have a payment intent ID, find the order by payment intent
        else if (paymentIntentId) {
          const ordersRef = collection(db, "orders")
          const snapshot = await getDocs(
            query(ordersRef, where("paymentDetails.transactionId", "==", paymentIntentId), limit(1)),
          )

          if (!snapshot.empty) {
            const orderData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Order
            setOrder(orderData)
            setPaymentStatus(orderData.paymentDetails?.status || null)
          } else {
            setError("Order not found")
          }
        } else {
          setError("No order information provided")
        }
      } catch (err) {
        console.error("Error fetching order:", err)
        setError("Failed to load order details")
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [user, orderId, paymentIntentId, router])

  // Set up real-time listener for order updates
  useEffect(() => {
    if (!order) return

    const unsubscribe = onSnapshot(
      doc(db, "orders", order.id),
      (doc) => {
        if (doc.exists()) {
          const updatedOrder = { id: doc.id, ...doc.data() } as Order
          setOrder(updatedOrder)
          setPaymentStatus(updatedOrder.paymentDetails?.status || null)
        }
      },
      (error) => {
        console.error("Error listening to order updates:", error)
      },
    )

    return () => unsubscribe()
  }, [order])

  // Poll for payment status updates if payment is still pending
  useEffect(() => {
    if (!order || paymentStatus === "completed" || pollingCount >= 10) return

    const pollPaymentStatus = async () => {
      try {
        const auth = getAuth()
        const user = auth.currentUser

        if (!user) return

        const idToken = await user.getIdToken()

        // Check payment status via API
        const response = await fetch(`/api/update-payment-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            paymentIntentId: order.paymentDetails?.transactionId,
            orderId: order.id,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.status === "completed") {
            setPaymentStatus("completed")
          }
        }
      } catch (error) {
        console.error("Error polling payment status:", error)
      } finally {
        setPollingCount((prev) => prev + 1)
      }
    }

    const timer = setTimeout(pollPaymentStatus, 3000) // Poll every 3 seconds
    return () => clearTimeout(timer)
  }, [order, paymentStatus, pollingCount])

  const handleRefreshStatus = async () => {
    if (!order) return

    setRefreshing(true)
    try {
      const orderDoc = await getDoc(doc(db, "orders", order.id))
      if (orderDoc.exists()) {
        const refreshedOrder = { id: orderDoc.id, ...orderDoc.data() } as Order
        setOrder(refreshedOrder)
        setPaymentStatus(refreshedOrder.paymentDetails?.status || null)
      }
    } catch (error) {
      console.error("Error refreshing order status:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const handlePrintInvoice = () => {
    window.print()
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
        </div>
      </>
    )
  }

  if (error || !order) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 min-h-[60vh]">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="h-16 w-16 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Възникна проблем</h1>
            <p className="text-gray-600 mb-6">{error || "Не можахме да намерим информация за вашата поръчка."}</p>
            <Button asChild>
              <Link href="/">Към началната страница</Link>
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
        <div className="max-w-4xl mx-auto">
          {/* Payment Status Alert */}
          {paymentStatus !== "completed" && (
            <Alert className="mb-6" variant={paymentStatus === "failed" ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{paymentStatus === "failed" ? "Проблем с плащането" : "Обработка на плащането"}</AlertTitle>
              <AlertDescription>
                {paymentStatus === "failed"
                  ? "Възникна проблем при обработката на вашето плащане. Моля, опитайте отново или се свържете с нас за съдействие."
                  : "Вашето плащане все още се обработва. Това може да отнеме няколко минути. Страницата ще се обнови автоматично."}
              </AlertDescription>
              <div className="mt-2">
                <Button
                  variant={paymentStatus === "failed" ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Обновяване...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Обнови статуса
                    </>
                  )}
                </Button>
              </div>
            </Alert>
          )}

          {/* Success Header */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Благодарим за поръчката!</h1>
            <p className="text-gray-600 mb-6">
              Вашата поръчка беше успешно обработена. Изпратихме потвърждение на имейла ви.
            </p>
            <div className="text-xl font-semibold mb-2">
              Номер на поръчка: <span className="text-black">{order.orderNumber}</span>
            </div>
            <div className="text-gray-600">Дата на поръчка: {formatDate(order.orderDate || order.createdAt)}</div>
          </div>

          {/* Order Details */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="border-b p-6">
              <h2 className="text-xl font-semibold mb-4">Детайли на поръчката</h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Продукт</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Количество</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Цена</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Общо</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items?.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            {item.image && (
                              <img
                                src={item.image || "/placeholder.svg"}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded mr-3"
                              />
                            )}
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-gray-500">{item.manufacturer}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">{item.quantity}</td>
                        <td className="px-4 py-4 text-right">
                          {typeof item.price === "number" ? item.price.toFixed(2) : item.price} лв.
                        </td>
                        <td className="px-4 py-4 text-right font-medium">
                          {typeof item.price === "number"
                            ? (item.price * item.quantity).toFixed(2)
                            : (Number.parseFloat(item.price) * item.quantity).toFixed(2)}{" "}
                          лв.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-medium">
                        Междинна сума:
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{order.subtotal.toFixed(2)} лв.</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-medium">
                        Доставка:
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {order.shippingCost > 0 ? `${order.shippingCost.toFixed(2)} лв.` : "Безплатно"}
                      </td>
                    </tr>
                    {order.taxAmount != null && order.taxAmount > 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-medium">
                          ДДС:
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{order.taxAmount.toFixed(2)} лв.</td>
                      </tr>
                    )}
                    <tr className="bg-gray-100">
                      <td colSpan={3} className="px-4 py-3 text-right font-bold text-lg">
                        Общо:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-lg">{order.totalAmount.toFixed(2)} лв.</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Customer and Shipping Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Информация за доставка
              </h3>
              <div className="space-y-2">
                <p className="font-medium">
                  {order.shippingDetails?.firstName} {order.shippingDetails?.lastName}
                </p>
                <p>{order.shippingDetails?.address}</p>
                <p>
                  {order.shippingDetails?.city}, {order.shippingDetails?.postalCode}
                </p>
                <p>{order.shippingDetails?.country}</p>
                <p className="mt-4 text-gray-600">
                  <span className="font-medium">Метод на доставка:</span> {order.shippingMethod}
                </p>
                {order.trackingNumber && (
                  <p className="text-gray-600">
                    <span className="font-medium">Номер за проследяване:</span> {order.trackingNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Информация за плащане
              </h3>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Метод на плащане:</span>{" "}
                  {order.paymentDetails?.method === "stripe" ? "Кредитна/Дебитна карта" : order.paymentDetails?.method}
                </p>
                <p>
                  <span className="font-medium">Статус на плащане:</span>{" "}
                  <span
                    className={`${
                      order.paymentDetails?.status === "completed"
                        ? "text-green-600"
                        : order.paymentDetails?.status === "failed"
                          ? "text-red-600"
                          : "text-yellow-600"
                    }`}
                  >
                    {order.paymentDetails?.status === "completed"
                      ? "Платено"
                      : order.paymentDetails?.status === "failed"
                        ? "Неуспешно"
                        : "В обработка"}
                  </span>
                </p>
                {order.paymentCompletedAt && (
                  <p>
                    <span className="font-medium">Дата на плащане:</span> {formatDate(order.paymentCompletedAt)}
                  </p>
                )}
                <p className="mt-4">
                  <span className="font-medium">Имейл:</span> {order.customer?.email}
                </p>
                <p>
                  <span className="font-medium">Телефон:</span> {order.shippingDetails?.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Order Status */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold mb-6 flex items-center">
              <Truck className="w-5 h-5 mr-2" />
              Статус на поръчката
            </h3>

            <div className="relative">
              <div className="absolute left-5 top-0 h-full border-l-2 border-gray-200"></div>

              <div className="relative mb-8">
                <div className="absolute left-5 -ml-3 mt-1.5 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div className="ml-10">
                  <h4 className="font-medium">Поръчката е получена</h4>
                  <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                  <p className="text-sm text-gray-600 mt-1">Вашата поръчка беше успешно получена.</p>
                </div>
              </div>

              <div className="relative mb-8">
                <div
                  className={`absolute left-5 -ml-3 mt-1.5 w-6 h-6 rounded-full ${order.paymentDetails?.status === "completed" ? "bg-green-500" : "bg-gray-300"} flex items-center justify-center`}
                >
                  {order.paymentDetails?.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <div className="ml-10">
                  <h4 className="font-medium">Плащането е обработено</h4>
                  <p className="text-sm text-gray-500">
                    {order.paymentCompletedAt ? formatDate(order.paymentCompletedAt) : "В очакване"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.paymentDetails?.status === "completed"
                      ? "Вашето плащане беше успешно обработено."
                      : "Вашето плащане се обработва."}
                  </p>
                </div>
              </div>

              <div className="relative mb-8">
                <div
                  className={`absolute left-5 -ml-3 mt-1.5 w-6 h-6 rounded-full ${order.status === "processing" || order.status === "shipped" || order.status === "delivered" || order.status === "completed" ? "bg-green-500" : "bg-gray-300"} flex items-center justify-center`}
                >
                  {order.status === "processing" ||
                  order.status === "shipped" ||
                  order.status === "delivered" ||
                  order.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <div className="ml-10">
                  <h4 className="font-medium">Поръчката се обработва</h4>
                  <p className="text-sm text-gray-500">
                    {order.status === "processing" ||
                    order.status === "shipped" ||
                    order.status === "delivered" ||
                    order.status === "completed"
                      ? "В процес"
                      : "В очакване"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.status === "processing" ||
                    order.status === "shipped" ||
                    order.status === "delivered" ||
                    order.status === "completed"
                      ? "Вашата поръчка се подготвя за изпращане."
                      : "Ще започнем обработката на вашата поръчка скоро."}
                  </p>
                </div>
              </div>

              <div className="relative mb-8">
                <div
                  className={`absolute left-5 -ml-3 mt-1.5 w-6 h-6 rounded-full ${order.status === "shipped" || order.status === "delivered" || order.status === "completed" ? "bg-green-500" : "bg-gray-300"} flex items-center justify-center`}
                >
                  {order.status === "shipped" || order.status === "delivered" || order.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <div className="ml-10">
                  <h4 className="font-medium">Поръчката е изпратена</h4>
                  <p className="text-sm text-gray-500">
                    {order.status === "shipped" || order.status === "delivered" || order.status === "completed"
                      ? "Изпратена"
                      : "В очакване"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.status === "shipped" || order.status === "delivered" || order.status === "completed"
                      ? `Вашата поръчка е изпратена${order.trackingNumber ? ` с номер за проследяване ${order.trackingNumber}` : ""}.`
                      : "Ще ви уведомим, когато поръчката ви бъде изпратена."}
                  </p>
                </div>
              </div>

              <div className="relative">
                <div
                  className={`absolute left-5 -ml-3 mt-1.5 w-6 h-6 rounded-full ${order.status === "delivered" || order.status === "completed" ? "bg-green-500" : "bg-gray-300"} flex items-center justify-center`}
                >
                  {order.status === "delivered" || order.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <div className="ml-10">
                  <h4 className="font-medium">Поръчката е доставена</h4>
                  <p className="text-sm text-gray-500">
                    {order.status === "delivered" || order.status === "completed" ? "Доставена" : "В очакване"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.status === "delivered" || order.status === "completed"
                      ? "Вашата поръчка беше успешно доставена."
                      : "Вашата поръчка все още не е доставена."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-4">
            <Button onClick={handlePrintInvoice} variant="outline" className="flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Изтегли фактура
            </Button>

            <Button asChild>
              <Link href="/account" className="flex items-center">
                Моят профил
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link href="/#motorcycles" className="flex items-center">
                <Package className="w-4 h-4 mr-2" />
                Продължи пазаруването
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
