"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"

interface RegisterModalProps {
  onClose: () => void
  onSwitchToLogin: () => void
  onSuccessfulRegister?: () => void
}

export default function RegisterModal({ onClose, onSwitchToLogin, onSuccessfulRegister }: RegisterModalProps) {
  const { register } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (password !== confirmPassword) {
      setError("Паролите не съвпадат")
      setIsLoading(false)
      return
    }

    try {
      await register(email, password)
      onClose()
      if (onSuccessfulRegister) {
        onSuccessfulRegister()
      }
    } catch (error) {
      console.error("Registration error:", error)
      setError("Грешка при регистрация. Моля, опитайте отново.")
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

        <h2 className="text-2xl font-bold mb-6 text-white">Регистрация</h2>

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
            placeholder="ПАРОЛА (МИНИМУМ 6 СИМВОЛА)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 bg-white bg-opacity-80 rounded text-black"
            required
          />

          <input
            type="password"
            placeholder="ПОВТОРЕТЕ ПАРОЛАТА"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 mb-4 bg-white bg-opacity-80 rounded text-black"
            required
          />

          <button
            type="submit"
            className="w-full p-3 bg-white text-black rounded font-medium hover:bg-opacity-90 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? "Зареждане..." : "РЕГИСТРИРАЙ СЕ"}
          </button>
        </form>

        <button onClick={onSwitchToLogin} className="mt-4 text-white hover:underline">
          ВЕЧЕ ИМАТЕ АКАУНТ?
        </button>
      </div>
    </div>
  )
}
