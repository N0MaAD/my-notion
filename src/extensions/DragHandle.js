import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let handle = null
    let currentBlockPos = null

    function createHandle() {
      const el = document.createElement('div')
      el.classList.add('drag-handle')
      el.draggable = true
      el.textContent = '⠿'
      return el
    }

    function removeHandle() {
      if (handle && handle.parentNode) {
        handle.parentNode.removeChild(handle)
      }
    }

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        view(editorView) {
          handle = createHandle()

          handle.addEventListener('dragstart', (e) => {
            if (currentBlockPos == null) return

            const node = editorView.state.doc.nodeAt(currentBlockPos)
            if (!node) return

            // Sélectionner le node pour que ProseMirror gère le drag
            const tr = editorView.state.tr
            tr.setSelection(
              editorView.state.selection.constructor.near(
                editorView.state.doc.resolve(currentBlockPos)
              )
            )
            editorView.dispatch(tr)

            // Laisser ProseMirror gérer le reste via son système natif
            const slice = editorView.state.selection.content()
            e.dataTransfer.effectAllowed = 'move'

            handle.classList.add('dragging')

            // Stocker les infos pour le drop
            const json = JSON.stringify({
              pos: currentBlockPos,
              size: node.nodeSize
            })
            e.dataTransfer.setData('application/prosemirror-drag', json)
          })

          handle.addEventListener('dragend', () => {
            handle.classList.remove('dragging')
          })

          return {
            destroy() {
              removeHandle()
            }
          }
        },
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const editorRect = view.dom.getBoundingClientRect()

              // Seulement près du bord gauche
              if (event.clientX > editorRect.left + 50) {
                removeHandle()
                return false
              }

              const coords = { left: event.clientX, top: event.clientY }
              const pos = view.posAtCoords(coords)
              if (!pos) {
                removeHandle()
                return false
              }

              try {
                const resolved = view.state.doc.resolve(pos.pos)
                const blockPos = resolved.before(1)
                const blockEl = view.nodeDOM(blockPos)

                if (!blockEl || !blockEl.getBoundingClientRect) {
                  removeHandle()
                  return false
                }

                currentBlockPos = blockPos

                const parentEl = view.dom.parentNode
                if (!handle.parentNode) {
                  parentEl.appendChild(handle)
                }

                const blockRect = blockEl.getBoundingClientRect()
                const parentRect = parentEl.getBoundingClientRect()

                handle.style.top = (blockRect.top - parentRect.top + blockRect.height / 2 - 10) + 'px'
                handle.style.left = (blockRect.left - parentRect.left - 28) + 'px'
              } catch (e) {
                removeHandle()
              }

              return false
            },
            mouseleave() {
              setTimeout(removeHandle, 300)
              return false
            },
            drop(view, event) {
              const data = event.dataTransfer.getData('application/prosemirror-drag')
              if (!data) return false

              try {
                const { pos: fromPos, size } = JSON.parse(data)
                const coords = { left: event.clientX, top: event.clientY }
                const dropPos = view.posAtCoords(coords)
                if (!dropPos) return false

                const resolved = view.state.doc.resolve(dropPos.pos)
                const targetBlockPos = resolved.before(1)

                // Ne rien faire si on drop au même endroit
                if (targetBlockPos === fromPos) return false

                const node = view.state.doc.nodeAt(fromPos)
                if (!node) return false

                const tr = view.state.tr

                // Déterminer si on drop avant ou après le bloc cible
                const targetEl = view.nodeDOM(targetBlockPos)
                if (!targetEl) return false

                const targetRect = targetEl.getBoundingClientRect()
                const dropBefore = event.clientY < targetRect.top + targetRect.height / 2

                // Supprimer le node d'origine
                tr.delete(fromPos, fromPos + size)

                // Calculer la nouvelle position après suppression
                let insertPos = targetBlockPos
                if (targetBlockPos > fromPos) {
                  insertPos -= size
                }
                if (!dropBefore) {
                  const targetNode = tr.doc.nodeAt(insertPos)
                  if (targetNode) {
                    insertPos += targetNode.nodeSize
                  }
                }

                // Insérer à la nouvelle position
                tr.insert(insertPos, node)
                view.dispatch(tr)

                event.preventDefault()
                return true
              } catch (e) {
                console.error('Drop error:', e)
                return false
              }
            }
          }
        }
      })
    ]
  }
})