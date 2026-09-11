/** Joins class names, dropping anything falsy. Keeps conditional classes readable. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
