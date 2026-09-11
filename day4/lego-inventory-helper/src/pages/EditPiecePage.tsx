import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CompartmentGrid } from '../components/CompartmentGrid'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PieceIdentityFields } from '../components/PieceIdentityFields'
import { PieceImage } from '../components/PieceImage'
import { Button, Callout, Card, Chip, EmptyState, Field, TextArea } from '../components/ui'
import { useInventory } from '../hooks/useInventory'
import { deletePiece, movePiece, updatePiece } from '../lib/store'
import { getPieceById, locationLabel } from '../lib/inventory'
import { formatDate } from '../lib/format'
import type { PieceColor } from '../types'

export function EditPiecePage() {
  const { pieceId } = useParams()
  const navigate = useNavigate()
  const snapshot = useInventory()
  const piece = pieceId ? getPieceById(snapshot, pieceId) : null

  // Form state is seeded once from the stored piece; `key` on the form below
  // makes React start it over if the route ever points at a different piece.
  const [partNumber, setPartNumber] = useState(piece?.partNumber ?? '')
  const [color, setColor] = useState<PieceColor | null>(piece?.color ?? null)
  const [notes, setNotes] = useState(piece?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (!piece) {
    return (
      <EmptyState icon="🤷" title="That piece is no longer in the inventory">
        <Link className="text-sm text-link hover:underline" to="/">
          Back to your drawers
        </Link>
      </EmptyState>
    )
  }

  const backTo = `/unit/${piece.unitId}/compartment/${piece.compartmentIndex}`

  async function save() {
    if (!piece) return
    if (!partNumber.trim()) {
      setError('A part number is required.')
      return
    }
    if (!color || (color.source === 'other' && !color.name.trim())) {
      setError('Pick a color for this piece.')
      return
    }
    setError(null)
    await updatePiece(piece.id, { partNumber: partNumber.trim(), color, notes: notes.trim() })
    navigate(backTo)
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Edit piece</h1>
        <Button variant="ghost" onClick={() => navigate(backTo)}>
          Cancel
        </Button>
      </div>

      <Card className="flex items-center gap-3 p-4">
        <PieceImage imageUrl={piece.imageUrl} size={56} />
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{piece.description}</div>
          <div className="text-xs text-ink-muted">
            {piece.quantity} in stock · {locationLabel(snapshot, piece.unitId, piece.compartmentIndex, piece.partitionIndex)}
          </div>
          <div className="text-xs text-ink-muted">Added {formatDate(piece.addedAt)}</div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <PieceIdentityFields
          partNumber={partNumber}
          onPartNumberChange={setPartNumber}
          color={color}
          onColorChange={setColor}
        />

        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <p className="text-xs text-ink-muted">
          Quantity isn't edited here: use <strong>Take out</strong> in the compartment to remove
          pieces, or <strong>Add a piece</strong> to bring more in — that way every change leaves a
          trace in the history.
        </p>

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Button variant="primary" className="w-full" onClick={save}>
          Save changes
        </Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-ink">Move to another compartment</h2>
            <p className="text-xs text-ink-muted">The piece keeps its quantity and history.</p>
          </div>
          <Button onClick={() => setMoving((open) => !open)}>{moving ? 'Close' : 'Move'}</Button>
        </div>
        {moving ? (
          <MovePicker
            currentUnitId={piece.unitId}
            onMove={async (unitId, compartmentIndex) => {
              await movePiece(piece.id, unitId, compartmentIndex)
              navigate(`/unit/${unitId}/compartment/${compartmentIndex}`)
            }}
          />
        ) : null}
      </Card>

      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-medium text-ink">Delete this piece</h2>
          <p className="text-xs text-ink-muted">Removes all {piece.quantity} of them from the inventory.</p>
        </div>
        <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
          Delete
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${piece.description}?`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          setConfirmingDelete(false)
          await deletePiece(piece.id)
          navigate('/')
        }}
      >
        This removes the whole entry from the inventory. The movement log keeps a record of it.
      </ConfirmDialog>
    </div>
  )
}

function MovePicker({
  currentUnitId,
  onMove,
}: {
  currentUnitId: string
  onMove: (unitId: string, compartmentIndex: number) => void
}) {
  const snapshot = useInventory()
  const [unitId, setUnitId] = useState(currentUnitId)
  const [selected, setSelected] = useState<number | null>(null)
  const unit = snapshot.units.find((u) => u.id === unitId) ?? snapshot.units[0]

  if (!unit) return null

  return (
    <div className="mt-4 space-y-3">
      {snapshot.units.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {snapshot.units.map((u) => (
            <Chip
              key={u.id}
              active={u.id === unitId}
              onClick={() => {
                setUnitId(u.id)
                setSelected(null)
              }}
            >
              {u.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <CompartmentGrid
        unit={unit}
        snapshot={snapshot}
        selectedIndex={selected}
        disableUnavailable
        onSelect={setSelected}
      />

      <Button
        variant="primary"
        className="w-full"
        disabled={selected == null}
        onClick={() => selected != null && onMove(unit.id, selected)}
      >
        Move it here
      </Button>
    </div>
  )
}
