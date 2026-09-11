export function fullnessBadgeHtml() {
  return `<span class="fullness-badge" title="Marked full">🚩</span>`
}

const ACTION_LABELS = {
  add: '➕ add',
  extract: '➖ extract',
  move: '🔀 move',
  edit: '✏️ edit',
  delete: '🗑️ delete',
}

export function actionTagHtml(type) {
  return `<span class="action-tag action-tag--${type}">${ACTION_LABELS[type] ?? type}</span>`
}
