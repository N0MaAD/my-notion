import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// ─── Configuration Firebase ───
// Remplace ces valeurs par celles de ton projet Firebase
// (Console Firebase > Parametres du projet > Config)
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
export const db = getFirestore(app)
