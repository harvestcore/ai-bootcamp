import { useEffect } from 'react'
import { Button, Card } from './ui'
import type { ReactNode } from 'react'

/**
 * Destructive actions ask once, properly. (The previous version turned the
 * button itself into "Confirm delete?", which is easy to hit twice by accident.)
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  title: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <Card className="w-full max-w-sm p-5" >
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {children ? <div className="mt-2 text-sm text-ink-muted">{children}</div> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
