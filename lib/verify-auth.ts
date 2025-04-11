import { firebaseAdmin } from "./firebase-admin"
import { getAuth } from "firebase-admin/auth"

export async function verifyAuthToken(token: string) {
  if (!token || !token.startsWith("Bearer ")) {
    throw new Error("No token provided")
  }

  try {
    const idToken = token.split("Bearer ")[1]
    const decodedToken = await getAuth(firebaseAdmin).verifyIdToken(idToken)
    return decodedToken
  } catch (error) {
    console.error("Error verifying auth token:", error)
    throw new Error("Invalid token")
  }
}
