"use client"

import type { Order } from "@/lib/types"

interface OrderModalProps {
  order: Order
  onClose: () => void
}

export default function OrderModal({ order, onClose }: OrderModalProps) {
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "В обработка",
      completed: "Завършена",
      cancelled: "Отказана",
      processing: "Обработва се",
      shipped: "Изпратена",
      delivered: "Доставена",
    }
    return statusMap[status] || "Неизвестен"
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "Няма дата"

    try {
      // Handle Firestore Timestamp
      if (dateValue.seconds) {
        return new Date(dateValue.seconds * 1000).toLocaleDateString("bg-BG")
      }
      // Handle regular Date object or string
      return new Date(dateValue).toLocaleDateString("bg-BG")
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Невалидна дата"
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Детайли на поръчката</h2>
          <button onClick={onClose} className="text-2xl">
            &times;
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              {order.productDetails?.image && (
                <img
                  src={order.productDetails.image || "/placeholder.svg"}
                  alt={order.productDetails.name}
                  className="w-full h-auto object-cover rounded-lg shadow-md"
                />
              )}

              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Марка:</span>
                  <span>{order.productDetails?.manufacturer || "Неизвестна"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Модел:</span>
                  <span>{order.productDetails?.name || "Неизвестен"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Цена:</span>
                  <span className="font-semibold">{order.productDetails?.price || "0"} лв.</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">Информация за поръчката</h3>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Номер на поръчка:</span>
                    <span className="font-medium">#{order.orderNumber || "N/A"}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Дата на поръчка:</span>
                    <span>{formatDate(order.orderDate || order.createdAt)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Статус:</span>
                    <span
                      className={`px-2 py-1 rounded-full text-sm ${
                        order.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : order.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {getStatusText(order.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">Информация за клиента</h3>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Имейл:</span>
                    <span>{order.customer?.email || "Няма информация"}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Име:</span>
                    <span>{order.customer?.displayName || "Няма информация"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
