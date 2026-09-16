// The client half of the quick-add: `CompartmentPanel` calls
// `addToExistingPiece(piece.id, n)` and then renders whatever the store holds.
// Nothing else in the panel may hold the quantity (the architecture rule is
// "every write answers with the whole snapshot, never patch locally"), so what
// has to be true is: the right action is called with the right payload, and the
// snapshot that comes back is published to the subscribers `useInventory()`
// is built on — that is what makes the row, the grid and the stats agree after
// one click, with no reload.
//
// `fetch` is stubbed: this pins the client contract, not the server (see
// `server/actions.test.ts` for the write itself).

import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { addToExistingPiece, getSnapshot, subscribe } from './store.ts'
import { piece, unit } from './testFixtures.ts'
import type { InventorySnapshotDto } from '../types.ts'

interface Call {
  url: string
  method?: string
  body: unknown
}

const realFetch = globalThis.fetch
let calls: Call[] = []
let nextBody: unknown = null

function snapshotDto(quantity: number): InventorySnapshotDto {
  return {
    units: [unit('a')],
    compartments: [],
    pieces: [piece('p1', { quantity })],
    log: [],
  }
}

beforeEach(() => {
  calls = []
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    return {
      ok: true,
      status: 200,
      json: async () => nextBody,
    } as Response
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('addToExistingPiece (the store action behind the panel’s quick-add)', () => {
  // @ai-generated
  test('posts the piece id and the amount to the addToExistingPiece action', async () => {
    nextBody = { snapshot: snapshotDto(8), result: piece('p1', { quantity: 8 }) }

    const result = await addToExistingPiece('p1', 3)

    assert.deepEqual(calls, [
      {
        url: '/api/actions/addToExistingPiece',
        method: 'POST',
        body: { pieceId: 'p1', quantity: 3 },
      },
    ])
    assert.equal(result?.quantity, 8)
  })

  // Criterion 11: the grid and the row both read the store, so adopting the
  // returned snapshot *is* the "updates without a page reload" behaviour.
  // @ai-generated
  test('adopts the returned snapshot and notifies subscribers once', async () => {
    nextBody = { snapshot: snapshotDto(8), result: piece('p1', { quantity: 8 }) }
    let notifications = 0
    const unsubscribe = subscribe(() => {
      notifications += 1
    })

    try {
      await addToExistingPiece('p1', 3)
    } finally {
      unsubscribe()
    }

    assert.equal(notifications, 1)
    assert.equal(getSnapshot().pieces.find((p) => p.id === 'p1')?.quantity, 8)
  })

  // The panel must not be able to show a stale quantity by keeping its own
  // copy: even a result the component ignores has to leave the store current.
  // @ai-generated
  test('a second add publishes the newer snapshot over the first', async () => {
    nextBody = { snapshot: snapshotDto(8), result: piece('p1', { quantity: 8 }) }
    await addToExistingPiece('p1', 3)
    nextBody = { snapshot: snapshotDto(12), result: piece('p1', { quantity: 12 }) }
    await addToExistingPiece('p1', 4)

    assert.equal(getSnapshot().pieces.find((p) => p.id === 'p1')?.quantity, 12)
    assert.deepEqual(
      calls.map((c) => c.body),
      [
        { pieceId: 'p1', quantity: 3 },
        { pieceId: 'p1', quantity: 4 },
      ],
    )
  })

  // Error case in the spec: the piece was deleted in another tab. The store
  // still has to publish the fresh snapshot (the row disappears) and hand the
  // component `null` rather than throwing.
  // @ai-generated
  test('publishes the fresh snapshot and returns null when the piece is gone', async () => {
    nextBody = { snapshot: { units: [unit('a')], compartments: [], pieces: [], log: [] }, result: null }

    const result = await addToExistingPiece('p1', 3)

    assert.equal(result, null)
    assert.deepEqual(getSnapshot().pieces, [])
  })

  // The spec's only requirement for a failed call: the inline row must become
  // usable again, which in the panel is a `finally` around the await. That
  // depends on the store *rejecting* rather than resolving quietly.
  // @ai-generated
  test('rejects when the API call fails, so the panel can re-enable its buttons', async () => {
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'boom' }),
      }) as Response) as typeof fetch

    await assert.rejects(() => addToExistingPiece('p1', 3), /boom/)
  })
})
