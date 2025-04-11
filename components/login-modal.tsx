"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useGarage } from "@/lib/garage-context"
import { useRouter } from "next/navigation"

interface LoginModalProps {
  onClose: () => void
  onSwitchToRegister: () => void
  onSuccessfulLogin?: () => void
}

export default function LoginModal({ onClose, onSwitchToRegister, onSuccessfulLogin }: LoginModalProps) {
  const { signIn } = useAuth()
  const { syncLocalCart, addToGarage } = useGarage()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Modify the handleSubmit function to handle direct checkout after login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      await signIn(email, password)
      onClose()
      if (onSuccessfulLogin) {
        onSuccessfulLogin()
      }
    } catch (error) {
      console.error("Login error:", error)
      setError("Грешен имейл или парола")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-3 left-3 text-white text-xl" onClick={onClose}>
          &times;
        </button>

        <h2 className="text-2xl font-bold mb-6 text-white">Вход</h2>

        {error && <div className="bg-red-500 bg-opacity-20 text-white p-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="ИМЕЙЛ"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 bg-white bg-opacity-80 rounded text-black"
            required
          />

          <input
            type="password"
            placeholder="ПАРОЛА"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 bg-white bg-opacity-80 rounded text-black"
            required
          />

          <button
            type="submit"
            className="w-full p-3 bg-white text-black rounded font-medium hover:bg-opacity-90 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? "Зареждане..." : "ВЛЕЗ"}
          </button>
        </form>

        <button onClick={onSwitchToRegister} className="mt-4 text-white hover:underline">
          НЯМАТЕ АКАУНТ?
        </button>
      </div>
    </div>
  )
}
