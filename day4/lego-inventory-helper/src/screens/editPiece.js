import { getUnits, getUnit, editPiece, movePiece, deletePiece, getPieceById } from '../lib/store.js'
import { lookupPartByNumber, getAvailableColorsForPart } from '../lib/catalog.js'
import { renderCompartmentGridHtml } from '../components/grid.js'
import { mountColorPicker } from '../components/colorPicker.js'
import { partSearchHtml, mountPartSearch } from '../components/partSearch.js'
import { navigate } from '../router.js'
import { escapeHtml, formatDate } from '../lib/format.js'

export function render(root, params) {
  const state = { pieceId: params.pieceId, showMove: false }

  draw()

  async function draw() {
    const piece = getPieceById(state.pieceId)
    if (!piece) {
      root.innerHTML = `<p class="empty-state">Piece not found. <a href="#/">Back to Home</a></p>`
      return
    }
    const unit = getUnit(piece.unitId)

    root.innerHTML = `
      <header class="app-header">
        <a class="icon-link" href="#/unit/${unit.id}/compartment/${piece.compartmentIndex}">← Back</a>
        <h1>✏️ Edit piece</h1>
      </header>
      <form id="edit-form" class="form">
        <div class="field-group">
          <span class="field-group__label">Search the catalog</span>
          ${partSearchHtml()}
        </div>
        <label>LEGO part number *<input type="text" name="partNumber" required value="${escapeHtml(piece.partNumber)}" /></label>
        <div class="field-group">
          <span class="field-group__label">Piece</span>
          <div id="catalog-hint" class="catalog-hint-value">${piece.catalogMatched ? escapeHtml(piece.description) : `<span class="warning-text">Not found in catalog — labeled "${escapeHtml(piece.description)}"</span>`}</div>
        </div>
        <fieldset>
          <legend>Color *</legend>
          <div id="color-picker"></div>
        </fieldset>
        <label>Notes<textarea name="notes">${escapeHtml(piece.notes ?? '')}</textarea></label>
        <div class="readonly-field">
          <span>Quantity: <strong>${piece.quantity}</strong></span>
          <span class="muted">To change quantity, use Extract (compartment view) or Add (to bring in more).</span>
        </div>
        <div class="readonly-field muted">Added ${formatDate(piece.addedAt)} — cannot be changed.</div>
        <button type="submit" class="btn btn--primary">Save changes</button>
      </form>
      <button type="button" class="btn" id="move-btn">Move to a different compartment</button>
      <div id="move-picker"></div>
      <button type="button" class="btn btn--danger" id="delete-btn">Delete piece</button>
    `

    let selectedColor = { ...piece.color }
    let currentPartNumber = piece.partNumber

    const partNumberInput = root.querySelector('[name="partNumber"]')
    const catalogHint = root.querySelector('#catalog-hint')
    const colorPickerEl = root.querySelector('#color-picker')

    async function refreshColors() {
      const colors = await getAvailableColorsForPart(currentPartNumber)
      if (selectedColor?.source === 'palette' && !colors.some((c) => c.id === selectedColor.id)) {
        selectedColor = null
      }
      mountColorPicker(colorPickerEl, {
        colors,
        selected: selectedColor,
        onChange: (color) => {
          selectedColor = color
        },
      })
    }

    async function handlePartNumberChange(value) {
      currentPartNumber = value.trim()
      if (!currentPartNumber) {
        catalogHint.innerHTML = '<span class="muted">Enter or search for a part number above</span>'
      } else {
        const match = await lookupPartByNumber(currentPartNumber)
        catalogHint.innerHTML = match
          ? escapeHtml(match.name)
          : `<span class="warning-text">Not found in catalog — will be labeled "Part #${escapeHtml(currentPartNumber)}"</span>`
      }
      await refreshColors()
    }

    const partSearchInput = root.querySelector('.part-search-input')
    let debounceTimer
    partNumberInput.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      const value = partNumberInput.value
      partSearchInput.value = ''
      debounceTimer = setTimeout(() => handlePartNumberChange(value), 200)
    })

    mountPartSearch(root.querySelector('.part-search'), {
      onSelect: (part) => {
        partNumberInput.value = part.part_num
        handlePartNumberChange(part.part_num)
      },
    })

    await refreshColors()

    root.querySelector('#edit-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const partNumber = fd.get('partNumber').trim()
      if (!partNumber) {
        alert('Please enter or search for a LEGO part number.')
        return
      }
      if (!selectedColor || (selectedColor.source === 'other' && !selectedColor.name)) {
        alert('Please select a color.')
        return
      }
      await editPiece(piece.id, {
        partNumber,
        color: selectedColor,
        notes: fd.get('notes').trim(),
      })
      navigate(`/unit/${piece.unitId}/compartment/${piece.compartmentIndex}`)
    })

    root.querySelector('#move-btn').addEventListener('click', () => {
      state.showMove = !state.showMove
      renderMovePicker(piece)
    })

    root.querySelector('#delete-btn').addEventListener('click', async () => {
      if (root.querySelector('#delete-btn').dataset.confirmed !== 'true') {
        root.querySelector('#delete-btn').dataset.confirmed = 'true'
        root.querySelector('#delete-btn').textContent = 'Confirm delete?'
        return
      }
      await deletePiece(piece.id)
      navigate('/')
    })

    if (state.showMove) renderMovePicker(piece)
  }

  function renderMovePicker(piece) {
    const pickerEl = root.querySelector('#move-picker')
    if (!state.showMove) {
      pickerEl.innerHTML = ''
      return
    }
    const units = getUnits()
    let selectedUnitId = units[0]?.id
    let selectedIndex = null

    function drawPicker() {
      const unit = units.find((u) => u.id === selectedUnitId)
      pickerEl.innerHTML = `
        <div class="unit-tabs">
          ${units.map((u) => `<button type="button" class="chip ${u.id === selectedUnitId ? 'chip--active' : ''}" data-move-unit-tab="${u.id}">${escapeHtml(u.name)}</button>`).join('')}
        </div>
        <div id="move-grid">${renderCompartmentGridHtml(unit, { disablePredicate: (_u, _i, s) => s.manuallyFull || s.structurallyFull })}</div>
        <button type="button" class="btn btn--primary" id="confirm-move" ${selectedIndex == null ? 'disabled' : ''}>Move here</button>
      `
      pickerEl.querySelectorAll('[data-move-unit-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedUnitId = btn.dataset.moveUnitTab
          selectedIndex = null
          drawPicker()
        })
      })
      pickerEl.querySelectorAll('#move-grid [data-index]').forEach((cell) => {
        cell.addEventListener('click', () => {
          selectedIndex = Number(cell.dataset.index)
          drawPicker()
        })
      })
      pickerEl.querySelector('#confirm-move').addEventListener('click', async () => {
        await movePiece(piece.id, selectedUnitId, selectedIndex)
        state.showMove = false
        navigate(`/unit/${selectedUnitId}/compartment/${selectedIndex}`)
      })
    }

    drawPicker()
  }
}
