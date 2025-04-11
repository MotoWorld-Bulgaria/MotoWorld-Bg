import { type NextRequest, NextResponse } from "next/server"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("productId")
    const quantity = searchParams.get("quantity")
    const products = searchParams.get("products")

    // Check single product
    if (productId && quantity) {
      const productDoc = await getDoc(doc(db, "motors", productId))

      if (!productDoc.exists()) {
        return NextResponse.json({
          available: false,
          message: "Продуктът не е намерен",
        })
      }

      const productData = productDoc.data()
      const availableQuantity = productData.inventory || 10 // Default to 10 if not set

      if (Number.parseInt(quantity) > availableQuantity) {
        return NextResponse.json({
          available: false,
          availableQuantity,
          message: `Само ${availableQuantity} бр. налични от този продукт.`,
        })
      }

      return NextResponse.json({ available: true })
    }

    // Check multiple products
    if (products) {
      const productList = products.split(",")
      const unavailableProducts = []

      for (const productInfo of productList) {
        const [id, requestedQuantity] = productInfo.split(":")
        const productDoc = await getDoc(doc(db, "motors", id))

        if (!productDoc.exists()) {
          unavailableProducts.push({
            id,
            name: "Неизвестен продукт",
            message: "Продуктът не е намерен",
          })
          continue
        }

        const productData = productDoc.data()
        const availableQuantity = productData.inventory || 10 // Default to 10 if not set

        if (Number.parseInt(requestedQuantity) > availableQuantity) {
          unavailableProducts.push({
            id,
            name: productData.name,
            availableQuantity,
            message: `Само ${availableQuantity} бр. налични.`,
          })
        }
      }

      if (unavailableProducts.length > 0) {
        return NextResponse.json({
          available: false,
          unavailableProducts,
          message: "Някои продукти не са налични в желаното количество.",
        })
      }

      return NextResponse.json({ available: true })
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
  } catch (error: any) {
    console.error("Error checking inventory:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
