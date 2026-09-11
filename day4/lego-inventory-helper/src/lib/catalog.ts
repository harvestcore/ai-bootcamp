import { api } from './api.ts'
import type { CatalogColor, CatalogPart } from '../types.ts'

/**
 * Catalog lookups. The catalog itself lives in the SQLite database next to the
 * inventory and is queried with SQL on the server — the browser no longer holds
 * 64k parts in memory just to search them.
 *
 * Results are memoized per part number because the Add/Edit forms ask the same
 * questions on every keystroke (already debounced upstream).
 */

const partCache = new Map<string, CatalogPart | null>()
const colorCache = new Map<string, CatalogColor[]>()

export async function lookupPartByNumber(partNumber: string): Promise<CatalogPart | null> {
  const key = partNumber.trim()
  if (!key) return null
  const cached = partCache.get(key)
  if (cached !== undefined) return cached
  const part = await api.lookupPart(key)
  partCache.set(key, part)
  return part
}

export async function getAvailableColorsForPart(partNumber: string): Promise<CatalogColor[]> {
  const key = partNumber.trim()
  const cached = colorCache.get(key)
  if (cached) return cached
  const colors = await api.colorsForPart(key)
  colorCache.set(key, colors)
  return colors
}

export function searchCatalogParts(query: string): Promise<CatalogPart[]> {
  return api.searchParts(query)
}
