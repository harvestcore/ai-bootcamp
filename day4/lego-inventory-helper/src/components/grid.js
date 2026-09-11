import { colorSwatchHtml } from './colorSwatch.js'
import { fullnessBadgeHtml } from './badges.js'
import { getCompartmentInfo } from '../lib/store.js'
import { escapeHtml } from '../lib/format.js'

// Renders a unit's compartment grid. `compact` produces the small "grid within
// a grid" used on the Home screen's unit cards; the full-size grid (Drawer unit
// view) additionally shows quantity badges.
export function renderCompartmentGridHtml(unit, { compact = false, disablePredicate = null } = {}) {
  const cells = []
  for (let index = 0; index < unit.rows * unit.cols; index++) {
    cells.push(renderCell(unit, index, compact, disablePredicate))
  }
  return `<div class="drawer-grid-wrap"><div class="drawer-grid ${compact ? 'drawer-grid--compact' : ''}" style="--cols:${unit.cols}">${cells.join('')}</div></div>`
}

function renderCell(unit, index, compact, disablePredicate) {
  const { occupants, manuallyFull, structurallyFull, record } = getCompartmentInfo(unit.id, index)
  const disabled = disablePredicate ? disablePredicate(unit.id, index, { manuallyFull, structurallyFull }) : false
  const classes = ['drawer-cell']
  if (occupants.length === 0) classes.push('drawer-cell--empty')
  else classes.push('drawer-cell--occupied')
  if (manuallyFull) classes.push('drawer-cell--full')
  if (disabled) classes.push('drawer-cell--disabled')

  let inner
  if (occupants.length === 0) {
    inner = ''
  } else if (record.partitionCount === 1) {
    const piece = occupants[0]
    inner = `
      ${colorSwatchHtml(piece.color, { size: compact ? 8 : 16 })}
      ${!compact ? `<span class="drawer-cell__qty">${piece.quantity}</span>` : ''}
    `
  } else {
    const bands = []
    for (let i = 0; i < record.partitionCount; i++) {
      const occ = occupants.find((o) => o.partitionIndex === i)
      bands.push(`
        <span class="drawer-cell__band ${record.partitionsFull[i] ? 'drawer-cell__band--full' : ''}">
          ${occ ? colorSwatchHtml(occ.color, { size: compact ? 6 : 12 }) : ''}
          ${occ && !compact ? `<span class="drawer-cell__qty drawer-cell__qty--band">${occ.quantity}</span>` : ''}
        </span>
      `)
    }
    inner = `<span class="drawer-cell__bands drawer-cell__bands--${record.partitionCount}">${bands.join('')}</span>`
  }

  const title = compact
    ? ''
    : `title="Compartment ${index + 1}${occupants.length ? `: ${escapeHtml(occupants.map((o) => o.description).join(', '))}` : ''}"`

  return `<button type="button" class="${classes.join(' ')}" data-index="${index}" ${disabled ? 'disabled' : ''} ${title}>
    ${inner}
    ${manuallyFull && !compact ? fullnessBadgeHtml() : ''}
  </button>`
}
