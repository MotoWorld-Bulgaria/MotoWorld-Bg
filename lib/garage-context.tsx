"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { doc, getDoc, setDoc, updateDoc, deleteField, onSnapshot } from "firebase/firestore"
import { db } from "./firebase"
import { useAuth } from "./auth-context"
import type { CartItem } from "./types"
import { toast } from "@/components/ui/use-toast"

interface GarageContextType {
  cartItems: CartItem[]
  loading: boolean
  error: string | null
  addToGarage: (item: CartItem) => Promise<void>
  removeFromGarage: (itemId: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  clearGarage: () => Promise<void>
  syncLocalCart: () => Promise<void>
}

const GarageContext = createContext<GarageContextType>({
  cartItems: [],
  loading: true,
  error: null,
  addToGarage: async () => {},
  removeFromGarage: async () => {},
  updateQuantity: async () => {},
  clearGarage: async () => {},
  syncLocalCart: async () => {},
})

export const useGarage = () => useContext(GarageContext)

interface GarageProviderProps {
  children: ReactNode
}

export const GarageProvider = ({ children }: GarageProviderProps) => {
  const { user } = useAuth()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null)

  // Subscribe to garage changes when user is authenticated
  useEffect(() => {
    if (user) {
      setLoading(true)

      // Create a reference to the user's garage document
      const garageRef = doc(db, "garages", user.uid)

      // Subscribe to real-time updates
      const unsubscribeListener = onSnapshot(
        garageRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data()
            const items: CartItem[] = []

            // Convert the document data to an array of cart items
            for (const [itemId, itemData] of Object.entries(data)) {
              if (itemId !== "userId") {
                items.push({
                  id: itemId,
                  ...(itemData as Omit<CartItem, "id">),
                })
              }
            }

            setCartItems(items)
          } else {
            // If the document doesn't exist, create it with an empty cart
            setDoc(garageRef, { userId: user.uid }).catch((err) => {
              console.error("Error creating garage document:", err)
              setError("Failed to initialize garage")
            })
            setCartItems([])
          }
          setLoading(false)
        },
        (err) => {
          console.error("Error subscribing to garage updates:", err)
          setError("Failed to load garage data")
          setLoading(false)
        },
      )

      setUnsubscribe(() => unsubscribeListener)

      // Attempt to sync any local cart data when user logs in
      syncLocalCart()

      return () => {
        if (unsubscribeListener) {
          unsubscribeListener()
        }
      }
    } else {
      // If user is not authenticated, load from localStorage
      if (typeof window !== "undefined") {
        const storedCart = localStorage.getItem("motoCart")
        if (storedCart) {
          setCartItems(JSON.parse(storedCart))
        } else {
          setCartItems([])
        }
      }
      setLoading(false)

      // Clean up any existing subscription
      if (unsubscribe) {
        unsubscribe()
        setUnsubscribe(null)
      }
    }
  }, [user])

  // Sync local cart data with Firebase when user logs in
  const syncLocalCart = async () => {
    if (!user) return

    try {
      const localCart = localStorage.getItem("motoCart")
      if (!localCart) return

      const localCartItems: CartItem[] = JSON.parse(localCart)
      if (localCartItems.length === 0) return

      const garageRef = doc(db, "garages", user.uid)
      const garageDoc = await getDoc(garageRef)

      if (garageDoc.exists()) {
        // Merge local cart with Firebase cart
        const updates: Record<string, any> = {}

        localCartItems.forEach((item) => {
          updates[item.id] = {
            name: item.name,
            manufacturer: item.manufacturer,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            horsepower: item.horsepower,
            maxSpeed: item.maxSpeed,
            torque: item.torque,
          }
        })

        await updateDoc(garageRef, updates)

        // Clear local cart after syncing
        localStorage.removeItem("motoCart")

        toast({
          title: "Гаражът е синхронизиран",
          description: "Вашият локален гараж беше успешно синхронизиран с акаунта ви.",
        })
      } else {
        // Create new garage document with local cart items
        const garageData: Record<string, any> = { userId: user.uid }

        localCartItems.forEach((item) => {
          garageData[item.id] = {
            name: item.name,
            manufacturer: item.manufacturer,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            horsepower: item.horsepower,
            maxSpeed: item.maxSpeed,
            torque: item.torque,
          }
        })

        await setDoc(garageRef, garageData)

        // Clear local cart after syncing
        localStorage.removeItem("motoCart")

        toast({
          title: "Гаражът е синхронизиран",
          description: "Вашият локален гараж беше успешно синхронизиран с акаунта ви.",
        })
      }
    } catch (error) {
      console.error("Error syncing local cart:", error)
      setError("Failed to sync local cart")
    }
  }

  // Add item to garage
  const addToGarage = async (item: CartItem) => {
    try {
      if (user) {
        // Add to Firebase if user is authenticated
        const garageRef = doc(db, "garages", user.uid)
        const garageDoc = await getDoc(garageRef)

        if (garageDoc.exists()) {
          const data = garageDoc.data()

          // Check if item already exists
          if (data[item.id]) {
            // Update quantity if item exists
            const existingItem = data[item.id] as Omit<CartItem, "id">
            await updateDoc(garageRef, {
              [item.id]: {
                ...existingItem,
                quantity: existingItem.quantity + item.quantity,
              },
            })
          } else {
            // Add new item
            await updateDoc(garageRef, {
              [item.id]: {
                name: item.name,
                manufacturer: item.manufacturer,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                horsepower: item.horsepower,
                maxSpeed: item.maxSpeed,
                torque: item.torque,
              },
            })
          }
        } else {
          // Create new garage document
          const garageData: Record<string, any> = { userId: user.uid }
          garageData[item.id] = {
            name: item.name,
            manufacturer: item.manufacturer,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            horsepower: item.horsepower,
            maxSpeed: item.maxSpeed,
            torque: item.torque,
          }

          await setDoc(garageRef, garageData)
        }
      } else {
        // Add to localStorage if user is not authenticated
        const storedCart = localStorage.getItem("motoCart")
        const cart: CartItem[] = storedCart ? JSON.parse(storedCart) : []

        // Check if item already exists
        const existingItemIndex = cart.findIndex((cartItem) => cartItem.id === item.id)

        if (existingItemIndex >= 0) {
          // Update quantity if item exists
          cart[existingItemIndex].quantity += item.quantity
        } else {
          // Add new item
          cart.push(item)
        }

        localStorage.setItem("motoCart", JSON.stringify(cart))
        setCartItems(cart)
      }
    } catch (error) {
      console.error("Error adding item to garage:", error)
      setError("Failed to add item to garage")
      throw error
    }
  }

  // Remove item from garage
  const removeFromGarage = async (itemId: string) => {
    try {
      if (user) {
        // Remove from Firebase if user is authenticated
        const garageRef = doc(db, "garages", user.uid)
        await updateDoc(garageRef, {
          [itemId]: deleteField(),
        })
      } else {
        // Remove from localStorage if user is not authenticated
        const storedCart = localStorage.getItem("motoCart")
        if (storedCart) {
          const cart: CartItem[] = JSON.parse(storedCart)
          const updatedCart = cart.filter((item) => item.id !== itemId)
          localStorage.setItem("motoCart", JSON.stringify(updatedCart))
          setCartItems(updatedCart)
        }
      }
    } catch (error) {
      console.error("Error removing item from garage:", error)
      setError("Failed to remove item from garage")
      throw error
    }
  }

  // Update item quantity
  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      if (quantity < 1) return

      if (user) {
        // Update in Firebase if user is authenticated
        const garageRef = doc(db, "garages", user.uid)
        const garageDoc = await getDoc(garageRef)

        if (garageDoc.exists()) {
          const data = garageDoc.data()

          if (data[itemId]) {
            const item = data[itemId] as Omit<CartItem, "id">
            await updateDoc(garageRef, {
              [itemId]: {
                ...item,
                quantity: quantity,
              },
            })
          }
        }
      } else {
        // Update in localStorage if user is not authenticated
        const storedCart = localStorage.getItem("motoCart")
        if (storedCart) {
          const cart: CartItem[] = JSON.parse(storedCart)
          const updatedCart = cart.map((item) => (item.id === itemId ? { ...item, quantity } : item))
          localStorage.setItem("motoCart", JSON.stringify(updatedCart))
          setCartItems(updatedCart)
        }
      }
    } catch (error) {
      console.error("Error updating item quantity:", error)
      setError("Failed to update item quantity")
      throw error
    }
  }

  // Clear garage
  const clearGarage = async () => {
    try {
      if (user) {
        // Clear Firebase garage if user is authenticated
        const garageRef = doc(db, "garages", user.uid)
        await setDoc(garageRef, { userId: user.uid })
      } else {
        // Clear localStorage if user is not authenticated
        localStorage.removeItem("motoCart")
        setCartItems([])
      }
    } catch (error) {
      console.error("Error clearing garage:", error)
      setError("Failed to clear garage")
      throw error
    }
  }

  return (
    <GarageContext.Provider
      value={{
        cartItems,
        loading,
        error,
        addToGarage,
        removeFromGarage,
        updateQuantity,
        clearGarage,
        syncLocalCart,
      }}
    >
      {children}
    </GarageContext.Provider>
  )
}
