import { ref, onMounted, onUnmounted } from 'vue'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

const mql = typeof window !== 'undefined' ? window.matchMedia(MOBILE_BREAKPOINT) : null
const isMobile = ref(mql ? mql.matches : false)

let listenerCount = 0

function update(e) {
  isMobile.value = e.matches
}

export function useIsMobile() {
  onMounted(() => {
    if (!mql) return
    if (listenerCount === 0) mql.addEventListener('change', update)
    listenerCount++
    isMobile.value = mql.matches
  })

  onUnmounted(() => {
    if (!mql) return
    listenerCount--
    if (listenerCount === 0) mql.removeEventListener('change', update)
  })

  return isMobile
}
