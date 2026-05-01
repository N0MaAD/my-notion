import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, addDoc, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuthStore } from './auth.js'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref([])
  const activeWorkspaceIds = ref([])
  const loading = ref(false)
  const membersInfo = ref({})

  const activeWorkspace = computed(() =>
    workspaces.value.find(w => w.id === activeWorkspaceIds.value[0]) || null
  )

  const primaryWorkspaceId = computed(() => activeWorkspaceIds.value[0] || null)

  const multiWorkspaceActive = computed(() => activeWorkspaceIds.value.length > 1)

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

      // Restore active IDs (default: first workspace only)
      const savedIds = userData.activeWorkspaceIds || []
      const validIds = savedIds.filter(id => wsList.some(w => w.id === id))
      activeWorkspaceIds.value = validIds.length > 0 ? validIds : (wsList[0] ? [wsList[0].id] : [])
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

    await setDoc(doc(db, 'workspaces', personalId), {
      name: 'Personnel', icon: '🏠', type: 'personal',
      ownerId: authStore.user.uid,
      members: { [authStore.user.uid]: memberEntry },
      columns: userData.columns || [], pins: userData.pins || [],
      trash: userData.trash || [], tags: userData.tags || [],
      pendingInvites: {}, createdAt: now, updatedAt: now
    })

    await setDoc(doc(db, 'workspaces', proId), {
      name: 'Professionnel', icon: '💼', type: 'work',
      ownerId: authStore.user.uid,
      members: { [authStore.user.uid]: memberEntry },
      columns: [], pins: [], trash: [], tags: [],
      pendingInvites: {}, createdAt: now, updatedAt: now
    })

    await setDoc(userRef, {
      ...userData,
      workspaceIds: [personalId, proId],
      activeWorkspaceIds: [personalId]
    })

    workspaces.value = [
      { id: personalId, name: 'Personnel', icon: '🏠', type: 'personal', role: 'owner', ownerId: authStore.user.uid, memberCount: 1 },
      { id: proId, name: 'Professionnel', icon: '💼', type: 'work', role: 'owner', ownerId: authStore.user.uid, memberCount: 1 }
    ]
    activeWorkspaceIds.value = [personalId]
  }

  async function toggleWorkspace(workspaceId) {
    const idx = activeWorkspaceIds.value.indexOf(workspaceId)
    if (idx !== -1) {
      if (activeWorkspaceIds.value.length <= 1) return false // must keep at least one
      activeWorkspaceIds.value.splice(idx, 1)
    } else {
      activeWorkspaceIds.value.push(workspaceId)
    }
    await persistActiveIds()
    return true
  }

  async function persistActiveIds() {
    const userRef = getUserDocRef()
    if (!userRef) return
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}
    await setDoc(userRef, { ...userData, activeWorkspaceIds: activeWorkspaceIds.value })
  }

  async function createWorkspace(name, icon, type = 'shared') {
    const authStore = useAuthStore()
    if (!authStore.user) return null

    const wsId = crypto.randomUUID()
    const now = new Date().toISOString()

    await setDoc(doc(db, 'workspaces', wsId), {
      name, icon: icon || '📁', type,
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
      columns: [], pins: [], trash: [], tags: [],
      pendingInvites: {}, createdAt: now, updatedAt: now
    })

    const userRef = getUserDocRef()
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}
    const wsIds = userData.workspaceIds || []
    wsIds.push(wsId)
    await setDoc(userRef, { ...userData, workspaceIds: wsIds })

    workspaces.value.push({ id: wsId, name, icon: icon || '📁', type, role: 'owner', ownerId: authStore.user.uid, memberCount: 1 })
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
    userData.activeWorkspaceIds = (userData.activeWorkspaceIds || []).filter(id => id !== workspaceId)
    if (!userData.activeWorkspaceIds.length) userData.activeWorkspaceIds = [userData.workspaceIds[0]]
    await setDoc(userRef, userData)

    workspaces.value = workspaces.value.filter(w => w.id !== workspaceId)
    activeWorkspaceIds.value = activeWorkspaceIds.value.filter(id => id !== workspaceId)
    if (!activeWorkspaceIds.value.length && workspaces.value.length) {
      activeWorkspaceIds.value = [workspaces.value[0].id]
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
    if (wsData.pendingInvites?.[email]) return { success: false, error: 'Invitation déjà envoyée' }

    if (!wsData.pendingInvites) wsData.pendingInvites = {}
    wsData.pendingInvites[email] = { role, invitedAt: new Date().toISOString(), invitedBy: authStore.user.uid }
    wsData.updatedAt = new Date().toISOString()
    await setDoc(wsRef, wsData)

    await addDoc(collection(db, 'invites'), {
      email, workspaceId, workspaceName: wsData.name, role,
      invitedBy: authStore.user.uid, createdAt: new Date().toISOString()
    })
    return { success: true }
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
      activeWorkspaceIds.value = activeWorkspaceIds.value.filter(id => id !== workspaceId)
      if (!activeWorkspaceIds.value.length && workspaces.value.length) {
        activeWorkspaceIds.value = [workspaces.value[0].id]
      }
      const userRef = getUserDocRef()
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        const userData = userSnap.data()
        userData.workspaceIds = (userData.workspaceIds || []).filter(id => id !== workspaceId)
        userData.activeWorkspaceIds = activeWorkspaceIds.value
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
    const members = Object.entries(wsData.members || {}).map(([uid, info]) => ({ uid, ...info }))
    membersInfo.value = { ...membersInfo.value, [workspaceId]: members }
    return members
  }

  async function getPendingInvites(workspaceId) {
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return []
    return Object.entries(wsSnap.data().pendingInvites || {}).map(([email, info]) => ({ email, ...info }))
  }

  async function generateShareLink(workspaceId, role = 'editor') {
    const authStore = useAuthStore()
    if (!authStore.user) return null
    const wsRef = getWorkspaceDocRef(workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return null
    const wsData = wsSnap.data()
    if (wsData.ownerId !== authStore.user.uid) return null

    const token = crypto.randomUUID()
    await setDoc(doc(db, 'shareLinks', token), {
      workspaceId,
      workspaceName: wsData.name,
      workspaceIcon: wsData.icon || '📁',
      role,
      createdBy: authStore.user.uid,
      createdAt: new Date().toISOString(),
      active: true
    })
    return token
  }

  async function getShareLinks(workspaceId) {
    const snap = await getDocs(query(collection(db, 'shareLinks'), where('workspaceId', '==', workspaceId), where('active', '==', true)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  async function revokeShareLink(token) {
    const linkRef = doc(db, 'shareLinks', token)
    const snap = await getDoc(linkRef)
    if (!snap.exists()) return
    await setDoc(linkRef, { ...snap.data(), active: false })
  }

  async function joinViaShareLink(token) {
    const authStore = useAuthStore()
    if (!authStore.user) return { success: false, error: 'Non connecté' }

    const linkRef = doc(db, 'shareLinks', token)
    const linkSnap = await getDoc(linkRef)
    if (!linkSnap.exists()) return { success: false, error: 'Lien invalide ou expiré' }
    const linkData = linkSnap.data()
    if (!linkData.active) return { success: false, error: 'Ce lien a été révoqué' }

    const wsRef = getWorkspaceDocRef(linkData.workspaceId)
    const wsSnap = await getDoc(wsRef)
    if (!wsSnap.exists()) return { success: false, error: 'Espace introuvable' }
    const wsData = wsSnap.data()

    if (wsData.members[authStore.user.uid]) {
      return { success: true, alreadyMember: true, workspaceId: linkData.workspaceId }
    }

    wsData.members[authStore.user.uid] = {
      role: linkData.role,
      displayName: authStore.user.displayName || '',
      email: authStore.user.email || '',
      photoURL: authStore.user.photoURL || '',
      joinedAt: new Date().toISOString()
    }
    wsData.updatedAt = new Date().toISOString()
    await setDoc(wsRef, wsData)

    const userRef = getUserDocRef()
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}
    const wsIds = userData.workspaceIds || []
    if (!wsIds.includes(linkData.workspaceId)) {
      wsIds.push(linkData.workspaceId)
      await setDoc(userRef, { ...userData, workspaceIds: wsIds })
    }

    workspaces.value.push({
      id: linkData.workspaceId, name: wsData.name, icon: wsData.icon,
      type: wsData.type, role: linkData.role, ownerId: wsData.ownerId,
      memberCount: Object.keys(wsData.members).length
    })

    return { success: true, workspaceId: linkData.workspaceId }
  }

  async function getShareLinkInfo(token) {
    const linkRef = doc(db, 'shareLinks', token)
    const linkSnap = await getDoc(linkRef)
    if (!linkSnap.exists()) return null
    const data = linkSnap.data()
    if (!data.active) return null
    return data
  }

  async function checkPendingInvites() {
    const authStore = useAuthStore()
    if (!authStore.user?.email) return
    try {
      const invitesSnap = await getDocs(query(collection(db, 'invites'), where('email', '==', authStore.user.email)))
      for (const inviteDoc of invitesSnap.docs) {
        const invite = inviteDoc.data()
        try {
          const wsRef = doc(db, 'workspaces', invite.workspaceId)
          const wsSnap = await getDoc(wsRef)
          if (!wsSnap.exists()) { await deleteDoc(inviteDoc.ref); continue }
          const wsData = wsSnap.data()
          if (wsData.members[authStore.user.uid]) { await deleteDoc(inviteDoc.ref); continue }

          wsData.members[authStore.user.uid] = {
            role: invite.role, displayName: authStore.user.displayName || '',
            email: authStore.user.email, photoURL: authStore.user.photoURL || '',
            joinedAt: new Date().toISOString()
          }
          if (wsData.pendingInvites) delete wsData.pendingInvites[authStore.user.email]
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
            id: invite.workspaceId, name: wsData.name, icon: wsData.icon,
            type: wsData.type, role: invite.role, ownerId: wsData.ownerId,
            memberCount: Object.keys(wsData.members).length
          })
          await deleteDoc(inviteDoc.ref)
        } catch (e) { console.warn('Erreur acceptation invite:', e) }
      }
    } catch (e) { console.warn('Erreur vérification invites:', e) }
  }

  function cleanup() {
    workspaces.value = []
    activeWorkspaceIds.value = []
    membersInfo.value = {}
  }

  return {
    workspaces, activeWorkspaceIds, activeWorkspace, primaryWorkspaceId,
    multiWorkspaceActive, loading, membersInfo,
    loadWorkspaces, toggleWorkspace, createWorkspace, updateWorkspace,
    deleteWorkspace, inviteMember, removeMember, loadWorkspaceMembers,
    getPendingInvites, checkPendingInvites, cleanup,
    generateShareLink, getShareLinks, revokeShareLink, joinViaShareLink, getShareLinkInfo
  }
})
