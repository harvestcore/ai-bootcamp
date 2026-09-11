// Domain model shared by the whole app. The data itself lives in IndexedDB
// (see lib/db.ts) and is mirrored in memory by lib/store.ts.

/** A color picked from the bundled Rebrickable palette. */
export interface PaletteColor {
  source: 'palette'
  id: number
  name: string
  rgb: string
}

/** A free-text color the catalog doesn't know about ("Other…" in the picker). */
export interface CustomColor {
  source: 'other'
  name: string
}

export type PieceColor = PaletteColor | CustomColor

/** One physical drawer organizer: a rows x cols grid of compartments. */
export interface DrawerUnit {
  id: string
  name: string
  rows: number
  cols: number
  order: number
}

/**
 * Per-compartment settings. Created lazily the first time a compartment is
 * subdivided or marked full — a compartment with no record behaves as a single
 * undivided, not-full compartment. Occupancy is NOT stored here: it is derived
 * live from the pieces (see lib/inventory.ts#getCompartmentInfo).
 */
export interface CompartmentRecord {
  key: string
  unitId: string
  index: number
  partitionCount: number
  partitionsFull: boolean[]
}

export interface Piece {
  id: string
  /** Display name: the catalog's official part name, or `Part #<num>`. */
  description: string
  partNumber: string
  color: PieceColor
  quantity: number
  unitId: string
  compartmentIndex: number
  partitionIndex: number
  notes: string
  addedAt: string
  catalogMatched: boolean
  imageUrl: string | null
}

export type MovementType = 'add' | 'extract' | 'move' | 'edit' | 'delete'

export interface MovementLocation {
  unitId: string
  compartmentIndex: number
}

export interface MovementEntry {
  id: string
  timestamp: string
  type: MovementType
  pieceDescription: string
  detail: string
  /** A move carries both destination and origin, so filtering by either finds it. */
  locations: MovementLocation[]
}

/**
 * The whole inventory as it crosses the wire (and as the server hands it back
 * after every mutation). The client turns `compartments` into a Map for lookup;
 * JSON has no Map, hence the array here.
 */
export interface InventorySnapshotDto {
  units: DrawerUnit[]
  compartments: CompartmentRecord[]
  pieces: Piece[]
  /** Newest first. */
  log: MovementEntry[]
}

/** What the Add-piece form collects before a location is chosen. */
export interface PieceDraft {
  partNumber: string
  color: PieceColor | null
  quantity: number
  notes: string
}

// ----- Bundled catalog records (see lib/catalog.ts) -----

export interface CatalogPart {
  part_num: string
  name: string
}

export interface CatalogColor {
  id: number
  name: string
  rgb: string
  isTrans: boolean
  numParts: number
}

export interface CatalogElement {
  part_num: string
  colors: { colorId: number; imgUrl: string | null }[]
}
