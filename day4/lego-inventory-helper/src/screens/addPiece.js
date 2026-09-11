import {
  getUnits,
  getUnit,
  findDuplicate,
  suggestLocation,
  needsPartitionSplit,
  getCompartmentInfo,
  mergeAddToExisting,
  createPieceAtLocation,
  setPartitionCount,
} from '../lib/store.js'
import { lookupPartByNumber, getAvailableColorsForPart } from '../lib/catalog.js'
import { renderCompartmentGridHtml } from '../components/grid.js'
import { colorSwatchHtml } from '../components/colorSwatch.js'
import { mountColorPicker } from '../components/colorPicker.js'
import { partSearchHtml, mountPartSearch } from '../components/partSearch.js'
import { navigate } from '../router.js'
import { escapeHtml } from '../lib/format.js'

export function render(root, params, query) {
  const openedFrom =
    query.unit && query.compartment != null
      ? { unitId: query.unit, compartmentIndex: Number(query.compartment) }
      : null

  const form = {
    partNumber: '',
    color: null,
    quantity: 1,
    notes: '',
  }

  function closeFlow() {
    if (openedFrom) navigate(`/unit/${openedFrom.unitId}/compartment/${openedFrom.compartmentIndex}`)
    else navigate('/')
  }

  renderShell()
  renderDetailsStep()

  function renderShell() {
    root.innerHTML = `
      <header class="app-header">
        <button type="button" class="icon-link" id="cancel-add">← Cancel</button>
        <h1>➕ Add piece</h1>
      </header>
      <div id="add-step"></div>
    `
    root.querySelector('#cancel-add').addEventListener('click', closeFlow)
  }

  function stepContainer() {
    return root.querySelector('#add-step')
  }

  async function renderDetailsStep() {
    const container = stepContainer()
    container.innerHTML = `
      <form id="details-form" class="form">
        <div class="field-group">
          <span class="field-group__label">Search the catalog</span>
          ${partSearchHtml()}
        </div>
        <label>LEGO part number *<input type="text" name="partNumber" required value="${escapeHtml(form.partNumber)}" placeholder="e.g. 3001" /></label>
        <div class="field-group">
          <span class="field-group__label">Piece</span>
          <div id="catalog-hint" class="catalog-hint-value">${form.partNumber ? '' : '<span class="muted">Enter or search for a part number above</span>'}</div>
        </div>
        <fieldset>
          <legend>Color *</legend>
          <div id="color-picker"></div>
        </fieldset>
        <label>Quantity *<input type="number" name="quantity" min="1" step="1" required value="${form.quantity}" /></label>
        <label>Notes<textarea name="notes">${escapeHtml(form.notes)}</textarea></label>
        <button type="submit" class="btn btn--primary">Continue</button>
      </form>
    `

    const partNumberInput = container.querySelector('[name="partNumber"]')
    const catalogHint = container.querySelector('#catalog-hint')
    const colorPickerEl = container.querySelector('#color-picker')

    async function refreshColors() {
      const colors = await getAvailableColorsForPart(form.partNumber)
      if (form.color?.source === 'palette' && !colors.some((c) => c.id === form.color.id)) {
        form.color = null
      }
      mountColorPicker(colorPickerEl, {
        colors,
        selected: form.color,
        onChange: (color) => {
          form.color = color
        },
      })
    }

    async function handlePartNumberChange(value) {
      form.partNumber = value.trim()
      if (!form.partNumber) {
        catalogHint.innerHTML = '<span class="muted">Enter or search for a part number above</span>'
      } else {
        const match = await lookupPartByNumber(form.partNumber)
        catalogHint.innerHTML = match
          ? escapeHtml(match.name)
          : `<span class="warning-text">Not found in catalog — will be labeled "Part #${escapeHtml(form.partNumber)}"</span>`
      }
      await refreshColors()
    }

    const partSearchInput = container.querySelector('.part-search-input')
    let debounceTimer
    partNumberInput.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      const value = partNumberInput.value
      // Typing the part number directly makes the catalog search box stale/
      // mismatched (it might still show a name from an earlier search) — clear it.
      partSearchInput.value = ''
      debounceTimer = setTimeout(() => handlePartNumberChange(value), 200)
    })

    mountPartSearch(container.querySelector('.part-search'), {
      onSelect: (part) => {
        partNumberInput.value = part.part_num
        handlePartNumberChange(part.part_num)
      },
    })

    await refreshColors()

    container.querySelector('#details-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      form.partNumber = fd.get('partNumber').trim()
      form.quantity = Math.max(1, Number(fd.get('quantity')) || 1)
      form.notes = fd.get('notes').trim()

      if (!form.partNumber) {
        alert('Please enter or search for a LEGO part number.')
        return
      }
      if (!form.color || (form.color.source === 'other' && !form.color.name)) {
        alert('Please select a color.')
        return
      }

      const duplicate = findDuplicate(form)
      if (duplicate) {
        renderDuplicateStep(duplicate)
      } else if (openedFrom) {
        // Opened from a specific compartment's "Add a piece" button — the
        // location is already unambiguous, so "Continue" should place it there
        // directly rather than making the user confirm a location they already
        // picked by opening this flow from that exact compartment.
        proceedToLocation(openedFrom.unitId, openedFrom.compartmentIndex)
      } else {
        renderLocationStep()
      }
    })
  }

  function proceedToLocation(unitId, compartmentIndex) {
    if (needsPartitionSplit(unitId, compartmentIndex)) {
      renderPartitionStep(unitId, compartmentIndex)
    } else {
      finish(unitId, compartmentIndex)
    }
  }

  function renderDuplicateStep(duplicate) {
    const unit = getUnit(duplicate.unitId)
    const { record } = getCompartmentInfo(duplicate.unitId, duplicate.compartmentIndex)
    const locationLabel =
      record.partitionCount > 1
        ? `${unit.name}, Compartment ${duplicate.compartmentIndex + 1}, Partition ${duplicate.partitionIndex + 1}`
        : `${unit.name}, Compartment ${duplicate.compartmentIndex + 1}`

    const container = stepContainer()
    container.innerHTML = `
      <div class="banner">
        <p>This piece already exists in <strong>${escapeHtml(locationLabel)}</strong> (${duplicate.quantity} in stock). Add your ${form.quantity} to that location?</p>
        <div class="banner__actions">
          <button type="button" class="btn btn--primary" id="add-to-existing">Add to that location</button>
          <button type="button" class="btn" id="choose-different">Choose a different location</button>
        </div>
      </div>
    `
    container.querySelector('#add-to-existing').addEventListener('click', async () => {
      await mergeAddToExisting(duplicate.id, form.quantity)
      closeFlow()
    })
    container.querySelector('#choose-different').addEventListener('click', () => renderLocationStep())
  }

  function renderLocationStep() {
    const units = getUnits()
    const suggestion = openedFrom ?? suggestLocation(form)
    let selectedUnitId = suggestion?.unitId ?? units[0]?.id
    let selectedIndex = suggestion?.compartmentIndex ?? null

    const container = stepContainer()

    function draw() {
      const unit = getUnits().find((u) => u.id === selectedUnitId)
      container.innerHTML = `
        ${suggestion?.reason && !openedFrom ? `<p class="muted">Suggested: ${escapeHtml(suggestion.reason)}</p>` : ''}
        <div class="unit-tabs">
          ${units.map((u) => `<button type="button" class="chip ${u.id === selectedUnitId ? 'chip--active' : ''}" data-unit-tab="${u.id}">${escapeHtml(u.name)}</button>`).join('')}
        </div>
        <div id="location-grid">${renderCompartmentGridHtml(unit, { disablePredicate: (_u, _i, s) => s.manuallyFull || s.structurallyFull })}</div>
        <button type="button" class="btn btn--primary" id="confirm-location" ${selectedIndex == null ? 'disabled' : ''}>Use this compartment</button>
      `
      if (selectedIndex != null) {
        container.querySelector(`#location-grid [data-index="${selectedIndex}"]`)?.classList.add('drawer-cell--selected')
      }
      container.querySelectorAll('[data-unit-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedUnitId = btn.dataset.unitTab
          selectedIndex = null
          draw()
        })
      })
      container.querySelectorAll('#location-grid [data-index]').forEach((cell) => {
        cell.addEventListener('click', () => {
          selectedIndex = Number(cell.dataset.index)
          draw()
        })
      })
      container.querySelector('#confirm-location').addEventListener('click', () => {
        proceedToLocation(selectedUnitId, selectedIndex)
      })
    }

    draw()
  }

  function renderPartitionStep(unitId, index) {
    const { occupants } = getCompartmentInfo(unitId, index)
    const minCount = occupants.length + 1
    const container = stepContainer()
    container.innerHTML = `
      <p>This compartment already holds a different color of the same piece. Split it into equal partitions:</p>
      <div class="partition-choice">
        ${[1, 2, 3]
          .filter((n) => n >= minCount)
          .map((n) => `<button type="button" class="btn" data-partition-count="${n}">${n === 1 ? 'Whole' : n === 2 ? 'Halves' : 'Thirds'}</button>`)
          .join('')}
      </div>
      <div class="partition-preview">
        ${occupants.map((o) => `<span class="partition-preview__slot">${colorSwatchHtml(o.color)} ${escapeHtml(o.color.name)}</span>`).join('')}
        <span class="partition-preview__slot partition-preview__slot--new">${colorSwatchHtml(form.color)} ${escapeHtml(form.color.name)} (new)</span>
      </div>
      <p class="muted">Partitions are physical dividers you place in the compartment yourself.</p>
    `
    container.querySelectorAll('[data-partition-count]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await setPartitionCount(unitId, index, Number(btn.dataset.partitionCount))
        finish(unitId, index)
      })
    })
  }

  async function finish(unitId, index) {
    await createPieceAtLocation(form, unitId, index)
    closeFlow()
  }
}
