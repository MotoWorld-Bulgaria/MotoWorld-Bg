import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add or update these utility functions for consistent status display
export const formatDate = (dateValue: any) => {
  if (!dateValue) return "Няма дата"

  try {
    // Handle Firestore Timestamp
    if (dateValue.seconds) {
      return new Date(dateValue.seconds * 1000).toLocaleDateString("bg-BG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }
    // Handle regular Date object or string
    return new Date(dateValue).toLocaleDateString("bg-BG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Невалидна дата"
  }
}

export const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: "В очакване",
    processing: "В обработка",
    shipped: "Изпратена",
    delivered: "Доставена",
    completed: "Завършена",
    cancelled: "Отказана",
  }
  return statusMap[status] || "Неизвестен"
}

export const getPaymentStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: "В очакване",
    processing: "В обработка",
    completed: "Платено",
    failed: "Неуспешно",
    refunded: "Възстановено",
  }
  return statusMap[status] || "Неизвестен"
}

export const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    processing: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    shipped: "bg-purple-100 text-purple-800 hover:bg-purple-200",
    delivered: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
    completed: "bg-green-100 text-green-800 hover:bg-green-200",
    cancelled: "bg-red-100 text-red-800 hover:bg-red-200",
  }
  return colorMap[status] || "bg-gray-100 text-gray-800 hover:bg-gray-200"
}

export const getPaymentStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    processing: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    completed: "bg-green-100 text-green-800 hover:bg-green-200",
    failed: "bg-red-100 text-red-800 hover:bg-red-200",
    refunded: "bg-purple-100 text-purple-800 hover:bg-purple-200",
  }
  return colorMap[status] || "bg-gray-100 text-gray-800 hover:bg-gray-200"
}
