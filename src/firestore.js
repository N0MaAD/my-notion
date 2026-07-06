import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'
import { app } from './firebase.js'

// Firestore est volontairement initialise dans un module separe afin que la
// page de connexion ne telecharge pas toute la couche base de donnees.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})
