import type { Piece, PieceColor, PieceDraft } from '../types.ts'

/** Anything that can be compared as "a piece of some type in some color". */
type Matchable = Pick<Piece, 'partNumber' | 'color'> & Partial<Pick<Piece, 'description'>>

export function normalizeText(text: string | null | undefined): string {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Stable identity for a color, used as a filter value and for equality checks. */
export function colorKey(color: PieceColor | null | undefined): string {
  if (!color) return ''
  return color.source === 'palette' ? `p:${color.id}` : `o:${normalizeText(color.name)}`
}

/**
 * Two pieces are "the same type" when they'd be described the same way ignoring
 * color: matched by part number when both have one, otherwise by normalized
 * description. Used both for grouping location suggestions and for triggering
 * partition splits.
 */
export function isSameType(a: Matchable, b: Matchable): boolean {
  const aPn = a.partNumber?.trim()
  const bPn = b.partNumber?.trim()
  if (aPn && bPn) return aPn === bPn
  return normalizeText(a.description) === normalizeText(b.description)
}

/**
 * Duplicate detection rule: same type AND same color. (Grouping deliberately
 * ignores color — two colors of one piece type is exactly what partitions are for.)
 */
export function isDuplicateMatch(a: Matchable, b: Matchable): boolean {
  if (colorKey(a.color) !== colorKey(b.color)) return false
  return isSameType(a, b)
}

/** A draft only counts as matchable once its color has been chosen. */
export function draftAsMatchable(draft: PieceDraft): Matchable | null {
  if (!draft.color) return null
  return { partNumber: draft.partNumber, color: draft.color }
}
