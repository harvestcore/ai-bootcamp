import { getUnits, searchPieces, exportInventory } from '../lib/store.js'
import { renderCompartmentGridHtml } from '../components/grid.js'
import { colorSwatchHtml } from '../components/colorSwatch.js'
import { navigate } from '../router.js'
import { escapeHtml } from '../lib/format.js'
import { colorKey } from '../lib/matching.js'

export function render(root) {
  const units = getUnits()

  root.innerHTML = `
    <header class="app-header">
      <h1>🧱 LEGO Inventory</h1>
      <a class="icon-link" href="#/add" title="Add a piece">+ Add piece</a>
      <button type="button" class="icon-link" id="export-btn" title="Export inventory as JSON">⬇ Export</button>
      <a class="icon-link" href="#/log" title="Movement log">📜 Log</a>
    </header>
    <div class="search-bar-wrap">
      <input id="search-input" type="search" placeholder="Search by part number or piece name…" autocomplete="off" />
    </div>
    <div id="results-area"></div>
    <div id="grid-area"></div>
    <p class="muted attribution">Part catalog data from <a href="https://rebrickable.com" target="_blank" rel="noopener">Rebrickable.com</a>.</p>
  `

  const resultsArea = root.querySelector('#results-area')
  const gridArea = root.querySelector('#grid-area')
  const input = root.querySelector('#search-input')

  root.querySelector('#export-btn').addEventListener('click', () => {
    const data = exportInventory()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lego-inventory-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  })

  function renderGrid() {
    if (units.length === 0) {
      gridArea.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗄️</div>
          <p>No drawer units yet — let's set up your workshop.</p>
          <button type="button" class="btn btn--primary" id="setup-cta">Set up your first drawer unit</button>
        </div>
      `
      gridArea.querySelector('#setup-cta').addEventListener('click', () => navigate('/setup'))
      return
    }
    gridArea.innerHTML = `
      <div class="unit-card-grid">
        ${units
          .map(
            (unit) => `
          <div class="unit-card" data-unit-id="${unit.id}">
            <div class="unit-card__label">${escapeHtml(unit.name)}</div>
            ${renderCompartmentGridHtml(unit, { compact: true })}
          </div>
        `,
          )
          .join('')}
        <button type="button" class="unit-card unit-card--add" id="add-unit-cta">+ Add unit</button>
      </div>
    `
    gridArea.querySelectorAll('.unit-card[data-unit-id]').forEach((card) => {
      card.addEventListener('click', () => navigate(`/unit/${card.dataset.unitId}`))
    })
    gridArea.querySelector('#add-unit-cta')?.addEventListener('click', () => navigate('/setup'))
  }

  let activeColorFilter = ''
  let activeUnitFilter = ''

  function renderResults() {
    const query = input.value
    if (!query.trim()) {
      resultsArea.innerHTML = ''
      gridArea.hidden = false
      return
    }
    gridArea.hidden = true
    const matches = searchPieces(query, {
      color: activeColorFilter || undefined,
      unitId: activeUnitFilter || undefined,
    })

    if (matches.length === 0) {
      resultsArea.innerHTML = `
        ${renderFilterBar(query)}
        <p class="empty-state">No results found.</p>
      `
      attachFilterHandlers()
      return
    }

    const rows = matches
      .slice()
      .sort((a, b) => a.description.localeCompare(b.description))
      .map((piece) => {
        const unit = units.find((u) => u.id === piece.unitId)
        return `
        <div class="search-row">
          ${colorSwatchHtml(piece.color, { size: 16 })}
          <span class="search-row__desc">${escapeHtml(piece.description)} — ${escapeHtml(piece.color.name)}</span>
          <span class="search-row__qty">${piece.quantity}</span>
          <span class="search-row__loc">${escapeHtml(unit?.name ?? '')}, Comp ${piece.compartmentIndex + 1}</span>
          <button type="button" class="btn btn--small" data-goto-unit="${piece.unitId}" data-goto-compartment="${piece.compartmentIndex}">Go to compartment</button>
        </div>
      `
      })
      .join('')

    resultsArea.innerHTML = `${renderFilterBar(query)}<div class="search-results">${rows}</div>`
    attachFilterHandlers()
    resultsArea.querySelectorAll('[data-goto-unit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigate(`/unit/${btn.dataset.gotoUnit}/compartment/${btn.dataset.gotoCompartment}`)
      })
    })
  }

  function renderFilterBar(query) {
    const currentMatches = searchPieces(query, {})
    const colors = [...new Map(currentMatches.map((p) => [colorKey(p.color), p.color])).values()]
    return `
      <div class="filter-bar">
        <div class="filter-chips" data-filter="color">
          ${colors
            .map(
              (c) =>
                `<button type="button" class="chip ${colorKey(c) === activeColorFilter ? 'chip--active' : ''}" data-value="${colorKey(c)}">${escapeHtml(c.name)}</button>`,
            )
            .join('')}
        </div>
        <div class="filter-chips" data-filter="unit">
          ${units
            .map(
              (u) =>
                `<button type="button" class="chip ${u.id === activeUnitFilter ? 'chip--active' : ''}" data-value="${u.id}">${escapeHtml(u.name)}</button>`,
            )
            .join('')}
        </div>
      </div>
    `
  }

  function attachFilterHandlers() {
    resultsArea.querySelectorAll('[data-filter="color"] .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeColorFilter = activeColorFilter === chip.dataset.value ? '' : chip.dataset.value
        renderResults()
      })
    })
    resultsArea.querySelectorAll('[data-filter="unit"] .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeUnitFilter = activeUnitFilter === chip.dataset.value ? '' : chip.dataset.value
        renderResults()
      })
    })
  }

  input.addEventListener('input', () => {
    activeColorFilter = ''
    activeUnitFilter = ''
    renderResults()
  })

  renderGrid()
  renderResults()
}
