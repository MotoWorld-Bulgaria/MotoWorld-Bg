"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Navbar from "@/components/navbar"
import OrderModal from "@/components/order-modal"
import type { Order, UserData } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, getStatusText, getPaymentStatusText, getStatusColor, getPaymentStatusColor } from "@/lib/utils"
import { CreditCard, Package, ShoppingBag, Truck, AlertCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
// First, let's import the StripePaymentModal component
import StripePaymentModal from "@/components/stripe-payment-modal"

export default function AccountPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [isImageEditOpen, setIsImageEditOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  // Add these state variables to the component's state declarations (around line 25)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState("")
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [processingOrder, setProcessingOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!user) {
      router.push("/")
      return
    }

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          setUserData(userDoc.data() as UserData)
        } else {
          console.error("User document does not exist")
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
      }
    }

    const fetchOrders = async () => {
      try {
        setLoading(true)

        const ordersQuery = query(collection(db, "orders"), where("customer.uid", "==", user.uid))
        const ordersSnapshot = await getDocs(ordersQuery)

        const ordersData: Order[] = []
        const unpaidOrdersData: Order[] = []

        ordersSnapshot.forEach((doc) => {
          const orderData = { id: doc.id, ...doc.data() } as Order
          ordersData.push(orderData)

          // Check if order is unpaid
          if (orderData.paymentDetails?.status !== "completed") {
            unpaidOrdersData.push(orderData)
          }
        })

        // Sort orders by date (newest first)
        ordersData.sort((a, b) => {
          const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime() / 1000
          const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime() / 1000
          return dateB - dateA
        })

        setOrders(ordersData)
        setUnpaidOrders(unpaidOrdersData)
      } catch (error) {
        console.error("Error fetching orders:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
    fetchOrders()
  }, [user, router])

  const handleEditField = (field: string) => {
    setEditingField(field)
  }

  const handleCancelEdit = () => {
    setEditingField(null)
  }

  const handleSaveField = async (field: string, value: string) => {
    if (!user || !userData) return

    try {
      // Add age validation
      if (field === "age") {
        const age = Number.parseInt(value)
        if (isNaN(age) || age < 16 || age > 120) {
          alert("Възрастта трябва да бъде между 16 и 120 години")
          return
        }
      }

      const userDocRef = doc(db, "users", user.uid)
      await updateDoc(userDocRef, { [field]: value })

      setUserData({ ...userData, [field]: value })
      setEditingField(null)
    } catch (error) {
      console.error(`Error updating ${field}:`, error)
    }
  }

  const handleEditImage = () => {
    setIsImageEditOpen(true)
  }

  const handleSaveImage = async () => {
    if (!user || !userData || !imageUrl) return

    try {
      const userDocRef = doc(db, "users", user.uid)
      await updateDoc(userDocRef, { photoURL: imageUrl })

      setUserData({ ...userData, photoURL: imageUrl })
      setIsImageEditOpen(false)
      setImageUrl("")
    } catch (error) {
      console.error("Error updating profile image:", error)
    }
  }

  const handleCancelImage = () => {
    setIsImageEditOpen(false)
    setImageUrl("")
  }

  const handleOpenOrderModal = (order: Order) => {
    setSelectedOrder(order)
    setIsModalOpen(true)
  }

  const handleCloseOrderModal = () => {
    setIsModalOpen(false)
    setSelectedOrder(null)
  }

  // Replace the existing handlePayNow function with this implementation
  const handlePayNow = async (order: Order) => {
    try {
      setProcessingOrderId(order.id)
      setProcessingOrder(order)

      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          returnUrl: `${window.location.origin}/account`,
        }),
      })

      if (response.ok) {
        const { clientSecret } = await response.json()
        setClientSecret(clientSecret)
        setIsPaymentModalOpen(true)
      } else {
        throw new Error("Failed to create payment intent")
      }
    } catch (error) {
      console.error("Error creating payment intent:", error)
      toast({
        title: "Грешка при създаването на плащане",
        description: "Възникна проблем при създаването на плащане. Моля, опитайте отново по-късно.",
        variant: "destructive",
      })
    }
  }

  // Add these handler functions for the payment modal
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      if (!processingOrderId) return

      const response = await fetch("/api/update-payment-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          paymentIntentId,
          orderId: processingOrderId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Плащането е успешно",
          description: "Вашето плащане беше успешно обработено.",
        })

        // Refresh orders data
        const fetchOrders = async () => {
          try {
            const ordersQuery = query(collection(db, "orders"), where("customer.uid", "==", user.uid))
            const ordersSnapshot = await getDocs(ordersQuery)

            const ordersData: Order[] = []
            const unpaidOrdersData: Order[] = []

            ordersSnapshot.forEach((doc) => {
              const orderData = { id: doc.id, ...doc.data() } as Order
              ordersData.push(orderData)

              // Check if order is unpaid
              if (orderData.paymentDetails?.status !== "completed") {
                unpaidOrdersData.push(orderData)
              }
            })

            // Sort orders by date (newest first)
            ordersData.sort((a, b) => {
              const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime() / 1000
              const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime() / 1000
              return dateB - dateA
            })

            setOrders(ordersData)
            setUnpaidOrders(unpaidOrdersData)
          } catch (error) {
            console.error("Error fetching orders:", error)
          }
        }
        fetchOrders()

        // Close modal after a short delay
        setTimeout(() => {
          setIsPaymentModalOpen(false)
          setProcessingOrderId(null)
          setProcessingOrder(null)
        }, 2000)
      } else {
        throw new Error(result.message || "Failed to update payment status")
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

  const handlePaymentError = (error: string) => {
    console.error("Payment error:", error)
    toast({
      title: "Грешка при плащането",
      description: "Възникна проблем при обработката на плащането. Моля, опитайте отново.",
      variant: "destructive",
    })
    setIsPaymentModalOpen(false)
    setProcessingOrderId(null)
    setProcessingOrder(null)
  }

  if (!user || loading) {
    return <div className="flex justify-center items-center h-screen">Зареждане...</div>
  }

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="profile">Профил</TabsTrigger>
            <TabsTrigger value="orders" className="relative">
              Поръчки
              {unpaidOrders.length > 0 && <Badge className="ml-2 bg-red-500">{unpaidOrders.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Profile Sidebar */}
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <img
                    src={
                      userData?.photoURL || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
                    }
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full border-4 border-gray-800"
                  />
                </div>

                {isImageEditOpen ? (
                  <div className="mb-4">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Въведете URL на снимката"
                      className="w-full p-2 border rounded mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveImage}
                        className="flex-1 bg-black text-white py-2 px-4 rounded hover:bg-gray-800"
                      >
                        <i className="fas fa-check mr-2"></i> Запази
                      </button>
                      <button
                        onClick={handleCancelImage}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
                      >
                        <i className="fas fa-times mr-2"></i> Отказ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleEditImage}
                    className="w-full bg-gray-100 text-gray-800 border border-gray-300 py-2 px-4 rounded mb-4 hover:bg-gray-200 flex items-center justify-center"
                  >
                    <i className="fas fa-image mr-2"></i> Смени Профилна Снимка
                  </button>
                )}

                <h2 className="text-xl font-semibold mb-2">
                  <span className="font-normal text-gray-600">Здравей, </span>
                  <span>{userData?.displayName || "Потребител"}</span>
                </h2>

                <p className="text-gray-600 text-sm mb-6">
                  Член от {new Date(user.metadata.creationTime || Date.now()).toLocaleDateString()}
                </p>

                {/* Removing the border-t and all orders content here */}
              </div>

              {/* Profile Content */}
              <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
                <h3 className="text-xl font-semibold mb-6">Информация за профила</h3>

                <div className="space-y-6">
                  <div className="border-b pb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Потребителско име</label>
                    {editingField === "displayName" ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          defaultValue={userData?.displayName || ""}
                          className="flex-1 p-2 border rounded"
                          id="displayNameInput"
                        />
                        <button
                          onClick={() =>
                            handleSaveField(
                              "displayName",
                              (document.getElementById("displayNameInput") as HTMLInputElement).value,
                            )
                          }
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-save"></i>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-200 text-gray-800 py-1 px-3 rounded hover:bg-gray-300"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>{userData?.displayName || "Не е зададено"}</span>
                        <button
                          onClick={() => handleEditField("displayName")}
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-b pb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Име</label>
                    {editingField === "firstName" ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          defaultValue={userData?.firstName || ""}
                          className="flex-1 p-2 border rounded"
                          id="firstNameInput"
                        />
                        <button
                          onClick={() =>
                            handleSaveField(
                              "firstName",
                              (document.getElementById("firstNameInput") as HTMLInputElement).value,
                            )
                          }
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-save"></i>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-200 text-gray-800 py-1 px-3 rounded hover:bg-gray-300"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>{userData?.firstName || "Не е зададено"}</span>
                        <button
                          onClick={() => handleEditField("firstName")}
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-b pb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Фамилия</label>
                    {editingField === "lastName" ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          defaultValue={userData?.lastName || ""}
                          className="flex-1 p-2 border rounded"
                          id="lastNameInput"
                        />
                        <button
                          onClick={() =>
                            handleSaveField(
                              "lastName",
                              (document.getElementById("lastNameInput") as HTMLInputElement).value,
                            )
                          }
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-save"></i>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-200 text-gray-800 py-1 px-3 rounded hover:bg-gray-300"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>{userData?.lastName || "Не е зададено"}</span>
                        <button
                          onClick={() => handleEditField("lastName")}
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-b pb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Възраст</label>
                    {editingField === "age" ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          defaultValue={userData?.age || ""}
                          min="16"
                          max="120"
                          className="flex-1 p-2 border rounded"
                          id="ageInput"
                          placeholder="Минимум 16 години"
                        />
                        <button
                          onClick={() =>
                            handleSaveField("age", (document.getElementById("ageInput") as HTMLInputElement).value)
                          }
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-save"></i>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-200 text-gray-800 py-1 px-3 rounded hover:bg-gray-300"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>{userData?.age || "Не е зададено"}</span>
                        <button
                          onClick={() => handleEditField("age")}
                          className="bg-black text-white py-1 px-3 rounded hover:bg-gray-800"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Имейл</label>
                    <p className="text-gray-800">{user.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold mb-6">Моите поръчки</h3>

              {unpaidOrders.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        Имате {unpaidOrders.length} неплатени поръчки. Моля, завършете плащането, за да продължим с
                        обработката им.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {orders.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">Все още нямате поръчки</p>
                  <Button asChild>
                    <Link href="/#motorcycles">Разгледай мотоциклети</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Unpaid Orders Section */}
                  {unpaidOrders.length > 0 && (
                    <>
                      <h4 className="text-lg font-medium text-red-600 mt-4">Неплатени поръчки</h4>
                      {unpaidOrders.map((order) => (
                        <Card key={order.id} className="overflow-hidden border-red-200">
                          <CardHeader className="bg-gray-50 pb-4">
                            <div className="flex flex-wrap justify-between items-center">
                              <div>
                                <CardTitle className="text-lg">
                                  Поръчка #{order.orderNumber || order.id.substring(0, 8)}
                                </CardTitle>
                                <CardDescription>{formatDate(order.createdAt)}</CardDescription>
                              </div>
                              <Badge className={getPaymentStatusColor(order.paymentDetails?.status || "pending")}>
                                {getPaymentStatusText(order.paymentDetails?.status || "pending")}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row gap-6">
                              <div className="md:w-1/4">
                                {order.productDetails?.image ? (
                                  <img
                                    src={order.productDetails.image || "/placeholder.svg"}
                                    alt={order.productDetails.name}
                                    className="w-full h-auto object-cover rounded-md"
                                  />
                                ) : (
                                  <div className="w-full h-32 bg-gray-200 rounded-md flex items-center justify-center">
                                    <Package className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="md:w-3/4">
                                <h4 className="font-semibold text-lg mb-2">{order.productDetails?.name}</h4>
                                <p className="text-gray-600 mb-4">{order.productDetails?.manufacturer}</p>

                                <div className="flex justify-between items-center border-t pt-4">
                                  <div className="font-semibold">Общо: {Number(order.totalAmount).toFixed(2)} лв.</div>
                                  <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => handleOpenOrderModal(order)}>
                                      Детайли
                                    </Button>
                                    <Button onClick={() => handlePayNow(order)}>Плати сега</Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      <div className="border-b border-gray-200 my-6"></div>
                    </>
                  )}

                  {/* Paid Orders Section */}
                  {orders.filter((order) => order.paymentDetails?.status === "completed").length > 0 && (
                    <>
                      <h4 className="text-lg font-medium text-gray-900">Всички поръчки</h4>
                      {orders.map((order) => (
                        <Card key={order.id} className="overflow-hidden">
                          <CardHeader className="bg-gray-50 pb-4">
                            <div className="flex flex-wrap justify-between items-center">
                              <div>
                                <CardTitle className="text-lg">
                                  Поръчка #{order.orderNumber || order.id.substring(0, 8)}
                                </CardTitle>
                                <CardDescription>{formatDate(order.createdAt)}</CardDescription>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
                                <Badge className={getStatusColor(order.status)}>{getStatusText(order.status)}</Badge>
                                <Badge className={getPaymentStatusColor(order.paymentDetails?.status || "pending")}>
                                  {getPaymentStatusText(order.paymentDetails?.status || "pending")}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row gap-6">
                              <div className="md:w-1/4">
                                {order.productDetails?.image ? (
                                  <img
                                    src={order.productDetails.image || "/placeholder.svg"}
                                    alt={order.productDetails.name}
                                    className="w-full h-auto object-cover rounded-md"
                                  />
                                ) : (
                                  <div className="w-full h-32 bg-gray-200 rounded-md flex items-center justify-center">
                                    <Package className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="md:w-3/4">
                                <h4 className="font-semibold text-lg mb-2">{order.productDetails?.name}</h4>
                                <p className="text-gray-600 mb-4">{order.productDetails?.manufacturer}</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <h5 className="font-medium text-sm text-gray-500 mb-1">Статус на доставка</h5>
                                    <div className="flex items-center">
                                      <Truck className="w-4 h-4 mr-2 text-gray-600" />
                                      <span>{getStatusText(order.status)}</span>
                                    </div>
                                    {order.trackingNumber && (
                                      <p className="text-sm mt-1">Номер за проследяване: {order.trackingNumber}</p>
                                    )}
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-sm text-gray-500 mb-1">Плащане</h5>
                                    <div className="flex items-center">
                                      <CreditCard className="w-4 h-4 mr-2 text-gray-600" />
                                      <span>{getPaymentStatusText(order.paymentDetails?.status || "pending")}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center border-t pt-4">
                                  <div className="font-semibold">Общо: {Number(order.totalAmount).toFixed(2)} лв.</div>
                                  <Button onClick={() => handleOpenOrderModal(order)}>Детайли</Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {isModalOpen && selectedOrder && <OrderModal order={selectedOrder} onClose={handleCloseOrderModal} />}
      {isPaymentModalOpen && clientSecret && processingOrder && (
        <StripePaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          clientSecret={clientSecret}
          orderData={{
            orderId: processingOrder.id,
            orderNumber: processingOrder.orderNumber || processingOrder.id.substring(0, 8),
            amount: processingOrder.totalAmount,
            returnUrl: `${window.location.origin}/account`,
          }}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
        />
      )}
    </>
  )
}
