import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { colorKey, isDuplicateMatch, isSameType, normalizeText } from './matching.ts'
import { BLACK, BLUE, RED, other } from './testFixtures.ts'

describe('normalizeText', () => {
  // @ai-generated
  test('trims, lowercases and collapses internal whitespace runs', () => {
    assert.equal(normalizeText('  Brick\t\n2   x  4 '), 'brick 2 x 4')
  })

  // @ai-generated
  test('treats a missing value as an empty string', () => {
    assert.equal(normalizeText(null), '')
    assert.equal(normalizeText(undefined), '')
  })
})

describe('colorKey', () => {
  // Black really is Rebrickable colour id 0: a falsy id must still produce a
  // key, or the single most common LEGO colour would read as "no colour".
  // @ai-generated
  test('keys a palette color by its id alone, ignoring the name', () => {
    assert.equal(colorKey(BLACK), 'p:0')
    assert.equal(colorKey({ ...RED, name: 'Bright Red' }), colorKey(RED))
    assert.notEqual(colorKey(RED), colorKey(BLUE))
  })

  // @ai-generated
  test('keys a custom color by its normalized name', () => {
    assert.equal(colorKey(other('  Sand   GREEN ')), 'o:sand green')
  })

  // @ai-generated
  test('returns an empty key when there is no color', () => {
    assert.equal(colorKey(null), '')
    assert.equal(colorKey(undefined), '')
  })
})

describe('isSameType', () => {
  // @ai-generated
  test('matches on part number regardless of color', () => {
    assert.equal(
      isSameType({ partNumber: '3001', color: RED }, { partNumber: '3001', color: BLUE }),
      true,
    )
  })

  // The part number wins over the description: two different parts can easily
  // carry the same catalog name, and merging them would misplace real bricks.
  // @ai-generated
  test('does not match different part numbers even when the descriptions are identical', () => {
    assert.equal(
      isSameType(
        { partNumber: '3001', color: RED, description: 'Brick 2 x 4' },
        { partNumber: '3002', color: RED, description: 'Brick 2 x 4' },
      ),
      false,
    )
  })

  // @ai-generated
  test('ignores surrounding whitespace on part numbers', () => {
    assert.equal(
      isSameType({ partNumber: ' 3001', color: RED }, { partNumber: '3001  ', color: RED }),
      true,
    )
  })

  // The description fallback only runs for records that predate the mandatory
  // part number (legacy imports and restored backups can still carry a blank).
  // @ai-generated
  test('falls back to the normalized description when a part number is missing', () => {
    assert.equal(
      isSameType(
        { partNumber: '', color: RED, description: 'Brick 2 x 4' },
        { partNumber: '3001', color: RED, description: 'brick  2 x 4' },
      ),
      true,
    )
  })

  // Argument order varies by caller — suggestLocation asks
  // isSameType(occupant, candidate), findDuplicate asks the other way round —
  // so a blank part number must take the same path from either side.
  // @ai-generated
  test('applies the fallback whichever side is missing the part number', () => {
    const blank = { partNumber: '', color: RED, description: 'Brick 2 x 4' }
    const known = { partNumber: '3001', color: RED, description: 'Brick 2 x 4' }
    assert.equal(isSameType(blank, known), true)
    assert.equal(isSameType(known, blank), true)
  })

  // @ai-generated
  test('does not match on the description fallback when the descriptions differ', () => {
    assert.equal(
      isSameType(
        { partNumber: '', color: RED, description: 'Brick 2 x 4' },
        { partNumber: '', color: RED, description: 'Plate 1 x 2' },
      ),
      false,
    )
  })
})

describe('isDuplicateMatch', () => {
  // @ai-generated
  test('is a duplicate when both the type and the color match', () => {
    assert.equal(
      isDuplicateMatch({ partNumber: '3001', color: RED }, { partNumber: '3001', color: RED }),
      true,
    )
  })

  // The counterpart to isSameType's colour-blindness: grouping ignores colour,
  // duplicate detection must not, or a red brick would merge into the blue pile.
  // @ai-generated
  test('is not a duplicate when only the color differs', () => {
    assert.equal(
      isDuplicateMatch({ partNumber: '3001', color: RED }, { partNumber: '3001', color: BLUE }),
      false,
    )
  })

  // @ai-generated
  test('is not a duplicate when the color matches but the part does not', () => {
    assert.equal(
      isDuplicateMatch({ partNumber: '3001', color: RED }, { partNumber: '3002', color: RED }),
      false,
    )
  })

  // @ai-generated
  test('treats one custom color spelled two ways as the same color', () => {
    assert.equal(
      isDuplicateMatch(
        { partNumber: '3001', color: other('Sand Green') },
        { partNumber: '3001', color: other(' sand  GREEN ') },
      ),
      true,
    )
  })

  // Entering the same brick once from the palette and once as "Other" is meant
  // to produce two separate entries — the palette id is the identity, not the
  // displayed name.
  // @ai-generated
  test('never matches a palette color against a custom color of the same name', () => {
    assert.equal(
      isDuplicateMatch(
        { partNumber: '3001', color: RED },
        { partNumber: '3001', color: other('Red') },
      ),
      false,
    )
  })
})
