import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

// Parse Firebase Admin credentials from environment
const getFirebaseAdminConfig = () => {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    const missingVars = []
    if (!projectId) missingVars.push("FIREBASE_ADMIN_PROJECT_ID")
    if (!clientEmail) missingVars.push("FIREBASE_ADMIN_CLIENT_EMAIL")
    if (!privateKey) missingVars.push("FIREBASE_ADMIN_PRIVATE_KEY")
    throw new Error(`Missing Firebase Admin credentials: ${missingVars.join(", ")}`)
  }

  // Handle the private key - normalize newlines
  let processedKey = privateKey.trim()
  
  // Remove surrounding quotes if present (Next.js env vars may include them)
  if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
    processedKey = processedKey.slice(1, -1)
  }
  
  // Replace escaped newlines with actual newlines
  processedKey = processedKey.replace(/\\n/g, "\n")
  
  // Ensure the key is valid
  if (!processedKey.includes("BEGIN PRIVATE KEY") || !processedKey.includes("END PRIVATE KEY")) {
    throw new Error("Invalid private key format: missing BEGIN/END markers")
  }

  return {
    projectId,
    clientEmail,
    privateKey: processedKey,
  }
}

// Initialize Firebase Admin - safely
let firebaseAdmin: any = null
let adminDb: any = null
let initError: Error | null = null

try {
  const creds = getFirebaseAdminConfig()
  const apps = getApps()
  
  if (apps.length === 0) {
    firebaseAdmin = initializeApp({
      credential: cert(creds),
    })
  } else {
    firebaseAdmin = apps[0]
  }
  
  adminDb = getFirestore(firebaseAdmin)
} catch (error) {
  initError = error instanceof Error ? error : new Error(String(error))
}

export { firebaseAdmin, adminDb, initError }

