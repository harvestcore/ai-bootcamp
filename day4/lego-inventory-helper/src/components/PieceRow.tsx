import { Link } from 'react-router-dom'
import { ColorSwatch } from './ColorSwatch'
import { PieceImage } from './PieceImage'
import { getUnit, type InventorySnapshot } from '../lib/inventory'
import type { Piece } from '../types'

/**
 * One piece as a tappable row, linking to the compartment that holds it.
 * Shared by the home search results and the full piece list so the two can't
 * drift apart.
 */
export function PieceRow({ piece, snapshot }: { piece: Piece; snapshot: InventorySnapshot }) {
  const unit = getUnit(snapshot, piece.unitId)

  return (
    <Link
      to={`/unit/${piece.unitId}/compartment/${piece.compartmentIndex}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-sunken"
    >
      <PieceImage imageUrl={piece.imageUrl} size={40} />
      <div className="min-w-0 flex-1">
        {/* Catalog names get long ("Minifig Head …, Angry / Surprised, Water
            Spots"), so the full name is at least available on hover here and
            shown in full in the compartment panel. */}
        <div className="truncate text-sm font-medium text-ink" title={piece.description}>
          {piece.description}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <ColorSwatch color={piece.color} size={11} />
          <span className="truncate">{piece.color.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">#{piece.partNumber || '—'}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-ink">{piece.quantity}</div>
        <div className="text-xs text-ink-muted">
          {unit?.name}, C{piece.compartmentIndex + 1}
        </div>
      </div>
      <span className="text-ink-muted" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}
