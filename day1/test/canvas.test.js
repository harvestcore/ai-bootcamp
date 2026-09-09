'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const canvas = require('../server/canvas');
const { PALETTE, WIDTHS, MAX_POINTS_PER_OP } = require('../shared/draw');

let nextCode = 0;
/** Every test gets its own room code so the shared `boards` map can't leak state between tests. */
function freshCode() {
    nextCode += 1;
    return `room${nextCode}`;
}

// @ai-generated
test('append accepts a valid stroke and clamps/rounds coordinates into 0..1', () => {
    const code = freshCode();
    const op = canvas.append(code, {
        start: true,
        color: PALETTE[0],
        width: WIDTHS[0],
        points: [
            [-0.5, 1.5],
            [0.123456, 0.5],
        ],
    });

    assert.deepEqual(op, {
        start: true,
        color: PALETTE[0],
        width: WIDTHS[0],
        points: [
            [0, 1],
            [0.1235, 0.5],
        ],
    });
    assert.deepEqual(canvas.history(code), [op]);
});

// @ai-generated
test('append rejects malformed ops without touching history', () => {
    const code = freshCode();
    const bad = [
        { color: 'not-a-color', width: WIDTHS[0], points: [[0, 0]] },
        { color: PALETTE[0], width: 999, points: [[0, 0]] },
        { color: PALETTE[0], width: WIDTHS[0], points: [] },
        { color: PALETTE[0], width: WIDTHS[0], points: [[0, 0, 0]] },
        { color: PALETTE[0], width: WIDTHS[0], points: [1, 2] }, // a point that isn't itself an array
        { color: PALETTE[0], width: WIDTHS[0], points: 'nope' },
        'not-an-object',
        null,
    ];

    for (const raw of bad) {
        assert.equal(canvas.append(code, raw), null, `expected ${JSON.stringify(raw)} to be rejected`);
    }
    assert.deepEqual(canvas.history(code), []);
});

// @ai-generated
test('append rejects points with non-numeric or non-finite coordinates', () => {
    const code = freshCode();
    const badPoints = [[['x', 0.5]], [[0.5, 'y']], [[Infinity, 0.5]], [[0.5, NaN]]];

    for (const points of badPoints) {
        const raw = { color: PALETTE[0], width: WIDTHS[0], points };
        assert.equal(canvas.append(code, raw), null, `expected ${JSON.stringify(points)} to be rejected`);
    }
});

// @ai-generated
test('a clear op empties history and is not itself stored', () => {
    const code = freshCode();
    canvas.append(code, { color: PALETTE[0], width: WIDTHS[0], points: [[0, 0]] });

    const op = canvas.append(code, { clear: true });

    assert.deepEqual(op, { clear: true });
    assert.deepEqual(canvas.history(code), []);
});

// @ai-generated
test('append caps points per op at MAX_POINTS_PER_OP', () => {
    const code = freshCode();
    const points = Array.from({ length: MAX_POINTS_PER_OP + 50 }, () => [0, 0]);

    const op = canvas.append(code, { color: PALETTE[0], width: WIDTHS[0], points });

    assert.equal(op.points.length, MAX_POINTS_PER_OP);
});

// @ai-generated
test('append refuses new ops once the room hits MAX_OPS_PER_TURN', () => {
    const code = freshCode();
    const validOp = { color: PALETTE[0], width: WIDTHS[0], points: [[0, 0]] };

    let lastAccepted;
    for (let i = 0; i < 4000; i += 1) {
        lastAccepted = canvas.append(code, validOp);
    }
    assert.notEqual(lastAccepted, null);

    assert.equal(canvas.append(code, validOp), null);
    assert.equal(canvas.history(code).length, 4000);
});

// @ai-generated
test('history() defaults to an empty array for an unknown room', () => {
    assert.deepEqual(canvas.history(freshCode()), []);
});
