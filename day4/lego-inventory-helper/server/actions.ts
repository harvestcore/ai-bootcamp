import { randomUUID } from 'node:crypto'
import { transaction } from './db.ts'
import { getImageForPartColor, lookupPart } from './catalog.ts'
import {
  deletePieceRow,
  deleteUnitRow,
  insertMovement,
  readSnapshot,
  readSnapshotDto,
  upsertCompartment,
  upsertPiece,
  upsertUnit,
} from './repository.ts'
import { compartmentKey } from '../src/lib/ids.ts'
import { getCompartmentInfo, getCompartmentRecord, locationLabel } from '../src/lib/inventory.ts'
import type { InventorySnapshot } from '../src/lib/inventory.ts'
import type {
  CompartmentRecord,
  DrawerUnit,
  InventorySnapshotDto,
  MovementEntry,
  MovementLocation,
  MovementType,
  Piece,
  PieceColor,
  PieceDraft,
} from '../src/types.ts'

/**
 * Every write the app can make. The domain rules live here (and in the shared
 * pure helpers in `src/lib/inventory.ts`, which this reuses so the server and
 * the UI can never disagree about what "full" or "the next free partition"
 * means).
 *
 * Each action runs in one SQLite transaction and answers with the whole new
 * inventory, so the client never has to guess what changed.
 */

export interface ActionResponse<T = undefined> {
  snapshot: InventorySnapshotDto
  result: T
}

function respond<T>(result: T): ActionResponse<T> {
  return { snapshot: readSnapshotDto(), result }
}

function appendLog(entry: {
  type: MovementType
  pieceDescription: string
  detail: string
  locations: MovementLocation[]
}): void {
  const full: MovementEntry = { id: randomUUID(), timestamp: new Date().toISOString(), ...entry }
  insertMovement(full)
}

// The part number is mandatory (the user's override of the original spec):
// there is no free-text description field. `description` is always the
// catalog's official name, or a `Part #<num>` label when it isn't recognized.
function resolvePartIdentity(partNumber: string) {
  const trimmed = partNumber.trim()
  const match = lookupPart(trimmed)
  return {
    partNumber: trimmed,
    description: match ? match.name : `Part #${trimmed}`,
    catalogMatched: !!match,
  }
}

// Real photos only exist for palette colors — a custom "Other" color has no
// Rebrickable color id to look one up with.
function computeImageUrl(partNumber: string, color: PieceColor | null): string | null {
  if (color?.source !== 'palette') return null
  return getImageForPartColor(partNumber, color.id)
}

function writeCompartmentRecord(record: CompartmentRecord): void {
  upsertCompartment(record)
}

/** Picks the partition a new arrival goes into, widening the compartment if needed. */
function claimPartition(snapshot: InventorySnapshot, unitId: string, compartmentIndex: number): number {
  const { occupants, record, freePartitionIndex } = getCompartmentInfo(snapshot, unitId, compartmentIndex)
  if (occupants.length === 0) return 0
  const partitionIndex = freePartitionIndex !== -1 ? freePartitionIndex : record.partitionCount
  if (partitionIndex >= record.partitionCount) {
    writeCompartmentRecord({
      ...record,
      partitionCount: partitionIndex + 1,
      partitionsFull: Array.from(
        { length: partitionIndex + 1 },
        (_, i) => record.partitionsFull[i] ?? false,
      ),
    })
  }
  return partitionIndex
}

// ---------- Drawer units ----------

export function createUnit(input: { rows: number; cols: number }): ActionResponse {
  return transaction(() => {
    const snapshot = readSnapshot()
    const unit: DrawerUnit = {
      id: randomUUID(),
      name: `Unit ${snapshot.units.length + 1}`,
      rows: input.rows,
      cols: input.cols,
      order: snapshot.units.length,
    }
    upsertUnit(unit)
    return respond(undefined)
  })
}

export function renameUnit(input: { unitId: string; name: string }): ActionResponse {
  return transaction(() => {
    const snapshot = readSnapshot()
    const unit = snapshot.units.find((u) => u.id === input.unitId)
    const trimmed = input.name.trim()
    if (unit && trimmed && trimmed !== unit.name) upsertUnit({ ...unit, name: trimmed })
    return respond(undefined)
  })
}

export type ResizeResult = { ok: true } | { ok: false; orphaned: Piece[] }

export function updateUnitDimensions(input: {
  unitId: string
  rows: number
  cols: number
}): ActionResponse<ResizeResult> {
  return transaction(() => {
    const snapshot = readSnapshot()
    const capacity = input.rows * input.cols
    const orphaned = snapshot.pieces.filter(
      (p) => p.unitId === input.unitId && p.compartmentIndex >= capacity,
    )
    if (orphaned.length > 0) return respond<ResizeResult>({ ok: false, orphaned })

    const unit = snapshot.units.find((u) => u.id === input.unitId)
    if (unit) upsertUnit({ ...unit, rows: input.rows, cols: input.cols })
    return respond<ResizeResult>({ ok: true })
  })
}

export type DeleteUnitResult = { ok: true } | { ok: false; occupied: number }

export function deleteUnit(input: { unitId: string }): ActionResponse<DeleteUnitResult> {
  return transaction(() => {
    const snapshot = readSnapshot()
    const occupied = snapshot.pieces.filter((p) => p.unitId === input.unitId).length
    if (occupied > 0) return respond<DeleteUnitResult>({ ok: false, occupied })
    deleteUnitRow(input.unitId)
    return respond<DeleteUnitResult>({ ok: true })
  })
}

// ---------- Compartments ----------

export function setPartitionCount(input: {
  unitId: string
  index: number
  count: number
}): ActionResponse {
  return transaction(() => {
    const previous = getCompartmentRecord(readSnapshot(), input.unitId, input.index)
    writeCompartmentRecord({
      ...previous,
      partitionCount: input.count,
      partitionsFull: Array.from(
        { length: input.count },
        (_, i) => previous.partitionsFull[i] ?? false,
      ),
    })
    return respond(undefined)
  })
}

export function setPartitionFull(input: {
  unitId: string
  index: number
  partitionIndex: number
  value: boolean
}): ActionResponse {
  return transaction(() => {
    const previous = getCompartmentRecord(readSnapshot(), input.unitId, input.index)
    const partitionsFull = [...previous.partitionsFull]
    partitionsFull[input.partitionIndex] = input.value
    writeCompartmentRecord({ ...previous, partitionsFull })
    return respond(undefined)
  })
}

// ---------- Pieces ----------

export function createPiece(input: {
  draft: PieceDraft
  unitId: string
  compartmentIndex: number
}): ActionResponse<Piece> {
  return transaction(() => {
    const { draft, unitId, compartmentIndex } = input
    if (!draft.color) throw new Error('A color is required')

    const partitionIndex = claimPartition(readSnapshot(), unitId, compartmentIndex)
    const { partNumber, description, catalogMatched } = resolvePartIdentity(draft.partNumber)

    const piece: Piece = {
      id: randomUUID(),
      description,
      partNumber,
      color: draft.color,
      quantity: draft.quantity,
      unitId,
      compartmentIndex,
      partitionIndex,
      notes: draft.notes.trim(),
      addedAt: new Date().toISOString(),
      catalogMatched,
      imageUrl: computeImageUrl(partNumber, draft.color),
    }
    upsertPiece(piece)

    appendLog({
      type: 'add',
      pieceDescription: piece.description,
      detail: `+${piece.quantity} → ${locationLabel(readSnapshot(), unitId, compartmentIndex, partitionIndex)}`,
      locations: [{ unitId, compartmentIndex }],
    })
    return respond(piece)
  })
}

export function addToExistingPiece(input: {
  pieceId: string
  quantity: number
}): ActionResponse<Piece | null> {
  return transaction(() => {
    const snapshot = readSnapshot()
    const existing = snapshot.pieces.find((p) => p.id === input.pieceId)
    if (!existing) return respond<Piece | null>(null)

    const piece = { ...existing, quantity: existing.quantity + input.quantity }
    upsertPiece(piece)
    appendLog({
      type: 'add',
      pieceDescription: piece.description,
      detail: `+${input.quantity} → ${locationLabel(snapshot, piece.unitId, piece.compartmentIndex, piece.partitionIndex)}`,
      locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
    })
    return respond<Piece | null>(piece)
  })
}

export function extractPiece(input: { pieceId: string; quantity: number }): ActionResponse {
  return transaction(() => {
    const snapshot = readSnapshot()
    const existing = snapshot.pieces.find((p) => p.id === input.pieceId)
    if (!existing) return respond(undefined)
    if (input.quantity < 1 || input.quantity > existing.quantity) {
      throw new Error('Invalid extraction quantity')
    }

    const remaining = existing.quantity - input.quantity
    const where = locationLabel(
      snapshot,
      existing.unitId,
      existing.compartmentIndex,
      existing.partitionIndex,
    )

    // Removing the last one frees the partition automatically: occupancy is
    // derived from the pieces, so there's no slot left behind to clean up.
    if (remaining === 0) deletePieceRow(existing.id)
    else upsertPiece({ ...existing, quantity: remaining })

    appendLog({
      type: 'extract',
      pieceDescription: existing.description,
      detail: `−${input.quantity} (${remaining} remaining) — ${where}`,
      locations: [{ unitId: existing.unitId, compartmentIndex: existing.compartmentIndex }],
    })
    return respond(undefined)
  })
}

export interface PieceEdits {
  partNumber?: string
  color?: PieceColor
  notes?: string
}

const EDITABLE_FIELDS = ['partNumber', 'color', 'notes'] as const

const FIELD_LABELS: Record<(typeof EDITABLE_FIELDS)[number], string> = {
  partNumber: 'Part number',
  color: 'Color',
  notes: 'Notes',
}

/** Each changed field gets its own log entry, so the history reads field by field. */
export function updatePiece(input: {
  pieceId: string
  edits: PieceEdits
}): ActionResponse<Piece | null> {
  return transaction(() => {
    const snapshot = readSnapshot()
    const existing = snapshot.pieces.find((p) => p.id === input.pieceId)
    if (!existing) return respond<Piece | null>(null)

    let piece = { ...existing }
    let imageRelevantChanged = false

    for (const field of EDITABLE_FIELDS) {
      const newValue = input.edits[field]
      if (newValue === undefined) continue
      const oldLabel = field === 'color' ? existing.color.name : String(existing[field] ?? '')
      const newLabel = field === 'color' ? (newValue as PieceColor).name : String(newValue)
      if (oldLabel === newLabel) continue

      piece = { ...piece, [field]: newValue }
      if (field === 'partNumber' || field === 'color') imageRelevantChanged = true

      if (field === 'partNumber') {
        const identity = resolvePartIdentity(newValue as string)
        piece = { ...piece, description: identity.description, catalogMatched: identity.catalogMatched }
      }

      appendLog({
        type: 'edit',
        pieceDescription: piece.description,
        detail: `${FIELD_LABELS[field]} changed: ${oldLabel || '(none)'} → ${newLabel || '(none)'}`,
        locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
      })
    }

    if (imageRelevantChanged) {
      piece = { ...piece, imageUrl: computeImageUrl(piece.partNumber, piece.color) }
    }
    upsertPiece(piece)
    return respond<Piece | null>(piece)
  })
}

export function movePiece(input: {
  pieceId: string
  toUnitId: string
  toCompartmentIndex: number
}): ActionResponse<Piece | null> {
  return transaction(() => {
    const before = readSnapshot()
    const existing = before.pieces.find((p) => p.id === input.pieceId)
    if (!existing) return respond<Piece | null>(null)

    const fromLabel = locationLabel(
      before,
      existing.unitId,
      existing.compartmentIndex,
      existing.partitionIndex,
    )
    const partitionIndex = claimPartition(before, input.toUnitId, input.toCompartmentIndex)
    const piece = {
      ...existing,
      unitId: input.toUnitId,
      compartmentIndex: input.toCompartmentIndex,
      partitionIndex,
    }
    upsertPiece(piece)

    const locations: MovementLocation[] = [
      { unitId: input.toUnitId, compartmentIndex: input.toCompartmentIndex },
    ]
    if (
      existing.unitId !== input.toUnitId ||
      existing.compartmentIndex !== input.toCompartmentIndex
    ) {
      locations.push({ unitId: existing.unitId, compartmentIndex: existing.compartmentIndex })
    }
    appendLog({
      type: 'move',
      pieceDescription: piece.description,
      detail: `${fromLabel} → ${locationLabel(readSnapshot(), input.toUnitId, input.toCompartmentIndex, partitionIndex)}`,
      locations,
    })
    return respond<Piece | null>(piece)
  })
}

export function deletePiece(input: { pieceId: string }): ActionResponse {
  return transaction(() => {
    const snapshot = readSnapshot()
    const piece = snapshot.pieces.find((p) => p.id === input.pieceId)
    if (!piece) return respond(undefined)

    const where = locationLabel(snapshot, piece.unitId, piece.compartmentIndex, piece.partitionIndex)
    deletePieceRow(piece.id)
    appendLog({
      type: 'delete',
      pieceDescription: piece.description,
      detail: `Removed (last known: ${piece.quantity} in ${where})`,
      locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
    })
    return respond(undefined)
  })
}

// ---------- One-time import of the old browser-stored inventory ----------

/**
 * Takes everything the previous IndexedDB version had and writes it into
 * SQLite, but only into an empty database — so it can never overwrite data that
 * already lives in the file, no matter how often the browser offers it.
 */
export function importLegacy(input: {
  units?: unknown[]
  compartments?: unknown[]
  pieces?: unknown[]
  log?: unknown[]
}): ActionResponse<{ imported: boolean; pieces: number }> {
  return transaction(() => {
    const snapshot = readSnapshot()
    if (snapshot.units.length > 0 || snapshot.pieces.length > 0) {
      return respond({ imported: false, pieces: 0 })
    }

    const units = (input.units ?? []).map(normalizeLegacyUnit).filter(isPresent)
    const pieces = (input.pieces ?? []).map(normalizeLegacyPiece).filter(isPresent)
    const compartments = (input.compartments ?? []).map(normalizeLegacyCompartment).filter(isPresent)
    const log = (input.log ?? []).map(normalizeLegacyMovement).filter(isPresent)

    for (const unit of units) upsertUnit(unit)
    for (const record of compartments) writeCompartmentRecord(record)
    for (const piece of pieces) upsertPiece(piece)
    for (const entry of log) insertMovement(entry)
    return respond({ imported: true, pieces: pieces.length })
  })
}

// The records below come from a database this code no longer owns — an older
// schema that, for instance, predates piece photos entirely. Anything missing
// is filled in with a sane default and anything unusable is dropped, so one bad
// row can't abort the whole hand-over (which would otherwise leave the user
// with an app that refuses to start).

type Loose = Record<string, unknown>

function isPresent<T>(value: T | null): value is T {
  return value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeLegacyUnit(raw: unknown): DrawerUnit | null {
  const unit = raw as Loose
  const id = asString(unit?.id)
  if (!id) return null
  return {
    id,
    name: asString(unit.name, 'Unit'),
    rows: Math.max(1, asNumber(unit.rows, 1)),
    cols: Math.max(1, asNumber(unit.cols, 1)),
    order: asNumber(unit.order, 0),
  }
}

function normalizeLegacyColor(raw: unknown): PieceColor {
  const color = (raw ?? {}) as Loose
  const name = asString(color.name, 'Unknown')
  if (color.source === 'other') return { source: 'other', name }
  return {
    source: 'palette',
    id: asNumber(color.id, 0),
    name,
    rgb: asString(color.rgb, '#9e9e9e'),
  }
}

function normalizeLegacyPiece(raw: unknown): Piece | null {
  const piece = raw as Loose
  const id = asString(piece?.id)
  const unitId = asString(piece?.unitId)
  if (!id || !unitId) return null
  const quantity = Math.max(1, Math.round(asNumber(piece.quantity, 1)))
  return {
    id,
    description: asString(piece.description, 'Unknown piece'),
    partNumber: asString(piece.partNumber),
    color: normalizeLegacyColor(piece.color),
    quantity,
    unitId,
    compartmentIndex: Math.max(0, asNumber(piece.compartmentIndex, 0)),
    partitionIndex: Math.max(0, asNumber(piece.partitionIndex, 0)),
    notes: asString(piece.notes),
    addedAt: asString(piece.addedAt, new Date().toISOString()),
    catalogMatched: piece.catalogMatched === true,
    imageUrl: typeof piece.imageUrl === 'string' ? piece.imageUrl : null,
  }
}

function normalizeLegacyCompartment(raw: unknown): CompartmentRecord | null {
  const record = raw as Loose
  const unitId = asString(record?.unitId)
  if (!unitId) return null
  const index = Math.max(0, asNumber(record.index, 0))
  const partitionCount = Math.max(1, asNumber(record.partitionCount, 1))
  const flags = Array.isArray(record.partitionsFull) ? record.partitionsFull : []
  return {
    key: asString(record.key) || compartmentKey(unitId, index),
    unitId,
    index,
    partitionCount,
    partitionsFull: Array.from({ length: partitionCount }, (_, i) => flags[i] === true),
  }
}

const MOVEMENT_TYPES: MovementType[] = ['add', 'extract', 'move', 'edit', 'delete']

function normalizeLegacyMovement(raw: unknown): MovementEntry | null {
  const entry = raw as Loose
  const id = asString(entry?.id)
  if (!id) return null
  const type = MOVEMENT_TYPES.includes(entry.type as MovementType)
    ? (entry.type as MovementType)
    : 'edit'
  const locations = Array.isArray(entry.locations)
    ? (entry.locations as Loose[])
        .map((location) => ({
          unitId: asString(location?.unitId),
          compartmentIndex: asNumber(location?.compartmentIndex, 0),
        }))
        .filter((location) => location.unitId !== '')
    : []
  return {
    id,
    timestamp: asString(entry.timestamp, new Date().toISOString()),
    type,
    pieceDescription: asString(entry.pieceDescription, 'Unknown piece'),
    detail: asString(entry.detail),
    locations,
  }
}
