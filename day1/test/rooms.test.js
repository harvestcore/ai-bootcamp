'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const rooms = require('../server/rooms');

let nextId = 0;
/** Every test gets its own player ids so state from other tests can't bleed in. */
function freshId() {
  nextId += 1;
  return `p${nextId}`;
}

// @ai-generated
test('normalizeRoomCode trims and uppercases a valid code', () => {
  assert.equal(rooms.normalizeRoomCode('  abcd  '), 'ABCD');
});

// @ai-generated
test('normalizeRoomCode rejects malformed codes', () => {
  for (const bad of [null, undefined, 42, '', 'AB', 'ABCDE', 'AB1D', 'ab-d']) {
    assert.equal(rooms.normalizeRoomCode(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
  }
});

// @ai-generated
test('generateRoomCode produces a code that normalizeRoomCode accepts unchanged', () => {
  const code = rooms.generateRoomCode();
  assert.equal(rooms.normalizeRoomCode(code), code);
});

// @ai-generated
test('normalizeName falls back on blank input', () => {
  assert.equal(rooms.normalizeName('   ', 'Guest'), 'Guest');
  assert.equal(rooms.normalizeName('', 'Guest'), 'Guest');
});

// @ai-generated
test('normalizeName collapses internal whitespace', () => {
  assert.equal(rooms.normalizeName('  Alice    Cooper  ', 'Guest'), 'Alice Cooper');
});

// @ai-generated
test('normalizeName truncates to MAX_NAME_LENGTH', () => {
  assert.equal(rooms.MAX_NAME_LENGTH, 16);
  assert.equal(rooms.normalizeName('This Name Is Definitely Too Long', 'Guest'), 'This Name Is Def');
});

// @ai-generated
test('addPlayer populates the room and the room survives while a player remains', () => {
  const code = 'ROOM';
  const a = freshId();
  const b = freshId();
  rooms.addPlayer(code, { id: a, name: 'Alice' });
  rooms.addPlayer(code, { id: b, name: 'Bob' });

  assert.deepEqual(rooms.snapshot(code).players, [
    { id: a, name: 'Alice' },
    { id: b, name: 'Bob' },
  ]);

  rooms.removePlayer(a);
  assert.deepEqual(rooms.snapshot(code).players, [{ id: b, name: 'Bob' }]);
});

// @ai-generated
test('removePlayer tears the room down once the last player leaves', () => {
  const code = 'GONE';
  const a = freshId();
  rooms.addPlayer(code, { id: a, name: 'Alice' });

  const leftCode = rooms.removePlayer(a);

  assert.equal(leftCode, code);
  assert.equal(rooms.snapshot(code), null);
});

// @ai-generated
test('removePlayer on a player who was never in a room returns null', () => {
  assert.equal(rooms.removePlayer(freshId()), null);
});

// @ai-generated
test('roomCodeOf reflects current membership', () => {
  const code = 'TRAK';
  const a = freshId();
  assert.equal(rooms.roomCodeOf(a), null);

  rooms.addPlayer(code, { id: a, name: 'Alice' });
  assert.equal(rooms.roomCodeOf(a), code);

  rooms.removePlayer(a);
  assert.equal(rooms.roomCodeOf(a), null);
});
