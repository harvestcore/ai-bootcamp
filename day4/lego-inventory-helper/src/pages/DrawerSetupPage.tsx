import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CompartmentGrid } from '../components/CompartmentGrid'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button, Callout, Card, Field, SectionTitle, TextInput } from '../components/ui'
import { useInventory } from '../hooks/useInventory'
import { createUnit, deleteUnit, renameUnit, updateUnitDimensions } from '../lib/store'
import { compartmentCount, countPiecesInUnit } from '../lib/inventory'
import { plural } from '../lib/format'
import type { DrawerUnit } from '../types'

const MIN_SIDE = 1
const MAX_SIDE = 10

export function DrawerSetupPage() {
  const snapshot = useInventory()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Drawer setup</h1>
        <p className="text-sm text-ink-muted">
          Describe your physical organizers: one unit per drawer cabinet, laid out in rows and
          columns of compartments.
        </p>
      </div>

      {snapshot.units.length === 0 ? <FirstRunForm /> : null}

      {snapshot.units.length > 0 ? (
        <>
          <section>
            <SectionTitle hint={plural(snapshot.units.length, 'unit')}>Your units</SectionTitle>
            <div className="space-y-3">
              {snapshot.units.map((unit) => (
                <UnitCard key={unit.id} unit={unit} />
              ))}
            </div>
          </section>
          <AddUnitForm />
        </>
      ) : null}
    </div>
  )
}

function SizeFields({
  rows,
  cols,
  onRows,
  onCols,
}: {
  rows: string
  cols: string
  onRows: (value: string) => void
  onCols: (value: string) => void
}) {
  return (
    <>
      <Field label="Rows">
        <TextInput
          type="number"
          min={MIN_SIDE}
          max={MAX_SIDE}
          value={rows}
          onChange={(e) => onRows(e.target.value)}
        />
      </Field>
      <Field label="Columns">
        <TextInput
          type="number"
          min={MIN_SIDE}
          max={MAX_SIDE}
          value={cols}
          onChange={(e) => onCols(e.target.value)}
        />
      </Field>
    </>
  )
}

function clampSide(value: string): number {
  return Math.min(MAX_SIDE, Math.max(MIN_SIDE, Number(value) || MIN_SIDE))
}

function FirstRunForm() {
  const navigate = useNavigate()
  const [count, setCount] = useState('4')
  const [rows, setRows] = useState('4')
  const [cols, setCols] = useState('4')
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      const units = Math.min(10, Math.max(1, Number(count) || 1))
      for (let i = 0; i < units; i++) {
        await createUnit({ rows: clampSide(rows), cols: clampSide(cols) })
      }
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <p className="text-sm text-ink">
        How many drawer units do you have, and how is each one divided? You can change all of this
        later.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Units">
          <TextInput
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </Field>
        <SizeFields rows={rows} cols={cols} onRows={setRows} onCols={setCols} />
      </div>
      <Button variant="primary" className="w-full" disabled={busy} onClick={create}>
        Create my drawers
      </Button>
    </Card>
  )
}

function AddUnitForm() {
  const [rows, setRows] = useState('4')
  const [cols, setCols] = useState('4')

  return (
    <Card className="space-y-4 p-4">
      <SectionTitle>Add another unit</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <SizeFields rows={rows} cols={cols} onRows={setRows} onCols={setCols} />
      </div>
      <Button onClick={() => createUnit({ rows: clampSide(rows), cols: clampSide(cols) })}>
        + Add unit
      </Button>
    </Card>
  )
}

function UnitCard({ unit }: { unit: DrawerUnit }) {
  const snapshot = useInventory()
  const [name, setName] = useState(unit.name)
  const [rows, setRows] = useState(String(unit.rows))
  const [cols, setCols] = useState(String(unit.cols))
  const [blocked, setBlocked] = useState<number[] | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const stored = countPiecesInUnit(snapshot, unit.id)

  async function saveChanges() {
    await renameUnit(unit.id, name)
    const result = await updateUnitDimensions(unit.id, clampSide(rows), clampSide(cols))
    setBlocked(result.ok ? null : result.orphaned.map((p) => p.compartmentIndex))
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium text-ink">{unit.name}</h3>
        <span className="text-xs text-ink-muted">
          {plural(stored, 'piece')} · {plural(compartmentCount(unit), 'compartment')}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <SizeFields rows={rows} cols={cols} onRows={setRows} onCols={setCols} />
      </div>

      {blocked ? (
        <div className="space-y-3">
          <Callout tone="danger">
            That size would leave {plural(blocked.length, 'piece')} outside the drawer. Move or take
            out the highlighted compartments first.
          </Callout>
          <CompartmentGrid unit={unit} snapshot={snapshot} highlightIndexes={blocked} />
        </div>
      ) : null}

      {deleteError ? <Callout tone="danger">{deleteError}</Callout> : null}

      <div className="flex gap-2">
        <Button variant="primary" onClick={saveChanges}>
          Save
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={() => setConfirmingDelete(true)}>
          Delete unit
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${unit.name}?`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          setConfirmingDelete(false)
          const result = await deleteUnit(unit.id)
          setDeleteError(
            result.ok
              ? null
              : `This unit still holds ${plural(result.occupied, 'piece')} — move or take them out first.`,
          )
        }}
      >
        The unit and its layout are removed. It has to be empty first.
      </ConfirmDialog>
    </Card>
  )
}
