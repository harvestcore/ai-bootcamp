export function newId(): string {
  return crypto.randomUUID()
}

export function compartmentKey(unitId: string, index: number): string {
  return `${unitId}::${index}`
}
