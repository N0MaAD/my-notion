import { Node, mergeAttributes } from '@tiptap/core'

function toVideoEmbed(url) {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return { type: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` }

  const dailyMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/)
  if (dailyMatch) return { type: 'iframe', src: `https://www.dailymotion.com/embed/video/${dailyMatch[1]}` }

  return { type: 'video', src: url }
}

export const VideoNode = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      embedType: { default: 'video' }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-video]' }]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'video-block'
      dom.setAttribute('data-video', '')

      const info = toVideoEmbed(node.attrs.src || '')

      if (info.type === 'iframe') {
        const iframe = document.createElement('iframe')
        iframe.src = info.src
        iframe.className = 'video-iframe'
        iframe.setAttribute('frameborder', '0')
        iframe.setAttribute('allowfullscreen', '')
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture')
        dom.appendChild(iframe)
      } else {
        const video = document.createElement('video')
        video.src = info.src
        video.controls = true
        video.className = 'video-player'
        video.preload = 'metadata'
        dom.appendChild(video)
      }

      return { dom }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const info = toVideoEmbed(node.attrs.src || '')
    if (info.type === 'iframe') {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-video': '', class: 'video-block' }),
        ['iframe', { src: info.src, class: 'video-iframe', frameborder: '0', allowfullscreen: '' }]
      ]
    }
    return ['div', mergeAttributes(HTMLAttributes, { 'data-video': '', class: 'video-block' }),
      ['video', { src: info.src, controls: '', class: 'video-player', preload: 'metadata' }]
    ]
  }
})
