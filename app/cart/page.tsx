"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useGarage } from "@/lib/garage-context"
import Navbar from "@/components/navbar"
import Link from "next/link"
import { Trash2, Plus, Minus, Warehouse, RefreshCw, Tag, Check } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { CartItem } from "@/lib/types"

interface PromoCode {
  code: string
  discount: number
}

export default function CartPage() {
  const { user } = useAuth()
  const { cartItems, loading, error, removeFromGarage, updateQuantity, syncLocalCart } = useGarage()
  const router = useRouter()
  const [processingItem, setProcessingItem] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Promo code states
  const [promoCode, setPromoCode] = useState("")
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | null>(null)
  const [promoCodeError, setPromoCodeError] = useState("")
  const [isApplyingPromo, setIsApplyingPromo] = useState(false)

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeFromGarage(itemId)
      toast({
        title: "Продуктът е премахнат",
        description: "Продуктът беше премахнат от гаража ви.",
        variant: "default",
      })
    } catch (error) {
      console.error("Error removing item:", error)
      toast({
        title: "Грешка",
        description: "Възникна проблем при премахването на продукта.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setProcessingItem(itemId)

    try {
      // Check inventory availability
      const response = await fetch(`/api/check-inventory?productId=${itemId}&quantity=${newQuantity}`)
      const data = await response.json()

      if (!data.available) {
        toast({
          title: "Недостатъчна наличност",
          description: `Само ${data.availableQuantity} бр. налични.`,
          variant: "destructive",
        })

        // Update to max available quantity
        await updateQuantity(itemId, data.availableQuantity)
      } else {
        // Update quantity
        await updateQuantity(itemId, newQuantity)
      }
    } catch (error) {
      console.error("Error updating quantity:", error)
      toast({
        title: "Грешка",
        description: "Възникна проблем при обновяването на количеството.",
        variant: "destructive",
      })
    } finally {
      setProcessingItem(null)
    }
  }

  const handleSyncLocalCart = async () => {
    setIsSyncing(true)
    try {
      await syncLocalCart()
    } catch (error) {
      console.error("Error syncing cart:", error)
      toast({
        title: "Грешка при синхронизация",
        description: "Възникна проблем при синхронизирането на гаража.",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
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

  const calculateSubtotal = (item: CartItem) => {
    const price = typeof item.price === "string" ? Number.parseFloat(item.price) : item.price
    return price * item.quantity
  }

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + calculateSubtotal(item)
    }, 0)
  }

  const getDiscount = () => {
    return appliedPromoCode ? appliedPromoCode.discount : 0
  }

  const calculateTotal = () => {
    const subtotal = getSubtotal()
    const discount = getDiscount()
    return Math.max(0, subtotal - discount) // Ensure total doesn't go below 0
  }

  const handleCheckout = () => {
    if (!user) {
      toast({
        title: "Необходимо е да влезете в профила си",
        description: "Моля, влезте в профила си, за да продължите с поръчката.",
        variant: "destructive",
      })
      return
    }

    router.push("/checkout")
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <h1 className="text-3xl font-bold mb-8 text-center">Гараж</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <h2 className="font-semibold">Мотори в гаража</h2>
                </div>

                <div className="divide-y p-4 space-y-4">
                  {[1, 2, 3].map((_, index) => (
                    <div key={index} className="flex gap-4 pt-4 first:pt-0">
                      <Skeleton className="h-24 w-24 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
                <h2 className="text-xl font-semibold mb-4">Резюме на поръчката</h2>

                <div className="space-y-4 mb-6">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>

                <Skeleton className="h-10 w-full mt-6" />
                <Skeleton className="h-4 w-2/3 mx-auto mt-4" />
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Грешка при зареждане на гаража</AlertTitle>
            <AlertDescription>
              Възникна проблем при зареждането на вашия гараж. Моля, опитайте отново по-късно.
            </AlertDescription>
          </Alert>

          {!user && (
            <div className="text-center mt-8">
              <Button onClick={handleSyncLocalCart} disabled={isSyncing} className="mx-auto">
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Синхронизиране...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Опитай отново
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-bold mb-8 text-center">Гараж</h1>

        {cartItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
              <Warehouse className="w-full h-full" />
            </div>
            <h2 className="text-xl font-semibold mb-4">Вашият гараж е празен</h2>
            <p className="text-gray-600 mb-6">Разгледайте нашите мотоциклети и добавете нещо в гаража си.</p>
            <Button asChild>
              <Link href="/#motorcycles">Разгледай мотоциклети</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <h2 className="font-semibold">
                    Продукти в гаража ({cartItems.reduce((acc, item) => acc + item.quantity, 0)})
                  </h2>
                </div>

                <div className="divide-y">
                  {cartItems.map((item) => (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-24 h-24 flex-shrink-0">
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={item.name}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>

                      <div className="flex-grow">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.manufacturer}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{item.horsepower} к.с.</span>
                          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{item.maxSpeed} км/ч</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="font-semibold">{calculateSubtotal(item).toFixed(2)} лв.</span>

                        <div className="flex items-center border rounded">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={processingItem === item.id || item.quantity <= 1}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50"
                            aria-label="Намали количеството"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <span className="px-4 py-1">{item.quantity}</span>

                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={processingItem === item.id}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50"
                            aria-label="Увеличи количеството"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-500 hover:text-red-700 flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          <span className="text-sm">Премахни</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
                <h2 className="text-xl font-semibold mb-4">Резюме на поръчката</h2>

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
                          <p className="text-xs text-green-600 mt-1">
                            Отстъпка: -{appliedPromoCode.discount.toFixed(2)} лв.
                          </p>
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

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Общо:</span>
                    <span>{calculateTotal().toFixed(2)} лв.</span>
                  </div>
                </div>

                <Button onClick={handleCheckout} className="w-full mt-6">
                  Продължи към плащане
                </Button>

                <Link href="/#motorcycles" className="block text-center mt-4 text-gray-600 hover:text-black">
                  Продължи пазаруването
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
