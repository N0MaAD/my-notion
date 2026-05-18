import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { app } from './firebase.js'
import { db } from './firebase.js'

let messaging = null

function getMsg() {
  if (!messaging) messaging = getMessaging(app)
  return messaging
}

export async function registerPush(userId) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const vapidKey = await getVapidKey()
    if (!vapidKey) {
      console.warn('No VAPID key configured in Firestore config/fcm')
      return null
    }
    const token = await getToken(getMsg(), {
      vapidKey,
      serviceWorkerRegistration: registration
    })
    if (token) {
      await saveToken(userId, token)
    }
    return token
  } catch (e) {
    console.warn('Push registration failed:', e)
    return null
  }
}

export function listenForegroundMessages(callback) {
  try {
    return onMessage(getMsg(), callback)
  } catch {
    return () => {}
  }
}

async function saveToken(userId, token) {
  const ref = doc(db, 'pushTokens', userId)
  const snap = await getDoc(ref)
  const tokens = snap.exists() ? (snap.data().tokens || {}) : {}
  tokens[token] = { updatedAt: new Date().toISOString(), userAgent: navigator.userAgent }
  await setDoc(ref, { tokens }, { merge: true })
}

export async function removeToken(userId, token) {
  if (!token) return
  const ref = doc(db, 'pushTokens', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const tokens = snap.data().tokens || {}
  delete tokens[token]
  await setDoc(ref, { tokens })
}

async function getVapidKey() {
  try {
    const snap = await getDoc(doc(db, 'config', 'fcm'))
    if (snap.exists()) return snap.data().vapidKey || ''
  } catch { /* offline or missing */ }
  return ''
}
