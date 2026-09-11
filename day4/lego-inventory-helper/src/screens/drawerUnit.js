import { getUnit } from '../lib/store.js'
import { renderCompartmentGridHtml } from '../components/grid.js'
import { navigate } from '../router.js'
import { renderCompartmentPanel } from './compartmentDetail.js'
import { escapeHtml } from '../lib/format.js'

export function render(root, params) {
  const unit = getUnit(params.id)
  if (!unit) {
    root.innerHTML = `<p class="empty-state">Unit not found. <a href="#/">Back to Home</a></p>`
    return
  }

  const compartmentIndex = params.index != null ? Number(params.index) : null

  root.innerHTML = `
    <header class="app-header">
      <a class="icon-link" href="#/" title="Back to Home">← Home</a>
      <h1>📦 ${escapeHtml(unit.name)}</h1>
      <a class="icon-link" href="#/setup" title="Edit drawer structure">⚙︎ Structure</a>
    </header>
    <div class="unit-view">
      <div id="grid-container">${renderCompartmentGridHtml(unit)}</div>
      <div id="panel-container"></div>
    </div>
  `

  root.querySelector('#grid-container').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-index]')
    if (!btn) return
    navigate(`/unit/${unit.id}/compartment/${btn.dataset.index}`)
  })

  const panelContainer = root.querySelector('#panel-container')
  if (compartmentIndex != null) {
    panelContainer.classList.add('panel-container--open')
    renderCompartmentPanel(panelContainer, unit, compartmentIndex, {
      onClose: () => navigate(`/unit/${unit.id}`),
    })
  }
}
