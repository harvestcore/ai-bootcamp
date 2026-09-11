import { Link, useNavigate, useParams } from 'react-router-dom'
import { CompartmentGrid } from '../components/CompartmentGrid'
import { CompartmentPanel } from '../components/CompartmentPanel'
import { Button, Card, EmptyState } from '../components/ui'
import { useInventory } from '../hooks/useInventory'
import { compartmentCount, getUnit } from '../lib/inventory'
import { plural } from '../lib/format'

/**
 * A whole drawer unit, with the detail of one compartment beside it (on wide
 * screens) or under it (on phones) — the grid stays visible either way, so you
 * never lose your place in the drawer while looking at one compartment.
 */
export function DrawerUnitPage() {
  const { id, index } = useParams()
  const navigate = useNavigate()
  const snapshot = useInventory()
  const unit = id ? getUnit(snapshot, id) : null

  if (!unit) {
    return (
      <EmptyState icon="🤷" title="That drawer unit no longer exists">
        <Link className="text-sm text-link hover:underline" to="/">
          Back to your drawers
        </Link>
      </EmptyState>
    )
  }

  const selectedIndex = index != null ? Number(index) : null
  const validSelection =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < compartmentCount(unit)
      ? selectedIndex
      : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{unit.name}</h1>
          <p className="text-sm text-ink-muted">
            {unit.rows}×{unit.cols} · {plural(compartmentCount(unit), 'compartment')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/setup')}>Edit structure</Button>
          <Button variant="primary" onClick={() => navigate('/add')}>
            Add a piece
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,22rem)] lg:items-start lg:justify-start">
        <Card className="p-3 sm:p-4 lg:w-fit">
          <CompartmentGrid
            unit={unit}
            snapshot={snapshot}
            selectedIndex={validSelection}
            onSelect={(compartment) => navigate(`/unit/${unit.id}/compartment/${compartment}`)}
          />
          <Legend />
        </Card>

        {validSelection != null ? (
          <CompartmentPanel
            unit={unit}
            index={validSelection}
            snapshot={snapshot}
            onClose={() => navigate(`/unit/${unit.id}`)}
          />
        ) : (
          <Card className="hidden p-6 text-center text-sm text-ink-muted lg:block">
            Pick a compartment to see what's inside it.
          </Card>
        )}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded border border-cell-line bg-cell-empty" />
        empty
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded border border-brand-line bg-cell-filled" />
        in use
      </span>
      <span className="flex items-center gap-1.5">
        <span className="hatched inline-block h-3 w-3 rounded border border-brand-line bg-cell-filled" />
        marked full
      </span>
    </div>
  )
}
