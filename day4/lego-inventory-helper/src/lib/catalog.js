import { parseCsv } from './csv.js'
import { tx, get, getAll } from './db.js'

// The bundled catalog is Rebrickable's full free CSV download
// (https://rebrickable.com/downloads/), all of it kept under public/catalog/ for
// provenance. Only three files are actually indexed into IndexedDB on first launch:
//   - parts.csv          part_num -> official name
//   - colors.csv          the predefined color palette
//   - inventory_parts.csv real part+color combinations seen across every official
//                          set's inventory, aggregated to part_num -> [{colorId, imgUrl}].
//                          This is what powers "only show colors that exist for this
//                          piece" and real piece photos (img_url is Rebrickable's own
//                          CDN link — see the "images" note below).
// sets/themes/minifigs/inventories/inventory_sets/inventory_minifigs/part_relationships
// are bundled but unused: this app is a loose-parts inventory, not a set browser, and
// nothing in the spec needs set/theme/minifig data.
const META_KEY = 'catalogIndexed'
const CATALOG_VERSION = 3

// A `textContent` update made right before a long synchronous block (parsing
// hundreds of thousands of CSV rows) never actually paints — the browser only
// gets a chance to render between tasks, not mid-task. Yielding one macrotask
// after each progress message lets the user see it before the next freeze.
function yieldToUI() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function setProgress(onProgress, message) {
  onProgress?.(message)
  await yieldToUI()
}

export async function ensureCatalogIndexed(onProgress) {
  const already = await tx('meta', 'readonly', (s) => get(s.meta, META_KEY))
  if (already?.value === CATALOG_VERSION) return

  await setProgress(onProgress, 'Downloading part catalog…')
  const [partsText, colorsText] = await Promise.all([
    fetch('catalog/parts.csv').then((r) => r.text()),
    fetch('catalog/colors.csv').then((r) => r.text()),
  ])

  await setProgress(onProgress, 'Indexing parts…')
  const parts = parseCsv(partsText)
  const partNumIdx = parts.header.indexOf('part_num')
  const nameIdx = parts.header.indexOf('name')

  await tx('catalogParts', 'readwrite', (s) => {
    for (const row of parts.rows) {
      s.catalogParts.put({ part_num: row[partNumIdx], name: row[nameIdx] })
    }
  })

  await setProgress(onProgress, 'Indexing colors…')
  const colors = parseCsv(colorsText)
  const colIdIdx = colors.header.indexOf('id')
  const colNameIdx = colors.header.indexOf('name')
  const colRgbIdx = colors.header.indexOf('rgb')
  const colTransIdx = colors.header.indexOf('is_trans')
  const colNumPartsIdx = colors.header.indexOf('num_parts')

  await tx('catalogColors', 'readwrite', (s) => {
    for (const row of colors.rows) {
      const id = Number(row[colIdIdx])
      if (id < 0) continue // skip Rebrickable's "[Unknown]" placeholder color
      s.catalogColors.put({
        id,
        name: row[colNameIdx],
        rgb: `#${row[colRgbIdx]}`,
        isTrans: row[colTransIdx] === 'True',
        numParts: Number(row[colNumPartsIdx]) || 0,
      })
    }
  })

  await setProgress(onProgress, 'Downloading part/color availability (large file, first launch only)…')
  const inventoryPartsText = await fetch('catalog/inventory_parts.csv').then((r) => r.text())

  await setProgress(onProgress, 'Indexing part/color availability (this can take up to a minute)…')
  const inventoryParts = parseCsv(inventoryPartsText)
  const ipPartIdx = inventoryParts.header.indexOf('part_num')
  const ipColorIdx = inventoryParts.header.indexOf('color_id')
  const ipImgIdx = inventoryParts.header.indexOf('img_url')
  const colorsByPart = new Map()
  for (const row of inventoryParts.rows) {
    const partNum = row[ipPartIdx]
    const colorId = Number(row[ipColorIdx])
    if (!partNum || Number.isNaN(colorId) || colorId < 0) continue
    let byColor = colorsByPart.get(partNum)
    if (!byColor) {
      byColor = new Map()
      colorsByPart.set(partNum, byColor)
    }
    if (!byColor.get(colorId)) {
      byColor.set(colorId, row[ipImgIdx] || null)
    }
  }
  await tx('catalogElements', 'readwrite', (s) => {
    for (const [partNum, byColor] of colorsByPart) {
      const colors = [...byColor].map(([colorId, imgUrl]) => ({ colorId, imgUrl }))
      s.catalogElements.put({ part_num: partNum, colors })
    }
  })

  await tx('meta', 'readwrite', (s) => {
    s.meta.put({ key: META_KEY, value: CATALOG_VERSION })
  })

  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {})
  }
}

export async function lookupPartByNumber(partNumber) {
  if (!partNumber) return null
  const trimmed = partNumber.trim()
  if (!trimmed) return null
  return tx('catalogParts', 'readonly', (s) => get(s.catalogParts, trimmed))
}

let paletteCache = null
export async function getColorPalette() {
  if (paletteCache) return paletteCache
  const all = await tx('catalogColors', 'readonly', (s) => getAll(s.catalogColors))
  all.sort((a, b) => b.numParts - a.numParts)
  paletteCache = all
  return paletteCache
}

async function getElementsRecord(partNumber) {
  if (!partNumber?.trim()) return null
  return tx('catalogElements', 'readonly', (s) => get(s.catalogElements, partNumber.trim()))
}

// Which colors actually exist for a given part, per every official set inventory
// Rebrickable has on record. Returns null when there's no availability data for
// this part (not in the catalog, or never recorded in any set) — callers should
// fall back to the full palette in that case rather than blocking color selection.
export async function getColorIdsForPart(partNumber) {
  const record = await getElementsRecord(partNumber)
  return record?.colors?.length ? record.colors.map((c) => c.colorId) : null
}

// Real piece photo for a specific part+color combination, from Rebrickable's own
// CDN (bundled for free in inventory_parts.csv — no API key needed). Returns null
// when there's no recorded photo for this exact combination; callers should fall
// back to the generic placeholder in that case.
export async function getImageForPartColor(partNumber, colorId) {
  if (colorId == null) return null
  const record = await getElementsRecord(partNumber)
  return record?.colors.find((c) => c.colorId === colorId)?.imgUrl ?? null
}

// Full palette filtered down to only the colors that exist for `partNumber`,
// falling back to the full palette when there's no per-part data to filter by.
export async function getAvailableColorsForPart(partNumber) {
  const palette = await getColorPalette()
  const colorIds = await getColorIdsForPart(partNumber)
  if (!colorIds) return palette
  const idSet = new Set(colorIds)
  const filtered = palette.filter((c) => idSet.has(c.id))
  return filtered.length ? filtered : palette
}

let partsCache = null
async function getAllParts() {
  if (partsCache) return partsCache
  partsCache = await tx('catalogParts', 'readonly', (s) => getAll(s.catalogParts))
  return partsCache
}

// Simple ranked substring search over the bundled parts catalog, used by the
// part-search autocomplete in Add/Edit piece. Matches on name or part number.
export async function searchCatalogParts(query, limit = 20) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const all = await getAllParts()
  const scored = []
  for (const part of all) {
    const name = part.name.toLowerCase()
    const num = part.part_num.toLowerCase()
    let score
    if (num === q) score = 0
    else if (name.startsWith(q)) score = 1
    else if (num.startsWith(q)) score = 2
    else if (name.includes(q)) score = 3
    else if (num.includes(q)) score = 4
    else continue
    scored.push({ part, score })
  }
  scored.sort((a, b) => a.score - b.score || a.part.name.localeCompare(b.part.name))
  return scored.slice(0, limit).map((s) => s.part)
}
