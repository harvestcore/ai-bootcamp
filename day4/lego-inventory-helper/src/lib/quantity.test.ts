import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { clampQuantity } from './quantity.ts'

describe('clampQuantity', () => {
  // @ai-generated
  test('leaves a valid whole number alone', () => {
    assert.equal(clampQuantity(1), 1)
    assert.equal(clampQuantity(7), 7)
  })

  // @ai-generated
  test('raises anything below 1 to 1', () => {
    assert.equal(clampQuantity(0), 1)
    assert.equal(clampQuantity(-2), 1)
  })

  // A non-integer quantity would persist as a REAL and strand the piece: the
  // extract form only accepts integers, so 7.5 could never be emptied.
  // @ai-generated
  test('rounds a typed fraction to an integer', () => {
    assert.equal(clampQuantity(2.5), 3)
    assert.equal(clampQuantity(2.4), 2)
    assert.equal(clampQuantity(1.2), 1)
    assert.equal(clampQuantity(0.4), 1)
  })

  // @ai-generated
  test('reads an empty or non-numeric field as 1', () => {
    assert.equal(clampQuantity(Number('')), 1)
    assert.equal(clampQuantity(Number('abc')), 1)
    assert.equal(clampQuantity(Infinity), 1)
  })

  // @ai-generated
  test('caps at max when one is given, still as an integer', () => {
    assert.equal(clampQuantity(9, 5), 5)
    assert.equal(clampQuantity(4.6, 5), 5)
    assert.equal(clampQuantity(3.2, 5), 3)
  })

  // @ai-generated
  test('ignores a missing max', () => {
    assert.equal(clampQuantity(9000), 9000)
    assert.equal(clampQuantity(9000, undefined), 9000)
  })
})
