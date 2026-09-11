import { escapeHtml } from '../lib/format.js'

export function colorSwatchHtml(color, { size = 18 } = {}) {
  if (!color) return ''
  if (color.source === 'other') {
    return `<span class="swatch swatch--other" style="--swatch-size:${size}px" title="${escapeHtml(color.name)} (custom)">?</span>`
  }
  return `<span class="swatch" style="--swatch-size:${size}px; background:${color.rgb}" title="${escapeHtml(color.name)}"></span>`
}
