import { searchCatalogParts } from '../lib/catalog.js'
import { escapeHtml } from '../lib/format.js'

export function partSearchHtml() {
  return `
    <div class="part-search">
      <input type="text" class="part-search-input" placeholder='Search the catalog by name (e.g. "plate 2 x 4")…' autocomplete="off" />
      <div class="part-search-results" hidden></div>
    </div>
  `
}

export function mountPartSearch(container, { onSelect }) {
  const input = container.querySelector('.part-search-input')
  const results = container.querySelector('.part-search-results')
  let debounceTimer

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const query = input.value
    if (!query.trim()) {
      results.hidden = true
      results.innerHTML = ''
      return
    }
    debounceTimer = setTimeout(() => runSearch(query), 200)
  })

  async function runSearch(query) {
    const matches = await searchCatalogParts(query)
    results.hidden = false
    if (matches.length === 0) {
      results.innerHTML = `<div class="part-search-empty muted">No matches in the catalog.</div>`
      return
    }
    results.innerHTML = matches
      .map(
        (p) => `
        <button type="button" class="part-search-result" data-part-num="${escapeHtml(p.part_num)}" data-part-name="${escapeHtml(p.name)}">
          <span class="part-search-result__name">${escapeHtml(p.name)}</span>
          <span class="part-search-result__num muted">#${escapeHtml(p.part_num)}</span>
        </button>
      `,
      )
      .join('')
    results.querySelectorAll('.part-search-result').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Clear rather than fill with the picked name: this box is only for
        // searching, never a persistent label — the resolved piece shows in the
        // dedicated "Piece" field instead, so there's one place, not two, that
        // can go stale relative to the actual part number field.
        input.value = ''
        results.hidden = true
        results.innerHTML = ''
        onSelect({ part_num: btn.dataset.partNum, name: btn.dataset.partName })
      })
    })
  }
}
