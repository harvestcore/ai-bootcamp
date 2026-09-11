// The client's view of the inventory.
//
// The data itself lives in a SQLite file on this machine (see `server/`); this
// module keeps the last snapshot the server sent, hands it to React through
// `useInventory()`, and turns every user action into one API call. Each write
// answers with the whole new inventory, so there is exactly one round trip per
// action and no chance of the screen and the database disagreeing.

import { api } from './api.ts'
import type { InventorySnapshot } from './inventory.ts'
import type {
  CompartmentRecord,
  DrawerUnit,
  InventorySnapshotDto,
  MovementEntry,
  Piece,
  PieceColor,
  PieceDraft,
} from '../types.ts'

const EMPTY: InventorySnapshot = { units: [], compartments: new Map(), pieces: [], log: [] }

const listeners = new Set<() => void>()
let snapshot: InventorySnapshot = EMPTY

function publish(dto: InventorySnapshotDto): void {
  snapshot = {
    units: dto.units,
    compartments: new Map(dto.compartments.map((c) => [c.key, c])),
    pieces: dto.pieces,
    log: dto.log,
  }
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): InventorySnapshot {
  return snapshot
}

export async function loadAll(): Promise<void> {
  publish(await api.inventory())
}

/** Runs a server action and adopts the inventory it returns. */
async function run<T>(name: string, input: unknown = {}): Promise<T> {
  const { snapshot: next, result } = await api.action<T>(name, input)
  publish(next)
  return result
}

// ---------- Drawer units ----------

export function createUnit(input: { rows: number; cols: number }): Promise<void> {
  return run('createUnit', input)
}

export function renameUnit(unitId: string, name: string): Promise<void> {
  return run('renameUnit', { unitId, name })
}

export type ResizeResult = { ok: true } | { ok: false; orphaned: Piece[] }

export function updateUnitDimensions(
  unitId: string,
  rows: number,
  cols: number,
): Promise<ResizeResult> {
  return run<ResizeResult>('updateUnitDimensions', { unitId, rows, cols })
}

export type DeleteUnitResult = { ok: true } | { ok: false; occupied: number }

export function deleteUnit(unitId: string): Promise<DeleteUnitResult> {
  return run<DeleteUnitResult>('deleteUnit', { unitId })
}

// ---------- Compartments ----------

export function setPartitionCount(unitId: string, index: number, count: number): Promise<void> {
  return run('setPartitionCount', { unitId, index, count })
}

export function setPartitionFull(
  unitId: string,
  index: number,
  partitionIndex: number,
  value: boolean,
): Promise<void> {
  return run('setPartitionFull', { unitId, index, partitionIndex, value })
}

// ---------- Pieces ----------

export function createPieceAtLocation(
  draft: PieceDraft,
  unitId: string,
  compartmentIndex: number,
): Promise<Piece> {
  return run<Piece>('createPiece', { draft, unitId, compartmentIndex })
}

export function addToExistingPiece(pieceId: string, quantity: number): Promise<Piece | null> {
  return run<Piece | null>('addToExistingPiece', { pieceId, quantity })
}

export function extractPiece(pieceId: string, quantity: number): Promise<void> {
  return run('extractPiece', { pieceId, quantity })
}

export interface PieceEdits {
  partNumber?: string
  color?: PieceColor
  notes?: string
}

export function updatePiece(pieceId: string, edits: PieceEdits): Promise<Piece | null> {
  return run<Piece | null>('updatePiece', { pieceId, edits })
}

export function movePiece(
  pieceId: string,
  toUnitId: string,
  toCompartmentIndex: number,
): Promise<Piece | null> {
  return run<Piece | null>('movePiece', { pieceId, toUnitId, toCompartmentIndex })
}

export function deletePiece(pieceId: string): Promise<void> {
  return run('deletePiece', { pieceId })
}

/** One-time hand-over from the browser-stored version. Ignored if the file already has data. */
export function importLegacyInventory(input: {
  units: DrawerUnit[]
  compartments: CompartmentRecord[]
  pieces: Piece[]
  log: MovementEntry[]
}): Promise<{ imported: boolean; pieces: number }> {
  return run<{ imported: boolean; pieces: number }>('importLegacy', input)
}

// ---------- Export ----------

export interface InventoryExport {
  exportedAt: string
  drawerUnits: DrawerUnit[]
  compartments: CompartmentRecord[]
  pieces: Piece[]
  movementLog: MovementEntry[]
}

/** Where the browser can fetch a consistent copy of the SQLite file itself. */
export const DATABASE_DOWNLOAD_URL = '/api/export/database'

/**
 * Replaces the entire inventory with the contents of an exported JSON file.
 * Destructive: the caller must have confirmed with the user first.
 */
export function restoreFromBackup(payload: unknown): Promise<{ units: number; pieces: number }> {
  return run<{ units: number; pieces: number }>('restoreBackup', payload)
}

/**
 * A portable JSON copy of the inventory. (The database file itself is the real
 * backup — this is the human-readable one the spec asks for.)
 */
export function exportInventory(): InventoryExport {
  return {
    exportedAt: new Date().toISOString(),
    drawerUnits: snapshot.units,
    compartments: [...snapshot.compartments.values()],
    pieces: snapshot.pieces,
    movementLog: snapshot.log,
  }
}
