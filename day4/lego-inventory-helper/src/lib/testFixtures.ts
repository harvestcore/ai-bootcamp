// Test-only builders for the pure domain helpers in `inventory.ts` and
// `matching.ts`. Kept next to them (rather than in a `test/` folder) so
// `npm run typecheck` checks the fixtures against the real domain types — a
// fixture that drifts from `types.ts` then fails the build instead of silently
// testing a shape the app never produces. Nothing in the app imports this file.

import { compartmentKey } from './ids.ts'
import type { InventorySnapshot } from './inventory.ts'
import type {
  CompartmentRecord,
  DrawerUnit,
  MovementEntry,
  MovementLocation,
  PaletteColor,
  Piece,
  PieceColor,
} from '../types.ts'

// Real Rebrickable ids: Black really is id 0, which is why it is used in the
// `colorKey` tests — a falsy id must still produce a key.
export const BLACK: PaletteColor = { source: 'palette', id: 0, name: 'Black', rgb: '05131D' }
export const RED: PaletteColor = { source: 'palette', id: 4, name: 'Red', rgb: 'C91A09' }
export const BLUE: PaletteColor = { source: 'palette', id: 1, name: 'Blue', rgb: '0055BF' }

/** A free-text "Other…" color. */
export function other(name: string): PieceColor {
  return { source: 'other', name }
}

export function unit(id: string, overrides: Partial<DrawerUnit> = {}): DrawerUnit {
  return { id, name: `Unit ${id}`, rows: 2, cols: 2, order: 0, ...overrides }
}

export function piece(id: string, overrides: Partial<Piece> = {}): Piece {
  return {
    id,
    description: 'Brick 2 x 4',
    partNumber: '3001',
    color: RED,
    quantity: 1,
    unitId: 'a',
    compartmentIndex: 0,
    partitionIndex: 0,
    notes: '',
    addedAt: '2026-01-01T00:00:00.000Z',
    catalogMatched: true,
    imageUrl: null,
    ...overrides,
  }
}

/** A stored compartment record; `partitionsFull` defaults to all-unflagged. */
export function record(
  unitId: string,
  index: number,
  overrides: Partial<CompartmentRecord> = {},
): CompartmentRecord {
  const partitionCount = overrides.partitionCount ?? 1
  return {
    key: compartmentKey(unitId, index),
    unitId,
    index,
    partitionCount,
    partitionsFull: Array.from({ length: partitionCount }, () => false),
    ...overrides,
  }
}

export function logEntry(
  id: string,
  locations: MovementLocation[],
  overrides: Partial<MovementEntry> = {},
): MovementEntry {
  return {
    id,
    timestamp: '2026-01-01T00:00:00.000Z',
    type: 'add',
    pieceDescription: 'Brick 2 x 4',
    detail: '',
    locations,
    ...overrides,
  }
}

export function snapshot(
  input: {
    units?: DrawerUnit[]
    pieces?: Piece[]
    compartments?: CompartmentRecord[]
    log?: MovementEntry[]
  } = {},
): InventorySnapshot {
  return {
    units: input.units ?? [],
    pieces: input.pieces ?? [],
    compartments: new Map((input.compartments ?? []).map((r) => [r.key, r])),
    log: input.log ?? [],
  }
}
