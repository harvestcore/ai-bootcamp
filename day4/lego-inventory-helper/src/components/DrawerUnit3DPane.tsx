import { Component, Suspense, lazy, useState, type ReactNode } from 'react'
import { Button } from './ui'
import type { InventorySnapshot } from '../lib/inventory'
import type { DrawerUnit } from '../types'

/**
 * Everything around the 3D scene that must not drag `three` into the bundle:
 * the WebGL check, the lazy import, the loading state and the fallback for a
 * browser that cannot render it. Nothing here imports `three` — the page
 * imports this file directly, and only the scene itself is code-split.
 */

const DrawerUnit3D = lazy(() =>
  import('./DrawerUnit3D').then((module) => ({ default: module.DrawerUnit3D })),
)

/** Asked before the chunk is fetched: no point downloading three for nothing. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function DrawerUnit3DPane({
  unit,
  snapshot,
  selectedIndex,
  onSelect,
  onBackToGrid,
}: {
  unit: DrawerUnit
  snapshot: InventorySnapshot
  selectedIndex: number | null
  onSelect: (index: number) => void
  /** Switches the page back to the grid, dropping `view=3d` from the URL. */
  onBackToGrid: () => void
}) {
  const [supported] = useState(hasWebGL)
  const [broken, setBroken] = useState(false)

  return (
    <div className="relative h-[22rem] w-full overflow-hidden rounded-lg sm:h-[26rem] lg:h-[28rem] lg:w-[34rem]">
      {!supported || broken ? (
        <Unavailable onBackToGrid={onBackToGrid} />
      ) : (
        <SceneBoundary onError={() => setBroken(true)}>
          <Suspense fallback={<PaneMessage>Loading 3D…</PaneMessage>}>
            <DrawerUnit3D
              unit={unit}
              snapshot={snapshot}
              selectedIndex={selectedIndex}
              onSelect={onSelect}
              onContextLost={() => setBroken(true)}
            />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  )
}

function PaneMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg bg-sunken px-6 text-center text-sm text-ink-muted">
      {children}
    </div>
  )
}

function Unavailable({ onBackToGrid }: { onBackToGrid: () => void }) {
  return (
    <PaneMessage>
      <p className="text-ink">3D isn't available in this browser.</p>
      <Button className="min-h-11" onClick={onBackToGrid}>
        Back to the grid
      </Button>
    </PaneMessage>
  )
}

/**
 * Creating the WebGL context can throw during render (a blocked or crashed GPU
 * process), which would otherwise blank the whole page. Caught here so the pane
 * — and only the pane — degrades to the message above.
 */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
