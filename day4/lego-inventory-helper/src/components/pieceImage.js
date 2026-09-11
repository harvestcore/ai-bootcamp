import { escapeHtml } from '../lib/format.js'

// Real piece photos come from Rebrickable's CDN (bundled in inventory_parts.csv —
// see lib/catalog.js#getImageForPartColor), which requires network access to load.
// When there's no recorded photo for this part+color, or the image fails to load
// (e.g. offline and not previously cached by the service worker), this falls back
// to a generic placeholder brick silhouette — no LEGO branding/trademarks.
export function pieceImageHtml({ size = 40, imageUrl = null } = {}) {
  const placeholder = `
    <svg viewBox="0 0 24 24" width="60%" height="60%" fill="currentColor">
      <rect x="3" y="9" width="18" height="12" rx="1.5" />
      <rect x="6" y="4" width="4" height="5" rx="1" />
      <rect x="14" y="4" width="4" height="5" rx="1" />
    </svg>
  `
  return `<span class="piece-image" style="--piece-image-size:${size}px">
    ${
      imageUrl
        ? `<img class="piece-image__photo" src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" />`
        : ''
    }
    <span class="piece-image__fallback" ${imageUrl ? 'hidden' : ''} aria-hidden="true">${placeholder}</span>
  </span>`
}
