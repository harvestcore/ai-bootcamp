import { api } from './lib/api.ts'
import { deleteLegacyDatabase, readLegacyInventory } from './lib/legacyBrowserData.ts'
import { importLegacyInventory, loadAll } from './lib/store.ts'

/**
 * Startup: make sure the local server has finished importing the catalog into
 * SQLite, hand over anything the old browser-stored version left behind, then
 * load the inventory. Runs exactly once per page load even though React's
 * StrictMode deliberately runs effects twice in development.
 */

const listeners = new Set<(message: string) => void>()
let lastMessage = 'Starting up…'
let bootPromise: Promise<void> | null = null

export function onBootProgress(listener: (message: string) => void): () => void {
  listeners.add(listener)
  listener(lastMessage)
  return () => listeners.delete(listener)
}

function report(message: string) {
  lastMessage = message
  for (const listener of listeners) listener(message)
}

export function boot(): Promise<void> {
  bootPromise ??= run()
  return bootPromise
}

const POLL_INTERVAL_MS = 500

async function run(): Promise<void> {
  if (await removeObsoleteServiceWorker()) {
    // A reload is already on its way in; keep the loading screen up.
    return new Promise<void>(() => {})
  }

  report('Connecting to your local database…')
  const status = await waitUntilReady()

  if (status.inventoryEmpty) await handOverLegacyData()

  report('Loading your inventory…')
  await loadAll()
}

/**
 * Set when the hand-over from the old browser storage failed. The data is
 * still in IndexedDB (the import is one transaction — it either lands whole or
 * not at all), so the app carries on and says so instead of refusing to start.
 */
let legacyImportError: string | null = null

export function getLegacyImportError(): string | null {
  return legacyImportError
}

async function waitUntilReady() {
  for (;;) {
    const status = await api.status()
    if (status.error) throw new Error(status.error)
    if (status.ready) return status
    report(status.message)
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function handOverLegacyData(): Promise<void> {
  const legacy = await readLegacyInventory()
  if (!legacy) return
  report('Moving your existing inventory into the database…')
  try {
    const outcome = await importLegacyInventory(legacy)
    if (outcome.imported) {
      console.log(`Imported ${outcome.pieces} piece entries from the old browser storage.`)
      // Only now, once the database has it: deleting first would risk losing it.
      deleteLegacyDatabase()
    }
  } catch (error) {
    legacyImportError = error instanceof Error ? error.message : String(error)
    console.error('Could not import the old browser-stored inventory:', error)
  }
}

/**
 * Earlier versions were an offline PWA and registered a service worker that
 * serves same-origin GETs cache-first. That worker would now intercept the API
 * as well and answer from a stale cache, so any browser still carrying one has
 * to be cleaned up. Unregistering alone isn't enough while it is actively
 * controlling the page — it keeps intercepting this document's own requests
 * until the page unloads — so when one is in control we force exactly one
 * reload and the next load has no controller at all.
 */
async function removeObsoleteServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const registrations = await navigator.serviceWorker.getRegistrations()
  const hadController = !!navigator.serviceWorker.controller
  if (registrations.length === 0 && !hadController) return false

  await Promise.all(registrations.map((registration) => registration.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  if (hadController) {
    location.reload()
    return true
  }
  return false
}
