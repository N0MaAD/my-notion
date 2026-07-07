import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'my-notion-theme'
const BG_STORAGE_KEY = 'my-notion-bg'

export const THEMES = [
  { id: 'blue', label: 'Bleu', icon: '🔵' },
  { id: 'light', label: 'Clair', icon: '⚪' },
  { id: 'dark', label: 'Sombre', icon: '⚫' }
]

export const PRESET_BACKGROUNDS = [
  // { id: 'mountains', label: 'Montagnes', url: '/backgrounds/mountains.jpg', theme: 'dark' },
  // { id: 'ocean', label: 'Océan', url: '/backgrounds/ocean.jpg', theme: 'blue' },
]

export const useThemeStore = defineStore('theme', () => {
  const theme = ref(localStorage.getItem(STORAGE_KEY) || 'blue')
  const backgroundImage = ref(localStorage.getItem(BG_STORAGE_KEY) || '')

  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id)
  }

  function setTheme(id) {
    theme.value = id
    localStorage.setItem(STORAGE_KEY, id)
    applyTheme(id)
  }

  function applyBackground(url) {
    if (url) {
      document.body.style.backgroundImage = `url(${url})`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundRepeat = 'no-repeat'
      document.body.style.backgroundAttachment = 'fixed'
      document.documentElement.setAttribute('data-custom-bg', 'true')
    } else {
      document.body.style.backgroundImage = ''
      document.body.style.backgroundSize = ''
      document.body.style.backgroundPosition = ''
      document.body.style.backgroundRepeat = ''
      document.body.style.backgroundAttachment = ''
      document.documentElement.removeAttribute('data-custom-bg')
    }
  }

  function setBackground(url, autoTheme) {
    backgroundImage.value = url
    if (url) {
      localStorage.setItem(BG_STORAGE_KEY, url)
    } else {
      localStorage.removeItem(BG_STORAGE_KEY)
    }
    applyBackground(url)
    if (autoTheme) {
      setTheme(autoTheme)
    }
  }

  function setCustomBackground(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const url = e.target.result
        setBackground(url, detectThemeFromImage(file.name))
        resolve(url)
      }
      reader.readAsDataURL(file)
    })
  }

  function detectThemeFromImage(filename) {
    const lower = (filename || '').toLowerCase()
    if (lower.includes('light') || lower.includes('white') || lower.includes('clair')) return 'light'
    if (lower.includes('dark') || lower.includes('noir') || lower.includes('sombre')) return 'dark'
    return 'dark'
  }

  function removeBackground() {
    setBackground('', null)
  }

  applyTheme(theme.value)
  if (backgroundImage.value) {
    applyBackground(backgroundImage.value)
  }

  return {
    theme, backgroundImage,
    setTheme, setBackground, setCustomBackground, removeBackground
  }
})
