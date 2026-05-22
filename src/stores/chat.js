import { defineStore } from 'pinia'
import { ref } from 'vue'
import { collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuthStore } from './auth.js'

export const useChatStore = defineStore('chat', () => {
  const messages = ref([])
  const loading = ref(false)
  let unsub = null
  let activeWsId = null

  function listen(wsId) {
    if (activeWsId === wsId && unsub) return
    stop()
    activeWsId = wsId
    loading.value = true

    const q = query(
      collection(db, 'workspaceChats', wsId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(100)
    )

    unsub = onSnapshot(q, (snap) => {
      messages.value = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse()
      loading.value = false
    }, () => {
      loading.value = false
    })
  }

  function stop() {
    if (unsub) { unsub(); unsub = null }
    activeWsId = null
    messages.value = []
  }

  async function send(wsId, text) {
    const auth = useAuthStore()
    if (!auth.user || !text.trim()) return
    await addDoc(collection(db, 'workspaceChats', wsId, 'messages'), {
      userId: auth.user.uid,
      userName: auth.user.displayName || auth.user.email,
      userPhoto: auth.user.photoURL || '',
      text: text.trim(),
      createdAt: new Date().toISOString()
    })
  }

  return { messages, loading, listen, stop, send }
})
