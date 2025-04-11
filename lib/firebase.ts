import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDpJhUe5vwF7WRHCXzOlhqktZBazOwnU2E",
  authDomain: "moto-bcb2b.firebaseapp.com",
  projectId: "moto-bcb2b",
  storageBucket: "moto-bcb2b.firebasestorage.app",
  messagingSenderId: "57659561149",
  appId: "1:57659561149:web:37ebea6b4410295295d3d4",
  measurementId: "G-TDBHGSMXG6",
}

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

export { app, auth, db, firebaseConfig }
