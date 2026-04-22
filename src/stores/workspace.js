import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuthStore } from './auth.js'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref([])
  const activeWorkspaceId = ref(null)
  const loading = ref(false)
  const membersInfo = ref({})

  const activeWorkspace = computed(() =>
    workspaces.value.find(w => w.id === activeWorkspaceId.value) || null
  )

  function getWorkspaceDocRef(workspaceId) {
    return doc(db, 'workspaces', workspaceId)
  }

  function getUserDocRef() {
    const authStore = useAuthStore()
    if (!authStore.user) return null
    return doc(db, 'users', authStore.user.uid)
  }

  async function loadWorkspaces() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    loading.value = true

    const userRef = getUserDocRef()
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}

    if (userData.workspaceIds && userData.workspaceIds.length > 0) {
      const wsList = []
      for (const wsId of userData.workspaceIds) {
        const wsRef = getWorkspaceDocRef(wsId)
        const wsSnap = await getDoc(wsRef)
        if (wsSnap.exists()) {
          const wsData = wsSnap.data()
          const memberEntry = wsData.members?.[authStore.user.uid]
          if (memberEntry) {
            wsList.push({
              id: wsId,
              name: wsData.name,
              icon: wsData.icon,
              type: wsData.type,
              role: memberEntry.role,
              ownerId: wsData.ownerId,
              memberCount: Object.keys(wsData.members || {}).length
            })
          }
        }
      }
      workspaces.value = wsList
      activeWorkspaceId.value = userData.activeWorkspaceId || wsList[0]?.id || null
    } else {
      await migrateToWorkspaces()
    }

    loading.value = false
  }

  async function migrateToWorkspaces() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const userRef = getUserDocRef()
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}

    const personalId = crypto.randomUUID()
    const proId = crypto.randomUUID()
    const now = new Date().toISOString()

    const memberEntry = {
      role: 'owner',
      displayName: authStore.user.displayName || '',
      email: authStore.user.email || '',
      photoURL: authStore.user.photoURL || '',
      joinedAt: now
    }

    const personalWs = {
      name: 'Personnel',
      icon: '🏠',
      type: 'personal',
      ownerId: authStore.user.uid,
      members: { [authStore.user.uid]: memberEntry },
      columns: userData.columns || [],
      pins: userData.pins || [],
      trash: userData.trash || [],
      tags: userData.tags || [],
      createdAt: now,
      updatedAt: now
    }

    const proWs = {
      name: 'Professionnel',
      icon: '💼',
      type: 'work',
      ownerId: authStore.user.uid,
      members: { [authStore.user.uid]: memberEntry },
      columns: [],
      pins: [],
      trash: [],
      tags: [],
      createdAt: now,
      updatedAt: now
    }

    await setDoc(doc(db, 'workspaces', personalId), personalWs)
    await setDoc(doc(db, 'workspaces', proId), proWs)

    await setDoc(userRef, {
      ...userData,
      workspaceIds: [personalId, proId],
      activeWorkspaceId: personalId
    })

    workspaces.value = [
      { id: personalId, name: 'Personnel', icon: '🏠', type: 'personal', role: 'owner', ownerId: authStore.user.uid, memberCount: 1 },
      { id: proId, name: 'Professionnel', icon: '💼', type: 'work', role: 'owner', ownerId: authStore.user.uid, memberCount: 1 }
    ]
    activeWorkspaceId.value = personalId
  }

  async function switchWorkspace(workspaceId) {
    if (workspaceId === activeWorkspaceId.value) return
    activeWorkspaceId.value = workspaceId

    const userRef = getUserDocRef()
    if (userRef) {
      const userSnap = await getDoc(userRef)
      const userData = userSnap.exists() ? userSnap.data() : {}
      await setDoc(userRef, { ...userData, activeWorkspaceId: workspaceId })
    }
  }

  async function createWorkspace(name, icon, type = 'shared') {
    const authStore = useAuthStore()
    if (!authStore.user) return null

    const wsId = crypto.randomUUID()
    const now = new Date().toISOString()

    const wsData = {
      name,
      icon: icon || '📁',
      type,
      ownerId: authStore.user.uid,
      members: {
        [authStore.user.uid]: {
          role: 'owner',
          displayName: authStore.user.displayName || '',
          email: authStore.user.email || '',
          photoURL: authStore.user.photoURL || '',
          joinedAt: now
        }
      },
      columns: [],
      pins: [],
      trash: [],
      tags: [],
      createdAt: now,
      updatedAt: now
    }

    await setDoc(doc(db, 'workspaces', wsId), wsData)

    const userRef = getUserDocRef()
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}
    const wsIds = userData.workspaceIds || []
    wsIds.push(wsId)
    await setDoc(userRef, { ...userData, workspaceIds: wsIds })

    workspaces.value.push({
      id: wsId,
      name,
      icon: icon || '📁',
      type,
      role: 'owner',
      ownerId: authStore.user.uid,
      memberCount: 1
    })

    return wsId
  }

  async function updateWorkspace(workspaceId, updates) {
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return

    const wsData = wsSnap.data()
    if (updates.name !== undefined) wsData.name = updates.name
    if (updates.icon !== undefined) wsData.icon = updates.icon
    wsData.updatedAt = new Date().toISOString()

    await setDoc(wsRef, wsData)

    const ws = workspaces.value.find(w => w.id === workspaceId)
    if (ws) {
      if (updates.name !== undefined) ws.name = updates.name
      if (updates.icon !== undefined) ws.icon = updates.icon
    }
  }

  async function deleteWorkspace(workspaceId) {
    if (workspaces.value.length <= 1) return false

    const authStore = useAuthStore()
    const ws = workspaces.value.find(w => w.id === workspaceId)
    if (!ws || ws.ownerId !== authStore.user.uid) return false

    await deleteDoc(doc(db, 'workspaces', workspaceId))

    const userRef = getUserDocRef()
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}
    userData.workspaceIds = (userData.workspaceIds || []).filter(id => id !== workspaceId)

    if (userData.activeWorkspaceId === workspaceId) {
      userData.activeWorkspaceId = userData.workspaceIds[0] || null
    }
    await setDoc(userRef, userData)

    workspaces.value = workspaces.value.filter(w => w.id !== workspaceId)
    if (activeWorkspaceId.value === workspaceId) {
      activeWorkspaceId.value = workspaces.value[0]?.id || null
    }

    return true
  }

  async function inviteMember(workspaceId, email, role = 'editor') {
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return { success: false, error: 'Workspace introuvable' }

    const wsData = wsSnap.data()

    const usersSnap = await getDocs(collection(db, 'users'))

    let targetUid = null
    let targetUser = null
    usersSnap.forEach(docSnap => {
      const data = docSnap.data()
      if (data.email === email) {
        targetUid = docSnap.id
        targetUser = data
      }
    })

    if (!targetUid) {
      if (!wsData.pendingInvites) wsData.pendingInvites = []
      if (!wsData.pendingInvites.some(inv => inv.email === email)) {
        wsData.pendingInvites.push({
          email,
          role,
          invitedAt: new Date().toISOString(),
          invitedBy: useAuthStore().user.uid
        })
      }
      wsData.updatedAt = new Date().toISOString()
      await setDoc(wsRef, wsData)
      return { success: true, pending: true }
    }

    if (wsData.members[targetUid]) {
      return { success: false, error: 'Déjà membre' }
    }

    wsData.members[targetUid] = {
      role,
      displayName: targetUser.displayName || email,
      email,
      photoURL: targetUser.photoURL || '',
      joinedAt: new Date().toISOString()
    }
    wsData.updatedAt = new Date().toISOString()
    await setDoc(wsRef, wsData)

    const targetUserRef = doc(db, 'users', targetUid)
    const targetUserSnap = await getDoc(targetUserRef)
    const targetUserData = targetUserSnap.exists() ? targetUserSnap.data() : {}
    const targetWsIds = targetUserData.workspaceIds || []
    if (!targetWsIds.includes(workspaceId)) {
      targetWsIds.push(workspaceId)
      await setDoc(targetUserRef, { ...targetUserData, workspaceIds: targetWsIds })
    }

    const ws = workspaces.value.find(w => w.id === workspaceId)
    if (ws) ws.memberCount = Object.keys(wsData.members).length

    return { success: true, pending: false }
  }

  async function removeMember(workspaceId, memberUid) {
    const authStore = useAuthStore()
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return false

    const wsData = wsSnap.data()
    if (wsData.ownerId === memberUid) return false
    if (wsData.ownerId !== authStore.user.uid && memberUid !== authStore.user.uid) return false

    delete wsData.members[memberUid]
    wsData.updatedAt = new Date().toISOString()
    await setDoc(wsRef, wsData)

    const memberUserRef = doc(db, 'users', memberUid)
    const memberUserSnap = await getDoc(memberUserRef)
    if (memberUserSnap.exists()) {
      const memberUserData = memberUserSnap.data()
      memberUserData.workspaceIds = (memberUserData.workspaceIds || []).filter(id => id !== workspaceId)
      if (memberUserData.activeWorkspaceId === workspaceId) {
        memberUserData.activeWorkspaceId = memberUserData.workspaceIds[0] || null
      }
      await setDoc(memberUserRef, memberUserData)
    }

    const ws = workspaces.value.find(w => w.id === workspaceId)
    if (ws) ws.memberCount = Object.keys(wsData.members).length

    if (memberUid === authStore.user.uid) {
      workspaces.value = workspaces.value.filter(w => w.id !== workspaceId)
      if (activeWorkspaceId.value === workspaceId) {
        activeWorkspaceId.value = workspaces.value[0]?.id || null
      }
    }

    return true
  }

  async function loadWorkspaceMembers(workspaceId) {
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return []

    const wsData = wsSnap.data()
    const members = []
    for (const [uid, info] of Object.entries(wsData.members || {})) {
      members.push({ uid, ...info })
    }
    membersInfo.value = { ...membersInfo.value, [workspaceId]: members }
    return members
  }

  async function checkPendingInvites() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const wsSnap = await getDocs(collection(db, 'workspaces'))

    for (const wsDoc of wsSnap.docs) {
      const wsData = wsDoc.data()
      if (!wsData.pendingInvites) continue

      const invite = wsData.pendingInvites.find(inv => inv.email === authStore.user.email)
      if (!invite) continue

      wsData.members[authStore.user.uid] = {
        role: invite.role,
        displayName: authStore.user.displayName || '',
        email: authStore.user.email,
        photoURL: authStore.user.photoURL || '',
        joinedAt: new Date().toISOString()
      }
      wsData.pendingInvites = wsData.pendingInvites.filter(inv => inv.email !== authStore.user.email)
      wsData.updatedAt = new Date().toISOString()
      await setDoc(doc(db, 'workspaces', wsDoc.id), wsData)

      const userRef = getUserDocRef()
      const userSnap = await getDoc(userRef)
      const userData = userSnap.exists() ? userSnap.data() : {}
      const wsIds = userData.workspaceIds || []
      if (!wsIds.includes(wsDoc.id)) {
        wsIds.push(wsDoc.id)
        await setDoc(userRef, { ...userData, workspaceIds: wsIds })
      }

      workspaces.value.push({
        id: wsDoc.id,
        name: wsData.name,
        icon: wsData.icon,
        type: wsData.type,
        role: invite.role,
        ownerId: wsData.ownerId,
        memberCount: Object.keys(wsData.members).length
      })
    }
  }

  function cleanup() {
    workspaces.value = []
    activeWorkspaceId.value = null
    membersInfo.value = {}
  }

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    loading,
    membersInfo,
    loadWorkspaces,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMember,
    removeMember,
    loadWorkspaceMembers,
    checkPendingInvites,
    cleanup
  }
})
