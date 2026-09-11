import type { CatalogColor, CatalogPart, InventorySnapshotDto } from '../types.ts'

/**
 * Thin client for the local API (see `server/api.ts`). The data lives in a
 * SQLite file on this machine; the browser only ever holds a copy of it for
 * rendering.
 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init)
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export interface ServerStatus {
  /** False while the catalog is still being imported into SQLite. */
  ready: boolean
  message: string
  error: string | null
  inventoryEmpty: boolean
  dbPath: string
}

export interface ActionResponse<T> {
  snapshot: InventorySnapshotDto
  result: T
}

export const api = {
  status: () => request<ServerStatus>('/status'),

  inventory: () => request<InventorySnapshotDto>('/inventory'),

  action: <T = undefined>(name: string, input: unknown = {}) =>
    request<ActionResponse<T>>(`/actions/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),

  lookupPart: (partNumber: string) =>
    request<{ part: CatalogPart | null }>(
      `/catalog/part?number=${encodeURIComponent(partNumber)}`,
    ).then((body) => body.part),

  colorsForPart: (partNumber: string) =>
    request<{ colors: CatalogColor[] }>(
      `/catalog/colors?part=${encodeURIComponent(partNumber)}`,
    ).then((body) => body.colors),

  searchParts: (query: string) =>
    request<{ parts: CatalogPart[] }>(`/catalog/search?q=${encodeURIComponent(query)}`).then(
      (body) => body.parts,
    ),
}
