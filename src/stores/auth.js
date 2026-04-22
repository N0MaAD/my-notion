import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth'
import { auth } from '../firebase.js'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      user.value = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
      }
      const userRef = doc(db, 'users', firebaseUser.uid)
      const userSnap = await getDoc(userRef)
      const existing = userSnap.exists() ? userSnap.data() : {}
      await setDoc(userRef, {
        ...existing,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL
      })
    } else {
      user.value = null
    }
    loading.value = false
  })

  async function loginWithGoogle(rememberMe = false) {
    const persistence = rememberMe
      ? browserLocalPersistence
      : browserSessionPersistence

    await setPersistence(auth, persistence)

    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  async function logout() {
    await signOut(auth)
  }

  return {
    user,
    loading,
    loginWithGoogle,
    logout
  }
})
