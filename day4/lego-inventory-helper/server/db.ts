import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The one SQLite database file. Everything the app knows lives here — the
 * inventory *and* the imported Rebrickable catalog — so the whole state of the
 * app is a single file you can copy, back up or inspect with any SQLite tool.
 *
 * Uses Node's built-in `node:sqlite`: no native module to compile, no npm
 * dependency at all.
 */

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const DB_PATH = process.env.LEGO_DB_PATH
  ? resolve(process.env.LEGO_DB_PATH)
  : resolve(projectRoot, 'data', 'inventory.sqlite')

export const CATALOG_DIR = process.env.LEGO_CATALOG_DIR
  ? resolve(process.env.LEGO_CATALOG_DIR)
  : resolve(projectRoot, 'catalog')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drawer_units (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  row_count  INTEGER NOT NULL,
  col_count  INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

-- Only compartments that have been subdivided or marked full get a row; an
-- untouched compartment is implied (1 partition, not full). Occupancy is never
-- stored: it is derived from the pieces table.
CREATE TABLE IF NOT EXISTS compartments (
  key             TEXT PRIMARY KEY,
  unit_id         TEXT NOT NULL,
  idx             INTEGER NOT NULL,
  partition_count INTEGER NOT NULL,
  partitions_full TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pieces (
  id                TEXT PRIMARY KEY,
  description       TEXT NOT NULL,
  part_number       TEXT NOT NULL,
  color_source      TEXT NOT NULL CHECK (color_source IN ('palette', 'other')),
  color_id          INTEGER,
  color_name        TEXT NOT NULL,
  color_rgb         TEXT,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  unit_id           TEXT NOT NULL,
  compartment_index INTEGER NOT NULL,
  partition_index   INTEGER NOT NULL,
  notes             TEXT NOT NULL DEFAULT '',
  added_at          TEXT NOT NULL,
  catalog_matched   INTEGER NOT NULL,
  image_url         TEXT
);
CREATE INDEX IF NOT EXISTS pieces_by_location ON pieces (unit_id, compartment_index);

CREATE TABLE IF NOT EXISTS movement_log (
  id                TEXT PRIMARY KEY,
  timestamp         TEXT NOT NULL,
  type              TEXT NOT NULL,
  piece_description TEXT NOT NULL,
  detail            TEXT NOT NULL,
  locations         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS movement_log_by_time ON movement_log (timestamp DESC);

-- ----- Imported Rebrickable catalog -----

CREATE TABLE IF NOT EXISTS catalog_parts (
  part_num TEXT PRIMARY KEY,
  name     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_colors (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  rgb       TEXT NOT NULL,
  is_trans  INTEGER NOT NULL,
  num_parts INTEGER NOT NULL
);

-- Which colors a part actually exists in, and the photo for that exact
-- part+color combination (Rebrickable's CDN URL, from inventory_parts.csv).
CREATE TABLE IF NOT EXISTS catalog_part_colors (
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  img_url  TEXT,
  PRIMARY KEY (part_num, color_id)
) WITHOUT ROWID;
`

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db) return db
  mkdirSync(dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  // WAL keeps reads from blocking the long catalog import; foreign_keys is off
  // by default in SQLite and this schema doesn't declare any, so integrity is
  // enforced in the actions layer instead.
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec(SCHEMA)
  return db
}

/** Runs `fn` in a transaction, rolling back if it throws. */
export function transaction<T>(fn: () => T): T {
  const database = getDb()
  database.exec('BEGIN')
  try {
    const result = fn()
    database.exec('COMMIT')
    return result
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}
