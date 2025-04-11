"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import {
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { auth, db } from "./firebase"

interface AuthContextType {
  user: User | null
  register: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  register: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  loading: true,
})

export const useAuth = () => useContext(AuthContext)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const register = async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        displayName: user.displayName || email.split("@")[0],
        photoURL: user.photoURL || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
      })

      return
    } catch (error) {
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      return
    } catch (error) {
      throw error
    }
  }

  const value = {
    user,
    register,
    signIn,
    signOut,
    loading,
  }

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}
