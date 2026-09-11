import { getDb } from './db.ts'
import type { InventorySnapshot } from '../src/lib/inventory.ts'
import type {
  CompartmentRecord,
  DrawerUnit,
  InventorySnapshotDto,
  MovementEntry,
  Piece,
  PieceColor,
} from '../src/types.ts'

// Row <-> domain mapping, and the small set of writes the actions layer needs.
// Everything above this file works with domain objects, never with SQL rows.

interface UnitRow {
  id: string
  name: string
  row_count: number
  col_count: number
  sort_order: number
}

interface CompartmentRow {
  key: string
  unit_id: string
  idx: number
  partition_count: number
  partitions_full: string
}

interface PieceRow {
  id: string
  description: string
  part_number: string
  color_source: string
  color_id: number | null
  color_name: string
  color_rgb: string | null
  quantity: number
  unit_id: string
  compartment_index: number
  partition_index: number
  notes: string
  added_at: string
  catalog_matched: number
  image_url: string | null
}

interface LogRow {
  id: string
  timestamp: string
  type: string
  piece_description: string
  detail: string
  locations: string
}

function toUnit(row: UnitRow): DrawerUnit {
  return { id: row.id, name: row.name, rows: row.row_count, cols: row.col_count, order: row.sort_order }
}

function toCompartment(row: CompartmentRow): CompartmentRecord {
  return {
    key: row.key,
    unitId: row.unit_id,
    index: row.idx,
    partitionCount: row.partition_count,
    partitionsFull: JSON.parse(row.partitions_full) as boolean[],
  }
}

function toColor(row: PieceRow): PieceColor {
  if (row.color_source === 'palette') {
    return { source: 'palette', id: row.color_id ?? 0, name: row.color_name, rgb: row.color_rgb ?? '#000000' }
  }
  return { source: 'other', name: row.color_name }
}

function toPiece(row: PieceRow): Piece {
  return {
    id: row.id,
    description: row.description,
    partNumber: row.part_number,
    color: toColor(row),
    quantity: row.quantity,
    unitId: row.unit_id,
    compartmentIndex: row.compartment_index,
    partitionIndex: row.partition_index,
    notes: row.notes,
    addedAt: row.added_at,
    catalogMatched: row.catalog_matched === 1,
    imageUrl: row.image_url,
  }
}

function toMovement(row: LogRow): MovementEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type as MovementEntry['type'],
    pieceDescription: row.piece_description,
    detail: row.detail,
    locations: JSON.parse(row.locations) as MovementEntry['locations'],
  }
}

// ---------- Reads ----------

export function readSnapshotDto(): InventorySnapshotDto {
  const db = getDb()
  return {
    units: (db.prepare('SELECT * FROM drawer_units ORDER BY sort_order').all() as unknown as UnitRow[]).map(toUnit),
    compartments: (db.prepare('SELECT * FROM compartments').all() as unknown as CompartmentRow[]).map(toCompartment),
    pieces: (db.prepare('SELECT * FROM pieces').all() as unknown as PieceRow[]).map(toPiece),
    log: (
      db.prepare('SELECT * FROM movement_log ORDER BY timestamp DESC').all() as unknown as LogRow[]
    ).map(toMovement),
  }
}

/**
 * The same snapshot the client gets, but with `compartments` as a Map — the
 * shape `src/lib/inventory.ts` expects, so the server can reuse the exact same
 * domain rules (occupants, free partitions, location labels) as the UI instead
 * of reimplementing them in SQL.
 */
export function readSnapshot(): InventorySnapshot {
  const dto = readSnapshotDto()
  return { ...dto, compartments: new Map(dto.compartments.map((c) => [c.key, c])) }
}

export function isInventoryEmpty(): boolean {
  const row = getDb()
    .prepare('SELECT (SELECT count(*) FROM drawer_units) + (SELECT count(*) FROM pieces) AS total')
    .get() as { total: number }
  return row.total === 0
}

// ---------- Writes ----------

export function upsertUnit(unit: DrawerUnit): void {
  getDb()
    .prepare(
      `INSERT INTO drawer_units (id, name, row_count, col_count, sort_order)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name, row_count = excluded.row_count,
         col_count = excluded.col_count, sort_order = excluded.sort_order`,
    )
    .run(unit.id, unit.name, unit.rows, unit.cols, unit.order)
}

export function deleteUnitRow(unitId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM compartments WHERE unit_id = ?').run(unitId)
  db.prepare('DELETE FROM drawer_units WHERE id = ?').run(unitId)
}

export function upsertCompartment(record: CompartmentRecord): void {
  getDb()
    .prepare(
      `INSERT INTO compartments (key, unit_id, idx, partition_count, partitions_full)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET
         partition_count = excluded.partition_count, partitions_full = excluded.partitions_full`,
    )
    .run(
      record.key,
      record.unitId,
      record.index,
      record.partitionCount,
      JSON.stringify(record.partitionsFull),
    )
}

export function upsertPiece(piece: Piece): void {
  getDb()
    .prepare(
      `INSERT INTO pieces (
         id, description, part_number, color_source, color_id, color_name, color_rgb,
         quantity, unit_id, compartment_index, partition_index, notes, added_at,
         catalog_matched, image_url
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         description = excluded.description, part_number = excluded.part_number,
         color_source = excluded.color_source, color_id = excluded.color_id,
         color_name = excluded.color_name, color_rgb = excluded.color_rgb,
         quantity = excluded.quantity, unit_id = excluded.unit_id,
         compartment_index = excluded.compartment_index, partition_index = excluded.partition_index,
         notes = excluded.notes, catalog_matched = excluded.catalog_matched,
         image_url = excluded.image_url`,
    )
    // `node:sqlite` refuses to bind `undefined`, and a piece can legitimately
    // arrive with fields the older browser-stored schema never had (it predates
    // piece photos), so every nullable column is normalized here rather than
    // trusting the caller.
    .run(
      piece.id,
      piece.description,
      piece.partNumber,
      piece.color.source,
      piece.color.source === 'palette' ? (piece.color.id ?? null) : null,
      piece.color.name,
      piece.color.source === 'palette' ? (piece.color.rgb ?? null) : null,
      piece.quantity,
      piece.unitId,
      piece.compartmentIndex,
      piece.partitionIndex,
      piece.notes ?? '',
      piece.addedAt,
      piece.catalogMatched ? 1 : 0,
      piece.imageUrl ?? null,
    )
}

export function deletePieceRow(pieceId: string): void {
  getDb().prepare('DELETE FROM pieces WHERE id = ?').run(pieceId)
}

export function insertMovement(entry: MovementEntry): void {
  getDb()
    .prepare(
      `INSERT INTO movement_log (id, timestamp, type, piece_description, detail, locations)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.id,
      entry.timestamp,
      entry.type,
      entry.pieceDescription,
      entry.detail,
      JSON.stringify(entry.locations),
    )
}
