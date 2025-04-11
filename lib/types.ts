export interface Motorcycle {
  id: string
  name: string
  manufacturer: string
  price: string | number
  maxSpeed: string | number
  horsepower: string | number
  torque: string | number
  image: string
  inventory?: number
}

export interface UserData {
  displayName?: string
  email?: string
  firstName?: string
  lastName?: string
  age?: string | number
  photoURL?: string
  createdAt?: string
  phone?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
}

export interface CartItem {
  id: string
  name: string
  manufacturer: string
  price: number
  quantity: number
  image?: string
  horsepower?: string | number
  maxSpeed?: string | number
  torque?: string | number
}

export interface OrderItem {
  id: string
  name: string
  manufacturer: string
  price: string | number
  quantity: number
  totalPrice?: number
  image?: string
  horsepower?: string | number
  maxSpeed?: string | number
  torque?: string | number
}

export interface ShippingDetails {
  firstName: string
  lastName: string
  address: string
  city: string
  postalCode: string
  country: string
  phone: string
}

export interface ShippingOption {
  id: string
  name: string
  price: number
  estimatedDays: string
  description: string
}

export interface PaymentDetails {
  method: "stripe" | "paypal" | "cash"
  transactionId?: string
  status: "pending" | "processing" | "completed" | "failed" | "refunded"
  amount: number
  currency: string
  paymentDate?: any
  paymentMethod?: string
}

export interface Order {
  id: string
  orderNumber?: string
  status: "pending" | "processing" | "completed" | "cancelled" | "shipped" | "delivered"
  orderDate?: any
  createdAt?: any
  customer?: {
    uid: string
    email: string
    displayName?: string
    firstName?: string
    lastName?: string
    phone?: string
  }
  items?: OrderItem[]
  productDetails?: {
    name: string
    manufacturer: string
    price: string | number
    image?: string
  }
  shippingDetails?: ShippingDetails & {
    method?: string
  }
  shippingMethod?: string
  shippingCost: number
  paymentDetails?: PaymentDetails
  checkoutSessionId?: string
  paymentStatus?: string
  paymentCompletedAt?: any
  amountPaid?: number
  paymentMethod?: string
  paymentTransactionId?: string
  notes?: string
  trackingNumber?: string
  estimatedDeliveryDate?: any
  subtotal: number
  totalAmount: number
  taxAmount?: number
}
