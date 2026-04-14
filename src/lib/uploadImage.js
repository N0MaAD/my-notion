import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '../firebase.js'

const MAX_DIM = 1600
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// Compresse une image dans un canvas pour limiter sa taille avant upload
async function compressImage(file) {
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
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression échouée')),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => reject(new Error('Image invalide'))
    img.src = URL.createObjectURL(file)
  })
}

export async function uploadImage(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Fichier non supporté')
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image trop grande (max ${MAX_BYTES / 1024 / 1024} MB)`)
  }
  const user = auth.currentUser
  if (!user) throw new Error('Non connecté')

  const blob = await compressImage(file).catch(() => file)
  const ext = 'jpg'
  const name = `${crypto.randomUUID()}.${ext}`
  const path = `users/${user.uid}/note-images/${name}`
  const ref = storageRef(storage, path)
  await uploadBytes(ref, blob, { contentType: 'image/jpeg' })
  const url = await getDownloadURL(ref)
  return url
}
