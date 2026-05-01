import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/notes' },
  { path: '/notes', name: 'notes', component: () => import('../views/BoardView.vue') },
  { path: '/notes/:id', name: 'note', component: () => import('../views/MobileNoteView.vue') },
  { path: '/agenda', name: 'agenda', component: () => import('../views/AgendaView.vue') },
  { path: '/tags', name: 'tags', component: () => import('../views/TagsView.vue') },
  { path: '/join/:token', name: 'join', component: () => import('../views/JoinView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/notes' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
