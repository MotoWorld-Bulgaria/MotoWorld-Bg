import type React from "react"
import type { Metadata } from "next"
import { Russo_One } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const russo = Russo_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-russo",
})

export const metadata: Metadata = {
  title: "MotoWorld",
  description: "Изследвайте света на две колела",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="bg">
      <head>
        <link rel="icon" href="/images/favicon.ico.png" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" />
      </head>
      <body className={russo.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

import "./globals.css"
