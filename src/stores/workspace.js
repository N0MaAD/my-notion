import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, addDoc, query, where } from 'firebase/firestore'
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
        try {
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
        } catch (e) {
          console.warn('Workspace inaccessible:', wsId, e)
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
      pendingInvites: {},
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
      pendingInvites: {},
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
      pendingInvites: {},
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
    const authStore = useAuthStore()
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return { success: false, error: 'Workspace introuvable' }

    const wsData = wsSnap.data()

    for (const [, info] of Object.entries(wsData.members || {})) {
      if (info.email === email) return { success: false, error: 'Déjà membre' }
    }

    if (wsData.pendingInvites && wsData.pendingInvites[email]) {
      return { success: false, error: 'Invitation déjà envoyée' }
    }

    if (!wsData.pendingInvites) wsData.pendingInvites = {}
    wsData.pendingInvites[email] = {
      role,
      invitedAt: new Date().toISOString(),
      invitedBy: authStore.user.uid
    }
    wsData.updatedAt = new Date().toISOString()
    await setDoc(wsRef, wsData)

    await addDoc(collection(db, 'invites'), {
      email,
      workspaceId,
      workspaceName: wsData.name,
      role,
      invitedBy: authStore.user.uid,
      createdAt: new Date().toISOString()
    })

    return { success: true, pending: true }
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

    const ws = workspaces.value.find(w => w.id === workspaceId)
    if (ws) ws.memberCount = Object.keys(wsData.members).length

    if (memberUid === authStore.user.uid) {
      workspaces.value = workspaces.value.filter(w => w.id !== workspaceId)
      if (activeWorkspaceId.value === workspaceId) {
        activeWorkspaceId.value = workspaces.value[0]?.id || null
      }
      const userRef = getUserDocRef()
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        const userData = userSnap.data()
        userData.workspaceIds = (userData.workspaceIds || []).filter(id => id !== workspaceId)
        if (userData.activeWorkspaceId === workspaceId) {
          userData.activeWorkspaceId = userData.workspaceIds[0] || null
        }
        await setDoc(userRef, userData)
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

  async function getPendingInvites(workspaceId) {
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return []

    const wsData = wsSnap.data()
    const pending = []
    for (const [email, info] of Object.entries(wsData.pendingInvites || {})) {
      pending.push({ email, ...info })
    }
    return pending
  }

  async function checkPendingInvites() {
    const authStore = useAuthStore()
    if (!authStore.user || !authStore.user.email) return

    try {
      const invitesQuery = query(
        collection(db, 'invites'),
        where('email', '==', authStore.user.email)
      )
      const invitesSnap = await getDocs(invitesQuery)

      for (const inviteDoc of invitesSnap.docs) {
        const invite = inviteDoc.data()

        try {
          const wsRef = doc(db, 'workspaces', invite.workspaceId)
          const wsSnap = await getDoc(wsRef)
          if (!wsSnap.exists()) {
            await deleteDoc(inviteDoc.ref)
            continue
          }

          const wsData = wsSnap.data()

          if (wsData.members[authStore.user.uid]) {
            await deleteDoc(inviteDoc.ref)
            continue
          }

          wsData.members[authStore.user.uid] = {
            role: invite.role,
            displayName: authStore.user.displayName || '',
            email: authStore.user.email,
            photoURL: authStore.user.photoURL || '',
            joinedAt: new Date().toISOString()
          }

          if (wsData.pendingInvites) {
            delete wsData.pendingInvites[authStore.user.email]
          }
          wsData.updatedAt = new Date().toISOString()
          await setDoc(wsRef, wsData)

          const userRef = getUserDocRef()
          const userSnap = await getDoc(userRef)
          const userData = userSnap.exists() ? userSnap.data() : {}
          const wsIds = userData.workspaceIds || []
          if (!wsIds.includes(invite.workspaceId)) {
            wsIds.push(invite.workspaceId)
            await setDoc(userRef, { ...userData, workspaceIds: wsIds })
          }

          workspaces.value.push({
            id: invite.workspaceId,
            name: wsData.name,
            icon: wsData.icon,
            type: wsData.type,
            role: invite.role,
            ownerId: wsData.ownerId,
            memberCount: Object.keys(wsData.members).length
          })

          await deleteDoc(inviteDoc.ref)
        } catch (e) {
          console.warn('Erreur acceptation invite:', invite.workspaceId, e)
        }
      }
    } catch (e) {
      console.warn('Erreur vérification invites:', e)
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
    getPendingInvites,
    checkPendingInvites,
    cleanup
  }
})
