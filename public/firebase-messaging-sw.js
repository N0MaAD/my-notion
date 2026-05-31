/* eslint-env serviceworker */
/* global firebase */

importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDBX3YJ-kPTqvMwTXLbt-mqFpl0bjYzcPA',
  authDomain: 'my-notion-8d43b.firebaseapp.com',
  projectId: 'my-notion-8d43b',
  storageBucket: 'my-notion-8d43b.firebasestorage.app',
  messagingSenderId: '580332901129',
  appId: '1:580332901129:web:80c929718ccc907805f9d8'
})

const messaging = firebase.messaging()

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  if (!title) return
  self.registration.showNotification(title, {
    body: body || '',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'my-notion-sync',
    renotify: true,
    data: payload.data || {}
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus()
        }
      }
      return clients.openWindow('/')
    })
  )
})
