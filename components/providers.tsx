"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { GarageProvider } from "@/lib/garage-context"

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <GarageProvider>{children}</GarageProvider>
    </AuthProvider>
  )
}
