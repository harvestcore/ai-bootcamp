export function newId() {
  return crypto.randomUUID()
}

export function compartmentKey(unitId, index) {
  return `${unitId}::${index}`
}

export function indexToRowCol(index, cols) {
  return { row: Math.floor(index / cols), col: index % cols }
}

export function rowColToIndex(row, col, cols) {
  return row * cols + col
}
