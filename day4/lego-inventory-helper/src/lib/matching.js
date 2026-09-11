export function normalizeText(text) {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function colorKey(color) {
  if (!color) return ''
  return color.source === 'palette' ? `p:${color.id}` : `o:${normalizeText(color.name)}`
}

// Two pieces are "the same type" when they'd be described the same way ignoring color:
// matched by part number when both have one, otherwise by normalized description.
// Used both for grouping location suggestions and for triggering partition splits.
export function isSameType(a, b) {
  const aPn = a.partNumber?.trim()
  const bPn = b.partNumber?.trim()
  if (aPn && bPn) return aPn === bPn
  return normalizeText(a.description) === normalizeText(b.description)
}

// Duplicate detection rule: part number + color when both entries have a part number,
// otherwise normalized description + color.
export function isDuplicateMatch(a, b) {
  if (colorKey(a.color) !== colorKey(b.color)) return false
  return isSameType(a, b)
}
