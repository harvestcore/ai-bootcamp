/**
 * Quantities are whole numbers of pieces, so every number the user can type
 * goes through here: rounds to an integer, then clamps to ≥ 1 (and ≤ `max`).
 * A non-numeric or empty field reads as `1` rather than `NaN`.
 */
export function clampQuantity(n: number, max?: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(1, Math.round(n)))
}
