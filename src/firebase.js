import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// ─── Configuration Firebase ───
const firebaseConfig = {
  apiKey: 'AIzaSyDBX3YJ-kPTqvMwTXLbt-mqFpl0bjYzcPA',
  authDomain: 'my-notion-8d43b.firebaseapp.com',
  projectId: 'my-notion-8d43b',
  storageBucket: 'my-notion-8d43b.firebasestorage.app',
  messagingSenderId: '580332901129',
  appId: '1:580332901129:web:80c929718ccc907805f9d8'
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Firestore avec persistance locale (mode hors ligne)
// Les donnees sont cachees dans IndexedDB et synchronisees automatiquement
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})

// Storage pour les images uploadees dans les notes
export const storage = getStorage(app)
