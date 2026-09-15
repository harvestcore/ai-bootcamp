import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CompartmentGrid } from '../components/CompartmentGrid'
import { AddPieceWizard } from '../components/AddPieceWizard'
import { CompartmentPanel } from '../components/CompartmentPanel'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DrawerUnit3DPane } from '../components/DrawerUnit3DPane'
import { Modal } from '../components/Modal'
import { Button, Card, EmptyState, TextInput } from '../components/ui'
import { useInventory } from '../hooks/useInventory'
import { cn } from '../lib/cn'
import { compartmentCount, getUnit, locationLabel, type InventorySnapshot } from '../lib/inventory'
import { plural } from '../lib/format'
import { renameUnit } from '../lib/store'
import type { DrawerUnit } from '../types'

/**
 * A whole drawer unit, with the detail of one compartment beside it (on wide
 * screens) or under it (on phones) — the grid stays visible either way, so you
 * never lose your place in the drawer while looking at one compartment.
 *
 * The unit can be shown as the flat grid (the default, and the only view any
 * other screen uses) or as a 3D cabinet. Which one is in the `view` search
 * param of this page's own URL, so a reload or a shared link opens on the same
 * view — and so every navigation inside the page has to carry it along.
 */
export function DrawerUnitPage() {
  const { id, index } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const snapshot = useInventory()
  const unit = id ? getUnit(snapshot, id) : null
  // The add-piece modal is in-memory state only: it is deliberately absent from
  // the URL, so a reload lands on the unit page with the modal closed.
  const [adding, setAdding] = useState(false)

  // Compared against the exact string: anything else, including `3D`, is the
  // grid, and an unrecognised value is left in the URL rather than rewritten.
  const is3D = params.get('view') === '3d'

  function setView(view: 'grid' | '3d') {
    const next = new URLSearchParams(params)
    // The default view leaves no param behind at all.
    if (view === '3d') next.set('view', '3d')
    else next.delete('view')
    // Replace, not push: the view is a presentation choice, so Back should
    // leave the unit page instead of stepping through view switches.
    setParams(next, { replace: true })
  }

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

  // Both views select the same way, and both keep the chosen view in the URL:
  // picking a compartment in 3D must not throw you back to the grid.
  const select = (compartment: number) =>
    navigate({
      pathname: `/unit/${unit.id}/compartment/${compartment}`,
      search: params.toString(),
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <UnitName unit={unit} />
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

      <ViewToggle active={is3D ? '3d' : 'grid'} onChange={setView} />

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,22rem)] lg:items-start lg:justify-start">
        <Card className="p-3 sm:p-4 lg:w-fit">
          {is3D ? (
            <DrawerUnit3DPane
              unit={unit}
              snapshot={snapshot}
              selectedIndex={validSelection}
              onSelect={select}
              onBackToGrid={() => setView('grid')}
            />
          ) : (
            <CompartmentGrid
              unit={unit}
              snapshot={snapshot}
              selectedIndex={validSelection}
              onSelect={select}
            />
          )}
          <Legend />
        </Card>

        {validSelection != null ? (
          <CompartmentPanel
            unit={unit}
            index={validSelection}
            snapshot={snapshot}
            onClose={() => navigate({ pathname: `/unit/${unit.id}`, search: params.toString() })}
            onAddPiece={() => setAdding(true)}
          />
        ) : (
          <Card className="hidden p-6 text-center text-sm text-ink-muted lg:block">
            Pick a compartment to see what's inside it.
          </Card>
        )}
      </div>

      {adding && validSelection != null ? (
        <AddPieceModal
          snapshot={snapshot}
          openedFrom={{ unitId: unit.id, compartmentIndex: validSelection }}
          onClose={() => setAdding(false)}
          onGoToCompartment={(unitId, compartmentIndex) => {
            setAdding(false)
            navigate({
              pathname: `/unit/${unitId}/compartment/${compartmentIndex}`,
              search: params.toString(),
            })
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * The add-piece wizard hosted over the unit page, so adding piece after piece
 * out of a salvaged set never loses the drawer you are standing in front of.
 * The very same `AddPieceWizard` the `/add` page renders; only the two exits
 * differ — they close this instead of navigating.
 *
 * A half-typed piece is worth a couple of minutes of work and the backdrop is
 * easy to hit by accident, so an unsaved draft is confirmed away first.
 */
function AddPieceModal({
  snapshot,
  openedFrom,
  onClose,
  onGoToCompartment,
}: {
  snapshot: InventorySnapshot
  openedFrom: { unitId: string; compartmentIndex: number }
  onClose: () => void
  onGoToCompartment: (unitId: string, compartmentIndex: number) => void
}) {
  const [unsaved, setUnsaved] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  function requestClose() {
    // Escape with the discard confirmation up dismisses the confirmation only:
    // `ConfirmDialog` has its own Escape handler and takes it from here.
    if (confirmingDiscard) return
    if (unsaved) setConfirmingDiscard(true)
    else onClose()
  }

  return (
    <Modal labelledBy="add-piece-modal-title" onRequestClose={requestClose}>
      <AddPieceWizard
        openedFrom={openedFrom}
        headingId="add-piece-modal-title"
        subtitle={locationLabel(snapshot, openedFrom.unitId, openedFrom.compartmentIndex)}
        onRequestClose={requestClose}
        onUnsavedChange={setUnsaved}
        onGoToCompartment={(unitId, compartmentIndex) => {
          // The compartment this opened over is already behind the modal.
          if (unitId === openedFrom.unitId && compartmentIndex === openedFrom.compartmentIndex) {
            onClose()
          } else {
            onGoToCompartment(unitId, compartmentIndex)
          }
        }}
      />

      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard this piece?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setConfirmingDiscard(false)}
        onConfirm={() => {
          setConfirmingDiscard(false)
          onClose()
        }}
      >
        The details you entered won't be saved. Pieces you already added stay in your inventory.
      </ConfirmDialog>
    </Modal>
  )
}

/**
 * Grid or 3D, for this unit only. Two plain buttons rather than a `select`, so
 * the pair is one keyboard stop each, states its own state with `aria-pressed`,
 * and stays a 44px touch target.
 */
function ViewToggle({
  active,
  onChange,
}: {
  active: 'grid' | '3d'
  onChange: (view: 'grid' | '3d') => void
}) {
  const options: { value: 'grid' | '3d'; label: string }[] = [
    { value: 'grid', label: 'Grid' },
    { value: '3d', label: '3D' },
  ]

  return (
    <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={active === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors',
            active === option.value
              ? 'bg-brand text-brand-ink shadow-sm'
              : 'text-ink-muted hover:bg-sunken hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Click the title to rename the unit. "Unit 1…4" tells you nothing when you're
 * standing in front of two cabinets and a shelf; renaming was previously buried
 * in the setup screen, which is not where you are when you notice.
 */
function UnitName({ unit }: { unit: DrawerUnit }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(unit.name)

  async function commit() {
    setEditing(false)
    const trimmed = name.trim()
    if (!trimmed || trimmed === unit.name) {
      setName(unit.name)
      return
    }
    await renameUnit(unit.id, trimmed)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(unit.name)
          setEditing(true)
        }}
        title="Click to rename"
        className="group flex items-center gap-2 text-xl font-semibold text-ink"
      >
        {unit.name}
        <span className="text-sm text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
          ✎
        </span>
      </button>
    )
  }

  return (
    <TextInput
      value={name}
      autoFocus
      aria-label="Unit name"
      className="h-9 w-56 text-lg font-semibold"
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          setName(unit.name)
          setEditing(false)
        }
      }}
    />
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
