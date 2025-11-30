import { firebaseAdmin, initError } from "./firebase-admin"
import { getAuth } from "firebase-admin/auth"

export async function verifyAuthToken(token: string) {
  if (!token || !token.startsWith("Bearer ")) {
    throw new Error("No token provided")
  }

  if (!firebaseAdmin) {
    console.error("Firebase Admin not initialized")
    if (initError) {
      throw new Error(`Firebase Admin initialization failed: ${initError.message}`)
    }
    throw new Error("Firebase Admin not initialized")
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
