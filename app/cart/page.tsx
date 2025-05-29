"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { useCart } from "@/hooks/use-cart"
import { formatCurrency } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Check, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"

interface CartItemProps {
  id: string
  name: string
  imageUrl: string
  price: number
  quantity: number
}

const calculateSubtotal = (item: CartItemProps) => {
  return item.price * item.quantity
}

const CartPage = () => {
  const router = useRouter()
  const { cartItems, addItem, removeItem, clearCart } = useCart()
  const [isSyncing, setIsSyncing] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  \
  const [appliedPromoCode, setAppliedPromoCode<{code: string, discount: number} | null>(null
  ) = useState(null)
  const [promoCodeError, setPromoCodeError] = useState("")
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)

  useEffect(() => {
    const storedCart = localStorage.getItem("cart")
    if (storedCart) {
      try {
        const parsedCart = JSON.parse(storedCart)
        if (Array.isArray(parsedCart)) {
          parsedCart.forEach((item) => {
            addItem(item, false) // prevent re-syncing during initial load
          })
        }
      } catch (error) {
        console.error("Error parsing cart from localStorage:", error)
        // Handle the error appropriately, e.g., clear the localStorage
        localStorage.removeItem("cart")
      }
    }
  }, [addItem])

  const handleSyncLocalCart = () => {
    setIsSyncing(true)
    localStorage.setItem("cart", JSON.stringify(cartItems))
    setTimeout(() => {
      setIsSyncing(false)
    }, 500)
  }

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoCodeError("Моля, въведете промо код")
      return
    }

    setIsApplyingPromo(true)
    setPromoCodeError("")

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Validate promo code (currently only supports 'Promo100')
    if (promoCode.trim().toLowerCase() === "promo100") {
      const discount = 100
      setAppliedPromoCode({ code: promoCode.trim(), discount })
      setPromoCode("")
      toast({
        title: "Промо кодът е приложен!",
        description: `Получихте отстъпка от ${discount.toFixed(2)} лв.`,
        variant: "default",
      })
    } else {
      setPromoCodeError("Невалиден промо код")
      toast({
        title: "Невалиден промо код",
        description: "Моля, проверете промо кода и опитайте отново.",
        variant: "destructive",
      })
    }

    setIsApplyingPromo(false)
  }

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null)
    setPromoCodeError("")
    toast({
      title: "Промо кодът е премахнат",
      description: "Отстъпката беше премахната от поръчката ви.",
      variant: "default",
    })
  }

  const calculateTotal = () => {
    const subtotal = cartItems.reduce((total, item) => {
      return total + calculateSubtotal(item)
    }, 0)

    const discount = appliedPromoCode ? appliedPromoCode.discount : 0
    return Math.max(0, subtotal - discount) // Ensure total doesn't go below 0
  }

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + calculateSubtotal(item)
    }, 0)
  }

  const getDiscount = () => {
    return appliedPromoCode ? appliedPromoCode.discount : 0
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold">Вашата количка е празна</h1>
        <p className="text-gray-500">Добавете продукти, за да продължите.</p>
        <Button onClick={() => router.push("/")} className="mt-4">
          Към магазина
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-12">
      <h1 className="text-3xl font-bold mb-6">Количка</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Cart Items */}
        <div className="space-y-4">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-center border rounded-lg p-4">
              <div className="w-24 h-24 relative mr-4">
                <Image
                  src={item.imageUrl || "/placeholder.svg"}
                  alt={item.name}
                  fill
                  style={{ objectFit: "cover" }}
                  className="rounded-lg"
                />
              </div>
              <div>
                <Link href={`/product/${item.id}`}>
                  <h2 className="text-lg font-semibold hover:underline cursor-pointer">{item.name}</h2>
                </Link>
                <p className="text-gray-500">{formatCurrency(item.price)}</p>
                <div className="flex items-center mt-2">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-gray-500 hover:text-red-600 focus:outline-none"
                  >
                    -
                  </button>
                  <span className="mx-2">{item.quantity}</span>
                  <button
                    onClick={() => addItem(item)}
                    className="text-gray-500 hover:text-green-600 focus:outline-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
          <Button
            onClick={() => {
              clearCart()
              router.refresh()
            }}
            variant="destructive"
            size="sm"
          >
            Изчисти количката
          </Button>
          <Button onClick={handleSyncLocalCart} disabled={isSyncing} size="sm">
            {isSyncing ? "Синхронизиране..." : "Синхронизирай количката"}
          </Button>
        </div>

        {/* Order Summary */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Поръчка</h2>
          <Separator className="mb-4" />

          <div className="space-y-4 mb-6">
            <div className="flex justify-between">
              <span>Брой продукти:</span>
              <span>{cartItems.reduce((acc, item) => acc + item.quantity, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Междинна сума:</span>
              <span>{getSubtotal().toFixed(2)} лв.</span>
            </div>
            <div className="flex justify-between">
              <span>Доставка:</span>
              <span>0.00 лв.</span>
            </div>

            {/* Promo Code Section */}
            <div className="border-t pt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">Промо код</span>
                </div>

                {appliedPromoCode ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">{appliedPromoCode.code}</span>
                      </div>
                      <button
                        onClick={handleRemovePromoCode}
                        className="text-xs text-green-600 hover:text-green-800 underline"
                      >
                        Премахни
                      </button>
                    </div>
                    <p className="text-xs text-green-600 mt-1">Отстъпка: -{appliedPromoCode.discount.toFixed(2)} лв.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Въведете промо код"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value)
                          setPromoCodeError("")
                        }}
                        className={`flex-1 ${promoCodeError ? "border-red-300 focus:border-red-500" : ""}`}
                        disabled={isApplyingPromo}
                      />
                      <Button
                        onClick={handleApplyPromoCode}
                        disabled={isApplyingPromo || !promoCode.trim()}
                        variant="outline"
                        size="sm"
                        className="px-4"
                      >
                        {isApplyingPromo ? "..." : "Приложи"}
                      </Button>
                    </div>
                    {promoCodeError && <p className="text-xs text-red-600">{promoCodeError}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Show discount line item if promo code is applied */}
            {appliedPromoCode && (
              <div className="flex justify-between text-green-600">
                <span>Отстъпка ({appliedPromoCode.code}):</span>
                <span>-{appliedPromoCode.discount.toFixed(2)} лв.</span>
              </div>
            )}
          </div>

          <div className="flex justify-between font-semibold">
            <span>Общо:</span>
            <span>{calculateTotal().toFixed(2)} лв.</span>
          </div>
          <Button className="w-full mt-4">Плащане</Button>
        </div>
      </div>
    </div>
  )
}

export default CartPage
