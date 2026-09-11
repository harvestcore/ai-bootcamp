import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CompartmentGrid } from '../components/CompartmentGrid'
import { ColorSwatch } from '../components/ColorSwatch'
import { PieceIdentityFields } from '../components/PieceIdentityFields'
import { Button, Callout, Card, Chip, EmptyState, Field, TextArea, TextInput } from '../components/ui'
import { PieceImage } from '../components/PieceImage'
import { useInventory } from '../hooks/useInventory'
import { plural } from '../lib/format'
import { addToExistingPiece, createPieceAtLocation, setPartitionCount } from '../lib/store'
import {
  findDuplicate,
  getCompartmentInfo,
  locationLabel,
  MAX_PARTITIONS,
  needsPartitionSplit,
  suggestLocation,
  type InventorySnapshot,
} from '../lib/inventory'
import type { Piece, PieceDraft } from '../types'

type Step = 'details' | 'duplicate' | 'location' | 'partition' | 'done'

interface JustAdded {
  description: string
  colorName: string
  quantity: number
  imageUrl: string | null
  unitId: string
  compartmentIndex: number
}

const PARTITION_LABELS: Record<number, string> = { 1: 'Whole', 2: 'Halves', 3: 'Thirds' }

/**
 * Adding a piece is a short wizard: what it is → where it goes → (only when the
 * compartment has to be physically subdivided) how to split it. Each step keeps
 * its own state, so going back and forth never loses what was already typed.
 */
export function AddPiecePage() {
  const snapshot = useInventory()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // Opened from a compartment's own "Add a piece here" button: the location is
  // already decided, so the location step is skipped entirely.
  const presetUnit = params.get('unit')
  const presetCompartment = params.get('compartment')
  const openedFrom =
    presetUnit && presetCompartment != null
      ? { unitId: presetUnit, compartmentIndex: Number(presetCompartment) }
      : null

  const [step, setStep] = useState<Step>('details')
  const [draft, setDraft] = useState<PieceDraft>({
    partNumber: '',
    color: null,
    quantity: 1,
    notes: '',
  })
  const [duplicate, setDuplicate] = useState<Piece | null>(null)
  const [target, setTarget] = useState<{ unitId: string; compartmentIndex: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState<JustAdded | null>(null)
  // Salvaging a set means entering piece after piece, so the flow stays put and
  // counts them instead of bouncing back to a screen you'd leave immediately.
  const [addedCount, setAddedCount] = useState(0)

  if (snapshot.units.length === 0) {
    return (
      <EmptyState icon="🗄️" title="Set up a drawer unit first">
        <p className="max-w-sm text-sm text-ink-muted">
          There's nowhere to put a piece yet. Create at least one drawer unit and come back.
        </p>
        <Button variant="primary" onClick={() => navigate('/setup')}>
          Go to drawer setup
        </Button>
      </EmptyState>
    )
  }

  function goToLocation(unitId: string, compartmentIndex: number) {
    setTarget({ unitId, compartmentIndex })
    if (needsPartitionSplit(snapshot, unitId, compartmentIndex)) setStep('partition')
    else void save(unitId, compartmentIndex)
  }

  async function save(unitId: string, compartmentIndex: number) {
    setSaving(true)
    try {
      const piece = await createPieceAtLocation(draft, unitId, compartmentIndex)
      finishWith({
        description: piece.description,
        colorName: piece.color.name,
        quantity: piece.quantity,
        imageUrl: piece.imageUrl,
        unitId,
        compartmentIndex,
      })
    } finally {
      setSaving(false)
    }
  }

  function finishWith(added: JustAdded) {
    setJustAdded(added)
    setAddedCount((count) => count + 1)
    setStep('done')
  }

  function startAnother(keepPartNumber: boolean) {
    setDraft({
      partNumber: keepPartNumber ? draft.partNumber : '',
      color: null,
      quantity: 1,
      notes: '',
    })
    setDuplicate(null)
    setTarget(null)
    setJustAdded(null)
    setStep('details')
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Add a piece</h1>
          {addedCount > 0 ? (
            <p className="text-sm text-ink-muted">{plural(addedCount, 'piece')} added so far</p>
          ) : null}
        </div>
        <Button variant="ghost" onClick={() => (addedCount > 0 ? navigate('/') : navigate(-1))}>
          {addedCount > 0 ? 'Done' : 'Cancel'}
        </Button>
      </div>

      {step === 'done' ? null : <Steps current={step} />}

      {step === 'details' ? (
        <DetailsStep
          draft={draft}
          onChange={setDraft}
          onSubmit={() => {
            const existing = draft.color
              ? findDuplicate(snapshot, { partNumber: draft.partNumber, color: draft.color })
              : null
            if (existing) {
              setDuplicate(existing)
              setStep('duplicate')
            } else if (openedFrom) {
              goToLocation(openedFrom.unitId, openedFrom.compartmentIndex)
            } else {
              setStep('location')
            }
          }}
        />
      ) : null}

      {step === 'duplicate' && duplicate ? (
        <DuplicateStep
          duplicate={duplicate}
          snapshot={snapshot}
          quantity={draft.quantity}
          busy={saving}
          onMerge={async () => {
            setSaving(true)
            try {
              await addToExistingPiece(duplicate.id, draft.quantity)
              finishWith({
                description: duplicate.description,
                colorName: duplicate.color.name,
                quantity: draft.quantity,
                imageUrl: duplicate.imageUrl,
                unitId: duplicate.unitId,
                compartmentIndex: duplicate.compartmentIndex,
              })
            } finally {
              setSaving(false)
            }
          }}
          onChooseAnother={() => setStep('location')}
          onBack={() => setStep('details')}
        />
      ) : null}

      {step === 'location' ? (
        <LocationStep
          snapshot={snapshot}
          draft={draft}
          busy={saving}
          onBack={() => setStep('details')}
          onPick={goToLocation}
        />
      ) : null}

      {step === 'done' && justAdded ? (
        <AddedStep
          added={justAdded}
          snapshot={snapshot}
          onAnother={startAnother}
          onGoToCompartment={() =>
            navigate(`/unit/${justAdded.unitId}/compartment/${justAdded.compartmentIndex}`)
          }
        />
      ) : null}

      {step === 'partition' && target ? (
        <PartitionStep
          snapshot={snapshot}
          draft={draft}
          target={target}
          busy={saving}
          onBack={() => setStep(openedFrom ? 'details' : 'location')}
          onChoose={async (count) => {
            await setPartitionCount(target.unitId, target.compartmentIndex, count)
            await save(target.unitId, target.compartmentIndex)
          }}
        />
      ) : null}
    </div>
  )
}

function AddedStep({
  added,
  snapshot,
  onAnother,
  onGoToCompartment,
}: {
  added: JustAdded
  snapshot: InventorySnapshot
  onAnother: (keepPartNumber: boolean) => void
  onGoToCompartment: () => void
}) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <PieceImage imageUrl={added.imageUrl} size={56} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-success">Added to your inventory</p>
          <p className="font-medium break-words text-ink">
            {added.quantity} × {added.description}
          </p>
          <p className="text-xs text-ink-muted">
            {added.colorName} · {locationLabel(snapshot, added.unitId, added.compartmentIndex)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" className="flex-1" onClick={() => onAnother(false)}>
          Add another piece
        </Button>
        <Button className="flex-1" onClick={() => onAnother(true)}>
          Same part, another color
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onGoToCompartment}>
        See the compartment →
      </Button>
    </Card>
  )
}

function Steps({ current }: { current: Step }) {
  const labels: { key: Step; label: string }[] = [
    { key: 'details', label: '1. The piece' },
    { key: 'location', label: '2. Where it goes' },
  ]
  const isLocationish = current === 'location' || current === 'partition' || current === 'duplicate'

  return (
    <div className="flex gap-2 text-xs font-medium">
      {labels.map((s) => {
        const active = s.key === current || (s.key === 'location' && isLocationish)
        return (
          <span
            key={s.key}
            className={
              active
                ? 'rounded-full bg-brand-soft px-3 py-1 text-ink'
                : 'rounded-full bg-sunken px-3 py-1 text-ink-muted'
            }
          >
            {s.label}
          </span>
        )
      })}
    </div>
  )
}

function DetailsStep({
  draft,
  onChange,
  onSubmit,
}: {
  draft: PieceDraft
  onChange: (draft: PieceDraft) => void
  onSubmit: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!draft.partNumber.trim()) {
      setError('Enter or search for a LEGO part number first.')
      return
    }
    if (!draft.color || (draft.color.source === 'other' && !draft.color.name.trim())) {
      setError('Pick a color for this piece.')
      return
    }
    setError(null)
    onSubmit()
  }

  return (
    <Card className="space-y-4 p-4">
      <PieceIdentityFields
        partNumber={draft.partNumber}
        onPartNumberChange={(partNumber) => onChange({ ...draft, partNumber })}
        color={draft.color}
        onColorChange={(color) => onChange({ ...draft, color })}
      />

      <Field label="How many" required>
        <QuantityInput
          value={draft.quantity}
          onChange={(quantity) => onChange({ ...draft, quantity })}
        />
      </Field>

      <Field label="Notes" hint="Anything the catalog name doesn't capture.">
        <TextArea value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
      </Field>

      {error ? <Callout tone="danger">{error}</Callout> : null}

      <Button variant="primary" className="w-full" onClick={submit}>
        Continue
      </Button>
    </Card>
  )
}

export function QuantityInput({
  value,
  onChange,
  max,
}: {
  value: number
  onChange: (value: number) => void
  max?: number
}) {
  const clamp = (n: number) => Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(1, n))
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => onChange(clamp(value - 1))} aria-label="One less">
        −
      </Button>
      <div className="w-24">
        <TextInput
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 1))}
          className="h-9 text-center"
        />
      </div>
      <Button size="sm" onClick={() => onChange(clamp(value + 1))} aria-label="One more">
        +
      </Button>
    </div>
  )
}

function DuplicateStep({
  duplicate,
  snapshot,
  quantity,
  busy,
  onMerge,
  onChooseAnother,
  onBack,
}: {
  duplicate: Piece
  snapshot: InventorySnapshot
  quantity: number
  busy: boolean
  onMerge: () => void
  onChooseAnother: () => void
  onBack: () => void
}) {
  const where = locationLabel(
    snapshot,
    duplicate.unitId,
    duplicate.compartmentIndex,
    duplicate.partitionIndex,
  )

  return (
    <Card className="space-y-4 p-4">
      <Callout>
        You already store this exact piece and color in <strong>{where}</strong> ({duplicate.quantity}{' '}
        in stock).
      </Callout>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" className="flex-1" disabled={busy} onClick={onMerge}>
          Add {quantity} there
        </Button>
        <Button className="flex-1" disabled={busy} onClick={onChooseAnother}>
          Put them somewhere else
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Back to the details
      </Button>
    </Card>
  )
}

function LocationStep({
  snapshot,
  draft,
  busy,
  onBack,
  onPick,
}: {
  snapshot: InventorySnapshot
  draft: PieceDraft
  busy: boolean
  onBack: () => void
  onPick: (unitId: string, compartmentIndex: number) => void
}) {
  const suggestion = draft.color
    ? suggestLocation(snapshot, { partNumber: draft.partNumber, color: draft.color })
    : null
  const [unitId, setUnitId] = useState(suggestion?.unitId ?? snapshot.units[0]!.id)
  const [selected, setSelected] = useState<number | null>(suggestion?.compartmentIndex ?? null)

  const unit = snapshot.units.find((u) => u.id === unitId) ?? snapshot.units[0]!

  return (
    <Card className="space-y-4 p-4">
      {suggestion ? (
        <Callout>
          Suggested: <strong>{locationLabel(snapshot, suggestion.unitId, suggestion.compartmentIndex)}</strong>{' '}
          — {suggestion.reason.toLowerCase()}.
        </Callout>
      ) : (
        <Callout tone="warning">
          Every compartment is full. Free one up, mark one as not full, or add another drawer unit.
        </Callout>
      )}

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
      <p className="text-xs text-ink-muted">
        Greyed-out compartments are full — either marked full by you, or already holding{' '}
        {MAX_PARTITIONS} different pieces.
      </p>

      <div className="flex gap-2">
        <Button onClick={onBack}>← Back</Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={selected == null || busy}
          onClick={() => selected != null && onPick(unit.id, selected)}
        >
          Put it here
        </Button>
      </div>
    </Card>
  )
}

function PartitionStep({
  snapshot,
  draft,
  target,
  busy,
  onBack,
  onChoose,
}: {
  snapshot: InventorySnapshot
  draft: PieceDraft
  target: { unitId: string; compartmentIndex: number }
  busy: boolean
  onBack: () => void
  onChoose: (count: number) => void
}) {
  const { occupants } = getCompartmentInfo(snapshot, target.unitId, target.compartmentIndex)
  const minimum = occupants.length + 1
  const choices = [1, 2, 3].filter((n) => n >= minimum && n <= MAX_PARTITIONS)

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-semibold text-ink">Split the compartment</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {locationLabel(snapshot, target.unitId, target.compartmentIndex)} already holds a different
          colour of this piece. Partitions are physical dividers you place yourself — pick how you'll
          divide it.
        </p>
      </div>

      <div className="space-y-1.5 rounded-xl bg-sunken p-3">
        {occupants.map((piece) => (
          <div key={piece.id} className="flex items-center gap-2 text-sm text-ink">
            <ColorSwatch color={piece.color} size={12} />
            {piece.color.name}
            <span className="text-ink-muted">· already there</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <ColorSwatch color={draft.color} size={12} />
          {draft.color?.name}
          <span className="text-ink-muted">· the new one</span>
        </div>
      </div>

      <div className="flex gap-2">
        {choices.map((count) => (
          <Button
            key={count}
            variant="primary"
            className="flex-1"
            disabled={busy}
            onClick={() => onChoose(count)}
          >
            {PARTITION_LABELS[count]}
          </Button>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Back
      </Button>
    </Card>
  )
}
