import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Button } from './components/ui'
import { boot, onBootProgress } from './boot'
import { AddPiecePage } from './pages/AddPiecePage'
import { DrawerSetupPage } from './pages/DrawerSetupPage'
import { DrawerUnitPage } from './pages/DrawerUnitPage'
import { EditPiecePage } from './pages/EditPiecePage'
import { HomePage } from './pages/HomePage'
import { MovementLogPage } from './pages/MovementLogPage'

export function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('Starting up…')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const stopListening = onBootProgress(setMessage)
    boot().then(
      () => setStatus('ready'),
      (err: unknown) => {
        console.error(err)
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      },
    )
    return stopListening
  }, [])

  if (status === 'error') return <BootError message={error} />
  if (status === 'loading') return <BootScreen message={message} />

  return (
    // Hash routing keeps every URL inside index.html, so the app still works
    // offline, from a file path, or from any subfolder — no server rewrites.
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="unit/:id" element={<DrawerUnitPage />} />
          <Route path="unit/:id/compartment/:index" element={<DrawerUnitPage />} />
          <Route path="add" element={<AddPiecePage />} />
          <Route path="edit/:pieceId" element={<EditPiecePage />} />
          <Route path="log" element={<MovementLogPage />} />
          <Route path="setup" element={<DrawerSetupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

function BootFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  )
}

function BootScreen({ message }: { message: string }) {
  return (
    <BootFrame>
      <div className="mx-auto mb-4 text-4xl" aria-hidden="true">
        🧱
      </div>
      <h1 className="font-semibold text-ink">LEGO Inventory</h1>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-sunken">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-brand" />
      </div>
    </BootFrame>
  )
}

function BootError({ message }: { message: string }) {
  return (
    <BootFrame>
      <div className="mx-auto mb-4 text-4xl" aria-hidden="true">
        ⚠️
      </div>
      <h1 className="font-semibold text-ink">The catalog didn't load</h1>
      <p className="mt-2 text-sm text-ink-muted">{message}</p>
      <Button variant="primary" className="mt-5 w-full" onClick={() => location.reload()}>
        Try again
      </Button>
    </BootFrame>
  )
}
