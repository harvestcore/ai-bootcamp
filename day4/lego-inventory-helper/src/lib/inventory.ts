// Pure read-only queries over an inventory snapshot. Nothing here touches
// IndexedDB or React: given the same snapshot they always return the same
// answer, which is what makes them safe to call straight from a component's
// render (and easy to reason about, or test, in isolation).

import { compartmentKey } from './ids.ts'
import { colorKey, isDuplicateMatch, isSameType } from './matching.ts'
import type {
  CompartmentRecord,
  DrawerUnit,
  MovementEntry,
  Piece,
  PieceColor,
} from '../types.ts'

export interface InventorySnapshot {
  units: DrawerUnit[]
  compartments: Map<string, CompartmentRecord>
  pieces: Piece[]
  /** Newest first. */
  log: MovementEntry[]
}

/** The hard ceiling on how many different pieces fit in one compartment. */
export const MAX_PARTITIONS = 3

export function getUnit(snap: InventorySnapshot, unitId: string): DrawerUnit | null {
  return snap.units.find((u) => u.id === unitId) ?? null
}

export function getPieceById(snap: InventorySnapshot, pieceId: string): Piece | null {
  return snap.pieces.find((p) => p.id === pieceId) ?? null
}

export function compartmentCount(unit: DrawerUnit): number {
  return unit.rows * unit.cols
}

/** The stored record for a compartment, or the implicit "untouched" default. */
export function getCompartmentRecord(
  snap: InventorySnapshot,
  unitId: string,
  index: number,
): CompartmentRecord {
  return (
    snap.compartments.get(compartmentKey(unitId, index)) ?? {
      key: compartmentKey(unitId, index),
      unitId,
      index,
      partitionCount: 1,
      partitionsFull: [false],
    }
  )
}

/** Occupancy is derived, never stored — that's what makes a partition free itself up. */
export function getOccupants(snap: InventorySnapshot, unitId: string, index: number): Piece[] {
  return snap.pieces
    .filter((p) => p.unitId === unitId && p.compartmentIndex === index)
    .sort((a, b) => a.partitionIndex - b.partitionIndex)
}

export interface CompartmentInfo {
  record: CompartmentRecord
  occupants: Piece[]
  /** Every partition flagged full by hand. */
  manuallyFull: boolean
  /** The hard max of distinct pieces is already there. */
  structurallyFull: boolean
  /** First partition with nothing in it, or -1. */
  freePartitionIndex: number
}

export function getCompartmentInfo(
  snap: InventorySnapshot,
  unitId: string,
  index: number,
): CompartmentInfo {
  const record = getCompartmentRecord(snap, unitId, index)
  const occupants = getOccupants(snap, unitId, index)
  const manuallyFull =
    record.partitionsFull.length === record.partitionCount && record.partitionsFull.every(Boolean)
  const structurallyFull = occupants.length >= MAX_PARTITIONS

  let freePartitionIndex = -1
  for (let i = 0; i < record.partitionCount; i++) {
    if (!occupants.some((o) => o.partitionIndex === i)) {
      freePartitionIndex = i
      break
    }
  }
  return { record, occupants, manuallyFull, structurallyFull, freePartitionIndex }
}

export function isCompartmentSelectable(snap: InventorySnapshot, unitId: string, index: number): boolean {
  const { manuallyFull, structurallyFull } = getCompartmentInfo(snap, unitId, index)
  return !manuallyFull && !structurallyFull
}

export function locationLabel(
  snap: InventorySnapshot,
  unitId: string,
  compartmentIndex: number,
  partitionIndex?: number,
): string {
  const unit = getUnit(snap, unitId)
  const base = `${unit?.name ?? 'Unit'}, Compartment ${compartmentIndex + 1}`
  if (partitionIndex == null) return base
  const { partitionCount } = getCompartmentRecord(snap, unitId, compartmentIndex)
  return partitionCount > 1 ? `${base}, Partition ${partitionIndex + 1}` : base
}

// ---------- Location suggestion ----------

export interface LocationSuggestion {
  unitId: string
  compartmentIndex: number
  reason: string
}

/**
 * Where a new piece should go: the first compartment already holding only this
 * same piece type (any color), else the first empty compartment. Full
 * compartments — by hand or structurally — are skipped either way.
 */
export function suggestLocation(
  snap: InventorySnapshot,
  candidate: Pick<Piece, 'partNumber' | 'color'>,
): LocationSuggestion | null {
  let empty: { unitId: string; compartmentIndex: number } | null = null

  for (const unit of snap.units) {
    for (let index = 0; index < compartmentCount(unit); index++) {
      const { manuallyFull, structurallyFull, occupants } = getCompartmentInfo(snap, unit.id, index)
      if (manuallyFull || structurallyFull) continue
      if (occupants.length === 0) {
        if (!empty) empty = { unitId: unit.id, compartmentIndex: index }
        continue
      }
      if (occupants.every((o) => isSameType(o, candidate))) {
        return {
          unitId: unit.id,
          compartmentIndex: index,
          reason: `Grouped with the other "${occupants[0]!.description}" pieces`,
        }
      }
    }
  }
  return empty ? { ...empty, reason: 'First empty compartment' } : null
}

/** True when adding one more piece here means physically splitting the compartment. */
export function needsPartitionSplit(snap: InventorySnapshot, unitId: string, index: number): boolean {
  const { occupants, record } = getCompartmentInfo(snap, unitId, index)
  if (occupants.length === 0) return false
  return occupants.length >= record.partitionCount
}

// ---------- Duplicate detection ----------

export function findDuplicate(
  snap: InventorySnapshot,
  candidate: Pick<Piece, 'partNumber' | 'color'>,
): Piece | null {
  return snap.pieces.find((piece) => isDuplicateMatch(candidate, piece)) ?? null
}

// ---------- Drawer setup guards ----------

export function countPiecesInUnit(snap: InventorySnapshot, unitId: string): number {
  return snap.pieces.filter((p) => p.unitId === unitId).length
}

/** Pieces that would fall outside a unit resized down to rows x cols. */
export function findOrphanedPieces(
  snap: InventorySnapshot,
  unitId: string,
  rows: number,
  cols: number,
): Piece[] {
  const capacity = rows * cols
  return snap.pieces.filter((p) => p.unitId === unitId && p.compartmentIndex >= capacity)
}

// ---------- Search & log ----------

export interface SearchFilters {
  color?: string
  unitId?: string
}

/**
 * Free-text search over the piece name, its part number, its **color name** and
 * its notes. Color is in there because "the red plates" is how people actually
 * look for a piece; notes because that's where anything the catalog name
 * doesn't capture ends up.
 */
export function searchPieces(
  snap: InventorySnapshot,
  query: string,
  { color, unitId }: SearchFilters = {},
): Piece[] {
  const q = query.trim().toLowerCase()
  return snap.pieces.filter((p) => {
    if (q) {
      const haystack = [p.description, p.partNumber, p.color.name, p.notes]
      if (!haystack.some((value) => value.toLowerCase().includes(q))) return false
    }
    if (color && colorKey(p.color) !== color) return false
    if (unitId && p.unitId !== unitId) return false
    return true
  })
}

export type PieceSort = 'name' | 'quantity' | 'location'

/** Sorted copy of `pieces`. Location order follows the physical layout. */
export function sortPieces(snap: InventorySnapshot, pieces: Piece[], sort: PieceSort): Piece[] {
  const unitOrder = new Map(snap.units.map((unit, index) => [unit.id, index]))
  const byName = (a: Piece, b: Piece) => a.description.localeCompare(b.description)

  return [...pieces].sort((a, b) => {
    if (sort === 'quantity') return b.quantity - a.quantity || byName(a, b)
    if (sort === 'location') {
      return (
        (unitOrder.get(a.unitId) ?? 0) - (unitOrder.get(b.unitId) ?? 0) ||
        a.compartmentIndex - b.compartmentIndex ||
        a.partitionIndex - b.partitionIndex
      )
    }
    return byName(a, b)
  })
}

/** Distinct colors present in a set of pieces, for the search filter chips. */
export function distinctColors(pieces: Piece[]): PieceColor[] {
  return [...new Map(pieces.map((p) => [colorKey(p.color), p.color])).values()]
}

export function filterLog(
  snap: InventorySnapshot,
  { unitId, compartmentIndex }: { unitId?: string; compartmentIndex?: number } = {},
): MovementEntry[] {
  return snap.log.filter((entry) => {
    if (!unitId) return true
    const inUnit = entry.locations.some((l) => l.unitId === unitId)
    if (!inUnit) return false
    if (compartmentIndex == null) return true
    return entry.locations.some(
      (l) => l.unitId === unitId && l.compartmentIndex === compartmentIndex,
    )
  })
}

// ---------- Headline numbers ----------

export interface InventoryStats {
  pieceKinds: number
  totalQuantity: number
  usedCompartments: number
  totalCompartments: number
}

export function getStats(snap: InventorySnapshot): InventoryStats {
  const occupied = new Set(snap.pieces.map((p) => compartmentKey(p.unitId, p.compartmentIndex)))
  return {
    pieceKinds: snap.pieces.length,
    totalQuantity: snap.pieces.reduce((sum, p) => sum + p.quantity, 0),
    usedCompartments: occupied.size,
    totalCompartments: snap.units.reduce((sum, u) => sum + compartmentCount(u), 0),
  }
}
