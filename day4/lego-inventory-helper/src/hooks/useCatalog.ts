import { useEffect, useState } from 'react'
import {
  getAvailableColorsForPart,
  lookupPartByNumber,
  searchCatalogParts,
} from '../lib/catalog'
import type { CatalogColor, CatalogPart } from '../types'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * The catalog lives in IndexedDB, so every lookup is async. These hooks wrap
 * that in the standard "fire the request, ignore it if a newer one started"
 * pattern, so a fast typist never sees results from an older keystroke.
 */

export interface CatalogLookup {
  part: CatalogPart | null
  loading: boolean
}

export function useCatalogPart(partNumber: string): CatalogLookup {
  const query = useDebouncedValue(partNumber.trim())
  const [state, setState] = useState<CatalogLookup>({ part: null, loading: false })

  useEffect(() => {
    if (!query) {
      setState({ part: null, loading: false })
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))
    lookupPartByNumber(query).then((part) => {
      if (!cancelled) setState({ part, loading: false })
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return state
}

/** The palette narrowed to the colors this part actually exists in. */
export function useAvailableColors(partNumber: string): CatalogColor[] {
  const query = useDebouncedValue(partNumber.trim())
  const [colors, setColors] = useState<CatalogColor[]>([])

  useEffect(() => {
    let cancelled = false
    getAvailableColorsForPart(query).then((result) => {
      if (!cancelled) setColors(result)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  return colors
}

export function useCatalogSearch(query: string): { results: CatalogPart[]; searching: boolean } {
  const debounced = useDebouncedValue(query)
  const [results, setResults] = useState<CatalogPart[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    searchCatalogParts(debounced).then((matches) => {
      if (cancelled) return
      setResults(matches)
      setSearching(false)
    })
    return () => {
      cancelled = true
    }
  }, [debounced])

  return { results, searching }
}
