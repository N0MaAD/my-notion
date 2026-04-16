import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'my-notion-theme'

export const THEMES = [
  { id: 'blue', label: 'Bleu', icon: '🔵' },
  { id: 'light', label: 'Clair', icon: '⚪' },
  { id: 'dark', label: 'Sombre', icon: '⚫' }
]

export const useThemeStore = defineStore('theme', () => {
  const theme = ref(localStorage.getItem(STORAGE_KEY) || 'blue')

  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id)
  }

  function setTheme(id) {
    theme.value = id
    localStorage.setItem(STORAGE_KEY, id)
    applyTheme(id)
  }

  // Appliquer le thème au démarrage
  applyTheme(theme.value)

  return { theme, setTheme }
})
