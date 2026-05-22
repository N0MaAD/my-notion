<template>
<div class="note-comments">
  <div class="comments-header" @click="expanded = !expanded">
    <span class="comments-toggle">{{ expanded ? '▾' : '›' }}</span>
    <span class="comments-title">💬 Commentaires</span>
    <span v-if="comments.length" class="comments-count">{{ comments.length }}</span>
  </div>

  <div v-if="expanded" class="comments-body">
    <div v-if="comments.length === 0" class="comments-empty">
      Aucun commentaire
    </div>

    <div
      v-for="comment in comments"
      :key="comment.id"
      class="comment-item"
    >
      <div class="comment-avatar">
        <img v-if="comment.userPhoto" :src="comment.userPhoto" referrerpolicy="no-referrer" />
        <span v-else class="comment-avatar-fallback">{{ (comment.userName || '?')[0] }}</span>
      </div>
      <div class="comment-content">
        <div class="comment-meta">
          <span class="comment-author">{{ comment.userName }}</span>
          <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
          <button
            v-if="comment.userId === currentUserId"
            class="comment-delete"
            @click="deleteComment(comment.id)"
            title="Supprimer"
          >✕</button>
        </div>
        <div class="comment-text" v-html="renderComment(comment.text)"></div>
      </div>
    </div>

    <div class="comment-input-wrap">
      <div class="comment-input-row">
        <textarea
          ref="inputRef"
          v-model="newComment"
          class="comment-input"
          placeholder="Écrire un commentaire... (@mention)"
          rows="1"
          @input="onInput"
          @keydown.enter.exact.prevent="submitComment"
          @keydown.down.prevent="mentionDown"
          @keydown.up.prevent="mentionUp"
          @keydown.escape="closeMentions"
        ></textarea>
        <button class="comment-send" @click="submitComment" :disabled="!newComment.trim()">➤</button>
      </div>

      <div v-if="showMentions && filteredMembers.length" class="mention-dropdown">
        <div
          v-for="(member, i) in filteredMembers"
          :key="member.uid"
          class="mention-item"
          :class="{ active: mentionIndex === i }"
          @click="selectMention(member)"
          @mouseenter="mentionIndex = i"
        >
          <img v-if="member.photoURL" :src="member.photoURL" class="mention-avatar" referrerpolicy="no-referrer" />
          <span v-else class="mention-avatar-fallback">{{ (member.displayName || '?')[0] }}</span>
          <span class="mention-name">{{ member.displayName || member.email }}</span>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useBoardStore } from '../../stores/board.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { useAuthStore } from '../../stores/auth.js'

const store = useBoardStore()
const wsStore = useWorkspaceStore()
const authStore = useAuthStore()

const expanded = ref(true)
const newComment = ref('')
const inputRef = ref(null)
const showMentions = ref(false)
const mentionIndex = ref(0)
const mentionStart = ref(-1)
const members = ref([])

const currentUserId = computed(() => authStore.user?.uid)

const comments = computed(() => {
  const note = store.activeNote
  if (!note) return []
  return note.comments || []
})

const mentionQuery = computed(() => {
  if (mentionStart.value === -1) return ''
  return newComment.value.slice(mentionStart.value + 1, getCursorPos())
})

const filteredMembers = computed(() => {
  const q = mentionQuery.value.toLowerCase()
  return members.value.filter(m =>
    (m.displayName || '').toLowerCase().includes(q) ||
    (m.email || '').toLowerCase().includes(q)
  ).slice(0, 5)
})

function getCursorPos() {
  return inputRef.value?.selectionStart || newComment.value.length
}

function onInput() {
  const val = newComment.value
  const cursor = getCursorPos()
  const lastAt = val.lastIndexOf('@', cursor - 1)

  if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ' || val[lastAt - 1] === '\n')) {
    const afterAt = val.slice(lastAt + 1, cursor)
    if (!afterAt.includes(' ') || afterAt.length < 20) {
      mentionStart.value = lastAt
      showMentions.value = true
      mentionIndex.value = 0
      return
    }
  }
  showMentions.value = false
  mentionStart.value = -1
}

function mentionDown() {
  if (showMentions.value && mentionIndex.value < filteredMembers.value.length - 1) mentionIndex.value++
}

function mentionUp() {
  if (showMentions.value && mentionIndex.value > 0) mentionIndex.value--
}

function closeMentions() {
  showMentions.value = false
  mentionStart.value = -1
}

function selectMention(member) {
  const cursor = getCursorPos()
  const before = newComment.value.slice(0, mentionStart.value)
  const after = newComment.value.slice(cursor)
  const name = member.displayName || member.email
  newComment.value = before + '@' + name + ' ' + after
  closeMentions()
  nextTick(() => {
    const pos = before.length + 1 + name.length + 1
    inputRef.value?.setSelectionRange(pos, pos)
    inputRef.value?.focus()
  })
}

function submitComment() {
  if (showMentions.value && filteredMembers.value.length) {
    selectMention(filteredMembers.value[mentionIndex.value])
    return
  }

  const text = newComment.value.trim()
  if (!text || !store.activeNote) return

  const mentions = extractMentions(text)
  const comment = {
    id: crypto.randomUUID(),
    userId: authStore.user.uid,
    userName: authStore.user.displayName || authStore.user.email,
    userPhoto: authStore.user.photoURL || '',
    text,
    mentions,
    createdAt: new Date().toISOString()
  }

  if (!store.activeNote.comments) store.activeNote.comments = []
  store.activeNote.comments.push(comment)
  newComment.value = ''
}

function deleteComment(commentId) {
  if (!store.activeNote?.comments) return
  store.activeNote.comments = store.activeNote.comments.filter(c => c.id !== commentId)
}

function extractMentions(text) {
  const found = []
  const regex = /@(\S+(?:\s\S+)?)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]
    const member = members.value.find(m =>
      (m.displayName || '').toLowerCase() === name.toLowerCase() ||
      (m.email || '').toLowerCase() === name.toLowerCase()
    )
    if (member) found.push({ uid: member.uid, name: member.displayName || member.email })
  }
  return found
}

function renderComment(text) {
  if (!text) return ''
  let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  safe = safe.replace(/@(\S+(?:\s\S+)?)/g, (full, name) => {
    const isMember = members.value.some(m =>
      (m.displayName || '').toLowerCase() === name.toLowerCase() ||
      (m.email || '').toLowerCase() === name.toLowerCase()
    )
    return isMember ? `<span class="mention-highlight">@${name}</span>` : full
  })
  safe = safe.replace(/\n/g, '<br>')
  return safe
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return "à l'instant"
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function loadMembers() {
  const wsId = wsStore.activeWorkspaceIds[0]
  if (!wsId) return
  members.value = await wsStore.loadWorkspaceMembers(wsId)
}

onMounted(loadMembers)
watch(() => wsStore.activeWorkspaceIds[0], loadMembers)
</script>

<style scoped>
.note-comments {
  border-top: 1px solid var(--border, rgba(255,255,255,0.08));
  margin-top: 1rem;
  padding-top: 0.5rem;
}

.comments-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0;
  cursor: pointer;
  user-select: none;
  font-size: 0.85rem;
  color: var(--text-secondary, #8892b0);
}

.comments-header:hover {
  color: var(--text-primary, #e2e8f0);
}

.comments-toggle {
  width: 1rem;
  text-align: center;
  font-size: 0.7rem;
}

.comments-title {
  font-weight: 600;
}

.comments-count {
  background: var(--accent, #38bdf8);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
  min-width: 1.2rem;
  text-align: center;
}

.comments-empty {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  padding: 0.75rem 0;
}

.comments-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.comment-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.comment-avatar img,
.comment-avatar-fallback {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.comment-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent, #38bdf8);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.15rem;
}

.comment-author {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
}

.comment-date {
  font-size: 0.68rem;
  color: var(--text-muted, #64748b);
}

.comment-delete {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.comment-item:hover .comment-delete {
  opacity: 1;
}

.comment-delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.comment-text {
  font-size: 0.82rem;
  color: var(--text-primary, #e2e8f0);
  line-height: 1.4;
  word-break: break-word;
}

.comment-input-wrap {
  position: relative;
  margin-top: 0.25rem;
}

.comment-input-row {
  display: flex;
  gap: 0.4rem;
  align-items: flex-end;
}

.comment-input {
  flex: 1;
  background: var(--bg-tertiary, #1e1e3a);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
  color: var(--text-primary, #e2e8f0);
  font-size: 0.82rem;
  resize: none;
  outline: none;
  font-family: inherit;
  min-height: 36px;
  max-height: 120px;
}

.comment-input:focus {
  border-color: var(--accent, #38bdf8);
}

.comment-input::placeholder {
  color: var(--text-muted, #64748b);
}

.comment-send {
  background: var(--accent, #38bdf8);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.comment-send:disabled {
  opacity: 0.4;
  cursor: default;
}

.comment-send:not(:disabled):hover {
  opacity: 0.85;
}

.mention-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 40px;
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border, rgba(255,255,255,0.12));
  border-radius: 8px;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.2);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  margin-bottom: 4px;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  cursor: pointer;
  transition: background 0.1s;
}

.mention-item:hover,
.mention-item.active {
  background: rgba(56, 189, 248, 0.1);
}

.mention-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.mention-avatar-fallback {
  width: 24px;
  height: 24px;
}

.mention-name {
  font-size: 0.82rem;
  color: var(--text-primary, #e2e8f0);
}

:deep(.mention-highlight) {
  color: var(--accent, #38bdf8);
  font-weight: 600;
}

@media (max-width: 768px) {
  .comment-avatar img,
  .comment-avatar-fallback {
    width: 24px;
    height: 24px;
  }

  .comment-input {
    min-height: 44px;
    font-size: 16px;
  }

  .comment-send {
    width: 44px;
    height: 44px;
  }

  .mention-item {
    min-height: 44px;
  }
}
</style>
