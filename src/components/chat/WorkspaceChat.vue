<template>
<div class="workspace-chat">
  <div class="chat-header">
    <button class="chat-back" @click="$emit('close')" title="Retour aux commentaires">‹</button>
    <span class="chat-title">Chat workspace</span>
  </div>

  <div class="chat-messages" ref="messagesRef">
    <div v-if="chatStore.loading" class="chat-status">Chargement…</div>
    <div v-else-if="chatStore.messages.length === 0" class="chat-status">
      Aucun message — lancez la conversation !
    </div>

    <template v-for="(msg, i) in chatStore.messages" :key="msg.id">
      <div v-if="showDateSep(i)" class="chat-date-sep">
        <span>{{ formatDateSep(msg.createdAt) }}</span>
      </div>
      <div
        class="chat-msg"
        :class="{ own: msg.userId === currentUserId, grouped: isGrouped(i) }"
      >
        <template v-if="msg.userId !== currentUserId">
          <div v-if="!isGrouped(i)" class="chat-msg-avatar">
            <img v-if="msg.userPhoto" :src="msg.userPhoto" referrerpolicy="no-referrer" />
            <span v-else class="chat-avatar-fb">{{ (msg.userName || '?')[0] }}</span>
          </div>
          <div v-else class="chat-msg-avatar-spacer"></div>
        </template>
        <div class="chat-bubble">
          <div v-if="msg.userId !== currentUserId && !isGrouped(i)" class="chat-msg-name">
            {{ msg.userName }}
          </div>
          <div class="chat-msg-text">{{ msg.text }}</div>
          <span class="chat-msg-time">{{ formatTime(msg.createdAt) }}</span>
        </div>
      </div>
    </template>
  </div>

  <div class="chat-input-wrap">
    <textarea
      v-model="newMessage"
      class="chat-input"
      placeholder="Message…"
      rows="1"
      @keydown.enter.exact.prevent="send"
    ></textarea>
    <button class="chat-send" @click="send" :disabled="!newMessage.trim()">➤</button>
  </div>
</div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../../stores/chat.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { useAuthStore } from '../../stores/auth.js'

defineEmits(['close'])

const chatStore = useChatStore()
const wsStore = useWorkspaceStore()
const authStore = useAuthStore()

const newMessage = ref('')
const messagesRef = ref(null)

const currentUserId = computed(() => authStore.user?.uid)
const wsId = computed(() => wsStore.activeWorkspaceIds[0])

function isGrouped(i) {
  if (i === 0) return false
  const prev = chatStore.messages[i - 1]
  const curr = chatStore.messages[i]
  if (prev.userId !== curr.userId) return false
  const diff = new Date(curr.createdAt) - new Date(prev.createdAt)
  return diff < 120000
}

function showDateSep(i) {
  if (i === 0) return true
  const prev = new Date(chatStore.messages[i - 1].createdAt).toDateString()
  const curr = new Date(chatStore.messages[i].createdAt).toDateString()
  return prev !== curr
}

function formatDateSep(ts) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui"
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function send() {
  const text = newMessage.value.trim()
  if (!text || !wsId.value) return
  newMessage.value = ''
  await chatStore.send(wsId.value, text)
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

watch(() => chatStore.messages.length, () => {
  nextTick(scrollToBottom)
})

onMounted(() => {
  if (wsId.value) chatStore.listen(wsId.value)
  nextTick(scrollToBottom)
})

onUnmounted(() => {
  chatStore.stop()
})
</script>

<style scoped>
.workspace-chat {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border, rgba(255,255,255,0.08));
  margin-top: 1rem;
  max-height: 500px;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  font-size: 0.85rem;
  color: var(--text-secondary, #8892b0);
  font-weight: 600;
}

.chat-back {
  background: none;
  border: none;
  color: var(--text-secondary, #8892b0);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  line-height: 1;
}

.chat-back:hover {
  color: var(--text-primary, #e2e8f0);
  background: rgba(255,255,255,0.06);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0;
  min-height: 120px;
  max-height: 380px;
}

.chat-status {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  text-align: center;
  padding: 2rem 0;
}

.chat-date-sep {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0;
}

.chat-date-sep span {
  font-size: 0.68rem;
  color: var(--text-muted, #64748b);
  background: var(--bg-tertiary, #1e1e3a);
  padding: 0.15rem 0.6rem;
  border-radius: 10px;
}

.chat-msg {
  display: flex;
  gap: 0.4rem;
  align-items: flex-end;
  max-width: 85%;
}

.chat-msg.own {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.chat-msg.grouped {
  margin-top: -0.15rem;
}

.chat-msg-avatar img,
.chat-avatar-fb {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.chat-avatar-fb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent, #38bdf8);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
}

.chat-msg-avatar-spacer {
  width: 26px;
  flex-shrink: 0;
}

.chat-bubble {
  background: var(--bg-tertiary, #1e1e3a);
  border-radius: 12px 12px 12px 4px;
  padding: 0.35rem 0.6rem;
  min-width: 3rem;
}

.chat-msg.own .chat-bubble {
  background: var(--accent, #38bdf8);
  color: #fff;
  border-radius: 12px 12px 4px 12px;
}

.chat-msg-name {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--accent, #38bdf8);
  margin-bottom: 0.1rem;
}

.chat-msg-text {
  font-size: 0.82rem;
  color: var(--text-primary, #e2e8f0);
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-msg.own .chat-msg-text {
  color: #fff;
}

.chat-msg-time {
  font-size: 0.6rem;
  color: var(--text-muted, #64748b);
  float: right;
  margin-top: 0.1rem;
  margin-left: 0.5rem;
}

.chat-msg.own .chat-msg-time {
  color: rgba(255,255,255,0.6);
}

.chat-input-wrap {
  display: flex;
  gap: 0.4rem;
  align-items: flex-end;
  padding-top: 0.4rem;
  border-top: 1px solid var(--border, rgba(255,255,255,0.06));
  margin-top: 0.25rem;
}

.chat-input {
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
  max-height: 100px;
}

.chat-input:focus {
  border-color: var(--accent, #38bdf8);
}

.chat-input::placeholder {
  color: var(--text-muted, #64748b);
}

.chat-send {
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

.chat-send:disabled {
  opacity: 0.4;
  cursor: default;
}

.chat-send:not(:disabled):hover {
  opacity: 0.85;
}

@media (max-width: 768px) {
  .chat-input {
    min-height: 44px;
    font-size: 16px;
  }

  .chat-send {
    width: 44px;
    height: 44px;
  }

  .chat-messages {
    max-height: 50vh;
  }
}
</style>
