import { Node } from '@tiptap/core'

export const PollNode = Node.create({
  name: 'pollBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      question: { default: 'Sondage' },
      options: { default: '[]' },
      myVote: { default: -1 }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-poll]' }]
  },

  renderHTML({ node }) {
    return ['div', {
      'data-poll': '',
      class: 'poll-block'
    }, `[Sondage: ${node.attrs.question}]`]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'poll-block'

      function render() {
        dom.innerHTML = ''
        const { question, options, myVote } = node.attrs
        let parsedOptions
        try { parsedOptions = JSON.parse(options) } catch { parsedOptions = [] }
        const totalVotes = parsedOptions.reduce((sum, o) => sum + (o.votes || 0), 0)
        const hasVoted = myVote >= 0 && myVote < parsedOptions.length

        const questionEl = document.createElement('div')
        questionEl.className = 'poll-question'
        questionEl.textContent = question || 'Sondage'
        dom.appendChild(questionEl)

        parsedOptions.forEach((opt, i) => {
          const optEl = document.createElement('div')
          optEl.className = 'poll-option'
          if (myVote === i) optEl.classList.add('poll-option-selected')

          const pct = totalVotes > 0 ? Math.round((opt.votes || 0) / totalVotes * 100) : 0

          const bar = document.createElement('div')
          bar.className = 'poll-option-bar'
          bar.style.width = pct + '%'

          const text = document.createElement('span')
          text.className = 'poll-option-text'
          text.textContent = opt.text

          const votes = document.createElement('span')
          votes.className = 'poll-option-votes'
          votes.textContent = totalVotes > 0 ? `${pct}%` : ''

          optEl.appendChild(bar)
          optEl.appendChild(text)
          optEl.appendChild(votes)

          optEl.addEventListener('mousedown', (e) => {
            e.preventDefault()
            const pos = getPos()
            if (pos == null) return

            if (myVote === i) return

            const newOptions = parsedOptions.map((o, j) => {
              let v = o.votes || 0
              if (hasVoted && j === myVote) v = Math.max(0, v - 1)
              if (j === i) v++
              return { ...o, votes: v }
            })

            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                options: JSON.stringify(newOptions),
                myVote: i
              })
            )
          })

          dom.appendChild(optEl)
        })

        const footer = document.createElement('div')
        footer.className = 'poll-footer'
        footer.textContent = `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`

        const resetBtn = document.createElement('button')
        resetBtn.className = 'poll-reset-btn'
        resetBtn.textContent = '↺'
        resetBtn.title = 'Réinitialiser'
        resetBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          const pos = getPos()
          if (pos == null) return
          const resetOptions = parsedOptions.map(o => ({ ...o, votes: 0 }))
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              options: JSON.stringify(resetOptions),
              myVote: -1
            })
          )
        })
        footer.appendChild(resetBtn)
        dom.appendChild(footer)
      }

      render()

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'pollBlock') return false
          node = updatedNode
          render()
          return true
        }
      }
    }
  }
})
