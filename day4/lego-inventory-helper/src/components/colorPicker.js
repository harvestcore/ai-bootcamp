import { escapeHtml } from '../lib/format.js'

// Colors selected as a scannable list (swatch + name) rather than a grid of bare
// circles — a list of up to a few hundred rows is easier to scan and tap than a
// wrapping grid, especially once the list is filtered down to a single part's
// available colors (see lib/catalog.js#getAvailableColorsForPart).
//
// The list collapses to a single "current selection" row once a color is picked
// (click it again to reopen and change it) rather than staying permanently
// expanded — otherwise every color list on the page stays open forever, which
// reads as broken ("I picked one and the whole list is still there").
export function mountColorPicker(container, { colors, selected, onChange }) {
  const showFilter = colors.length > 12
  let currentSelected = selected
  let expanded = !currentSelected

  function render() {
    if (expanded) renderExpanded()
    else renderCollapsed()
  }

  function renderCollapsed() {
    const isOther = currentSelected?.source === 'other'
    const label = currentSelected ? (isOther ? `${currentSelected.name || 'Custom color'} (custom)` : currentSelected.name) : 'Select a color…'
    const swatch = currentSelected
      ? isOther
        ? `<span class="swatch swatch--other">?</span>`
        : `<span class="swatch" style="background:${currentSelected.rgb}"></span>`
      : `<span class="swatch swatch--empty"></span>`

    container.innerHTML = `
      <button type="button" class="color-picker-collapsed">
        ${swatch}
        <span class="color-list-row__name">${escapeHtml(label)}</span>
        <span class="color-picker-collapsed__change">Change</span>
      </button>
    `
    container.querySelector('.color-picker-collapsed').addEventListener('click', () => {
      expanded = true
      render()
    })
  }

  function renderExpanded() {
    const otherSelected = currentSelected?.source === 'other'
    container.innerHTML = `
      <div class="color-picker">
        ${showFilter ? `<input type="text" class="color-filter" placeholder="Filter colors…" />` : ''}
        <div class="color-list">
          ${colors
            .map(
              (c) => `
            <button type="button" class="color-list-row ${currentSelected?.source === 'palette' && currentSelected.id === c.id ? 'color-list-row--selected' : ''}" data-color-id="${c.id}" data-color-name="${escapeHtml(c.name)}" data-color-rgb="${c.rgb}">
              <span class="swatch" style="background:${c.rgb}"></span>
              <span class="color-list-row__name">${escapeHtml(c.name)}</span>
            </button>
          `,
            )
            .join('')}
          <button type="button" class="color-list-row color-list-row--other ${otherSelected ? 'color-list-row--selected' : ''}" data-color-other="1">
            <span class="swatch swatch--other">?</span>
            <span class="color-list-row__name">Other…</span>
          </button>
        </div>
        <div class="color-other-row" ${otherSelected ? '' : 'hidden'}>
          <input type="text" class="color-other-input" placeholder="Custom color name" value="${otherSelected ? escapeHtml(currentSelected.name) : ''}" />
          <button type="button" class="btn btn--small btn--primary color-other-confirm">Use this color</button>
        </div>
      </div>
    `

    const filterInput = container.querySelector('.color-filter')
    const otherRow = container.querySelector('.color-other-row')
    const otherInput = container.querySelector('.color-other-input')
    const otherConfirm = container.querySelector('.color-other-confirm')
    const rows = [...container.querySelectorAll('.color-list-row[data-color-id]')]
    const otherBtn = container.querySelector('[data-color-other]')

    filterInput?.addEventListener('input', () => {
      const q = filterInput.value.trim().toLowerCase()
      rows.forEach((row) => {
        row.hidden = q.length > 0 && !row.dataset.colorName.toLowerCase().includes(q)
      })
    })

    rows.forEach((row) => {
      row.addEventListener('click', () => {
        currentSelected = { source: 'palette', id: Number(row.dataset.colorId), name: row.dataset.colorName, rgb: row.dataset.colorRgb }
        onChange(currentSelected)
        expanded = false
        render()
      })
    })

    otherBtn.addEventListener('click', () => {
      otherRow.hidden = false
      otherInput.focus()
    })

    otherInput.addEventListener('input', () => {
      currentSelected = { source: 'other', name: otherInput.value.trim() }
      onChange(currentSelected)
    })
    otherInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      confirmOther()
    })
    otherConfirm.addEventListener('click', confirmOther)

    function confirmOther() {
      const name = otherInput.value.trim()
      if (!name) {
        otherInput.focus()
        return
      }
      currentSelected = { source: 'other', name }
      onChange(currentSelected)
      expanded = false
      render()
    }
  }

  render()
}
