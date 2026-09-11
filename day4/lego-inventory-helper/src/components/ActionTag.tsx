import type { MovementType } from '../types'

const TAGS: Record<MovementType, { label: string; icon: string; className: string }> = {
  add: { label: 'add', icon: '＋', className: 'text-success border-success/40 bg-success/10' },
  extract: { label: 'extract', icon: '−', className: 'text-warning border-warning/40 bg-warning/10' },
  move: { label: 'move', icon: '⇄', className: 'text-info border-info/40 bg-info/10' },
  edit: { label: 'edit', icon: '✎', className: 'text-edit border-edit/40 bg-edit/10' },
  delete: { label: 'delete', icon: '🗑', className: 'text-danger border-danger/40 bg-danger/10' },
}

export function ActionTag({ type }: { type: MovementType }) {
  const tag = TAGS[type]
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold ${tag.className}`}
    >
      <span aria-hidden="true">{tag.icon}</span>
      {tag.label}
    </span>
  )
}
