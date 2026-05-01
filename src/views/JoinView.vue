<template>
<div class="join-page">
  <div class="join-card">
    <div v-if="loading" class="join-status">
      <p class="join-loading">Chargement...</p>
    </div>

    <div v-else-if="error" class="join-status">
      <h2 class="join-title">Lien invalide</h2>
      <p class="join-error">{{ error }}</p>
      <button class="btn btn-accent" @click="goHome">Retour à l'accueil</button>
    </div>

    <div v-else-if="!authStore.user" class="join-status">
      <h2 class="join-title">Rejoindre un espace</h2>
      <div class="join-info">
        <span class="join-ws-icon">{{ linkInfo.workspaceIcon }}</span>
        <span class="join-ws-name">{{ linkInfo.workspaceName }}</span>
      </div>
      <p class="join-role">Rôle : <strong>{{ linkInfo.role === 'editor' ? 'Éditeur' : 'Lecteur' }}</strong></p>
      <p class="join-desc">Connecte-toi pour rejoindre cet espace de travail.</p>
      <button class="btn btn-accent join-login-btn" @click="doLogin">Se connecter avec Google</button>
    </div>

    <div v-else-if="joined" class="join-status">
      <h2 class="join-title">{{ alreadyMember ? 'Déjà membre' : 'Bienvenue !' }}</h2>
      <p class="join-desc">{{ alreadyMember ? 'Tu fais déjà partie de cet espace.' : 'Tu as rejoint l\'espace avec succès.' }}</p>
      <button class="btn btn-accent" @click="goHome">Ouvrir My Notion</button>
    </div>

    <div v-else class="join-status">
      <h2 class="join-title">Rejoindre un espace</h2>
      <div class="join-info">
        <span class="join-ws-icon">{{ linkInfo.workspaceIcon }}</span>
        <span class="join-ws-name">{{ linkInfo.workspaceName }}</span>
      </div>
      <p class="join-role">Rôle : <strong>{{ linkInfo.role === 'editor' ? 'Éditeur' : 'Lecteur' }}</strong></p>
      <p class="join-user">Connecté en tant que <strong>{{ authStore.user.displayName }}</strong></p>
      <button class="btn btn-accent join-btn" @click="doJoin" :disabled="joining">
        {{ joining ? 'Connexion...' : 'Rejoindre' }}
      </button>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useWorkspaceStore } from '../stores/workspace.js'
import { useBoardStore } from '../stores/board.js'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../firebase.js'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const wsStore = useWorkspaceStore()
const boardStore = useBoardStore()

const loading = ref(true)
const error = ref('')
const linkInfo = ref(null)
const joined = ref(false)
const joining = ref(false)
const alreadyMember = ref(false)

onMounted(async () => {
  const token = route.params.token
  if (!token) { error.value = 'Lien invalide'; loading.value = false; return }

  const info = await wsStore.getShareLinkInfo(token)
  if (!info) { error.value = 'Ce lien est invalide ou a été révoqué.'; loading.value = false; return }

  linkInfo.value = info
  loading.value = false
})

watch(() => authStore.user, async (user) => {
  if (user && linkInfo.value && !joined.value) {
    await wsStore.loadWorkspaces()
  }
})

async function doLogin() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider())
  } catch (e) {
    error.value = 'Erreur de connexion'
  }
}

async function doJoin() {
  joining.value = true
  const token = route.params.token
  const result = await wsStore.joinViaShareLink(token)
  if (result.success) {
    joined.value = true
    alreadyMember.value = !!result.alreadyMember
  } else {
    error.value = result.error
  }
  joining.value = false
}

function goHome() {
  router.push('/notes')
}
</script>

<style scoped>
.join-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
  background: var(--bg-primary, #0f0f23);
}

.join-card {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 16px;
  padding: 2rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 8px 40px rgba(0,0,0,0.3);
}

.join-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
}

.join-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary, #e2e8f0);
  margin: 0;
}

.join-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: var(--bg-hover, rgba(255,255,255,0.05));
  border-radius: 12px;
}

.join-ws-icon {
  font-size: 2rem;
}

.join-ws-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
}

.join-role {
  color: var(--text-secondary, #8892b0);
  font-size: 0.9rem;
  margin: 0;
}

.join-desc {
  color: var(--text-secondary, #8892b0);
  font-size: 0.9rem;
  margin: 0;
}

.join-user {
  color: var(--text-secondary, #8892b0);
  font-size: 0.85rem;
  margin: 0;
}

.join-error {
  color: var(--danger, #ef4444);
  margin: 0;
}

.join-loading {
  color: var(--text-secondary, #8892b0);
  margin: 0;
}

.join-btn,
.join-login-btn {
  margin-top: 0.5rem;
  min-height: 44px;
  padding: 0.6rem 2rem;
  font-size: 1rem;
}
</style>
