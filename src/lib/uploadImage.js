// Compression + encodage base64 d'une image, sans Firebase Storage.
// L'image est stockée directement dans le document Firestore (limite dure : 1 Mio/doc).
// On vise ~500 Ko max après compression pour laisser de la marge.

const MAX_DIM = 1400
const MAX_OUTPUT_BYTES = 500 * 1024 // 500 Ko cible pour le base64

// Compresse une image dans un canvas et renvoie un data URL JPEG.
// Réduit progressivement la qualité si le résultat dépasse MAX_OUTPUT_BYTES.
async function compressToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Essais successifs : 0.85 → 0.7 → 0.55 → 0.4
      const qualities = [0.85, 0.7, 0.55, 0.4]
      let best = null
      for (const q of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', q)
        // Taille approximative du binaire derrière le base64
        const header = 'data:image/jpeg;base64,'
        const approxBytes = Math.ceil((dataUrl.length - header.length) * 0.75)
        best = { dataUrl, approxBytes, q }
        if (approxBytes <= MAX_OUTPUT_BYTES) break
      }

      if (best && best.approxBytes <= MAX_OUTPUT_BYTES) {
        resolve(best.dataUrl)
      } else {
        reject(new Error('Image trop lourde même après compression (max ~500 Ko)'))
      }
    }
    img.onerror = () => reject(new Error('Image invalide'))
    img.src = URL.createObjectURL(file)
  })
}

export async function uploadImage(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Fichier non supporté')
  }
  // Limite d'entrée généreuse, la compression fera le tri ensuite
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Image trop grande (max 20 MB en entrée)')
  }
  return await compressToDataUrl(file)
}
