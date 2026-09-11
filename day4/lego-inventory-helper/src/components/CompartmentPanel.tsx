import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ColorSwatch } from './ColorSwatch'
import { ConfirmDialog } from './ConfirmDialog'
import { PieceImage } from './PieceImage'
import { Button, Card, TextInput } from './ui'
import { deletePiece, extractPiece, setPartitionFull } from '../lib/store'
import { getCompartmentInfo, type InventorySnapshot } from '../lib/inventory'
import { formatDate } from '../lib/format'
import type { DrawerUnit, Piece } from '../types'

/** What is actually inside one compartment, partition by partition. */
export function CompartmentPanel({
  unit,
  index,
  snapshot,
  onClose,
}: {
  unit: DrawerUnit
  index: number
  snapshot: InventorySnapshot
  onClose: () => void
}) {
  const navigate = useNavigate()
  const panel = useRef<HTMLDivElement>(null)
  const { occupants, record } = getCompartmentInfo(snapshot, unit.id, index)
  const partitions = Array.from({ length: record.partitionCount }, (_, i) => i)

  // On a phone this panel renders *below* the grid, so tapping a compartment
  // would otherwise look like nothing happened. On wide screens it sits beside
  // the grid and is already visible, so leave the scroll position alone.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) return
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [unit.id, index])

  return (
    <Card ref={panel} className="overflow-hidden lg:sticky lg:top-20">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-ink">Compartment {index + 1}</h2>
          <p className="truncate text-xs text-ink-muted">{unit.name}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close compartment">
          ✕
        </Button>
      </div>

      <div className="divide-y divide-line">
        {partitions.map((partitionIndex) => {
          const piece = occupants.find((o) => o.partitionIndex === partitionIndex)
          return piece ? (
            <OccupantRow
              key={piece.id}
              piece={piece}
              unitId={unit.id}
              compartmentIndex={index}
              partitionIndex={partitionIndex}
              partitionCount={record.partitionCount}
              full={record.partitionsFull[partitionIndex] ?? false}
            />
          ) : (
            <EmptyPartitionRow
              key={partitionIndex}
              unitId={unit.id}
              compartmentIndex={index}
              partitionIndex={partitionIndex}
              partitionCount={record.partitionCount}
              full={record.partitionsFull[partitionIndex] ?? false}
            />
          )
        })}
      </div>

      <div className="border-t border-line p-3">
        <Button
          variant="primary"
          className="w-full"
          onClick={() => navigate(`/add?unit=${unit.id}&compartment=${index}`)}
        >
          Add a piece here
        </Button>
      </div>
    </Card>
  )
}

function PartitionLabel({
  partitionIndex,
  partitionCount,
}: {
  partitionIndex: number
  partitionCount: number
}) {
  if (partitionCount <= 1) return null
  return (
    <span className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
      Partition {partitionIndex + 1}
    </span>
  )
}

function FullToggle({
  unitId,
  compartmentIndex,
  partitionIndex,
  full,
}: {
  unitId: string
  compartmentIndex: number
  partitionIndex: number
  full: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
      <input
        type="checkbox"
        checked={full}
        className="accent-[var(--brand)]"
        onChange={(e) => setPartitionFull(unitId, compartmentIndex, partitionIndex, e.target.checked)}
      />
      Full
    </label>
  )
}

function EmptyPartitionRow(props: {
  unitId: string
  compartmentIndex: number
  partitionIndex: number
  partitionCount: number
  full: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <PartitionLabel
          partitionIndex={props.partitionIndex}
          partitionCount={props.partitionCount}
        />
        <span className="text-sm text-ink-muted">Empty</span>
      </div>
      <FullToggle {...props} />
    </div>
  )
}

function OccupantRow({
  piece,
  unitId,
  compartmentIndex,
  partitionIndex,
  partitionCount,
  full,
}: {
  piece: Piece
  unitId: string
  compartmentIndex: number
  partitionIndex: number
  partitionCount: number
  full: boolean
}) {
  const navigate = useNavigate()
  const [extracting, setExtracting] = useState(false)
  const [amount, setAmount] = useState('1')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function confirmExtract() {
    const qty = Number(amount)
    if (!Number.isInteger(qty) || qty < 1 || qty > piece.quantity) return
    await extractPiece(piece.id, qty)
    setExtracting(false)
    setAmount('1')
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <PieceImage imageUrl={piece.imageUrl} size={48} />
        <div className="min-w-0 flex-1">
          <PartitionLabel partitionIndex={partitionIndex} partitionCount={partitionCount} />
          {/* Not truncated: catalog names run long, and this panel is the one
              place the whole name has to be readable. */}
          <div className="font-medium break-words text-ink">{piece.description}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span className="flex items-center gap-1">
              <ColorSwatch color={piece.color} size={11} />
              {piece.color.name}
            </span>
            <span className="font-mono">#{piece.partNumber}</span>
          </div>
          {!piece.catalogMatched ? (
            <p className="mt-1 text-xs text-warning">Not found in the catalog.</p>
          ) : null}
          {piece.notes ? <p className="mt-1.5 text-xs text-ink">{piece.notes}</p> : null}
          <p className="mt-1 text-[11px] text-ink-muted">Added {formatDate(piece.addedAt)}</p>
        </div>
        <div className="text-right">
          <div className="text-lg leading-none font-semibold text-ink">{piece.quantity}</div>
          <div className="text-[11px] text-ink-muted">in stock</div>
        </div>
      </div>

      {extracting ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-sunken p-2">
          <div className="w-24">
            <TextInput
              type="number"
              min={1}
              max={piece.quantity}
              value={amount}
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmExtract()
              }}
              className="h-9 text-center"
            />
          </div>
          <Button variant="primary" size="sm" onClick={confirmExtract}>
            Take out
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExtracting(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setExtracting(true)}>
            Take out
          </Button>
          <Button size="sm" onClick={() => navigate(`/edit/${piece.id}`)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
          <span className="ml-auto">
            <FullToggle
              unitId={unitId}
              compartmentIndex={compartmentIndex}
              partitionIndex={partitionIndex}
              full={full}
            />
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${piece.description}?`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          setConfirmingDelete(false)
          await deletePiece(piece.id)
        }}
      >
        This removes the whole entry ({piece.quantity} in stock) from the inventory. The movement log
        keeps a record of it.
      </ConfirmDialog>
    </div>
  )
}
