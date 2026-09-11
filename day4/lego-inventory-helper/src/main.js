import { ensureCatalogIndexed } from './lib/catalog.js'
import { loadAll } from './lib/store.js'
import { defineRoute, setNotFoundHandler, init, navigate } from './router.js'
import * as home from './screens/home.js'
import * as drawerUnit from './screens/drawerUnit.js'
import * as addPiece from './screens/addPiece.js'
import * as editPiece from './screens/editPiece.js'
import * as movementLog from './screens/movementLog.js'
import * as drawerSetup from './screens/drawerSetup.js'

const appEl = document.getElementById('app')

// In `vite dev`, module paths (e.g. /src/lib/db.js) are unhashed, so a service
// worker registered during a previous dev session can go on serving stale JS
// indefinitely (cache-first) even after the files on disk change — including
// stale IndexedDB schema code, which surfaces as confusing "object store not
// found" errors that don't match the current source. Registering the SW only
// in production builds (see boot() below) prevents this going forward.
//
// Unregistering alone isn't enough to clean up an *already*-stale dev session:
// the old SW still controls (and keeps intercepting/re-caching fetches for) this
// document until it's fully unloaded, so anything short of a full reload here
// races the app's own module imports against the outgoing SW. If one is in
// control, force exactly one reload — the next load has no controller at all.
async function cleanUpStaleServiceWorker() {
  if (!('serviceWorker' in navigator)) return false
  const hadController = !!navigator.serviceWorker.controller
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((r) => r.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
  if (hadController) {
    location.reload()
    return true
  }
  return false
}

async function boot() {
  if (import.meta.env.DEV && (await cleanUpStaleServiceWorker())) {
    return // a reload is already on its way in; nothing left to do this round
  }

  appEl.innerHTML = `<div class="boot-screen"><p id="boot-status">Loading catalog…</p></div>`
  const statusEl = document.getElementById('boot-status')

  try {
    await ensureCatalogIndexed((msg) => {
      statusEl.textContent = msg
    })
    await loadAll()
  } catch (err) {
    console.error(err)
    appEl.innerHTML = `
      <div class="boot-screen boot-screen--error">
        <p>Something went wrong loading the catalog.</p>
        <p class="muted">${err?.message ?? err}</p>
        <button type="button" id="boot-retry" class="btn btn--primary">Reload</button>
      </div>
    `
    document.getElementById('boot-retry').addEventListener('click', () => location.reload())
    return
  }

  defineRoute('/', home.render)
  defineRoute('/unit/:id', drawerUnit.render)
  defineRoute('/unit/:id/compartment/:index', drawerUnit.render)
  defineRoute('/add', addPiece.render)
  defineRoute('/edit/:pieceId', editPiece.render)
  defineRoute('/log', movementLog.render)
  defineRoute('/setup', drawerSetup.render)
  setNotFoundHandler(() => navigate('/'))

  init(appEl)

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  }
}

boot()
