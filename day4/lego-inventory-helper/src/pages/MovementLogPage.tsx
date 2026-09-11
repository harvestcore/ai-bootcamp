import { useSearchParams } from 'react-router-dom'
import { ActionTag } from '../components/ActionTag'
import { Card, EmptyState, SectionTitle } from '../components/ui'
import { useInventory } from '../hooks/useInventory'
import { compartmentCount, filterLog, getUnit } from '../lib/inventory'
import { formatDateTime, plural } from '../lib/format'

const SELECT_CLASS =
  'h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none'

/**
 * Every add, extraction, move, edit and deletion, newest first. The filters
 * live in the URL, so a filtered history can be bookmarked or linked to.
 */
export function MovementLogPage() {
  const snapshot = useInventory()
  const [params, setParams] = useSearchParams()

  const unitId = params.get('unit') ?? ''
  const compartmentParam = params.get('compartment')
  const compartmentIndex = compartmentParam != null ? Number(compartmentParam) : null
  const unit = unitId ? getUnit(snapshot, unitId) : null

  const entries = filterLog(snapshot, {
    unitId: unitId || undefined,
    compartmentIndex: compartmentIndex ?? undefined,
  })

  function update(next: { unit?: string; compartment?: string }) {
    const search = new URLSearchParams()
    if (next.unit) search.set('unit', next.unit)
    if (next.unit && next.compartment) search.set('compartment', next.compartment)
    setParams(search)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">History</h1>
        <p className="text-sm text-ink-muted">Everything that has gone in, out or moved.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className={SELECT_CLASS}
          value={unitId}
          onChange={(e) => update({ unit: e.target.value })}
        >
          <option value="">All units</option>
          {snapshot.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          className={SELECT_CLASS}
          value={compartmentIndex ?? ''}
          disabled={!unit}
          onChange={(e) => update({ unit: unitId, compartment: e.target.value })}
        >
          <option value="">All compartments</option>
          {unit
            ? Array.from({ length: compartmentCount(unit) }, (_, i) => (
                <option key={i} value={i}>
                  Compartment {i + 1}
                </option>
              ))
            : null}
        </select>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon="🕘" title="Nothing recorded yet">
          <p className="text-sm text-ink-muted">
            Adding, taking out, moving or editing a piece all show up here.
          </p>
        </EmptyState>
      ) : (
        <section>
          <SectionTitle hint={plural(entries.length, 'entry', 'entries')}>Movements</SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <ActionTag type={entry.type} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {entry.pieceDescription}
                </span>
                <span className="order-last w-full text-xs text-ink-muted sm:order-none sm:w-auto sm:flex-1 sm:text-right">
                  {entry.detail}
                </span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {formatDateTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
