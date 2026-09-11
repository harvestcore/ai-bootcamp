import { getUnits, getFilteredLog } from '../lib/store.js'
import { actionTagHtml } from '../components/badges.js'
import { navigate } from '../router.js'
import { escapeHtml, formatDateTime } from '../lib/format.js'

export function render(root, params, query) {
  const units = getUnits()
  let unitId = query.unit ?? ''
  let compartmentIndex = query.compartment != null ? Number(query.compartment) : null

  root.innerHTML = `
    <header class="app-header">
      <a class="icon-link" href="#/" title="Back to Home">← Home</a>
      <h1>📜 Movement log</h1>
    </header>
    <div class="filter-bar">
      <select id="unit-filter">
        <option value="">All units</option>
        ${units.map((u) => `<option value="${u.id}" ${u.id === unitId ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
      </select>
      <select id="compartment-filter" ${unitId ? '' : 'disabled'}>
        <option value="">All compartments</option>
      </select>
    </div>
    <div id="log-rows"></div>
  `

  const unitFilter = root.querySelector('#unit-filter')
  const compartmentFilter = root.querySelector('#compartment-filter')

  function populateCompartments() {
    const unit = units.find((u) => u.id === unitId)
    if (!unit) {
      compartmentFilter.innerHTML = `<option value="">All compartments</option>`
      compartmentFilter.disabled = true
      return
    }
    compartmentFilter.disabled = false
    const options = []
    for (let i = 0; i < unit.rows * unit.cols; i++) {
      options.push(`<option value="${i}" ${i === compartmentIndex ? 'selected' : ''}>Compartment ${i + 1}</option>`)
    }
    compartmentFilter.innerHTML = `<option value="">All compartments</option>${options.join('')}`
  }

  function renderRows() {
    const entries = getFilteredLog({
      unitId: unitId || undefined,
      compartmentIndex: compartmentIndex != null ? compartmentIndex : undefined,
    })
    const rowsEl = root.querySelector('#log-rows')
    if (entries.length === 0) {
      rowsEl.innerHTML = `<p class="empty-state">No log entries for this filter.</p>`
      return
    }
    rowsEl.innerHTML = entries
      .map(
        (entry) => `
      <div class="log-row">
        <span class="log-row__time muted">${formatDateTime(entry.timestamp)}</span>
        ${actionTagHtml(entry.type)}
        <span class="log-row__desc">${escapeHtml(entry.pieceDescription)}</span>
        <span class="log-row__detail">${escapeHtml(entry.detail)}</span>
      </div>
    `,
      )
      .join('')
  }

  populateCompartments()
  renderRows()

  unitFilter.addEventListener('change', () => {
    unitId = unitFilter.value
    compartmentIndex = null
    navigate(`/log${unitId ? `?unit=${unitId}` : ''}`)
  })
  compartmentFilter.addEventListener('change', () => {
    compartmentIndex = compartmentFilter.value === '' ? null : Number(compartmentFilter.value)
    navigate(`/log?unit=${unitId}${compartmentIndex != null ? `&compartment=${compartmentIndex}` : ''}`)
  })
}
