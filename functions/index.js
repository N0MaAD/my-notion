const { onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp()

exports.onWorkspaceChange = onDocumentUpdated('workspaces/{wsId}', async (event) => {
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (!before || !after) return

  const modifiedBy = after._lastModifiedBy
  const wsId = event.params.wsId

  const diff = describeDiff(before, after)
  if (!diff) return

  const db = getFirestore()
  const wsSnap = await db.doc(`workspaces/${wsId}`).get()
  const wsData = wsSnap.data()

  const memberUids = await getWorkspaceMembers(db, wsId)
  if (memberUids.length === 0) return

  const tokens = []
  for (const uid of memberUids) {
    const tokenSnap = await db.doc(`pushTokens/${uid}`).get()
    if (!tokenSnap.exists) continue
    const data = tokenSnap.data()
    for (const [token, meta] of Object.entries(data.tokens || {})) {
      tokens.push({ token, uid })
    }
  }

  if (tokens.length === 0) return

  const wsName = wsData?.name || wsId
  const message = {
    notification: {
      title: `My Notion · ${wsName}`,
      body: diff
    },
    data: { wsId, type: 'workspace_change' }
  }

  const results = await Promise.allSettled(
    tokens.map(({ token }) =>
      getMessaging().send({ ...message, token })
    )
  )

  const staleTokens = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const code = result.reason?.code
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token') {
        staleTokens.push(tokens[i])
      }
    }
  })

  for (const { token, uid } of staleTokens) {
    const ref = db.doc(`pushTokens/${uid}`)
    const snap = await ref.get()
    if (!snap.exists) continue
    const data = snap.data()
    delete data.tokens[token]
    await ref.set(data)
  }
})

async function getWorkspaceMembers(db, wsId) {
  const snap = await db.doc(`workspaces/${wsId}`).get()
  if (!snap.exists) return []
  const data = snap.data()
  if (data.members && typeof data.members === 'object') {
    return Object.keys(data.members)
  }
  if (data.owner) return [data.owner]
  return []
}

function describeDiff(before, after) {
  const prevNotes = new Set()
  const afterNotes = new Set()
  const prevTitles = {}
  const afterTitles = {}

  for (const col of before.columns || []) {
    for (const n of col.notes || []) { prevNotes.add(n.id); prevTitles[n.id] = n.title || 'Sans titre' }
  }
  for (const col of after.columns || []) {
    for (const n of col.notes || []) { afterNotes.add(n.id); afterTitles[n.id] = n.title || 'Sans titre' }
  }

  const added = [...afterNotes].filter(id => !prevNotes.has(id))
  const removed = [...prevNotes].filter(id => !afterNotes.has(id))

  if (added.length > 0) {
    const title = afterTitles[added[0]]
    return added.length === 1
      ? `Nouvelle note : ${title}`
      : `${added.length} nouvelles notes ajoutées`
  }
  if (removed.length > 0) {
    const title = prevTitles[removed[0]]
    return removed.length === 1
      ? `Note supprimée : ${title}`
      : `${removed.length} notes supprimées`
  }

  let modified = 0
  for (const col of after.columns || []) {
    const prevCol = (before.columns || []).find(c => c.id === col.id)
    if (!prevCol) continue
    for (const n of col.notes || []) {
      const prev = (prevCol.notes || []).find(p => p.id === n.id)
      if (prev && JSON.stringify(prev) !== JSON.stringify(n)) modified++
    }
  }

  if (modified > 0) {
    return modified === 1 ? 'Une note a été modifiée' : `${modified} notes modifiées`
  }

  return null
}
