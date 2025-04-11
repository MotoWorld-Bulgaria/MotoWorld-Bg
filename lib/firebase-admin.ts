import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
}

export const firebaseAdmin = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0]

export const adminDb = getFirestore(firebaseAdmin)
