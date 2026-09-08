'use strict';

/**
 * Stroke history per room, so a player who joins or reconnects mid-turn can be
 * replayed the drawing so far.
 *
 * Strokes are stored as *ops*, each one either a clear or a run of points to
 * connect. Replaying the ops in order reproduces the drawing exactly, which is
 * why nothing here ever rasterises: no canvas frames, only deltas.
 *
 * Like rooms.js this knows nothing about sockets.
 */

const { MAX_POINTS_PER_OP, PALETTE, WIDTHS } = require('../shared/draw');

/** One 60s turn produces a few hundred ops; this only bounds a hostile client. */
const MAX_OPS_PER_TURN = 4000;

const COLORS = new Set(PALETTE);
const BRUSHES = new Set(WIDTHS);

/** roomCode -> ops[] */
const boards = new Map();

/** Clamps to the 0..1 space and drops the precision we cannot see. */
function coordinate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
}

/**
 * Validates a client-supplied op. Returns a fresh, trusted object or null —
 * the raw payload is never stored, since a client can forge any shape.
 */
function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.clear === true) return { clear: true };

  if (!COLORS.has(raw.color) || !BRUSHES.has(raw.width)) return null;
  if (!Array.isArray(raw.points) || raw.points.length === 0) return null;

  const points = [];
  for (const point of raw.points.slice(0, MAX_POINTS_PER_OP)) {
    if (!Array.isArray(point) || point.length !== 2) return null;
    const x = coordinate(point[0]);
    const y = coordinate(point[1]);
    if (x === null || y === null) return null;
    points.push([x, y]);
  }

  return { start: raw.start === true, color: raw.color, width: raw.width, points };
}

/**
 * Appends an op to the room's board. Returns the sanitized op to broadcast, or
 * null if it was invalid or the board is full.
 */
function append(code, raw) {
  const op = sanitize(raw);
  if (!op) return null;

  if (op.clear) {
    // A cleared board replays as blank, so the history can simply be dropped.
    boards.set(code, []);
    return op;
  }

  let ops = boards.get(code);
  if (!ops) {
    ops = [];
    boards.set(code, ops);
  }
  if (ops.length >= MAX_OPS_PER_TURN) return null;

  ops.push(op);
  return op;
}

function history(code) {
  return boards.get(code) ?? [];
}

/** Called at the start of every turn, and when a room is torn down. */
function clear(code) {
  boards.delete(code);
}

module.exports = { append, clear, history };
