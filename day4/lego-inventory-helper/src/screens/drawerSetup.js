import { getUnits, createUnit, updateUnitDimensions, deleteUnit, countPiecesInUnit, findOrphanedPieces } from '../lib/store.js'
import { renderCompartmentGridHtml } from '../components/grid.js'
import { navigate } from '../router.js'
import { escapeHtml } from '../lib/format.js'

export function render(root) {
  draw()

  function draw() {
    const units = getUnits()
    root.innerHTML = `
      <header class="app-header">
        <a class="icon-link" href="#/" title="Back to Home">← Home</a>
        <h1>⚙️ Drawer setup</h1>
      </header>
      ${units.length === 0 ? renderInitialForm() : renderUnitList(units)}
      ${units.length > 0 ? renderAddUnitForm() : ''}
    `
    attachHandlers(units)
  }

  function renderInitialForm() {
    return `
      <div class="setup-card">
        <p>How many drawer units do you have?</p>
        <form id="initial-form" class="form form--inline">
          <label>Units<input type="number" name="count" min="1" max="10" value="4" /></label>
          <label>Rows<input type="number" name="rows" min="1" max="10" value="4" /></label>
          <label>Columns<input type="number" name="cols" min="1" max="10" value="4" /></label>
          <button type="submit" class="btn btn--primary">Create</button>
        </form>
      </div>
    `
  }

  function renderAddUnitForm() {
    return `
      <div class="setup-card">
        <form id="add-unit-form" class="form form--inline">
          <label>Rows<input type="number" name="rows" min="1" max="10" value="4" /></label>
          <label>Columns<input type="number" name="cols" min="1" max="10" value="4" /></label>
          <button type="submit" class="btn">+ Add unit</button>
        </form>
      </div>
    `
  }

  function renderUnitList(units) {
    return `
      <div class="setup-list">
        ${units
          .map((unit) => {
            const occupied = countPiecesInUnit(unit.id)
            return `
            <div class="setup-unit" data-unit-id="${unit.id}">
              <h3>${escapeHtml(unit.name)}</h3>
              <p class="muted">${occupied} piece${occupied === 1 ? '' : 's'} stored</p>
              <form class="form form--inline" data-dimensions-form="${unit.id}">
                <label>Rows<input type="number" name="rows" min="1" max="10" value="${unit.rows}" /></label>
                <label>Columns<input type="number" name="cols" min="1" max="10" value="${unit.cols}" /></label>
                <button type="submit" class="btn btn--small">Save</button>
              </form>
              <div class="setup-unit__warning" data-warning="${unit.id}"></div>
              <button type="button" class="btn btn--small btn--danger" data-delete-unit="${unit.id}">Delete unit</button>
            </div>
          `
          })
          .join('')}
      </div>
    `
  }

  function attachHandlers(units) {
    root.querySelector('#initial-form')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const count = Number(fd.get('count'))
      const rows = Number(fd.get('rows'))
      const cols = Number(fd.get('cols'))
      for (let i = 0; i < count; i++) {
        await createUnit({ rows, cols })
      }
      navigate('/')
    })

    root.querySelector('#add-unit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      await createUnit({ rows: Number(fd.get('rows')), cols: Number(fd.get('cols')) })
      draw()
    })

    units.forEach((unit) => {
      root.querySelector(`[data-dimensions-form="${unit.id}"]`)?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        const rows = Number(fd.get('rows'))
        const cols = Number(fd.get('cols'))
        const result = await updateUnitDimensions(unit.id, rows, cols)
        const warningEl = root.querySelector(`[data-warning="${unit.id}"]`)
        if (!result.ok) {
          const orphaned = findOrphanedPieces(unit.id, rows, cols)
          warningEl.innerHTML = `
            <p class="warning-text">Move or remove the pieces in the highlighted compartments first.</p>
            ${renderCompartmentGridHtml(unit, { disablePredicate: () => false })}
          `
          warningEl.querySelectorAll('[data-index]').forEach((cell) => {
            if (orphaned.some((p) => p.compartmentIndex === Number(cell.dataset.index))) {
              cell.classList.add('drawer-cell--orphaned')
            }
          })
        } else {
          draw()
        }
      })
    })

    root.querySelectorAll('[data-delete-unit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const unitId = btn.dataset.deleteUnit
        const result = await deleteUnit(unitId)
        if (!result.ok) {
          const warningEl = root.querySelector(`[data-warning="${unitId}"]`)
          warningEl.innerHTML = `<p class="warning-text">This unit still has ${result.occupied} piece(s) in it — move or remove them first.</p>`
        } else {
          draw()
        }
      })
    })
  }
}
