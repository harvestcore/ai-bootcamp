import type { CompartmentRecord, DrawerUnit, MovementEntry, Piece } from '../types.ts'

/**
 * Reads the inventory left behind by the previous version, which kept
 * everything in the browser's IndexedDB. Now that the data lives in a SQLite
 * file, this exists purely so nobody loses what they had: it is read once,
 * handed to the server (which only accepts it into an empty database), and
 * then the old browser database is deleted.
 */

const LEGACY_DB = 'lego-inventory'
const STORES = ['drawerUnits', 'compartments', 'pieces', 'log'] as const

export interface LegacyInventory {
  units: DrawerUnit[]
  compartments: CompartmentRecord[]
  pieces: Piece[]
  log: MovementEntry[]
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function legacyDbExists(): Promise<boolean> {
  if (!('indexedDB' in globalThis)) return false
  // Not in every browser, but where it is we avoid creating an empty database
  // just to find out there was nothing there.
  if (typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases()
    return databases.some((entry) => entry.name === LEGACY_DB)
  }
  return true
}

export async function readLegacyInventory(): Promise<LegacyInventory | null> {
  try {
    if (!(await legacyDbExists())) return null

    const open = indexedDB.open(LEGACY_DB)
    const db = await promisify(open)
    const hasEverything = STORES.every((name) => db.objectStoreNames.contains(name))
    if (!hasEverything) {
      db.close()
      return null
    }

    const tx = db.transaction(STORES as unknown as string[], 'readonly')
    const [units, compartments, pieces, log] = await Promise.all([
      promisify(tx.objectStore('drawerUnits').getAll() as IDBRequest<DrawerUnit[]>),
      promisify(tx.objectStore('compartments').getAll() as IDBRequest<CompartmentRecord[]>),
      promisify(tx.objectStore('pieces').getAll() as IDBRequest<Piece[]>),
      promisify(tx.objectStore('log').getAll() as IDBRequest<MovementEntry[]>),
    ])
    db.close()

    if (units.length === 0 && pieces.length === 0) return null
    return { units, compartments, pieces, log }
  } catch (error) {
    console.warn('Could not read the old browser-stored inventory:', error)
    return null
  }
}

export function deleteLegacyDatabase(): void {
  try {
    indexedDB.deleteDatabase(LEGACY_DB)
  } catch {
    /* nothing to clean up */
  }
}
