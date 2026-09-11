import { getCompartmentInfo, extractPiece, deletePiece, toggleCompartmentPartitionFull } from '../lib/store.js'
import { colorSwatchHtml } from '../components/colorSwatch.js'
import { pieceImageHtml } from '../components/pieceImage.js'
import { navigate } from '../router.js'
import { escapeHtml, formatDate } from '../lib/format.js'

export function renderCompartmentPanel(container, unit, index, { onClose }) {
  draw()

  function draw() {
    const { occupants, record } = getCompartmentInfo(unit.id, index)

    container.innerHTML = `
      <div class="panel">
        <div class="panel__header">
          <h2>${escapeHtml(unit.name)}, Compartment ${index + 1}</h2>
          <button type="button" class="btn btn--icon" id="close-panel">✕</button>
        </div>
        <div class="panel__body">
          ${
            occupants.length === 0
              ? `<p class="empty-state">Nothing stored here yet.</p>`
              : Array.from({ length: record.partitionCount }, (_, i) => renderRow(occupants, record, i)).join('')
          }
        </div>
        <div class="panel__footer">
          <button type="button" class="btn btn--primary" id="add-here">Add a piece to this compartment</button>
        </div>
      </div>
    `

    container.querySelector('#close-panel').addEventListener('click', onClose)
    container.querySelector('#add-here').addEventListener('click', () => {
      navigate(`/add?unit=${unit.id}&compartment=${index}`)
    })

    container.querySelectorAll('[data-extract-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stepper = container.querySelector(`[data-extract-stepper="${btn.dataset.extractToggle}"]`)
        stepper.hidden = !stepper.hidden
      })
    })

    container.querySelectorAll('[data-extract-confirm]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pieceId = btn.dataset.extractConfirm
        const input = container.querySelector(`[data-extract-qty="${pieceId}"]`)
        const qty = Number(input.value)
        if (!qty || qty < 1) return
        await extractPiece(pieceId, qty)
        draw()
      })
    })

    container.querySelectorAll('[data-full-toggle]').forEach((toggle) => {
      toggle.addEventListener('change', async () => {
        await toggleCompartmentPartitionFull(unit.id, index, Number(toggle.dataset.fullToggle), toggle.checked)
        draw()
      })
    })

    container.querySelectorAll('[data-edit-piece]').forEach((link) => {
      link.addEventListener('click', () => navigate(`/edit/${link.dataset.editPiece}`))
    })

    container.querySelectorAll('[data-delete-piece]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.confirmed !== 'true') {
          btn.dataset.confirmed = 'true'
          btn.textContent = 'Confirm delete?'
          return
        }
        await deletePiece(btn.dataset.deletePiece)
        draw()
      })
    })
  }

  function renderRow(occupants, record, partitionIndex) {
    const piece = occupants.find((o) => o.partitionIndex === partitionIndex)
    const isFull = record.partitionsFull[partitionIndex]
    if (!piece) {
      return `
        <div class="piece-row piece-row--empty">
          <span class="piece-row__label">Partition ${partitionIndex + 1}: empty</span>
          <label class="full-toggle">
            <input type="checkbox" data-full-toggle="${partitionIndex}" ${isFull ? 'checked' : ''} />
            Mark full
          </label>
        </div>
      `
    }
    return `
      <div class="piece-row">
        ${pieceImageHtml({ size: 44, imageUrl: piece.imageUrl })}
        <div class="piece-row__info">
          ${colorSwatchHtml(piece.color)}
          <strong>${escapeHtml(piece.description)}</strong>
          <span class="muted">#${escapeHtml(piece.partNumber)}</span>
          ${!piece.catalogMatched ? `<span class="warning-text">Not found in catalog</span>` : ''}
          ${piece.notes ? `<p class="piece-row__notes">${escapeHtml(piece.notes)}</p>` : ''}
          <span class="muted">Added ${formatDate(piece.addedAt)}</span>
        </div>
        <div class="piece-row__qty">${piece.quantity}</div>
        <div class="piece-row__actions">
          <button type="button" class="btn btn--small" data-extract-toggle="${piece.id}">Extract</button>
          <div class="stepper" data-extract-stepper="${piece.id}" hidden>
            <input type="number" min="1" max="${piece.quantity}" value="1" data-extract-qty="${piece.id}" />
            <button type="button" class="btn btn--small btn--primary" data-extract-confirm="${piece.id}">Confirm</button>
          </div>
          <label class="full-toggle">
            <input type="checkbox" data-full-toggle="${partitionIndex}" ${isFull ? 'checked' : ''} />
            Mark full
          </label>
          <button type="button" class="btn btn--small" data-edit-piece="${piece.id}">Edit</button>
          <button type="button" class="btn btn--small btn--danger" data-delete-piece="${piece.id}">Delete</button>
        </div>
      </div>
    `
  }
}
