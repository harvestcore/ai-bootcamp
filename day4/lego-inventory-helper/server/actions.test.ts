// The write behind the compartment panel's quick-add button, tested against a
// throwaway SQLite file (`LEGO_DB_PATH`) — Node's built-in test runner and
// `node:sqlite`, so still no dependency. See `day4/CLAUDE.md` ("Tests"): the
// React panel itself would need a DOM runner and a testing library, which is
// not installed, so everything the quick-add can be held to without a browser
// is held to here — the quantity bump, the single movement entry and its
// detail text, the fields that must not move, and the "Full" flag.
//
// The env var has to be set before `db.ts` is evaluated (it reads DB_PATH at
// import time), hence the dynamic imports below.

import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { MovementEntry, PaletteColor, Piece } from '../src/types.ts'

const dbDir = mkdtempSync(join(tmpdir(), 'lego-actions-test-'))
process.env.LEGO_DB_PATH = join(dbDir, 'inventory.sqlite')

const { addToExistingPiece, createPiece, createUnit, setPartitionCount, setPartitionFull } =
  await import('./actions.ts')
const { getDb } = await import('./db.ts')
const { readSnapshotDto } = await import('./repository.ts')
const { compartmentKey } = await import('../src/lib/ids.ts')

const RED: PaletteColor = { source: 'palette', id: 4, name: 'Red', rgb: 'C91A09' }

beforeEach(() => {
  // One database file for the whole run; each test starts from an empty
  // inventory so nothing leaks between them (the catalog tables stay empty,
  // which is a legitimate state: every piece then reads catalogMatched false).
  getDb().exec('DELETE FROM pieces; DELETE FROM movement_log; DELETE FROM compartments; DELETE FROM drawer_units;')
})

after(() => {
  rmSync(dbDir, { recursive: true, force: true })
})

/** A unit with one 1x2 grid, holding one piece in compartment 0. */
function seed(overrides: { quantity?: number; notes?: string } = {}): {
  unitId: string
  piece: Piece
} {
  const created = createUnit({ rows: 1, cols: 2 })
  const unitId = created.snapshot.units[0]!.id
  const { result: piece } = createPiece({
    draft: {
      partNumber: '3001',
      color: RED,
      quantity: overrides.quantity ?? 5,
      notes: overrides.notes ?? 'from set 10497',
    },
    unitId,
    compartmentIndex: 0,
  })
  return { unitId, piece }
}

/** Only the entries the quick-add wrote — `createPiece` logs an `add` too. */
function addEntriesFor(log: MovementEntry[], description: string): MovementEntry[] {
  return log.filter((e) => e.type === 'add' && e.pieceDescription === description)
}

describe('addToExistingPiece (the quick-add write)', () => {
  // Criterion 5: confirming 3 on a piece showing 5 leaves it at 8.
  // @ai-generated
  test('bumps the quantity by the amount asked for and returns the updated piece', () => {
    const { piece } = seed({ quantity: 5 })

    const { result, snapshot } = addToExistingPiece({ pieceId: piece.id, quantity: 3 })

    assert.equal(result?.quantity, 8)
    // Criterion 11's foundation: the snapshot every screen re-renders off
    // already carries the new stock, so nothing has to patch it locally.
    assert.equal(snapshot.pieces.find((p) => p.id === piece.id)?.quantity, 8)
  })

  // Criterion 6: exactly one entry, of type `add`, with the right detail.
  // @ai-generated
  test('appends exactly one add entry naming the amount and the compartment', () => {
    const { piece } = seed({ quantity: 5 })
    const before = addEntriesFor(readSnapshotDto().log, piece.description).length
    assert.equal(before, 1, 'precondition: only createPiece has logged so far')

    const { snapshot } = addToExistingPiece({ pieceId: piece.id, quantity: 3 })
    const entries = addEntriesFor(snapshot.log, piece.description)

    assert.equal(entries.length, before + 1)
    const detail = entries.map((e) => e.detail).filter((d) => d.startsWith('+3 '))
    assert.deepEqual(detail, ['+3 → Unit 1, Compartment 1'])
    // The log is filterable by unit/compartment from either side of the app.
    const entry = entries.find((e) => e.detail === '+3 → Unit 1, Compartment 1')!
    assert.deepEqual(entry.locations, [{ unitId: piece.unitId, compartmentIndex: 0 }])
  })

  // Criterion 6, the subdivided case: the detail must name the partition too,
  // which is what makes the entry identify one occupant rather than a drawer.
  // @ai-generated
  test('names the partition in the detail when the compartment is subdivided', () => {
    const { unitId } = seed({ quantity: 1 })
    setPartitionCount({ unitId, index: 0, count: 2 })
    const { result: second } = createPiece({
      draft: { partNumber: '3002', color: RED, quantity: 2, notes: '' },
      unitId,
      compartmentIndex: 0,
    })
    assert.equal(second.partitionIndex, 1, 'precondition: the new piece took partition 2')

    const { snapshot } = addToExistingPiece({ pieceId: second.id, quantity: 4 })

    const details = addEntriesFor(snapshot.log, second.description).map((e) => e.detail)
    assert.ok(
      details.includes('+4 → Unit 1, Compartment 1, Partition 2'),
      `expected a "Partition 2" detail, got ${JSON.stringify(details)}`,
    )
  })

  // Criterion 7: an add is a restock, not an edit — nothing else may move.
  // @ai-generated
  test('leaves every other field of the piece untouched', () => {
    const { piece } = seed({ quantity: 5, notes: 'from set 10497' })

    const { result, snapshot } = addToExistingPiece({ pieceId: piece.id, quantity: 2 })
    const stored = snapshot.pieces.find((p) => p.id === piece.id)!

    for (const target of [result!, stored]) {
      assert.deepEqual(
        { ...target, quantity: piece.quantity },
        piece,
        'only `quantity` may differ after a quick-add',
      )
    }
  })

  // Criterion 10's server half: two adds accumulate rather than overwriting,
  // and each one is its own audit entry.
  // @ai-generated
  test('accumulates across successive adds, one entry each', () => {
    const { piece } = seed({ quantity: 5 })

    addToExistingPiece({ pieceId: piece.id, quantity: 2 })
    const { result, snapshot } = addToExistingPiece({ pieceId: piece.id, quantity: 4 })

    assert.equal(result?.quantity, 11)
    const details = addEntriesFor(snapshot.log, piece.description).map((e) => e.detail)
    assert.equal(details.filter((d) => d.startsWith('+2 ')).length, 1)
    assert.equal(details.filter((d) => d.startsWith('+4 ')).length, 1)
  })

  // Criterion 18: "Full" gates suggestions and the location picker, not a
  // write to a piece already sitting there — and the flag is the user's, so
  // the add must not clear it.
  // @ai-generated
  test('accepts an add to a partition marked Full and leaves the flag set', () => {
    const { unitId, piece } = seed({ quantity: 5 })
    setPartitionFull({ unitId, index: 0, partitionIndex: 0, value: true })

    const { result, snapshot } = addToExistingPiece({ pieceId: piece.id, quantity: 3 })

    assert.equal(result?.quantity, 8)
    const record = snapshot.compartments.find((c) => c.key === compartmentKey(unitId, 0))
    assert.equal(record?.partitionsFull[0], true, 'the Full flag must survive a quick-add')
  })

  // Criterion 19: the quick-add never consults the catalog, so an unmatched
  // part number is not a special case. The catalog tables are empty in this
  // suite, so this is exactly the piece the panel shows "Not found in the
  // catalog." for.
  // @ai-generated
  test('adds to a piece that is not in the catalog', () => {
    const { piece } = seed({ quantity: 1 })
    assert.equal(piece.catalogMatched, false, 'precondition: unmatched part number')
    assert.equal(piece.description, 'Part #3001')

    const { result } = addToExistingPiece({ pieceId: piece.id, quantity: 6 })

    assert.equal(result?.quantity, 7)
    assert.equal(result?.catalogMatched, false)
  })

  // Error case in the spec: the piece was deleted in another tab. The panel
  // relies on getting `null` plus a truthful snapshot, and on nothing being
  // written — no resurrected piece, no orphan log entry.
  // @ai-generated
  test('answers null and writes nothing when the piece no longer exists', () => {
    const { piece } = seed({ quantity: 5 })
    const logBefore = readSnapshotDto().log.length

    const { result, snapshot } = addToExistingPiece({ pieceId: 'deleted-elsewhere', quantity: 3 })
    assert.equal(piece.quantity, 5)

    assert.equal(result, null)
    assert.equal(snapshot.log.length, logBefore)
    assert.equal(snapshot.pieces.length, 1)
    assert.equal(snapshot.pieces[0]!.quantity, 5)
  })

  // The quantity rule (whole numbers >= 1) can't live in the UI alone: a
  // request reaches the API without passing through `QuantityInput`. So the
  // action rejects an out-of-range amount the way `extractPiece` does.
  // @ai-generated
  test('rejects a quantity that is not a whole number >= 1', () => {
    const { piece } = seed({ quantity: 5 })

    for (const quantity of [-2, 0, 1.5, Number.NaN]) {
      assert.throws(
        () => addToExistingPiece({ pieceId: piece.id, quantity }),
        /Invalid quantity/,
        `expected ${quantity} to be rejected`,
      )
    }
  })

  // The transaction has to be all-or-nothing: a rejected amount must leave
  // neither the stock nor the log touched.
  // @ai-generated
  test('writes nothing at all when the quantity is rejected', () => {
    const { piece } = seed({ quantity: 5 })
    const logBefore = readSnapshotDto().log.length

    assert.throws(() => addToExistingPiece({ pieceId: piece.id, quantity: -5 }))

    const after = readSnapshotDto()
    assert.equal(after.pieces[0]!.quantity, 5)
    assert.equal(after.log.length, logBefore, 'the rejected add must leave no entry behind')
  })
})
