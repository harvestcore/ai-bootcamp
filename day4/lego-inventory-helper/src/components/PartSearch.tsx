import { useState } from 'react'
import { useCatalogSearch } from '../hooks/useCatalog'
import { TextInput } from './ui'
import type { CatalogPart } from '../types'

/**
 * Autocomplete over the bundled parts catalog, for when you know what the piece
 * looks like but not its number.
 *
 * The box clears itself once you pick something: it is only ever a search field,
 * never a label of the current selection — the part number field below is the
 * single place that can be read as "what this piece is".
 */
export function PartSearch({ onSelect }: { onSelect: (part: CatalogPart) => void }) {
  const [query, setQuery] = useState('')
  const { results, searching } = useCatalogSearch(query)
  const open = query.trim().length > 0

  return (
    <div className="relative">
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search the catalog by name, e.g. "plate 2 x 4"'
        autoComplete="off"
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
          {results.map((part) => (
            <button
              key={part.part_num}
              type="button"
              onClick={() => {
                setQuery('')
                onSelect(part)
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-sunken"
            >
              <span className="flex-1 truncate text-ink">{part.name}</span>
              <span className="shrink-0 font-mono text-xs text-ink-muted">#{part.part_num}</span>
            </button>
          ))}
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">
              {searching ? 'Searching…' : 'No matches in the catalog.'}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
