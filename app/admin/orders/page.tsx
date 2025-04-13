"use client"

import { Label } from "@/components/ui/label"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Navbar from "@/components/navbar"
import type { Order } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import {
  Search,
  MoreHorizontal,
  RefreshCw,
  FileText,
  Calendar,
  User,
  CreditCard,
  Package,
  Filter,
  ArrowUpDown,
  Eye,
  Edit,
  Trash,
  Send,
  MapPin,
} from "lucide-react"
import { formatDate, getStatusText, getPaymentStatusText, getStatusColor, getPaymentStatusColor } from "@/lib/utils"

// Stripe API integration for payment information
import { loadStripe } from "@stripe/stripe-js"
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)

export default function OrdersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [sortField, setSortField] = useState<string>("createdAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [editFormData, setEditFormData] = useState({
    status: "",
    trackingNumber: "",
    notes: "",
    estimatedDeliveryDate: "",
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    if (!user) {
      router.push("/")
      return
    }

    // Check if user is admin
    if (user.uid !== "ZXduWaLnwuVPlKPvZm0FyoDeaXs2") {
      router.push("/")
      return
    }

    fetchOrders()
  }, [user, router])

  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, statusFilter, paymentStatusFilter, dateFilter, activeTab, sortField, sortDirection])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setIsRefreshing(true)

      // Create a query with ordering
      const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"))

      const ordersSnapshot = await getDocs(ordersQuery)
      const ordersList = ordersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[]

      // Fetch payment information from Stripe for each order
      for (const order of ordersList) {
        if (order.checkoutSessionId) {
          try {
            // We'll use our backend API to fetch Stripe data
            const response = await fetch(`/api/get-payment-status?sessionId=${order.checkoutSessionId}`)
            if (response.ok) {
              const paymentData = await response.json()

              // Update order with payment information
              if (paymentData.status) {
                order.paymentDetails = {
                  method: "stripe",
                  ...order.paymentDetails,
                  status: paymentData.status as "pending" | "processing" | "completed" | "failed" | "refunded",
                  paymentDate: paymentData.created,
                  amount: paymentData.amount_total ? paymentData.amount_total / 100 : order.totalAmount,
                  currency: paymentData.currency || "bgn",
                  paymentMethod: paymentData.payment_method_types?.[0] || "card",
                }
              }
            }
          } catch (error) {
            console.error("Error fetching payment data for order:", order.id, error)
          }
        }
      }

      setOrders(ordersList)
      setLoading(false)
      setIsRefreshing(false)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setLoading(false)
      setIsRefreshing(false)
      toast({
        title: "Грешка",
        description: "Възникна проблем при зареждането на поръчките.",
        variant: "destructive",
      })
    }
  }

  const filterOrders = () => {
    let filtered = [...orders]

    // Filter by tab
    if (activeTab !== "all") {
      filtered = filtered.filter((order) => {
        if (activeTab === "pending") return order.status === "pending"
        if (activeTab === "processing") return order.status === "processing"
        if (activeTab === "shipped") return order.status === "shipped"
        if (activeTab === "delivered") return order.status === "delivered"
        if (activeTab === "completed") return order.status === "completed"
        if (activeTab === "cancelled") return order.status === "cancelled"
        if (activeTab === "unpaid") return order.paymentDetails?.status !== "completed"
        return true
      })
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.customer?.email?.toLowerCase().includes(term) ||
          order.customer?.displayName?.toLowerCase().includes(term) ||
          order.customer?.firstName?.toLowerCase().includes(term) ||
          order.customer?.lastName?.toLowerCase().includes(term) ||
          order.productDetails?.name?.toLowerCase().includes(term) ||
          order.orderNumber?.toLowerCase().includes(term) ||
          order.id.toLowerCase().includes(term),
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Apply payment status filter
    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter((order) => order.paymentDetails?.status === paymentStatusFilter)
    }

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const lastWeek = new Date(today)
      lastWeek.setDate(lastWeek.getDate() - 7)
      const lastMonth = new Date(today)
      lastMonth.setMonth(lastMonth.getMonth() - 1)

      filtered = filtered.filter((order) => {
        const orderDate = order.createdAt?.seconds
          ? new Date(order.createdAt.seconds * 1000)
          : new Date(order.createdAt)

        if (dateFilter === "today") {
          return orderDate >= today
        } else if (dateFilter === "yesterday") {
          return orderDate >= yesterday && orderDate < today
        } else if (dateFilter === "last7days") {
          return orderDate >= lastWeek
        } else if (dateFilter === "last30days") {
          return orderDate >= lastMonth
        }
        return true
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let valueA, valueB

      // Handle different field types
      if (sortField === "createdAt" || sortField === "orderDate") {
        valueA = a[sortField]?.seconds ? a[sortField].seconds : new Date(a[sortField]).getTime()
        valueB = b[sortField]?.seconds ? b[sortField].seconds : new Date(b[sortField]).getTime()
      } else if (sortField === "totalAmount") {
        valueA = a.totalAmount || 0
        valueB = b.totalAmount || 0
      } else if (sortField === "customer") {
        valueA = `${a.customer?.firstName || ""} ${a.customer?.lastName || ""}`.toLowerCase()
        valueB = `${b.customer?.firstName || ""} ${b.customer?.lastName || ""}`.toLowerCase()
      } else if (sortField === "status") {
        valueA = a.status || ""
        valueB = b.status || ""
      } else if (sortField === "paymentStatus") {
        valueA = a.paymentDetails?.status || ""
        valueB = b.paymentDetails?.status || ""
      } else {
        valueA = a[sortField as keyof Order] || ""
        valueB = b[sortField as keyof Order] || ""
      }

      // Compare based on direction
      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })

    setFilteredOrders(filtered)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
  }

  const handlePaymentStatusFilterChange = (value: string) => {
    setPaymentStatusFilter(value)
  }

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsViewDialogOpen(true)
  }

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order)
    setEditFormData({
      status: order.status,
      trackingNumber: order.trackingNumber || "",
      notes: order.notes || "",
      estimatedDeliveryDate: order.estimatedDeliveryDate
        ? order.estimatedDeliveryDate.seconds
          ? new Date(order.estimatedDeliveryDate.seconds * 1000).toISOString().split("T")[0]
          : new Date(order.estimatedDeliveryDate).toISOString().split("T")[0]
        : "",
    })
    setIsEditDialogOpen(true)
  }

  const handleDeleteOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsDeleteDialogOpen(true)
  }

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleEditFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        status: editFormData.status as "pending" | "processing" | "completed" | "cancelled" | "shipped" | "delivered",
        trackingNumber: editFormData.trackingNumber,
        notes: editFormData.notes,
        estimatedDeliveryDate: editFormData.estimatedDeliveryDate
          ? new Date(editFormData.estimatedDeliveryDate).toISOString()
          : null,
        updatedAt: new Date().toISOString(),
      })

      // Update local state
      setOrders(
        orders.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                status: editFormData.status as "pending" | "processing" | "completed" | "cancelled" | "shipped" | "delivered",
                trackingNumber: editFormData.trackingNumber,
                notes: editFormData.notes,
                estimatedDeliveryDate: editFormData.estimatedDeliveryDate
                  ? new Date(editFormData.estimatedDeliveryDate).toISOString()
                  : null,
                updatedAt: new Date().toISOString(),
              }
            : order,
        ),
      )

      setIsEditDialogOpen(false)
      toast({
        title: "Успешно обновяване",
        description: "Поръчката беше успешно обновена.",
      })
    } catch (error) {
      console.error("Error updating order:", error)
      toast({
        title: "Грешка",
        description: "Възникна проблем при обновяването на поръчката.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedOrder) return

    try {
      await deleteDoc(doc(db, "orders", selectedOrder.id))

      // Update local state
      setOrders(orders.filter((order) => order.id !== selectedOrder.id))

      setIsDeleteDialogOpen(false)
      toast({
        title: "Успешно изтриване",
        description: "Поръчката беше успешно изтрита.",
      })
    } catch (error) {
      console.error("Error deleting order:", error)
      toast({
        title: "Грешка",
        description: "Възникна проблем при изтриването на поръчката.",
        variant: "destructive",
      })
    }
  }

  // Payment reminder functionality removed

  const handleCreatePaymentLink = async (order: Order) => {
    if (!order.id) return

    try {
      const response = await fetch("/api/create-payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()

        // Copy to clipboard
        navigator.clipboard.writeText(url)

        toast({
          title: "Линк за плащане създаден",
          description: "Линкът за плащане беше копиран в клипборда.",
        })
      } else {
        throw new Error("Failed to create payment link")
      }
    } catch (error) {
      console.error("Error creating payment link:", error)
      toast({
        title: "Грешка",
        description: "Възникна проблем при създаването на линк за плащане.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold">Управление на поръчки</h1>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrders}
              disabled={isRefreshing}
              className="flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Обнови
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid grid-cols-4 md:grid-cols-8 mb-4">
            <TabsTrigger value="all">Всички</TabsTrigger>
            <TabsTrigger value="pending">В очакване</TabsTrigger>
            <TabsTrigger value="processing">В обработка</TabsTrigger>
            <TabsTrigger value="shipped">Изпратени</TabsTrigger>
            <TabsTrigger value="delivered">Доставени</TabsTrigger>
            <TabsTrigger value="completed">Завършени</TabsTrigger>
            <TabsTrigger value="cancelled">Отказани</TabsTrigger>
            <TabsTrigger value="unpaid">Неплатени</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Поръчки</CardTitle>
                <CardDescription>
                  {activeTab === "all" && "Всички поръчки"}
                  {activeTab === "pending" && "Поръчки в очакване на обработка"}
                  {activeTab === "processing" && "Поръчки в процес на обработка"}
                  {activeTab === "shipped" && "Изпратени поръчки"}
                  {activeTab === "delivered" && "Доставени поръчки"}
                  {activeTab === "completed" && "Завършени поръчки"}
                  {activeTab === "cancelled" && "Отказани поръчки"}
                  {activeTab === "unpaid" && "Неплатени поръчки"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Търсене на поръчка..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-8"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                      <SelectTrigger className="w-[180px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Статус" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Всички статуси</SelectItem>
                        <SelectItem value="pending">В очакване</SelectItem>
                        <SelectItem value="processing">В обработка</SelectItem>
                        <SelectItem value="shipped">Изпратена</SelectItem>
                        <SelectItem value="delivered">Доставена</SelectItem>
                        <SelectItem value="completed">Завършена</SelectItem>
                        <SelectItem value="cancelled">Отказана</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={paymentStatusFilter} onValueChange={handlePaymentStatusFilterChange}>
                      <SelectTrigger className="w-[180px]">
                        <CreditCard className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Плащане" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Всички плащания</SelectItem>
                        <SelectItem value="pending">В очакване</SelectItem>
                        <SelectItem value="processing">В обработка</SelectItem>
                        <SelectItem value="completed">Платено</SelectItem>
                        <SelectItem value="failed">Неуспешно</SelectItem>
                        <SelectItem value="refunded">Възстановено</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={dateFilter} onValueChange={handleDateFilterChange}>
                      <SelectTrigger className="w-[180px]">
                        <Calendar className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Период" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Всички периоди</SelectItem>
                        <SelectItem value="today">Днес</SelectItem>
                        <SelectItem value="yesterday">Вчера</SelectItem>
                        <SelectItem value="last7days">Последните 7 дни</SelectItem>
                        <SelectItem value="last30days">Последните 30 дни</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
                  </div>
                ) : (
                  <>
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">Няма намерени поръчки</p>
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px] cursor-pointer" onClick={() => handleSort("orderNumber")}>
                                <div className="flex items-center">
                                  Номер
                                  {sortField === "orderNumber" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer" onClick={() => handleSort("customer")}>
                                <div className="flex items-center">
                                  Клиент
                                  {sortField === "customer" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer" onClick={() => handleSort("createdAt")}>
                                <div className="flex items-center">
                                  Дата
                                  {sortField === "createdAt" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                                <div className="flex items-center">
                                  Статус
                                  {sortField === "status" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer" onClick={() => handleSort("paymentStatus")}>
                                <div className="flex items-center">
                                  Плащане
                                  {sortField === "paymentStatus" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                </div>
                              </TableHead>
                              <TableHead
                                className="text-right cursor-pointer"
                                onClick={() => handleSort("totalAmount")}
                              >
                                <div className="flex items-center justify-end">
                                  Сума
                                  {sortField === "totalAmount" && <ArrowUpDown className="ml-2 h-4 w-4" />}
                                </div>
                              </TableHead>
                              <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOrders.map((order) => (
                              <TableRow key={order.id} className="hover:bg-gray-50">
                                <TableCell className="font-medium">
                                  {order.orderNumber || order.id.substring(0, 8)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span>
                                      {order.customer?.firstName} {order.customer?.lastName}
                                    </span>
                                    <span className="text-xs text-gray-500">{order.customer?.email}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{formatDate(order.createdAt)}</TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(order.status)}>{getStatusText(order.status)}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getPaymentStatusColor(order.paymentDetails?.status || "pending")}>
                                    {getPaymentStatusText(order.paymentDetails?.status || "pending")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {Number(order.totalAmount).toFixed(2)} лв.
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Действия</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Действия</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Преглед
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleEditOrder(order)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Редактиране
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      {order.paymentDetails?.status !== "completed" && (
                                        <>
                                          <DropdownMenuItem onClick={() => handleCreatePaymentLink(order)}>
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            Създай линк за плащане
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteOrder(order)}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        <Trash className="mr-2 h-4 w-4" />
                                        Изтриване
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  Показани {filteredOrders.length} от {orders.length} поръчки
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Order Dialog */}
        {selectedOrder && (
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Детайли на поръчка #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
                </DialogTitle>
                <DialogDescription>Създадена на {formatDate(selectedOrder.createdAt)}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Информация за клиента
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p>
                      <span className="font-medium">Име:</span> {selectedOrder.customer?.firstName}{" "}
                      {selectedOrder.customer?.lastName}
                    </p>
                    <p>
                      <span className="font-medium">Имейл:</span> {selectedOrder.customer?.email}
                    </p>
                    <p>
                      <span className="font-medium">Телефон:</span> {selectedOrder.customer?.phone}
                    </p>
                  </div>

                  <h3 className="text-lg font-semibold mb-2 mt-6 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Адрес за доставка
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p>{selectedOrder.shippingDetails?.address}</p>
                    <p>
                      {selectedOrder.shippingDetails?.city}, {selectedOrder.shippingDetails?.postalCode}
                    </p>
                    <p>{selectedOrder.shippingDetails?.country}</p>
                    <p className="mt-2">
                      <span className="font-medium">Метод на доставка:</span> {selectedOrder.shippingDetails?.method}
                    </p>
                    {selectedOrder.trackingNumber && (
                      <p>
                        <span className="font-medium">Номер за проследяване:</span> {selectedOrder.trackingNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <Package className="w-5 h-5 mr-2" />
                    Статус на поръчката
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="flex items-center mb-2">
                      <Badge className={getStatusColor(selectedOrder.status)}>
                        {getStatusText(selectedOrder.status)}
                      </Badge>
                    </div>
                    {selectedOrder.notes && <p className="text-sm text-gray-600 mt-2">{selectedOrder.notes}</p>}
                    {selectedOrder.estimatedDeliveryDate && (
                      <p className="mt-2">
                        <span className="font-medium">Очаквана доставка:</span>{" "}
                        {formatDate(selectedOrder.estimatedDeliveryDate)}
                      </p>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold mb-2 mt-6 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Информация за плащане
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p>
                      <span className="font-medium">Метод:</span>{" "}
                      {selectedOrder.paymentDetails?.method === "stripe"
                        ? "Кредитна/Дебитна карта"
                        : selectedOrder.paymentDetails?.method}
                    </p>
                    <p>
                      <span className="font-medium">Статус:</span>{" "}
                      <Badge className={getPaymentStatusColor(selectedOrder.paymentDetails?.status || "pending")}>
                        {getPaymentStatusText(selectedOrder.paymentDetails?.status || "pending")}
                      </Badge>
                    </p>
                    {selectedOrder.paymentCompletedAt && (
                      <p>
                        <span className="font-medium">Дата на плащане:</span>{" "}
                        {formatDate(selectedOrder.paymentCompletedAt)}
                      </p>
                    )}
                    <p className="mt-2">
                      <span className="font-medium">Сума:</span> {Number(selectedOrder.totalAmount).toFixed(2)} лв.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Продукти
                </h3>
                <div className="bg-gray-50 p-4 rounded-md overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Продукт</th>
                        <th className="text-center py-2 px-4">Количество</th>
                        <th className="text-right py-2 px-4">Цена</th>
                        <th className="text-right py-2 px-4">Общо</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-2 px-4">
                            <div className="flex items-center">
                              {item.image && (
                                <img
                                  src={item.image || "/placeholder.svg"}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded mr-3"
                                />
                              )}
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-gray-500">{item.manufacturer}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-center">{item.quantity}</td>
                          <td className="py-2 px-4 text-right">
                            {(typeof item.price === "string" ? Number.parseFloat(item.price) : item.price).toFixed(2)} лв.
                          </td>
                          <td className="py-2 px-4 text-right font-medium">
                            {(item.totalPrice !== undefined ? 
                              item.totalPrice : 
                              (typeof item.price === "string" ? Number.parseFloat(item.price) : item.price) * item.quantity
                            ).toFixed(2)}{" "}
                            лв.
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100">
                        <td colSpan={3} className="py-2 px-4 text-right font-medium">
                          Междинна сума:
                        </td>
                        <td className="py-2 px-4 text-right font-medium">{selectedOrder.subtotal.toFixed(2)} лв.</td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td colSpan={3} className="py-2 px-4 text-right font-medium">
                          Доставка:
                        </td>
                        <td className="py-2 px-4 text-right font-medium">
                          {selectedOrder.shippingCost > 0
                            ? `${selectedOrder.shippingCost.toFixed(2)} лв.`
                            : "Безплатно"}
                        </td>
                      </tr>
                      {selectedOrder.taxAmount !== undefined && selectedOrder.taxAmount > 0 && (
                        <tr className="bg-gray-100">
                          <td colSpan={3} className="py-2 px-4 text-right font-medium">
                            ДДС:
                          </td>
                          <td className="py-2 px-4 text-right font-medium">{selectedOrder.taxAmount.toFixed(2)} лв.</td>
                        </tr>
                      )}
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan={3} className="py-2 px-4 text-right">
                          Общо:
                        </td>
                        <td className="py-2 px-4 text-right">{selectedOrder.totalAmount.toFixed(2)} лв.</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Затвори
                </Button>
                <Button
                  onClick={() => {
                    setIsViewDialogOpen(false)
                    handleEditOrder(selectedOrder)
                  }}
                >
                  Редактирай
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Order Dialog */}
        {selectedOrder && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Редактиране на поръчка #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
                </DialogTitle>
                <DialogDescription>Променете статуса и детайлите на поръчката.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleEditFormSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">
                      Статус
                    </Label>
                    <Select
                      name="status"
                      value={editFormData.status}
                      onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Изберете статус" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">В очакване</SelectItem>
                        <SelectItem value="processing">В обработка</SelectItem>
                        <SelectItem value="shipped">Изпратена</SelectItem>
                        <SelectItem value="delivered">Доставена</SelectItem>
                        <SelectItem value="completed">Завършена</SelectItem>
                        <SelectItem value="cancelled">Отказана</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="trackingNumber" className="text-right">
                      Номер за проследяване
                    </Label>
                    <Input
                      id="trackingNumber"
                      name="trackingNumber"
                      value={editFormData.trackingNumber}
                      onChange={handleEditFormChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="estimatedDeliveryDate" className="text-right">
                      Очаквана доставка
                    </Label>
                    <Input
                      id="estimatedDeliveryDate"
                      name="estimatedDeliveryDate"
                      type="date"
                      value={editFormData.estimatedDeliveryDate}
                      onChange={handleEditFormChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="notes" className="text-right pt-2">
                      Бележки
                    </Label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={editFormData.notes}
                      onChange={handleEditFormChange}
                      className="col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Запази промените</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Order Dialog */}
        {selectedOrder && (
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Потвърдете изтриването</DialogTitle>
                <DialogDescription>
                  Сигурни ли сте, че искате да изтриете поръчка #
                  {selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}? Това действие не може да бъде
                  отменено.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Отказ
                </Button>
                <Button variant="destructive" onClick={handleDeleteConfirm}>
                  Изтрий
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  )
}
