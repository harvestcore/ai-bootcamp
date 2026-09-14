import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_PARTITIONS,
  countPiecesInUnit,
  distinctColors,
  filterLog,
  findDuplicate,
  findOrphanedPieces,
  getCompartmentInfo,
  getCompartmentRecord,
  getOccupants,
  getPieceById,
  getStats,
  isCompartmentSelectable,
  locationLabel,
  needsPartitionSplit,
  searchPieces,
  sortPieces,
  suggestLocation,
} from './inventory.ts'
import { colorKey } from './matching.ts'
import { BLUE, RED, logEntry, other, piece, record, snapshot, unit } from './testFixtures.ts'

const ids = (pieces: { id: string }[]) => pieces.map((p) => p.id)

describe('getPieceById', () => {
  // The edit screen resolves /piece/:id through this. Matching on any other
  // field (the part number is the tempting one) would silently hand the user a
  // different brick to edit, and the type system cannot catch that.
  // @ai-generated
  test('resolves a piece by its own id', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [
        piece('wanted', { partNumber: '3001' }),
        piece('other', { partNumber: '3023', compartmentIndex: 1 }),
      ],
    })
    assert.equal(getPieceById(snap, 'wanted')?.id, 'wanted')
    assert.equal(getPieceById(snap, '3001'), null)
    assert.equal(getPieceById(snap, 'missing'), null)
  })
})

describe('getCompartmentRecord', () => {
  // The implicit default is load-bearing: five other helpers read a compartment
  // nobody has ever touched through it, so "1 partition, not full" has to come
  // out of a missing map entry rather than out of a stored row.
  // @ai-generated
  test('defaults an untouched compartment to one not-full partition', () => {
    const snap = snapshot({ units: [unit('a')] })
    assert.deepEqual(getCompartmentRecord(snap, 'a', 1), {
      key: 'a::1',
      unitId: 'a',
      index: 1,
      partitionCount: 1,
      partitionsFull: [false],
    })
  })

  // @ai-generated
  test('looks a stored record up by unit and compartment together', () => {
    const snap = snapshot({
      units: [unit('a'), unit('b')],
      compartments: [record('a', 1, { partitionCount: 3 })],
    })
    assert.equal(getCompartmentRecord(snap, 'a', 1).partitionCount, 3)
    assert.equal(getCompartmentRecord(snap, 'b', 1).partitionCount, 1)
  })
})

describe('getOccupants', () => {
  // @ai-generated
  test('returns only the pieces in that exact unit and compartment', () => {
    const snap = snapshot({
      units: [unit('a'), unit('b')],
      pieces: [
        piece('here', { unitId: 'a', compartmentIndex: 0 }),
        piece('other-compartment', { unitId: 'a', compartmentIndex: 1 }),
        piece('other-unit', { unitId: 'b', compartmentIndex: 0 }),
      ],
    })
    assert.deepEqual(ids(getOccupants(snap, 'a', 0)), ['here'])
  })

  // @ai-generated
  test('sorts occupants by partition index, whatever order the snapshot holds', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [
        piece('third', { partitionIndex: 2 }),
        piece('first', { partitionIndex: 0 }),
        piece('second', { partitionIndex: 1 }),
      ],
    })
    assert.deepEqual(ids(getOccupants(snap, 'a', 0)), ['first', 'second', 'third'])
  })

  // @ai-generated
  test('returns nothing for an empty compartment', () => {
    assert.deepEqual(getOccupants(snapshot({ units: [unit('a')] }), 'a', 0), [])
  })
})

describe('MAX_PARTITIONS', () => {
  // The spec's hard ceiling: at most three different pieces share a
  // compartment. Every fixture below derives its size from this constant, so
  // without one assertion on the value itself, raising it to 4 would change
  // what the app allows while the whole suite stayed green.
  // @ai-generated
  test('caps a compartment at three distinct pieces', () => {
    assert.equal(MAX_PARTITIONS, 3)
  })
})

describe('getCompartmentInfo', () => {
  // "Manually full" never looks at the pieces: an empty compartment the user has
  // flagged is still full, because the flag means "no physical room left".
  // @ai-generated
  test('is manually full when every partition is flagged, even with nothing in it', () => {
    const snap = snapshot({
      units: [unit('a')],
      compartments: [record('a', 0, { partitionCount: 3, partitionsFull: [true, true, true] })],
    })
    assert.equal(getCompartmentInfo(snap, 'a', 0).manuallyFull, true)
  })

  // @ai-generated
  test('is not manually full while one partition is unflagged', () => {
    const snap = snapshot({
      units: [unit('a')],
      compartments: [record('a', 0, { partitionCount: 3, partitionsFull: [true, false, true] })],
    })
    assert.equal(getCompartmentInfo(snap, 'a', 0).manuallyFull, false)
  })

  // The hard ceiling is a count of distinct pieces, independent of any flag —
  // the boundary is exactly MAX_PARTITIONS, not one either side of it.
  // @ai-generated
  test('is structurally full at exactly MAX_PARTITIONS occupants, with no flag set', () => {
    const occupants = Array.from({ length: MAX_PARTITIONS }, (_, i) =>
      piece(`p${i}`, { partitionIndex: i }),
    )
    const full = snapshot({ units: [unit('a')], pieces: occupants })
    const nearlyFull = snapshot({ units: [unit('a')], pieces: occupants.slice(0, -1) })

    assert.equal(getCompartmentInfo(full, 'a', 0).structurallyFull, true)
    assert.equal(getCompartmentInfo(full, 'a', 0).manuallyFull, false)
    assert.equal(getCompartmentInfo(nearlyFull, 'a', 0).structurallyFull, false)
  })

  // A hole, not the tail: extracting the middle piece of three must hand the
  // freed slot back, which is the whole point of deriving occupancy.
  // @ai-generated
  test('finds the first free partition, including a gap between occupants', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('p0', { partitionIndex: 0 }), piece('p2', { partitionIndex: 2 })],
      compartments: [record('a', 0, { partitionCount: 3 })],
    })
    assert.equal(getCompartmentInfo(snap, 'a', 0).freePartitionIndex, 1)

    // ...and the FIRST one, not the last: with only the middle slot taken, the
    // new piece belongs in slot 1, not slot 3.
    const middleTaken = snapshot({
      units: [unit('a')],
      pieces: [piece('p1', { partitionIndex: 1 })],
      compartments: [record('a', 0, { partitionCount: 3 })],
    })
    assert.equal(getCompartmentInfo(middleTaken, 'a', 0).freePartitionIndex, 0)
  })

  // @ai-generated
  test('reports no free partition once every declared slot is taken', () => {
    const snap = snapshot({ units: [unit('a')], pieces: [piece('p0')] })
    assert.equal(getCompartmentInfo(snap, 'a', 0).freePartitionIndex, -1)
  })

  // @ai-generated
  test('offers partition 0 in an untouched empty compartment', () => {
    assert.equal(getCompartmentInfo(snapshot({ units: [unit('a')] }), 'a', 0).freePartitionIndex, 0)
  })
})

describe('isCompartmentSelectable', () => {
  // @ai-generated
  test('is selectable while there is room left', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('p0')],
      compartments: [record('a', 0, { partitionCount: 2 })],
    })
    assert.equal(isCompartmentSelectable(snap, 'a', 0), true)
  })

  // @ai-generated
  test('is not selectable when manually full', () => {
    const snap = snapshot({
      units: [unit('a')],
      compartments: [record('a', 0, { partitionsFull: [true] })],
    })
    assert.equal(isCompartmentSelectable(snap, 'a', 0), false)
  })

  // Both gates have to be checked: three pieces already there is a hard stop
  // even though the user never flagged anything.
  // @ai-generated
  test('is not selectable when structurally full despite no flag', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: Array.from({ length: MAX_PARTITIONS }, (_, i) => piece(`p${i}`, { partitionIndex: i })),
      compartments: [record('a', 0, { partitionCount: MAX_PARTITIONS })],
    })
    assert.equal(isCompartmentSelectable(snap, 'a', 0), false)
  })
})

describe('locationLabel', () => {
  // @ai-generated
  // Two units on purpose: the label has to resolve the unit by id, or every
  // piece row in the app would show the first drawer's name.
  test('numbers compartments from 1, naming the unit it was asked for', () => {
    const snap = snapshot({ units: [unit('a', { name: 'Bench' }), unit('b', { name: 'Workbench' })] })
    assert.equal(locationLabel(snap, 'b', 2), 'Workbench, Compartment 3')
  })

  // Partition 0 is the ordinary case, so the "was a partition given?" check must
  // test for null rather than falsiness — otherwise the first partition of a
  // split compartment silently loses its label.
  // @ai-generated
  test('appends the 1-based partition for a subdivided compartment', () => {
    const snap = snapshot({
      units: [unit('a', { name: 'Workbench' })],
      compartments: [record('a', 0, { partitionCount: 2 })],
    })
    assert.equal(locationLabel(snap, 'a', 0, 0), 'Workbench, Compartment 1, Partition 1')
  })

  // @ai-generated
  test('omits the partition for an undivided compartment', () => {
    const snap = snapshot({ units: [unit('a', { name: 'Workbench' })] })
    assert.equal(locationLabel(snap, 'a', 0, 0), 'Workbench, Compartment 1')
  })

  // @ai-generated
  test('falls back to a generic unit name when the unit is gone', () => {
    assert.equal(locationLabel(snapshot(), 'missing', 0), 'Unit, Compartment 1')
  })
})

describe('suggestLocation', () => {
  // @ai-generated
  test('suggests the first empty compartment when nothing groups', () => {
    const snap = snapshot({ units: [unit('a')] })
    assert.deepEqual(suggestLocation(snap, { partNumber: '3001', color: RED }), {
      unitId: 'a',
      compartmentIndex: 0,
      reason: 'First empty compartment',
    })
  })

  // Grouping beats order: keeping one part type together matters more than
  // filling the drawer front to back, including across units.
  // @ai-generated
  test('prefers grouping with the same part over an earlier empty compartment', () => {
    const snap = snapshot({
      units: [unit('a'), unit('b')],
      pieces: [piece('existing', { unitId: 'b', compartmentIndex: 1, partNumber: '3001' })],
    })
    const suggestion = suggestLocation(snap, { partNumber: '3001', color: RED })
    assert.equal(suggestion?.unitId, 'b')
    assert.equal(suggestion?.compartmentIndex, 1)
    assert.match(suggestion?.reason ?? '', /^Grouped with the other "Brick 2 x 4" pieces$/)
  })

  // Deliberate: two colours of one part is exactly what a partition split is
  // for, so grouping ignores colour even though duplicate detection does not.
  // @ai-generated
  test('groups a different color of the same part', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('existing', { compartmentIndex: 0, partNumber: '3001', color: RED })],
    })
    assert.equal(suggestLocation(snap, { partNumber: '3001', color: BLUE })?.compartmentIndex, 0)
  })

  // @ai-generated
  test('does not group into a compartment holding a mix of part types', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [
        piece('same', { compartmentIndex: 0, partNumber: '3001', partitionIndex: 0 }),
        piece('different', { compartmentIndex: 0, partNumber: '3023', partitionIndex: 1 }),
      ],
      compartments: [record('a', 0, { partitionCount: 2 })],
    })
    assert.equal(suggestLocation(snap, { partNumber: '3001', color: RED })?.compartmentIndex, 1)
  })

  // @ai-generated
  test('skips a same-part compartment the user marked full', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('existing', { compartmentIndex: 0, partNumber: '3001' })],
      compartments: [record('a', 0, { partitionsFull: [true] })],
    })
    assert.equal(suggestLocation(snap, { partNumber: '3001', color: RED })?.compartmentIndex, 1)
  })

  // @ai-generated
  test('skips a same-part compartment that is structurally full', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: Array.from({ length: MAX_PARTITIONS }, (_, i) =>
        piece(`p${i}`, { compartmentIndex: 0, partitionIndex: i, partNumber: '3001' }),
      ),
      compartments: [record('a', 0, { partitionCount: MAX_PARTITIONS })],
    })
    assert.equal(suggestLocation(snap, { partNumber: '3001', color: RED })?.compartmentIndex, 1)
  })

  // The empty-compartment path has to respect the gates too. A compartment the
  // user flagged while it was empty means "no physical room" (a divider, a
  // label, something already in the drawer) — offering it as "first empty"
  // would send them to a slot they know is unusable.
  // @ai-generated
  test('skips an empty compartment the user marked full', () => {
    const snap = snapshot({
      units: [unit('a')],
      compartments: [record('a', 0, { partitionsFull: [true] })],
    })
    assert.equal(suggestLocation(snap, { partNumber: '3001', color: RED })?.compartmentIndex, 1)
  })

  // @ai-generated
  test('groups into the first matching compartment when the part sits in two', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [
        piece('earlier', { compartmentIndex: 1, partNumber: '3001' }),
        piece('later', { compartmentIndex: 2, partNumber: '3001' }),
      ],
    })
    assert.equal(suggestLocation(snap, { partNumber: '3001', color: RED })?.compartmentIndex, 1)
  })

  // @ai-generated
  test('returns nothing when no compartment can take the piece', () => {
    const snap = snapshot({
      units: [unit('a', { rows: 1, cols: 1 })],
      pieces: [piece('existing', { partNumber: '3023' })],
    })
    assert.equal(suggestLocation(snap, { partNumber: '3001', color: RED }), null)
  })

  // The first-run state: the Add-piece flow calls this before drawer setup.
  // @ai-generated
  test('returns nothing before any drawer unit exists', () => {
    assert.equal(suggestLocation(snapshot(), { partNumber: '3001', color: RED }), null)
  })
})

describe('needsPartitionSplit', () => {
  // @ai-generated
  test('is false for an empty compartment', () => {
    assert.equal(needsPartitionSplit(snapshot({ units: [unit('a')] }), 'a', 0), false)
  })

  // @ai-generated
  test('is true once the occupants fill every declared partition', () => {
    const undivided = snapshot({ units: [unit('a')], pieces: [piece('p0')] })
    const split = snapshot({
      units: [unit('a')],
      pieces: [piece('p0', { partitionIndex: 0 }), piece('p1', { partitionIndex: 1 })],
      compartments: [record('a', 0, { partitionCount: 2 })],
    })
    assert.equal(needsPartitionSplit(undivided, 'a', 0), true)
    assert.equal(needsPartitionSplit(split, 'a', 0), true)
  })

  // @ai-generated
  test('is false while a declared partition is still free', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('p0')],
      compartments: [record('a', 0, { partitionCount: 2 })],
    })
    assert.equal(needsPartitionSplit(snap, 'a', 0), false)
  })
})

describe('findDuplicate', () => {
  // @ai-generated
  test('finds the same part in the same color anywhere in the inventory', () => {
    const snap = snapshot({
      units: [unit('a'), unit('b')],
      pieces: [
        piece('elsewhere', { unitId: 'b', compartmentIndex: 3, partNumber: '3001', color: RED }),
      ],
    })
    assert.equal(findDuplicate(snap, { partNumber: '3001', color: RED })?.id, 'elsewhere')
  })

  // @ai-generated
  test('does not treat another color of the same part as a duplicate', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('red-one', { partNumber: '3001', color: RED })],
    })
    assert.equal(findDuplicate(snap, { partNumber: '3001', color: BLUE }), null)
  })
})

describe('countPiecesInUnit', () => {
  // This guards deleting a drawer unit, so it must count entries, not bricks:
  // one entry holding 50 bricks still means the unit is not empty.
  // @ai-generated
  test('counts piece entries in the unit, not their quantities', () => {
    const snap = snapshot({
      units: [unit('a'), unit('b')],
      pieces: [
        piece('bulk', { unitId: 'a', quantity: 50 }),
        piece('single', { unitId: 'a', compartmentIndex: 1 }),
        piece('other-unit', { unitId: 'b' }),
      ],
    })
    assert.equal(countPiecesInUnit(snap, 'a'), 2)
    assert.equal(countPiecesInUnit(snap, 'empty-unit'), 0)
  })
})

describe('findOrphanedPieces', () => {
  // The resize guard's exact boundary: with capacity 4 the last valid index is
  // 3, so index 4 is the first one that falls off the grid.
  // @ai-generated
  test('returns the pieces that would fall outside the smaller grid', () => {
    const snap = snapshot({
      units: [unit('a', { rows: 4, cols: 4 }), unit('b')],
      pieces: [
        piece('last-valid', { unitId: 'a', compartmentIndex: 3 }),
        piece('falls-off', { unitId: 'a', compartmentIndex: 4 }),
        piece('other-unit', { unitId: 'b', compartmentIndex: 9 }),
      ],
    })
    // Deliberately non-square (4x1, not 2x2): capacity is rows*cols, and a
    // square fixture cannot tell that apart from rows+cols.
    assert.deepEqual(ids(findOrphanedPieces(snap, 'a', 4, 1)), ['falls-off'])
  })

  // @ai-generated
  test('orphans nothing when the unit only grows', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('p', { compartmentIndex: 3 })],
    })
    assert.deepEqual(findOrphanedPieces(snap, 'a', 4, 4), [])
  })
})

describe('searchPieces', () => {
  const brick = piece('brick', {
    description: 'Brick 2 x 4',
    partNumber: '3001',
    color: RED,
    notes: 'from the 1989 castle set',
    unitId: 'a',
  })
  const plate = piece('plate', {
    description: 'Plate 1 x 2',
    partNumber: '3023',
    color: BLUE,
    unitId: 'b',
    compartmentIndex: 1,
  })
  const snap = snapshot({ units: [unit('a'), unit('b')], pieces: [brick, plate] })

  // @ai-generated
  test('matches the piece name, case-insensitively', () => {
    assert.deepEqual(ids(searchPieces(snap, 'BRICK 2')), ['brick'])
  })

  // @ai-generated
  test('matches the part number', () => {
    assert.deepEqual(ids(searchPieces(snap, '3023')), ['plate'])
  })

  // Searching the colour name is deliberate and beyond the written spec:
  // "the red plates" is how people actually look for a piece.
  // @ai-generated
  test('matches the color name', () => {
    assert.deepEqual(ids(searchPieces(snap, 'blue')), ['plate'])
  })

  // Notes are the only free text left now that the part number is mandatory,
  // so anything the catalog name does not capture is findable only here.
  // @ai-generated
  test('matches the notes', () => {
    assert.deepEqual(ids(searchPieces(snap, 'castle')), ['brick'])
  })

  // @ai-generated
  test('returns every piece for a blank query', () => {
    assert.deepEqual(ids(searchPieces(snap, '   ')), ['brick', 'plate'])
  })

  // The filter value is a colorKey, not a display name — that contract is what
  // ties the chips built by distinctColors to this filter.
  // @ai-generated
  test('filters by color key', () => {
    assert.deepEqual(ids(searchPieces(snap, '', { color: colorKey(RED) })), ['brick'])
  })

  // @ai-generated
  test('filters by unit', () => {
    assert.deepEqual(ids(searchPieces(snap, '', { unitId: 'b' })), ['plate'])
  })

  // @ai-generated
  test('combines the query with the filters', () => {
    assert.deepEqual(ids(searchPieces(snap, 'brick', { unitId: 'b' })), [])
  })
})

describe('sortPieces', () => {
  const snap = snapshot({ units: [unit('a'), unit('b')] })

  // @ai-generated
  test('sorts by name', () => {
    const pieces = [
      piece('plate', { description: 'Plate 1 x 2' }),
      piece('axle', { description: 'Axle 3' }),
      piece('brick', { description: 'Brick 2 x 4' }),
    ]
    assert.deepEqual(ids(sortPieces(snap, pieces, 'name')), ['axle', 'brick', 'plate'])
  })

  // @ai-generated
  test('sorts by quantity descending, breaking ties by name', () => {
    const pieces = [
      piece('brick', { description: 'Brick 2 x 4', quantity: 5 }),
      piece('axle', { description: 'Axle 3', quantity: 5 }),
      piece('plate', { description: 'Plate 1 x 2', quantity: 9 }),
    ]
    assert.deepEqual(ids(sortPieces(snap, pieces, 'quantity')), ['plate', 'axle', 'brick'])
  })

  // Location order has to follow the physical layout all three levels down,
  // or the list stops matching what the drawers look like.
  // @ai-generated
  test('sorts by unit, then compartment, then partition', () => {
    const pieces = [
      piece('b-first', { unitId: 'b', compartmentIndex: 0, partitionIndex: 0 }),
      piece('a-second-compartment', { unitId: 'a', compartmentIndex: 1, partitionIndex: 0 }),
      piece('a-second-partition', { unitId: 'a', compartmentIndex: 0, partitionIndex: 1 }),
      piece('a-first', { unitId: 'a', compartmentIndex: 0, partitionIndex: 0 }),
    ]
    assert.deepEqual(ids(sortPieces(snap, pieces, 'location')), [
      'a-first',
      'a-second-partition',
      'a-second-compartment',
      'b-first',
    ])
  })

  // Callers pass arrays straight out of the snapshot, so an in-place sort would
  // quietly reorder the store's own data.
  // @ai-generated
  test('does not reorder the array it was given', () => {
    const pieces = [
      piece('plate', { description: 'Plate 1 x 2' }),
      piece('axle', { description: 'Axle 3' }),
    ]
    sortPieces(snap, pieces, 'name')
    assert.deepEqual(ids(pieces), ['plate', 'axle'])
  })
})

describe('distinctColors', () => {
  // @ai-generated
  test('returns one entry per color, in first-seen order', () => {
    const colors = distinctColors([
      piece('p1', { color: BLUE }),
      piece('p2', { color: RED }),
      piece('p3', { color: BLUE }),
    ])
    assert.deepEqual(colors, [BLUE, RED])
  })

  // Deduping by display name instead of by colour key would collapse these two
  // into one chip that then filters to only half the pieces.
  // @ai-generated
  test('keeps a palette color and a custom color of the same name apart', () => {
    const colors = distinctColors([piece('p1', { color: RED }), piece('p2', { color: other('Red') })])
    assert.equal(colors.length, 2)
  })
})

describe('filterLog', () => {
  // A move carries destination and origin in one entry, so filtering by either
  // end has to find it — and find it exactly once.
  const move = logEntry('move', [
    { unitId: 'b', compartmentIndex: 0 },
    { unitId: 'a', compartmentIndex: 1 },
  ], { type: 'move' })
  const added = logEntry('added', [{ unitId: 'a', compartmentIndex: 0 }])
  const snap = snapshot({ units: [unit('a'), unit('b')], log: [move, added] })

  // @ai-generated
  test('returns the whole log when nothing is filtered', () => {
    assert.deepEqual(ids(filterLog(snap)), ['move', 'added'])
  })

  // @ai-generated
  test('finds a move from either end, once', () => {
    assert.deepEqual(ids(filterLog(snap, { unitId: 'a' })), ['move', 'added'])
    assert.deepEqual(ids(filterLog(snap, { unitId: 'b' })), ['move'])
  })

  // Both halves must come from the same location object: the move above touches
  // unit a and compartment 0, but never unit a's compartment 0.
  // @ai-generated
  test('requires the unit and the compartment to match the same location', () => {
    assert.deepEqual(ids(filterLog(snap, { unitId: 'a', compartmentIndex: 0 })), ['added'])
  })

  // Reachable by hand-editing the URL the log page reads its filters from.
  // @ai-generated
  test('ignores a compartment filter with no unit behind it', () => {
    assert.deepEqual(ids(filterLog(snap, { compartmentIndex: 0 })), ['move', 'added'])
  })
})

describe('getStats', () => {
  // @ai-generated
  test('counts piece kinds and total quantity separately', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: [piece('bulk', { quantity: 50 }), piece('single', { compartmentIndex: 1 })],
    })
    const stats = getStats(snap)
    assert.equal(stats.pieceKinds, 2)
    assert.equal(stats.totalQuantity, 51)
  })

  // @ai-generated
  test('counts a shared compartment once', () => {
    const snap = snapshot({
      units: [unit('a')],
      pieces: Array.from({ length: MAX_PARTITIONS }, (_, i) =>
        piece(`p${i}`, { compartmentIndex: 0, partitionIndex: i }),
      ),
    })
    assert.equal(getStats(snap).usedCompartments, 1)
  })

  // The occupancy key has to carry the unit, or compartment 1 of every drawer
  // would be counted as one compartment.
  // @ai-generated
  test('does not merge the same compartment index across units', () => {
    const snap = snapshot({
      units: [unit('a'), unit('b')],
      pieces: [piece('in-a', { unitId: 'a' }), piece('in-b', { unitId: 'b' })],
    })
    assert.equal(getStats(snap).usedCompartments, 2)
  })

  // @ai-generated
  test('totals the compartments of every unit', () => {
    const snap = snapshot({
      units: [unit('a', { rows: 2, cols: 2 }), unit('b', { rows: 3, cols: 1 })],
    })
    assert.equal(getStats(snap).totalCompartments, 7)
  })

  // @ai-generated
  test('reports zeros for an empty inventory', () => {
    assert.deepEqual(getStats(snapshot()), {
      pieceKinds: 0,
      totalQuantity: 0,
      usedCompartments: 0,
      totalCompartments: 0,
    })
  })
})
