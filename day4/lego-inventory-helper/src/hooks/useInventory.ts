import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe } from '../lib/store'
import type { InventorySnapshot } from '../lib/inventory'

/**
 * Reads the inventory from the store and re-renders this component whenever
 * anything in it changes. `useSyncExternalStore` is React's built-in way to
 * subscribe to state that lives outside React — the store publishes a new
 * snapshot object on every mutation, and React compares snapshots by identity.
 */
export function useInventory(): InventorySnapshot {
  return useSyncExternalStore(subscribe, getSnapshot)
}
