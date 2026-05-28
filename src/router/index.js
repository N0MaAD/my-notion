import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  { path: '/', redirect: '/notes' },
  { path: '/notes', name: 'notes', component: () => import('../views/BoardView.vue') },
  { path: '/notes/:id', name: 'note', component: () => import('../views/MobileNoteView.vue') },
  { path: '/agenda', name: 'agenda', component: () => import('../views/AgendaView.vue') },
  { path: '/tags', name: 'tags', component: () => import('../views/TagsView.vue') },
  { path: '/trash', name: 'trash', component: () => import('../views/TrashView.vue') },
  { path: '/join/:token', name: 'join', component: () => import('../views/JoinView.vue'), meta: { public: true } },
  { path: '/:pathMatch(.*)*', redirect: '/notes' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  const auth = useAuthStore()
  if (!auth.loading && !auth.user) return false
  return true
})

export default router
