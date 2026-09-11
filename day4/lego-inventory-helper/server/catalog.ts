import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { CATALOG_DIR, getDb, getMeta, setMeta, transaction } from './db.ts'
import { splitCsvLine } from './csv.ts'
import type { CatalogColor, CatalogPart } from '../src/types.ts'

/**
 * Imports Rebrickable's free CSV download into the same SQLite file as the
 * inventory, once. Only three of the bundled files matter (see
 * `catalog/CATALOG.md`):
 *   - parts.csv            part_num -> official name
 *   - colors.csv           the palette
 *   - inventory_parts.csv  which colors each part exists in, plus the photo URL
 *                          for that exact part+color (Rebrickable's CDN, no API
 *                          key needed)
 *
 * The files are read as a stream: inventory_parts.csv is ~127 MB / 1.5M rows
 * and must never be pulled into memory as one string.
 */

const CATALOG_VERSION = '4'

export interface CatalogStatus {
  ready: boolean
  message: string
  error: string | null
}

let status: CatalogStatus = { ready: false, message: 'Starting up…', error: null }
let importStarted = false

export function getCatalogStatus(): CatalogStatus {
  return status
}

/** Kicks the import off in the background; returns immediately. */
export function ensureCatalogImported(): void {
  if (importStarted) return
  importStarted = true

  if (getMeta('catalogVersion') === CATALOG_VERSION) {
    status = { ready: true, message: 'Ready', error: null }
    return
  }

  runImport().then(
    () => {
      setMeta('catalogVersion', CATALOG_VERSION)
      status = { ready: true, message: 'Ready', error: null }
      console.log('[catalog] import finished')
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      status = { ready: false, message: 'Catalog import failed', error: message }
      console.error('[catalog] import failed:', error)
    },
  )
}

function report(message: string) {
  status = { ready: false, message, error: null }
  console.log(`[catalog] ${message}`)
}

function catalogFile(name: string): string {
  const path = resolve(CATALOG_DIR, name)
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${name} in ${CATALOG_DIR}. Download the CSVs from https://rebrickable.com/downloads/ into that folder.`,
    )
  }
  return path
}

/** Streams a CSV file, calling `onRow` with a column-name -> value accessor. */
async function forEachRow(
  name: string,
  onRow: (get: (column: string) => string) => void,
): Promise<void> {
  const stream = createReadStream(catalogFile(name), { encoding: 'utf8' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let header: string[] | null = null
  const columnIndex = new Map<string, number>()

  for await (const line of lines) {
    if (!line) continue
    const fields = splitCsvLine(line)
    if (!header) {
      header = fields
      header.forEach((column, i) => columnIndex.set(column, i))
      continue
    }
    onRow((column) => fields[columnIndex.get(column) ?? -1] ?? '')
  }
}

async function runImport(): Promise<void> {
  const db = getDb()

  report('Importing parts…')
  const parts: [string, string][] = []
  await forEachRow('parts.csv', (get) => parts.push([get('part_num'), get('name')]))
  transaction(() => {
    db.exec('DELETE FROM catalog_parts')
    const insert = db.prepare('INSERT OR REPLACE INTO catalog_parts (part_num, name) VALUES (?, ?)')
    for (const [partNum, name] of parts) insert.run(partNum, name)
  })

  report('Importing colors…')
  const colors: [number, string, string, number, number][] = []
  await forEachRow('colors.csv', (get) => {
    const id = Number(get('id'))
    if (!Number.isFinite(id) || id < 0) return // skip Rebrickable's "[Unknown]" placeholder
    colors.push([
      id,
      get('name'),
      `#${get('rgb')}`,
      get('is_trans') === 'True' ? 1 : 0,
      Number(get('num_parts')) || 0,
    ])
  })
  transaction(() => {
    db.exec('DELETE FROM catalog_colors')
    const insert = db.prepare(
      'INSERT OR REPLACE INTO catalog_colors (id, name, rgb, is_trans, num_parts) VALUES (?, ?, ?, ?, ?)',
    )
    for (const row of colors) insert.run(...row)
  })

  report('Importing part/color availability (large file, first run only)…')
  // 1.5M rows collapse to one entry per part+color; the first photo URL seen for
  // a combination wins (they're all the same image on Rebrickable's side).
  const byPart = new Map<string, Map<number, string | null>>()
  await forEachRow('inventory_parts.csv', (get) => {
    const partNum = get('part_num')
    const colorId = Number(get('color_id'))
    if (!partNum || !Number.isFinite(colorId) || colorId < 0) return
    let colorsForPart = byPart.get(partNum)
    if (!colorsForPart) {
      colorsForPart = new Map()
      byPart.set(partNum, colorsForPart)
    }
    if (!colorsForPart.get(colorId)) colorsForPart.set(colorId, get('img_url') || null)
  })

  report('Saving part/color availability…')
  transaction(() => {
    db.exec('DELETE FROM catalog_part_colors')
    const insert = db.prepare(
      'INSERT OR REPLACE INTO catalog_part_colors (part_num, color_id, img_url) VALUES (?, ?, ?)',
    )
    for (const [partNum, colorsForPart] of byPart) {
      for (const [colorId, imgUrl] of colorsForPart) insert.run(partNum, colorId, imgUrl)
    }
  })
}

// ---------- Queries ----------

export function lookupPart(partNumber: string): CatalogPart | null {
  const trimmed = partNumber.trim()
  if (!trimmed) return null
  const row = getDb()
    .prepare('SELECT part_num, name FROM catalog_parts WHERE part_num = ?')
    .get(trimmed) as CatalogPart | undefined
  return row ? { part_num: row.part_num, name: row.name } : null
}

function toCatalogColor(row: {
  id: number
  name: string
  rgb: string
  is_trans: number
  num_parts: number
}): CatalogColor {
  return {
    id: row.id,
    name: row.name,
    rgb: row.rgb,
    isTrans: row.is_trans === 1,
    numParts: row.num_parts,
  }
}

type ColorRow = { id: number; name: string; rgb: string; is_trans: number; num_parts: number }

export function getPalette(): CatalogColor[] {
  const rows = getDb()
    .prepare('SELECT * FROM catalog_colors ORDER BY num_parts DESC')
    .all() as unknown as ColorRow[]
  return rows.map(toCatalogColor)
}

/**
 * The palette narrowed to the colors this part is known to exist in, falling
 * back to the whole palette when there's nothing on record for it.
 */
export function getColorsForPart(partNumber: string): CatalogColor[] {
  const trimmed = partNumber.trim()
  if (!trimmed) return getPalette()
  const rows = getDb()
    .prepare(
      `SELECT c.* FROM catalog_colors c
       JOIN catalog_part_colors pc ON pc.color_id = c.id
       WHERE pc.part_num = ?
       ORDER BY c.num_parts DESC`,
    )
    .all(trimmed) as unknown as ColorRow[]
  return rows.length ? rows.map(toCatalogColor) : getPalette()
}

export function getImageForPartColor(partNumber: string, colorId: number | null): string | null {
  if (colorId == null) return null
  const row = getDb()
    .prepare('SELECT img_url FROM catalog_part_colors WHERE part_num = ? AND color_id = ?')
    .get(partNumber.trim(), colorId) as { img_url: string | null } | undefined
  return row?.img_url ?? null
}

/**
 * Ranked catalog search. An exact part number wins, then name/number prefixes,
 * then anything containing the query — the same ranking the in-memory version
 * used, expressed as SQL so the 64k-row table never has to be loaded.
 */
export function searchParts(query: string, limit = 20): CatalogPart[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const prefix = `${q}%`
  const infix = `%${q}%`
  const rows = getDb()
    .prepare(
      `SELECT part_num, name,
         CASE
           WHEN lower(part_num) = ?        THEN 0
           WHEN lower(name) LIKE ?         THEN 1
           WHEN lower(part_num) LIKE ?     THEN 2
           WHEN lower(name) LIKE ?         THEN 3
           ELSE 4
         END AS score
       FROM catalog_parts
       WHERE lower(name) LIKE ? OR lower(part_num) LIKE ?
       ORDER BY score, name
       LIMIT ?`,
    )
    .all(q, prefix, prefix, infix, infix, infix, limit) as unknown as CatalogPart[]
  return rows.map((row) => ({ part_num: row.part_num, name: row.name }))
}
