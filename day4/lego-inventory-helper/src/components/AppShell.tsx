import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../lib/cn'
import { getLegacyImportError } from '../boot'
import { exportInventory } from '../lib/store'

const NAV = [
  { to: '/', label: 'Drawers', icon: '🗄️', end: true },
  { to: '/pieces', label: 'Pieces', icon: '🧱', end: false },
  { to: '/add', label: 'Add piece', short: 'Add', icon: '➕', end: false },
  { to: '/log', label: 'History', icon: '🕘', end: false },
  { to: '/setup', label: 'Setup', icon: '⚙️', end: false },
]

/**
 * The frame every screen renders inside: one persistent header (and, on
 * phones, a thumb-reachable tab bar) instead of each screen inventing its own
 * back-link. Navigation stays in the same place no matter where you are.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-ink">
            <span aria-hidden="true">🧱</span>
            <span>LEGO Inventory</span>
          </NavLink>

          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-soft text-ink' : 'text-ink-muted hover:bg-sunken hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <ExportButton />
          </nav>

          <div className="ml-auto sm:hidden">
            <ExportButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 sm:pb-10">
        <LegacyImportWarning />
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
                  isActive ? 'text-ink' : 'text-ink-muted',
                )
              }
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {item.icon}
              </span>
              {/* The tab bar has five slots on a phone: some labels need a shorter form. */}
              {'short' in item ? item.short : item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/**
 * Shown only when the one-time hand-over from the old browser storage failed.
 * Nothing was lost — the import is all-or-nothing — but the user needs to know
 * their old inventory hasn't arrived rather than assume it's gone.
 */
function LegacyImportWarning() {
  const error = getLegacyImportError()
  if (!error) return null
  return (
    <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink">
      <strong>Your previous inventory couldn't be imported.</strong> It is still saved in this
      browser and nothing was deleted, so nothing is lost — but this app is now reading an empty
      database. Details: {error}
    </div>
  )
}

function ExportButton() {
  function download() {
    const data = exportInventory()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lego-inventory-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      title="Export the whole inventory as a JSON file"
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      ⬇ Export
    </button>
  )
}
