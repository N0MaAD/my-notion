import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'

// ─── Configuration Firebase ───
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDBX3YJ-kPTqvMwTXLbt-mqFpl0bjYzcPA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'my-notion-8d43b.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'my-notion-8d43b',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'my-notion-8d43b.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '580332901129',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:580332901129:web:80c929718ccc907805f9d8'
}

const app = initializeApp(firebaseConfig)
export { app }
export const auth = getAuth(app)

// Firestore avec persistance locale (mode hors ligne)
// Les donnees sont cachees dans IndexedDB et synchronisees automatiquement
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})
