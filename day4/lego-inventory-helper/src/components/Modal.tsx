import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Card } from './ui'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  // `offsetParent` is null for anything display:none — the steps the wizard
  // isn't showing are unmounted, but a collapsed suggestion list isn't.
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/**
 * A real modal dialog: the page behind it is dimmed, cannot scroll and cannot be
 * reached with Tab. Unlike `ConfirmDialog` (two buttons, nowhere for focus to
 * get lost) this one hosts a whole form, so it traps focus for real, gives it
 * back to whatever opened it, and scroll-locks the body.
 *
 * Rendered through a portal on `document.body`, so it escapes the page's
 * stacking and sits above the sticky header and the mobile tab bar (both z-30).
 *
 * The overlay is the scroller, not the panel: a tall wizard scrolls inside the
 * modal without clipping anything absolutely positioned in it (the part-search
 * suggestion dropdown).
 */
export function Modal({
  labelledBy,
  onRequestClose,
  children,
}: {
  /** Id of the heading inside `children` that names the dialog. */
  labelledBy: string
  /** Escape, a backdrop click, or the dialog's own close control. */
  onRequestClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRequestClose])

  // Focus goes in on open and back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // `preventScroll`: the first control is at the top of a modal that has just
    // appeared, so there is nothing to scroll to — and without it the browser
    // scrolls the page *behind* the modal to reveal it.
    focusable(panel.current)[0]?.focus({ preventScroll: true })
    return () => opener?.focus?.()
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  function trapTab(e: ReactKeyboardEvent) {
    if (e.key !== 'Tab') return
    const stops = focusable(panel.current)
    if (stops.length === 0) return
    const first = stops[0]!
    const last = stops[stops.length - 1]!
    const active = document.activeElement
    if (e.shiftKey && (active === first || !panel.current?.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" onKeyDown={trapTab}>
      <div
        className="flex min-h-full items-start justify-center sm:p-4"
        // Only a press that lands on the backdrop itself closes: a click that
        // starts inside the panel (a suggestion, a swatch, a compartment) never
        // reaches this element.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onRequestClose()
        }}
      >
        <Card ref={panel} className="w-full max-w-xl rounded-none p-4 sm:rounded-card">
          <div role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
            {children}
          </div>
        </Card>
      </div>
    </div>,
    document.body,
  )
}
