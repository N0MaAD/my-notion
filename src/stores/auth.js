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

  // Ecoute les changements d'etat d'authentification
  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      user.value = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
      }
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
