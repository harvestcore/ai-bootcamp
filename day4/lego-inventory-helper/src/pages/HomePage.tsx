import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CompartmentGrid } from '../components/CompartmentGrid'
import { ColorSwatch } from '../components/ColorSwatch'
import { PieceImage } from '../components/PieceImage'
import { Button, Card, Chip, EmptyState, SectionTitle, TextInput } from '../components/ui'
import { useInventory } from '../hooks/useInventory'
import { colorKey } from '../lib/matching'
import {
  compartmentCount,
  distinctColors,
  getStats,
  getUnit,
  searchPieces,
} from '../lib/inventory'
import { plural } from '../lib/format'
import type { Piece } from '../types'

export function HomePage() {
  const snapshot = useInventory()
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')

  const searching = query.trim().length > 0

  return (
    <div className="space-y-6">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted">
          🔍
        </span>
        <TextInput
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setColorFilter('')
            setUnitFilter('')
          }}
          placeholder="Search your pieces by name or part number…"
          className="h-12 rounded-2xl pl-10 text-base shadow-sm"
          autoComplete="off"
        />
      </div>

      {searching ? (
        <SearchResults
          snapshot={snapshot}
          query={query}
          colorFilter={colorFilter}
          unitFilter={unitFilter}
          onColorFilter={setColorFilter}
          onUnitFilter={setUnitFilter}
        />
      ) : (
        <>
          <Stats snapshot={snapshot} />
          <Units snapshot={snapshot} />
        </>
      )}
    </div>
  )
}

function Stats({ snapshot }: { snapshot: ReturnType<typeof useInventory> }) {
  const stats = getStats(snapshot)
  if (snapshot.units.length === 0) return null

  const tiles = [
    { label: 'Distinct pieces', value: stats.pieceKinds },
    { label: 'Bricks in total', value: stats.totalQuantity },
    { label: 'Compartments used', value: `${stats.usedCompartments}/${stats.totalCompartments}` },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((tile) => (
        <Card key={tile.label} className="px-3 py-3 text-center sm:px-4">
          <div className="text-xl font-semibold text-ink sm:text-2xl">{tile.value}</div>
          <div className="mt-0.5 text-[11px] leading-tight text-ink-muted sm:text-xs">{tile.label}</div>
        </Card>
      ))}
    </div>
  )
}

function Units({ snapshot }: { snapshot: ReturnType<typeof useInventory> }) {
  const navigate = useNavigate()

  if (snapshot.units.length === 0) {
    return (
      <EmptyState icon="🗄️" title="No drawer units yet">
        <p className="max-w-sm text-sm text-ink-muted">
          Tell the app how your workshop drawers are laid out and it will start suggesting where each
          piece goes.
        </p>
        <Button variant="primary" onClick={() => navigate('/setup')}>
          Set up your first drawer unit
        </Button>
      </EmptyState>
    )
  }

  return (
    <section>
      <SectionTitle hint={plural(snapshot.units.length, 'unit')}>Your drawers</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.units.map((unit) => (
          <Link
            key={unit.id}
            to={`/unit/${unit.id}`}
            className="rounded-card border border-line bg-surface p-3 shadow-sm transition-colors hover:border-brand"
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-medium text-ink">{unit.name}</span>
              <span className="text-xs text-ink-muted">
                {unit.rows}×{unit.cols} · {plural(compartmentCount(unit), 'compartment')}
              </span>
            </div>
            <CompartmentGrid unit={unit} snapshot={snapshot} variant="compact" />
          </Link>
        ))}
        <Link
          to="/setup"
          className="flex min-h-28 items-center justify-center rounded-card border border-dashed border-line-strong text-sm font-medium text-ink-muted transition-colors hover:border-brand hover:text-ink"
        >
          + Add a drawer unit
        </Link>
      </div>
    </section>
  )
}

function SearchResults({
  snapshot,
  query,
  colorFilter,
  unitFilter,
  onColorFilter,
  onUnitFilter,
}: {
  snapshot: ReturnType<typeof useInventory>
  query: string
  colorFilter: string
  unitFilter: string
  onColorFilter: (value: string) => void
  onUnitFilter: (value: string) => void
}) {
  const unfiltered = useMemo(() => searchPieces(snapshot, query), [snapshot, query])
  const matches = useMemo(
    () =>
      searchPieces(snapshot, query, {
        color: colorFilter || undefined,
        unitId: unitFilter || undefined,
      }).sort((a, b) => a.description.localeCompare(b.description)),
    [snapshot, query, colorFilter, unitFilter],
  )
  const colors = distinctColors(unfiltered)

  return (
    <section className="space-y-3">
      <SectionTitle hint={`${matches.length} of ${unfiltered.length}`}>Search results</SectionTitle>

      {unfiltered.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {colors.map((color) => (
            <Chip
              key={colorKey(color)}
              active={colorFilter === colorKey(color)}
              onClick={() => onColorFilter(colorFilter === colorKey(color) ? '' : colorKey(color))}
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
                  onClick={() => onUnitFilter(unitFilter === unit.id ? '' : unit.id)}
                >
                  {unit.name}
                </Chip>
              ))
            : null}
        </div>
      ) : null}

      {matches.length === 0 ? (
        <EmptyState icon="🔍" title="Nothing matches that search">
          <p className="text-sm text-ink-muted">
            Try a part number, or a word from the piece name like “plate” or “slope”.
          </p>
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {matches.map((piece) => (
            <ResultRow key={piece.id} piece={piece} snapshot={snapshot} />
          ))}
        </Card>
      )}
    </section>
  )
}

function ResultRow({ piece, snapshot }: { piece: Piece; snapshot: ReturnType<typeof useInventory> }) {
  const unit = getUnit(snapshot, piece.unitId)

  return (
    <Link
      to={`/unit/${piece.unitId}/compartment/${piece.compartmentIndex}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-sunken"
    >
      <PieceImage imageUrl={piece.imageUrl} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{piece.description}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <ColorSwatch color={piece.color} size={11} />
          <span className="truncate">{piece.color.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">#{piece.partNumber}</span>
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
