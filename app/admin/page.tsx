"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import Navbar from "@/components/navbar"
import type { Motorcycle, Order } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  MapPin,
} from "lucide-react"
import { formatDate, getStatusText, getPaymentStatusText, getStatusColor, getPaymentStatusColor } from "@/lib/utils"

// Import Stripe for payment information
import { loadStripe } from "@stripe/stripe-js"
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)

// Add the OrdersManagement component after the imports
function OrdersManagement() {
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
                  ...order.paymentDetails,
                  status: paymentData.status,
                  paymentDate: paymentData.created,
                  amount: paymentData.amount_total ? paymentData.amount_total / 100 : order.totalAmount,
                  currency: paymentData.currency || "bgn",
                  method: "stripe", // Setting a default value since this is Stripe payment data
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
        status: editFormData.status,
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
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <h2 className="text-xl font-bold">Управление на поръчки</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={isRefreshing}
            className="flex items-center h-8"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Обнови
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsContent value={activeTab} className="mt-0">
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-lg">Поръчки</CardTitle>
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
                    className="pl-8 bg-white"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
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
                    <SelectTrigger className="w-[180px] bg-white">
                      <CreditCard className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Плащане" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">Всички плащания</SelectItem>
                      <SelectItem value="pending">В очакване</SelectItem>
                      <SelectItem value="processing">В обработка</SelectItem>
                      <SelectItem value="completed">Платено</SelectItem>
                      <SelectItem value="failed">Неуспешно</SelectItem>
                      <SelectItem value="refunded">Възстановено</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={dateFilter} onValueChange={handleDateFilterChange}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <Calendar className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Период" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
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
                      {/* Desktop Table View */}
                      <div className="hidden md:block">
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
                                    <DropdownMenuContent align="end" className="bg-white">
                                      <DropdownMenuLabel className="bg-white">Действия</DropdownMenuLabel>
                                      <DropdownMenuItem className="bg-white" onClick={() => handleViewOrder(order)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Преглед
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="bg-white" onClick={() => handleEditOrder(order)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Редактиране
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteOrder(order)}
                                        className="text-red-600 focus:text-red-600 bg-white"
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

                      {/* Mobile/Tablet Card View */}
                      <div className="block md:hidden">
                        {filteredOrders.map((order) => (
                          <div key={order.id} className="border-b p-2">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-medium">
                                    #{order.orderNumber || order.id.substring(0, 8)}
                                  </div>
                                  <div className="text-xs text-gray-500">{formatDate(order.createdAt)}</div>
                                </div>
                                <div className="text-xs mt-0.5 text-gray-600">
                                  {order.customer?.firstName} {order.customer?.lastName}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <Badge className={`${getStatusColor(order.status)} text-[10px] h-5 px-1`}>
                                    {getStatusText(order.status)}
                                  </Badge>
                                  <span className="text-sm font-medium">
                                    {Number(order.totalAmount).toFixed(2)} лв.
                                  </span>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[140px] p-1 bg-white">
                                  <DropdownMenuItem className="py-1.5 text-xs" onClick={() => handleViewOrder(order)}>
                                    <Eye className="mr-2 h-3 w-3" />
                                    Преглед
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="py-1.5 text-xs" onClick={() => handleEditOrder(order)}>
                                    <Edit className="mr-2 h-3 w-3" />
                                    Редакция
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="py-1.5 text-xs text-red-600"
                                    onClick={() => handleDeleteOrder(order)}
                                  >
                                    <Trash className="mr-2 h-3 w-3" />
                                    Изтрий
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
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
          <DialogContent className="max-w-xs md:max-w-lg mx-auto p-2 md:p-4 bg-white overflow-y-auto max-h-[80vh]">
            <DialogHeader className="space-y-0.5 pb-2">
              <DialogTitle className="text-sm md:text-lg font-medium">
                #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
              </DialogTitle>
              <DialogDescription className="text-xs">{formatDate(selectedOrder.createdAt)}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-3">
                {/* Customer Info */}
                <div>
                  <h3 className="text-sm font-medium mb-1 flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    Информация за клиента
                  </h3>
                  <div className="bg-gray-50 p-3 rounded-md text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-gray-600">Име:</div>
                      <div>
                        {selectedOrder.customer?.firstName} {selectedOrder.customer?.lastName}
                      </div>
                      <div className="text-gray-600">Имейл:</div>
                      <div className="break-all">{selectedOrder.customer?.email}</div>
                      <div className="text-gray-600">Телефон:</div>
                      <div>{selectedOrder.customer?.phone}</div>
                    </div>
                  </div>
                </div>

                {/* Shipping Info */}
                <div>
                  <h3 className="text-sm font-medium mb-1 flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    Адрес за доставка
                  </h3>
                  <div className="bg-gray-50 p-3 rounded-md text-sm">
                    <div className="space-y-1">
                      <p>{selectedOrder.shippingDetails?.address}</p>
                      <p>
                        {selectedOrder.shippingDetails?.city}, {selectedOrder.shippingDetails?.postalCode}
                      </p>
                      <p>{selectedOrder.shippingDetails?.country}</p>
                      <div className="pt-2 grid grid-cols-2 gap-2">
                        <div className="text-gray-600">Метод:</div>
                        <div>{selectedOrder.shippingDetails?.method}</div>
                        {selectedOrder.trackingNumber && (
                          <>
                            <div className="text-gray-600">Tracking:</div>
                            <div>{selectedOrder.trackingNumber}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Status */}
                <div>
                  <h3 className="text-sm font-medium mb-1 flex items-center">
                    <Package className="w-3 h-3 mr-1" />
                    Статус
                  </h3>
                  <div className="bg-gray-50 p-3 rounded-md text-sm">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge className={getStatusColor(selectedOrder.status)}>
                        {getStatusText(selectedOrder.status)}
                      </Badge>
                      <Badge className={getPaymentStatusColor(selectedOrder.paymentDetails?.status || "pending")}>
                        {getPaymentStatusText(selectedOrder.paymentDetails?.status || "pending")}
                      </Badge>
                    </div>
                    {selectedOrder.notes && <p className="text-gray-600 mt-2 text-sm">{selectedOrder.notes}</p>}
                  </div>
                </div>

                {/* Products */}
                <div>
                  <h3 className="text-sm font-medium mb-1 flex items-center">
                    <FileText className="w-3 h-3 mr-1" />
                    Продукти
                  </h3>
                  <div className="bg-gray-50 rounded-md text-sm divide-y">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="p-3 flex items-center gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          <div className="text-gray-500">{item.manufacturer}</div>
                          <div className="mt-1 flex justify-between">
                            <span>{item.quantity} бр.</span>
                            <span className="font-medium">
                              {typeof item.totalPrice === "number"
                                ? item.totalPrice.toFixed(2)
                                : typeof item.price === "number"
                                  ? (item.price * item.quantity).toFixed(2)
                                  : (Number.parseFloat(item.price as string) * item.quantity).toFixed(2)}{" "}
                              лв.
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Междинна сума:</span>
                        <span>{selectedOrder.subtotal.toFixed(2)} лв.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Доставка:</span>
                        <span>
                          {selectedOrder.shippingCost > 0
                            ? `${selectedOrder.shippingCost.toFixed(2)} лв.`
                            : "Безплатно"}
                        </span>
                      </div>
                      {selectedOrder.taxAmount !== undefined && selectedOrder.taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">ДДС:</span>
                          <span>{selectedOrder.taxAmount.toFixed(2)} лв.</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold pt-2">
                        <span>Общо:</span>
                        <span>{selectedOrder.totalAmount.toFixed(2)} лв.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-3 flex-col gap-1.5">
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full py-1 h-8">
                Затвори
              </Button>
              <Button
                onClick={() => {
                  setIsViewDialogOpen(false)
                  handleEditOrder(selectedOrder)
                }}
                className="w-full py-1 h-8"
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
          <DialogContent className="max-w-xs md:max-w-lg mx-auto p-3 md:p-6 bg-white">
            <DialogHeader className="space-y-1 p-0 mb-2">
              <DialogTitle className="text-sm md:text-lg font-medium">
                #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditFormSubmit} className="space-y-3 py-3">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Статус</Label>
                  <Select
                    name="status"
                    value={editFormData.status}
                    onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Изберете статус" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem className="bg-white" value="pending">
                        В очакване
                      </SelectItem>
                      <SelectItem className="bg-white" value="processing">
                        В обработка
                      </SelectItem>
                      <SelectItem className="bg-white" value="shipped">
                        Изпратена
                      </SelectItem>
                      <SelectItem className="bg-white" value="delivered">
                        Доставена
                      </SelectItem>
                      <SelectItem className="bg-white" value="completed">
                        Завършена
                      </SelectItem>
                      <SelectItem className="bg-white" value="cancelled">
                        Отказана
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackingNumber">Номер за проследяване</Label>
                  <Input
                    id="trackingNumber"
                    name="trackingNumber"
                    value={editFormData.trackingNumber}
                    onChange={handleEditFormChange}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimatedDeliveryDate">Очаквана доставка</Label>
                  <Input
                    id="estimatedDeliveryDate"
                    name="estimatedDeliveryDate"
                    type="date"
                    value={editFormData.estimatedDeliveryDate}
                    onChange={handleEditFormChange}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Бележки</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={editFormData.notes}
                    onChange={handleEditFormChange}
                    className="w-full min-h-[80px] rounded-md border border-input bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 pt-3">
                <Button variant="outline" type="button" onClick={() => setIsEditDialogOpen(false)} className="w-full">
                  Отказ
                </Button>
                <Button type="submit" className="w-full">
                  Запази промените
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Order Dialog */}
      {selectedOrder && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="bg-white p-3 sm:p-4 mx-2 sm:mx-4 w-[calc(100%-1rem)] sm:w-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Потвърдете изтриването</DialogTitle>
              <DialogDescription className="text-xs">
                Сигурни ли сте, че искате да изтриете поръчка #
                {selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}? Това действие не може да бъде отменено.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="w-full sm:w-auto">
                Отказ
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} className="w-full sm:w-auto">
                Изтрий
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
  const [currentlyEditing, setCurrentlyEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    manufacturer: "",
    price: "",
    maxSpeed: "",
    horsepower: "",
    torque: "",
    image: "",
  })

  useEffect(() => {
    if (!user) {
      router.push("/")
      return
    }

    // Check if user is admin (in a real app, you'd check against a database role)
    if (user.uid !== "ZXduWaLnwuVPlKPvZm0FyoDeaXs2") {
      router.push("/")
      return
    }

    fetchMotorcycles()
  }, [user, router])

  const fetchMotorcycles = async () => {
    try {
      const motorcyclesCollection = collection(db, "motors")
      const motorcyclesSnapshot = await getDocs(motorcyclesCollection)
      const motorcyclesList = motorcyclesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Motorcycle[]

      setMotorcycles(motorcyclesList)
    } catch (error) {
      console.error("Error fetching motorcycles:", error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await addDoc(collection(db, "motors"), formData)

      // Reset form
      setFormData({
        name: "",
        manufacturer: "",
        price: "",
        maxSpeed: "",
        horsepower: "",
        torque: "",
        image: "",
      })

      // Refresh motorcycles list
      fetchMotorcycles()
    } catch (error) {
      console.error("Error adding motorcycle:", error)
    }
  }

  const handleEdit = (motorcycleId: string) => {
    setCurrentlyEditing(motorcycleId)
  }

  const handleSave = async (motorcycleId: string) => {
    const motorcycleElement = document.querySelector(`.motor-item[data-id="${motorcycleId}"]`)
    if (!motorcycleElement) return

    const updatedData = {
      manufacturer: (motorcycleElement.querySelector(".manufacturer-value") as HTMLElement).innerText,
      price: (motorcycleElement.querySelector(".price-value") as HTMLElement).innerText.replace(" лв.", ""),
      horsepower: (motorcycleElement.querySelector(".horsepower-value") as HTMLElement).innerText.replace(" к.с.", ""),
      maxSpeed: (motorcycleElement.querySelector(".maxspeed-value") as HTMLElement).innerText.replace(" км/ч", ""),
    }

    try {
      await updateDoc(doc(db, "motors", motorcycleId), updatedData)
      setCurrentlyEditing(null)
      fetchMotorcycles()
    } catch (error) {
      console.error("Error updating motorcycle:", error)
    }
  }

  const handleDelete = async (motorcycleId: string) => {
    if (confirm("Сигурни ли сте, че искате да изтриете този мотор?")) {
      try {
        await deleteDoc(doc(db, "motors", motorcycleId))
        fetchMotorcycles()
      } catch (error) {
        console.error("Error deleting motorcycle:", error)
      }
    }
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-bold text-center mb-8">Администраторски център</h1>

        <Tabs defaultValue="motorcycles" className="space-y-6">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 mx-auto">
            <TabsTrigger value="motorcycles">Мотоциклети</TabsTrigger>
            <TabsTrigger value="orders">Поръчки</TabsTrigger>
          </TabsList>

          <TabsContent value="motorcycles">
            <section className="bg-white rounded-lg shadow-md p-6 mb-10">
              <h2 className="text-2xl font-semibold mb-6 text-center">Добави нов мотоциклет</h2>

              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium mb-4 border-b pb-2">Основна информация</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-600 mb-1">
                      Модел
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-600 mb-1">
                      Производител
                    </label>
                    <input
                      type="text"
                      id="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-600 mb-1">
                      Цена
                    </label>
                    <input
                      type="text"
                      id="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      required
                    />
                  </div>
                </div>

                <h3 className="text-lg font-medium mb-4 border-b pb-2">Технически данни</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label htmlFor="maxSpeed" className="block text-sm font-medium text-gray-600 mb-1">
                      Максимална скорост
                    </label>
                    <input
                      type="text"
                      id="maxSpeed"
                      value={formData.maxSpeed}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="horsepower" className="block text-sm font-medium text-gray-600 mb-1">
                      Конски сили
                    </label>
                    <input
                      type="text"
                      id="horsepower"
                      value={formData.horsepower}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="torque" className="block text-sm font-medium text-gray-600 mb-1">
                      Въртящ момент
                    </label>
                    <input
                      type="text"
                      id="torque"
                      value={formData.torque}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      required
                    />
                  </div>
                </div>

                <h3 className="text-lg font-medium mb-4 border-b pb-2">Изображение</h3>

                <div className="mb-6">
                  <label htmlFor="image" className="block text-sm font-medium text-gray-600 mb-1">
                    URL на изображението
                  </label>
                  <input
                    type="text"
                    id="image"
                    value={formData.image}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                    required
                  />
                </div>

                <div className="text-center">
                  <button
                    type="submit"
                    className="bg-black text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    Добавяне на мотор
                  </button>
                </div>
              </form>
            </section>

            <section className="bg-gray-100 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 text-center">Каталог мотоциклети</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {motorcycles.map((motorcycle) => (
                  <div
                    key={motorcycle.id}
                    className="motor-item bg-white rounded-lg shadow-md overflow-hidden"
                    data-id={motorcycle.id}
                  >
                    <div className="h-48 overflow-hidden">
                      <img
                        src={motorcycle.image || "/placeholder.svg"}
                        alt={motorcycle.name}
                        className="w-full h-full object-cover transition-transform hover:scale-105"
                      />
                    </div>

                    <div className="p-4">
                      <h3 className="text-xl font-semibold mb-3">{motorcycle.name}</h3>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Производител:</span>
                          <span
                            className="manufacturer-value font-medium"
                            contentEditable={currentlyEditing === motorcycle.id}
                            suppressContentEditableWarning={true}
                          >
                            {motorcycle.manufacturer}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-600">Цена:</span>
                          <span
                            className="price-value font-medium"
                            contentEditable={currentlyEditing === motorcycle.id}
                            suppressContentEditableWarning={true}
                          >
                            {motorcycle.price} лв.
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-600">Мощност:</span>
                          <span
                            className="horsepower-value font-medium"
                            contentEditable={currentlyEditing === motorcycle.id}
                            suppressContentEditableWarning={true}
                          >
                            {motorcycle.horsepower} к.с.
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-gray-600">Макс. скорост:</span>
                          <span
                            className="maxspeed-value font-medium"
                            contentEditable={currentlyEditing === motorcycle.id}
                            suppressContentEditableWarning={true}
                          >
                            {motorcycle.maxSpeed} км/ч
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {currentlyEditing === motorcycle.id ? (
                          <button
                            onClick={() => handleSave(motorcycle.id)}
                            className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                          >
                            Запази
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEdit(motorcycle.id)}
                            className="flex-1 bg-black text-white py-2 rounded hover:bg-gray-800"
                          >
                            Редактирай
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(motorcycle.id)}
                          className="flex-1 bg-red-100 text-red-600 py-2 rounded hover:bg-red-200"
                        >
                          Изтрий
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {motorcycles.length === 0 && <p className="text-center text-gray-500 py-8">Няма добавени мотоциклети</p>}
            </section>
          </TabsContent>

          <TabsContent value="orders">
            <OrdersManagement />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
