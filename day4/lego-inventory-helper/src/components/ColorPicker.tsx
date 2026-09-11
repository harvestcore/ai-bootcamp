import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { ColorSwatch } from './ColorSwatch'
import { Button, TextInput } from './ui'
import type { CatalogColor, PieceColor } from '../types'

/**
 * Colors are picked from a scannable list (swatch + name) rather than a grid of
 * bare circles — easier to scan and to tap, especially once the list is filtered
 * down to the colors a given part actually exists in.
 *
 * Once something is picked the list collapses to the current selection: leaving
 * every list permanently expanded reads as broken ("I picked one and it's all
 * still there"). Click the selection to reopen it.
 */
export function ColorPicker({
  colors,
  value,
  onChange,
}: {
  colors: CatalogColor[]
  value: PieceColor | null
  onChange: (color: PieceColor) => void
}) {
  const [expanded, setExpanded] = useState(!value)
  const [filter, setFilter] = useState('')
  const [customName, setCustomName] = useState(value?.source === 'other' ? value.name : '')
  const [customOpen, setCustomOpen] = useState(value?.source === 'other')

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return colors
    return colors.filter((c) => c.name.toLowerCase().includes(q))
  }, [colors, filter])

  if (!expanded && value) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:bg-sunken"
      >
        <ColorSwatch color={value} size={20} />
        <span className="flex-1 text-sm font-medium text-ink">
          {value.source === 'other' ? `${value.name || 'Custom color'} (custom)` : value.name}
        </span>
        <span className="text-xs font-medium text-link">Change</span>
      </button>
    )
  }

  function pick(color: PieceColor) {
    onChange(color)
    setExpanded(false)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {colors.length > 12 ? (
        <div className="border-b border-line p-2">
          <TextInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter colors…"
            className="border-transparent bg-sunken"
          />
        </div>
      ) : null}

      <div className="no-scrollbar max-h-64 overflow-y-auto">
        {visible.map((color) => {
          const selected = value?.source === 'palette' && value.id === color.id
          return (
            <button
              key={color.id}
              type="button"
              onClick={() =>
                pick({ source: 'palette', id: color.id, name: color.name, rgb: color.rgb })
              }
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-sunken',
                selected && 'bg-brand-soft font-semibold',
              )}
            >
              <ColorSwatch color={{ source: 'palette', id: color.id, name: color.name, rgb: color.rgb }} />
              <span className="flex-1 truncate text-ink">{color.name}</span>
              {selected ? <span aria-hidden="true">✓</span> : null}
            </button>
          )
        })}
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">No color matches that filter.</p>
        ) : null}

        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={cn(
            'flex w-full items-center gap-3 border-t border-line px-3 py-2 text-left text-sm hover:bg-sunken',
            value?.source === 'other' && 'bg-brand-soft font-semibold',
          )}
        >
          <ColorSwatch color={{ source: 'other', name: 'Other' }} />
          <span className="flex-1 text-ink">Other…</span>
        </button>
      </div>

      {customOpen ? (
        <div className="flex gap-2 border-t border-line bg-sunken p-2">
          <TextInput
            value={customName}
            autoFocus
            placeholder="Custom color name"
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              if (customName.trim()) pick({ source: 'other', name: customName.trim() })
            }}
          />
          <Button
            variant="primary"
            disabled={!customName.trim()}
            onClick={() => pick({ source: 'other', name: customName.trim() })}
          >
            Use
          </Button>
        </div>
      ) : null}
    </div>
  )
}
