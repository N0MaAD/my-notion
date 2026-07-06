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

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)

  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      user.value = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
      }
      syncUserProfile(firebaseUser).catch((error) => {
        console.warn('User profile sync failed:', error)
      })
    } else {
      user.value = null
    }
    loading.value = false
  })

  async function syncUserProfile(firebaseUser) {
    const [{ doc, getDoc, setDoc }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('../firestore.js')
    ])
    const userRef = doc(db, 'users', firebaseUser.uid)
    const userSnap = await getDoc(userRef)
    const existing = userSnap.exists() ? userSnap.data() : {}
    await setDoc(userRef, {
      ...existing,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL
    })
  }

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
