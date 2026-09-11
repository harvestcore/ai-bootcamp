import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieceRow } from '../components/PieceRow'
import { ColorSwatch } from '../components/ColorSwatch'
import { Button, Card, Chip, EmptyState, SectionTitle, TextInput } from '../components/ui'
import { useInventory } from '../hooks/useInventory'
import { colorKey } from '../lib/matching'
import { distinctColors, searchPieces, sortPieces, type PieceSort } from '../lib/inventory'
import { plural } from '../lib/format'

const SORTS: { value: PieceSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'quantity', label: 'How many' },
  { value: 'location', label: 'Where it is' },
]

/**
 * Everything you own, in one list. The home screen answers "where is this
 * piece?"; this answers "what do I actually have?" — which the drawer grids
 * can't, once there are more pieces than compartments you can eyeball.
 */
export function PiecesPage() {
  const snapshot = useInventory()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PieceSort>('name')
  const [colorFilter, setColorFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')

  const filtered = useMemo(
    () =>
      sortPieces(
        snapshot,
        searchPieces(snapshot, query, {
          color: colorFilter || undefined,
          unitId: unitFilter || undefined,
        }),
        sort,
      ),
    [snapshot, query, colorFilter, unitFilter, sort],
  )

  const colors = distinctColors(snapshot.pieces)
  const totalQuantity = filtered.reduce((sum, piece) => sum + piece.quantity, 0)

  if (snapshot.pieces.length === 0) {
    return (
      <EmptyState icon="🧱" title="No pieces yet">
        <p className="max-w-sm text-sm text-ink-muted">
          Once you start putting salvaged pieces into your drawers, they all show up here.
        </p>
        <Button variant="primary" onClick={() => navigate('/add')}>
          Add your first piece
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">All pieces</h1>
        <p className="text-sm text-ink-muted">
          {plural(snapshot.pieces.length, 'entry', 'entries')} across your drawers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1">
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, number, color or notes…"
            autoComplete="off"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-muted">Sort by</span>
          {SORTS.map((option) => (
            <Chip
              key={option.value}
              active={sort === option.value}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      {(colors.length > 1 || snapshot.units.length > 1) && (
        <div className="flex flex-wrap gap-1.5">
          {colors.map((color) => (
            <Chip
              key={colorKey(color)}
              active={colorFilter === colorKey(color)}
              onClick={() => setColorFilter(colorFilter === colorKey(color) ? '' : colorKey(color))}
            >
              <ColorSwatch color={color} size={12} />
              {color.name}
            </Chip>
          ))}
          {snapshot.units.length > 1
            ? snapshot.units.map((unit) => (
                <Chip
                  key={unit.id}
                  active={unitFilter === unit.id}
                  onClick={() => setUnitFilter(unitFilter === unit.id ? '' : unit.id)}
                >
                  {unit.name}
                </Chip>
              ))
            : null}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Nothing matches those filters">
          <Button
            onClick={() => {
              setQuery('')
              setColorFilter('')
              setUnitFilter('')
            }}
          >
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <section>
          <SectionTitle hint={`${plural(filtered.length, 'entry', 'entries')} · ${totalQuantity} bricks`}>
            Pieces
          </SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {filtered.map((piece) => (
              <PieceRow key={piece.id} piece={piece} snapshot={snapshot} />
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
