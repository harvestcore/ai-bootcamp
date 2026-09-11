import { cn } from '../lib/cn'
import type { PieceColor } from '../types'

/** A color dot. Custom ("Other…") colors have no rgb, so they show a `?` instead. */
export function ColorSwatch({
  color,
  size = 16,
  className,
}: {
  color: PieceColor | null
  size?: number
  className?: string
}) {
  const style = { width: size, height: size }

  if (!color) {
    return (
      <span
        className={cn('inline-block shrink-0 rounded-full border border-dashed border-line-strong', className)}
        style={style}
      />
    )
  }

  if (color.source === 'other') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-sunken text-[9px] font-bold text-ink-muted',
          className,
        )}
        style={style}
        title={`${color.name} (custom color)`}
      >
        ?
      </span>
    )
  }

  return (
    <span
      className={cn('inline-block shrink-0 rounded-full border border-black/15 shadow-inner', className)}
      style={{ ...style, background: color.rgb }}
      title={color.name}
    />
  )
}
