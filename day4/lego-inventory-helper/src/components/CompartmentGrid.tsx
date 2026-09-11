import { cn } from '../lib/cn'
import { ColorSwatch } from './ColorSwatch'
import { compartmentCount, getCompartmentInfo, type InventorySnapshot } from '../lib/inventory'
import type { DrawerUnit } from '../types'

/**
 * One drawer unit drawn as its physical grid of compartments.
 *
 * The same component covers all three uses — the small preview on Home, the
 * full-size view of a unit, and the picker used when choosing where a piece
 * goes — because they only differ in size and in which cells are selectable.
 */
export function CompartmentGrid({
  unit,
  snapshot,
  variant = 'full',
  selectedIndex = null,
  highlightIndexes,
  disableUnavailable = false,
  onSelect,
}: {
  unit: DrawerUnit
  snapshot: InventorySnapshot
  variant?: 'full' | 'compact'
  selectedIndex?: number | null
  /** Cells to call out, e.g. the ones blocking a resize. */
  highlightIndexes?: number[]
  /** Grey out compartments that can't take another piece. */
  disableUnavailable?: boolean
  onSelect?: (index: number) => void
}) {
  const compact = variant === 'compact'
  const cells = Array.from({ length: compartmentCount(unit) }, (_, index) => index)

  return (
    // Cells cap out at a readable size instead of stretching to fill the card —
    // a 3x3 unit on a wide screen shouldn't render nine huge squares — but they
    // still shrink below that cap on a narrow phone.
    <div
      className={cn('grid justify-center', compact ? 'gap-1' : 'gap-2')}
      style={{
        gridTemplateColumns: `repeat(${unit.cols}, minmax(0, ${compact ? '2.5rem' : '4.5rem'}))`,
      }}
    >
      {cells.map((index) => (
        <Cell
          key={index}
          unit={unit}
          index={index}
          snapshot={snapshot}
          compact={compact}
          selected={selectedIndex === index}
          highlighted={highlightIndexes?.includes(index) ?? false}
          disableUnavailable={disableUnavailable}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function Cell({
  unit,
  index,
  snapshot,
  compact,
  selected,
  highlighted,
  disableUnavailable,
  onSelect,
}: {
  unit: DrawerUnit
  index: number
  snapshot: InventorySnapshot
  compact: boolean
  selected: boolean
  highlighted: boolean
  disableUnavailable: boolean
  onSelect?: (index: number) => void
}) {
  const { occupants, record, manuallyFull, structurallyFull } = getCompartmentInfo(
    snapshot,
    unit.id,
    index,
  )
  const unavailable = manuallyFull || structurallyFull
  const disabled = disableUnavailable && unavailable
  const occupied = occupants.length > 0

  const title = occupied
    ? `Compartment ${index + 1}: ${occupants.map((o) => `${o.description} (${o.quantity})`).join(', ')}`
    : `Compartment ${index + 1}: empty`

  return (
    <button
      type="button"
      title={title}
      disabled={disabled || !onSelect}
      onClick={onSelect ? () => onSelect(index) : undefined}
      className={cn(
        'relative overflow-hidden rounded-lg border transition-colors',
        compact ? 'aspect-square' : 'aspect-square min-h-11',
        occupied ? 'border-brand-line bg-cell-filled' : 'border-cell-line bg-cell-empty',
        manuallyFull && 'hatched',
        highlighted && 'ring-2 ring-danger',
        selected && 'ring-2 ring-brand ring-offset-1 ring-offset-surface',
        onSelect && !disabled && 'cursor-pointer hover:border-brand',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <CellContents
        compact={compact}
        partitionCount={record.partitionCount}
        partitionsFull={record.partitionsFull}
        occupants={occupants}
      />
      {!compact && !occupied ? (
        <span className="absolute bottom-0.5 right-1 text-[10px] text-ink-muted/60">{index + 1}</span>
      ) : null}
    </button>
  )
}

function CellContents({
  compact,
  partitionCount,
  partitionsFull,
  occupants,
}: {
  compact: boolean
  partitionCount: number
  partitionsFull: boolean[]
  occupants: ReturnType<typeof getCompartmentInfo>['occupants']
}) {
  if (occupants.length === 0) return null

  if (partitionCount === 1) {
    const piece = occupants[0]!
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-0.5">
        <ColorSwatch color={piece.color} size={compact ? 8 : 18} />
        {!compact ? (
          <span className="text-[11px] font-semibold text-ink-muted">{piece.quantity}</span>
        ) : null}
      </span>
    )
  }

  // Subdivided: one horizontal band per physical partition.
  return (
    <span className="flex h-full w-full flex-col">
      {Array.from({ length: partitionCount }, (_, i) => {
        const piece = occupants.find((o) => o.partitionIndex === i)
        return (
          <span
            key={i}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 border-b border-cell-line/60 last:border-b-0',
              partitionsFull[i] && 'hatched',
            )}
          >
            {piece ? <ColorSwatch color={piece.color} size={compact ? 6 : 12} /> : null}
            {piece && !compact ? (
              <span className="text-[10px] font-semibold text-ink-muted">{piece.quantity}</span>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}
