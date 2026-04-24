import { Node } from '@tiptap/core'
import { Chart, registerables } from 'chart.js'
import { useBoardStore } from '../stores/board.js'

Chart.register(...registerables)

const COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#a855f7',
  '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f97316'
]

function getAutoData(metric) {
  const store = useBoardStore()
  switch (metric) {
    case 'notesByColumn': {
      const labels = store.columns.map(c => c.title)
      const values = store.columns.map(c => c.notes.length)
      return { labels, values }
    }
    case 'notesByTag': {
      const labels = store.tags.map(t => t.name)
      const values = store.tags.map(t => store.getNotesForTag(t.id).length)
      return { labels, values }
    }
    case 'taskCompletion': {
      let done = 0, pending = 0
      for (const col of store.columns) {
        for (const note of col.notes) {
          if (note.type === 'task') {
            if (note.checked) done++
            else pending++
          }
        }
      }
      return { labels: ['Terminées', 'En cours'], values: [done, pending] }
    }
    case 'notesByType': {
      const types = {}
      for (const col of store.columns) {
        for (const note of col.notes) {
          const t = note.type || 'note'
          types[t] = (types[t] || 0) + 1
        }
      }
      return { labels: Object.keys(types), values: Object.values(types) }
    }
    default:
      return { labels: [], values: [] }
  }
}

function buildChartConfig(chartType, labels, values) {
  const colors = labels.map((_, i) => COLORS[i % COLORS.length])
  const type = chartType === 'horizontalBar' ? 'bar' : chartType

  return {
    type: type === 'number' ? 'bar' : type,
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: chartType === 'line' ? 'transparent' : colors,
        borderColor: chartType === 'line' ? colors[0] : colors,
        borderWidth: chartType === 'line' ? 2.5 : 1,
        tension: chartType === 'line' ? 0.35 : 0,
        pointBackgroundColor: chartType === 'line' ? colors[0] : undefined,
        pointRadius: chartType === 'line' ? 4 : undefined
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: chartType === 'horizontalBar' ? 'y' : 'x',
      plugins: {
        legend: { display: chartType === 'doughnut' }
      },
      scales: chartType === 'doughnut' ? {} : {
        y: { beginAtZero: true },
        x: {}
      }
    }
  }
}

export const ChartNode = Node.create({
  name: 'chartBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      chartType: { default: 'bar' },
      title: { default: '' },
      dataSource: { default: 'manual' },
      autoMetric: { default: 'notesByColumn' },
      chartData: { default: '{"labels":["A","B","C"],"values":[10,20,15]}' }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-chart]' }]
  },

  renderHTML({ node }) {
    return ['div', {
      'data-chart': '',
      'data-chart-type': node.attrs.chartType,
      class: 'chart-block'
    }, `[Graphique: ${node.attrs.title || node.attrs.chartType}]`]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'chart-block'
      dom.setAttribute('data-chart', '')

      let chartInstance = null

      function render() {
        if (chartInstance) { chartInstance.destroy(); chartInstance = null }
        dom.innerHTML = ''

        const { chartType, dataSource, autoMetric, chartData, title } = node.attrs

        let labels, values
        if (dataSource === 'auto') {
          const autoData = getAutoData(autoMetric)
          labels = autoData.labels
          values = autoData.values
        } else {
          try {
            const parsed = JSON.parse(chartData)
            labels = parsed.labels || []
            values = parsed.values || []
          } catch {
            labels = []; values = []
          }
        }

        if (title) {
          const titleEl = document.createElement('div')
          titleEl.className = 'chart-title'
          titleEl.textContent = title
          dom.appendChild(titleEl)
        }

        if (chartType === 'number') {
          const total = values.reduce((a, b) => a + b, 0)
          const numEl = document.createElement('div')
          numEl.className = 'chart-number-display'
          numEl.innerHTML = `<span class="chart-number-value">${total.toLocaleString('fr-FR')}</span>`
          if (labels.length > 0) {
            numEl.innerHTML += `<span class="chart-number-label">${labels[0]}</span>`
          }
          dom.appendChild(numEl)
        } else {
          const wrapper = document.createElement('div')
          wrapper.className = 'chart-canvas-wrap'
          const canvas = document.createElement('canvas')
          wrapper.appendChild(canvas)
          dom.appendChild(wrapper)

          const config = buildChartConfig(chartType, labels, values)
          chartInstance = new Chart(canvas, config)
        }

        const editBtn = document.createElement('button')
        editBtn.className = 'chart-edit-btn'
        editBtn.textContent = '✎'
        editBtn.title = 'Modifier le graphique'
        editBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          dom.dispatchEvent(new CustomEvent('edit-chart', {
            bubbles: true,
            detail: { pos: getPos(), attrs: { ...node.attrs } }
          }))
        })
        dom.appendChild(editBtn)
      }

      render()

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'chartBlock') return false
          node = updatedNode
          render()
          return true
        },
        destroy() {
          if (chartInstance) chartInstance.destroy()
        }
      }
    }
  }
})
