"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useGarage } from "@/lib/garage-context"
import type { Motorcycle, CartItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Warehouse } from "lucide-react"
import LoginModal from "./login-modal"
import RegisterModal from "./register-modal"

interface MotorcycleCardProps {
  motorcycle: Motorcycle
}

interface PopupProps {
  motorcycle: Motorcycle
  onClose: () => void
}

const AddedToCartPopup = ({ motorcycle, onClose }: PopupProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl transform transition-all animate-scale-in">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <Warehouse className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Добавено в гаража!</h3>
          <img
            src={motorcycle.image || "/placeholder.svg"}
            alt={motorcycle.name}
            className="w-32 h-32 object-cover mx-auto rounded-lg mb-4"
          />
          <p className="text-gray-600 mb-4">{motorcycle.name} беше добавен успешно във вашия гараж</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onClose}>
              Продължи пазаруването
            </Button>
            <Button onClick={() => (window.location.href = "/cart")}>Към гаража</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MotorcycleCard({ motorcycle }: MotorcycleCardProps) {
  const { user } = useAuth()
  const { addToGarage } = useGarage()
  const router = useRouter()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [pendingMotorcycle, setPendingMotorcycle] = useState<Motorcycle | null>(null)

  const handleAddToCart = async () => {
    if (!user) {
      setPendingMotorcycle(motorcycle)
      setShowLoginModal(true)
      return
    }

    await addToCartAndShowPopup()
  }

  const addToCartAndShowPopup = async () => {
    setIsAddingToCart(true)

    try {
      const cartItem: CartItem = {
        id: motorcycle.id,
        name: motorcycle.name,
        manufacturer: motorcycle.manufacturer,
        price: typeof motorcycle.price === "string" ? Number.parseFloat(motorcycle.price) : motorcycle.price,
        quantity: 1,
        image: motorcycle.image,
        horsepower: motorcycle.horsepower,
        maxSpeed: motorcycle.maxSpeed,
        torque: motorcycle.torque,
      }
      

      await addToGarage(cartItem)
      setShowPopup(true)
    } catch (error) {
      console.error("Error adding to cart:", error)
      toast({
        title: "Грешка",
        description: "Възникна проблем при добавянето в гаража.",
        variant: "destructive",
      })
    } finally {
      setIsAddingToCart(false)
    }
  }

  const closeModals = () => {
    setShowLoginModal(false)
    setShowRegisterModal(false)
    setPendingMotorcycle(null)
  }

  const switchToRegister = () => {
    setShowLoginModal(false)
    setShowRegisterModal(true)
  }

  const switchToLogin = () => {
    setShowRegisterModal(false)
    setShowLoginModal(true)
  }

  const handleSuccessfulLogin = async () => {
    closeModals()
    if (pendingMotorcycle) {
      await addToCartAndShowPopup()
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg overflow-hidden flex flex-col md:flex-row max-w-full hover:shadow-md transition-shadow">
        <div className="w-full md:w-1/3 h-40 md:h-auto relative overflow-hidden">
          <img
            src={motorcycle.image || "/placeholder.svg"}
            alt={motorcycle.name}
            className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
          />
        </div>

        <div className="p-4 w-full md:w-2/3">
          <h3 className="text-xl font-semibold mb-3">{motorcycle.name}</h3>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            <span className="text-gray-600">Производител:</span>
            <span>{motorcycle.manufacturer}</span>

            <span className="text-gray-600">Макс. скорост:</span>
            <span>{motorcycle.maxSpeed} км/ч</span>

            <span className="text-gray-600">Конски сили:</span>
            <span>{motorcycle.horsepower}</span>

            <span className="text-gray-600">Въртящ момент:</span>
            <span>{motorcycle.torque} Nm</span>
          </div>

          <div className="flex items-center justify-between mt-auto">
            <span className="text-lg font-bold">{motorcycle.price} BGN</span>
            <Button
                variant="outline"
                size="sm"
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="flex items-center"
              >
                <Warehouse className="w-4 h-4 mr-1" />
                {isAddingToCart ? "Добавяне..." : "Добави в гаража"}
              </Button>
          </div>
        </div>
      </div>

      {showPopup && <AddedToCartPopup motorcycle={motorcycle} onClose={() => setShowPopup(false)} />}

      {showLoginModal && (
        <LoginModal 
          onClose={closeModals} 
          onSwitchToRegister={switchToRegister} 
          onSuccessfulLogin={handleSuccessfulLogin}
        />
      )}
      
      {showRegisterModal && (
        <RegisterModal 
          onClose={closeModals} 
          onSwitchToLogin={switchToLogin}
          onSuccessfulRegister={handleSuccessfulLogin}
        />
      )}
    </>
  )
}
