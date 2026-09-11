const DB_NAME = 'lego-inventory'
const DB_VERSION = 3

let dbPromise = null

export function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onblocked = () => {
      reject(new Error('Database upgrade blocked — close this app in any other open tab and reload.'))
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('drawerUnits')) {
        db.createObjectStore('drawerUnits', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('compartments')) {
        db.createObjectStore('compartments', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('pieces')) {
        db.createObjectStore('pieces', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('log')) {
        const log = db.createObjectStore('log', { keyPath: 'id' })
        log.createIndex('byTimestamp', 'timestamp')
      }
      if (!db.objectStoreNames.contains('catalogParts')) {
        db.createObjectStore('catalogParts', { keyPath: 'part_num' })
      }
      if (!db.objectStoreNames.contains('catalogColors')) {
        db.createObjectStore('catalogColors', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('catalogElements')) {
        db.createObjectStore('catalogElements', { keyPath: 'part_num' })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // If another tab opens a newer version later, close this connection so
      // its upgrade isn't blocked indefinitely — better a closed handle we
      // reopen on next call than a silent hang.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function tx(storeNames, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode)
    const stores = Object.fromEntries(
      (Array.isArray(storeNames) ? storeNames : [storeNames]).map((name) => [name, t.objectStore(name)]),
    )
    let result
    Promise.resolve(fn(stores))
      .then((r) => {
        result = r
      })
      .catch((err) => {
        try {
          t.abort()
        } catch {
          /* already finishing */
        }
        reject(err)
      })
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error('Transaction aborted'))
  })
}

export function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function getAll(store) {
  return reqToPromise(store.getAll())
}

export function get(store, key) {
  return reqToPromise(store.get(key))
}

export function put(store, value) {
  return reqToPromise(store.put(value))
}

export function del(store, key) {
  return reqToPromise(store.delete(key))
}

export function count(store) {
  return reqToPromise(store.count())
}
