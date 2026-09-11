import { tx, getAll, put, del } from './db.js'
import { newId, compartmentKey } from './ids.js'
import { isDuplicateMatch, isSameType, colorKey } from './matching.js'
import { lookupPartByNumber, getImageForPartColor } from './catalog.js'

const state = {
  units: [],
  compartments: new Map(), // key -> { key, unitId, index, partitionCount, partitionsFull }
  pieces: new Map(), // id -> piece
  log: [], // newest first
}

export async function loadAll() {
  const [units, compartments, pieces, log] = await Promise.all([
    tx('drawerUnits', 'readonly', (s) => getAll(s.drawerUnits)),
    tx('compartments', 'readonly', (s) => getAll(s.compartments)),
    tx('pieces', 'readonly', (s) => getAll(s.pieces)),
    tx('log', 'readonly', (s) => getAll(s.log)),
  ])
  state.units = units.sort((a, b) => a.order - b.order)
  state.compartments = new Map(compartments.map((c) => [c.key, c]))
  state.pieces = new Map(pieces.map((p) => [p.id, p]))
  state.log = log.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function getUnits() {
  return state.units
}
export function getUnit(unitId) {
  return state.units.find((u) => u.id === unitId)
}
export function getAllPieces() {
  return [...state.pieces.values()]
}
export function getPieceById(id) {
  return state.pieces.get(id) ?? null
}
export function getLog() {
  return state.log
}

// ---------- Compartment state ----------

export function getCompartmentRecord(unitId, index) {
  return (
    state.compartments.get(compartmentKey(unitId, index)) ?? {
      key: compartmentKey(unitId, index),
      unitId,
      index,
      partitionCount: 1,
      partitionsFull: [false],
    }
  )
}

export function getOccupants(unitId, index) {
  return [...state.pieces.values()]
    .filter((p) => p.unitId === unitId && p.compartmentIndex === index)
    .sort((a, b) => a.partitionIndex - b.partitionIndex)
}

export function getCompartmentInfo(unitId, index) {
  const record = getCompartmentRecord(unitId, index)
  const occupants = getOccupants(unitId, index)
  const manuallyFull =
    record.partitionsFull.length === record.partitionCount && record.partitionsFull.every(Boolean)
  const structurallyFull = occupants.length >= 3
  let freePartitionIndex = -1
  for (let i = 0; i < record.partitionCount; i++) {
    if (!occupants.some((o) => o.partitionIndex === i)) {
      freePartitionIndex = i
      break
    }
  }
  return { record, occupants, manuallyFull, structurallyFull, freePartitionIndex }
}

async function saveCompartmentRecord(record) {
  state.compartments.set(record.key, record)
  await tx('compartments', 'readwrite', (s) => put(s.compartments, record))
}

export async function setPartitionCount(unitId, index, count) {
  const record = { ...getCompartmentRecord(unitId, index) }
  const prevFull = record.partitionsFull
  record.partitionCount = count
  record.partitionsFull = Array.from({ length: count }, (_, i) => prevFull[i] ?? false)
  await saveCompartmentRecord(record)
}

export async function toggleCompartmentPartitionFull(unitId, index, partitionIndex, value) {
  const record = { ...getCompartmentRecord(unitId, index) }
  record.partitionsFull = [...record.partitionsFull]
  record.partitionsFull[partitionIndex] = value
  await saveCompartmentRecord(record)
}

// ---------- Location suggestion ----------

export function suggestLocation(candidate) {
  let grouped = null
  let empty = null
  for (const unit of state.units) {
    for (let index = 0; index < unit.rows * unit.cols; index++) {
      const { manuallyFull, structurallyFull, occupants } = getCompartmentInfo(unit.id, index)
      if (manuallyFull || structurallyFull) continue
      if (occupants.length === 0) {
        if (!empty) empty = { unitId: unit.id, compartmentIndex: index }
        continue
      }
      if (!grouped && occupants.every((o) => isSameType(o, candidate))) {
        grouped = {
          unitId: unit.id,
          compartmentIndex: index,
          reason: `Grouped with other "${occupants[0].description}" pieces`,
        }
      }
    }
    if (grouped) break
  }
  return grouped ?? (empty ? { ...empty, reason: 'First empty compartment' } : null)
}

export function needsPartitionSplit(unitId, index) {
  const { occupants, record } = getCompartmentInfo(unitId, index)
  if (occupants.length === 0) return false
  return occupants.length >= record.partitionCount
}

// ---------- Duplicate detection ----------

export function findDuplicate(candidate) {
  for (const piece of state.pieces.values()) {
    if (isDuplicateMatch(candidate, piece)) return piece
  }
  return null
}

// ---------- Log ----------

async function appendLog(entry) {
  const full = { id: newId(), timestamp: new Date().toISOString(), ...entry }
  state.log.unshift(full)
  await tx('log', 'readwrite', (s) => put(s.log, full))
}

export function getFilteredLog({ unitId, compartmentIndex } = {}) {
  return state.log.filter((entry) => {
    if (unitId == null) return true
    const inUnit = entry.locations.some((l) => l.unitId === unitId)
    if (!inUnit) return false
    if (compartmentIndex == null) return true
    return entry.locations.some((l) => l.unitId === unitId && l.compartmentIndex === compartmentIndex)
  })
}

function locationLabel(unit, compartmentIndex, partitionIndex, partitionCount) {
  const base = `${unit?.name ?? 'Unit'}, Compartment ${compartmentIndex + 1}`
  return partitionCount > 1 ? `${base}, Partition ${partitionIndex + 1}` : base
}

// ---------- Drawer setup ----------

export async function createUnit({ rows, cols }) {
  const unit = { id: newId(), name: `Unit ${state.units.length + 1}`, rows, cols, order: state.units.length }
  state.units.push(unit)
  await tx('drawerUnits', 'readwrite', (s) => put(s.drawerUnits, unit))
  return unit
}

export function findOrphanedPieces(unitId, rows, cols) {
  const capacity = rows * cols
  return [...state.pieces.values()].filter((p) => p.unitId === unitId && p.compartmentIndex >= capacity)
}

export async function updateUnitDimensions(unitId, rows, cols) {
  const orphaned = findOrphanedPieces(unitId, rows, cols)
  if (orphaned.length > 0) return { ok: false, orphaned }
  const unit = getUnit(unitId)
  unit.rows = rows
  unit.cols = cols
  await tx('drawerUnits', 'readwrite', (s) => put(s.drawerUnits, unit))
  return { ok: true }
}

export function countPiecesInUnit(unitId) {
  return [...state.pieces.values()].filter((p) => p.unitId === unitId).length
}

export async function deleteUnit(unitId) {
  const occupied = countPiecesInUnit(unitId)
  if (occupied > 0) return { ok: false, occupied }
  state.units = state.units.filter((u) => u.id !== unitId)
  const staleKeys = [...state.compartments.keys()].filter((k) => state.compartments.get(k).unitId === unitId)
  await tx(['drawerUnits', 'compartments'], 'readwrite', (s) => {
    del(s.drawerUnits, unitId)
    for (const key of staleKeys) {
      state.compartments.delete(key)
      del(s.compartments, key)
    }
  })
  return { ok: true }
}

// ---------- Adding / merging ----------

// Real piece photos only exist for the bundled catalog's palette colors (a custom
// "Other" color has no Rebrickable color id to look one up with).
async function computeImageUrl(partNumber, color) {
  if (color?.source !== 'palette') return null
  return getImageForPartColor(partNumber, color.id)
}

// The part number is mandatory (per the user's override of the original spec):
// there is no free-text description field. `description` is always derived from
// the bundled catalog's official name for the part number, or a `Part #<num>`
// label when the number isn't recognized — notes cover any free-text need.
async function resolvePartIdentity(partNumber) {
  const trimmed = partNumber.trim()
  const match = await lookupPartByNumber(trimmed)
  return {
    partNumber: trimmed,
    description: match ? match.name : `Part #${trimmed}`,
    catalogMatched: !!match,
  }
}

export async function createPieceAtLocation(input, unitId, compartmentIndex) {
  const { occupants, record, freePartitionIndex } = getCompartmentInfo(unitId, compartmentIndex)
  let partitionIndex = 0
  if (occupants.length > 0) {
    partitionIndex = freePartitionIndex !== -1 ? freePartitionIndex : record.partitionCount
    if (partitionIndex >= record.partitionCount) {
      await setPartitionCount(unitId, compartmentIndex, partitionIndex + 1)
    }
  }

  const { partNumber, description, catalogMatched } = await resolvePartIdentity(input.partNumber)
  const imageUrl = await computeImageUrl(partNumber, input.color)

  const piece = {
    id: newId(),
    description,
    partNumber,
    color: input.color,
    quantity: input.quantity,
    unitId,
    compartmentIndex,
    partitionIndex,
    notes: input.notes?.trim() || '',
    addedAt: new Date().toISOString(),
    catalogMatched,
    imageUrl,
  }
  state.pieces.set(piece.id, piece)
  await tx('pieces', 'readwrite', (s) => put(s.pieces, piece))

  const unit = getUnit(unitId)
  const partitionCount = getCompartmentRecord(unitId, compartmentIndex).partitionCount
  await appendLog({
    type: 'add',
    pieceDescription: piece.description,
    detail: `+${piece.quantity} → ${locationLabel(unit, compartmentIndex, partitionIndex, partitionCount)}`,
    locations: [{ unitId, compartmentIndex }],
  })
  return piece
}

export async function mergeAddToExisting(existingId, qty) {
  const piece = state.pieces.get(existingId)
  piece.quantity += qty
  await tx('pieces', 'readwrite', (s) => put(s.pieces, piece))
  const unit = getUnit(piece.unitId)
  const partitionCount = getCompartmentRecord(piece.unitId, piece.compartmentIndex).partitionCount
  await appendLog({
    type: 'add',
    pieceDescription: piece.description,
    detail: `+${qty} → ${locationLabel(unit, piece.compartmentIndex, piece.partitionIndex, partitionCount)}`,
    locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
  })
  return piece
}

// ---------- Extraction ----------

export async function extractPiece(pieceId, qty) {
  const piece = state.pieces.get(pieceId)
  if (qty < 1 || qty > piece.quantity) throw new Error('Invalid extraction quantity')
  piece.quantity -= qty
  const unit = getUnit(piece.unitId)
  const partitionCount = getCompartmentRecord(piece.unitId, piece.compartmentIndex).partitionCount
  const location = locationLabel(unit, piece.compartmentIndex, piece.partitionIndex, partitionCount)

  if (piece.quantity === 0) {
    state.pieces.delete(pieceId)
    await tx('pieces', 'readwrite', (s) => del(s.pieces, pieceId))
    await appendLog({
      type: 'extract',
      pieceDescription: piece.description,
      detail: `−${qty} (0 remaining) — ${location}`,
      locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
    })
  } else {
    await tx('pieces', 'readwrite', (s) => put(s.pieces, piece))
    await appendLog({
      type: 'extract',
      pieceDescription: piece.description,
      detail: `−${qty} (${piece.quantity} remaining) — ${location}`,
      locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
    })
  }
}

// ---------- Editing ----------

const EDITABLE_FIELDS = ['partNumber', 'color', 'notes']

export async function editPiece(pieceId, changes) {
  const piece = state.pieces.get(pieceId)
  let imageRelevantChanged = false

  for (const field of EDITABLE_FIELDS) {
    if (!(field in changes)) continue
    const oldValue = piece[field]
    const newValue = changes[field]
    const oldLabel = field === 'color' ? oldValue.name : String(oldValue ?? '')
    const newLabel = field === 'color' ? newValue.name : String(newValue ?? '')
    if (oldLabel === newLabel) continue

    piece[field] = newValue
    if (field === 'partNumber' || field === 'color') imageRelevantChanged = true

    if (field === 'partNumber') {
      const { description, catalogMatched } = await resolvePartIdentity(newValue)
      piece.description = description
      piece.catalogMatched = catalogMatched
    }

    await appendLog({
      type: 'edit',
      pieceDescription: piece.description,
      detail: `${fieldLabel(field)} changed: ${oldLabel || '(none)'} → ${newLabel || '(none)'}`,
      locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
    })
  }

  if (imageRelevantChanged) {
    piece.imageUrl = await computeImageUrl(piece.partNumber, piece.color)
  }

  await tx('pieces', 'readwrite', (s) => put(s.pieces, piece))
  return piece
}

function fieldLabel(field) {
  return { partNumber: 'Part number', color: 'Color', notes: 'Notes' }[field]
}

// ---------- Move ----------

export async function movePiece(pieceId, toUnitId, toCompartmentIndex) {
  const piece = state.pieces.get(pieceId)
  const fromUnitId = piece.unitId
  const fromCompartmentIndex = piece.compartmentIndex
  const fromUnit = getUnit(fromUnitId)
  const fromPartitionCount = getCompartmentRecord(fromUnitId, fromCompartmentIndex).partitionCount
  const fromLabel = locationLabel(fromUnit, fromCompartmentIndex, piece.partitionIndex, fromPartitionCount)

  const { occupants, record, freePartitionIndex } = getCompartmentInfo(toUnitId, toCompartmentIndex)
  let partitionIndex = 0
  if (occupants.length > 0) {
    partitionIndex = freePartitionIndex !== -1 ? freePartitionIndex : record.partitionCount
    if (partitionIndex >= record.partitionCount) {
      await setPartitionCount(toUnitId, toCompartmentIndex, partitionIndex + 1)
    }
  }

  piece.unitId = toUnitId
  piece.compartmentIndex = toCompartmentIndex
  piece.partitionIndex = partitionIndex
  await tx('pieces', 'readwrite', (s) => put(s.pieces, piece))

  const toUnit = getUnit(toUnitId)
  const toPartitionCount = getCompartmentRecord(toUnitId, toCompartmentIndex).partitionCount
  const toLabel = locationLabel(toUnit, toCompartmentIndex, partitionIndex, toPartitionCount)

  const locations = [{ unitId: toUnitId, compartmentIndex: toCompartmentIndex }]
  if (fromUnitId !== toUnitId || fromCompartmentIndex !== toCompartmentIndex) {
    locations.push({ unitId: fromUnitId, compartmentIndex: fromCompartmentIndex })
  }
  await appendLog({
    type: 'move',
    pieceDescription: piece.description,
    detail: `${fromLabel} → ${toLabel}`,
    locations,
  })
  return piece
}

// ---------- Delete ----------

export async function deletePiece(pieceId) {
  const piece = state.pieces.get(pieceId)
  const unit = getUnit(piece.unitId)
  const partitionCount = getCompartmentRecord(piece.unitId, piece.compartmentIndex).partitionCount
  const location = locationLabel(unit, piece.compartmentIndex, piece.partitionIndex, partitionCount)

  state.pieces.delete(pieceId)
  await tx('pieces', 'readwrite', (s) => del(s.pieces, pieceId))
  await appendLog({
    type: 'delete',
    pieceDescription: piece.description,
    detail: `Removed (last known: ${piece.quantity} in ${location})`,
    locations: [{ unitId: piece.unitId, compartmentIndex: piece.compartmentIndex }],
  })
}

// ---------- Search ----------

export function searchPieces(query, { color, unitId } = {}) {
  const q = query.trim().toLowerCase()
  return [...state.pieces.values()].filter((p) => {
    if (q) {
      const matchesText =
        p.description.toLowerCase().includes(q) || (p.partNumber ?? '').toLowerCase().includes(q)
      if (!matchesText) return false
    }
    if (color && colorKey(p.color) !== color) return false
    if (unitId && p.unitId !== unitId) return false
    return true
  })
}

// ---------- Export ----------

export function exportInventory() {
  return {
    exportedAt: new Date().toISOString(),
    drawerUnits: state.units,
    compartments: [...state.compartments.values()],
    pieces: [...state.pieces.values()],
    movementLog: state.log,
  }
}
