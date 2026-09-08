/**
 * The drawing board: pointer input, rendering, and nothing else.
 *
 * It renders *ops* (the same deltas the server stores) and keeps its own copy
 * so it can repaint from scratch when the canvas is resized. Coordinates are
 * normalised 0..1, so every player sees the same drawing at any size.
 */
'use strict';

window.Board = (function () {
  const REPAINT_MS = 40; // batch pointer moves into ~25 messages/second

  let canvas = null;
  let ctx = null;
  let emit = () => {};

  let ops = [];
  let enabled = false;
  let colour = window.DRAW.PALETTE[0];
  let width = window.DRAW.WIDTHS[1];

  let drawing = false;
  let startingStroke = false;
  let pending = [];
  let lastPoint = null; // where the live stroke left off, in 0..1 space

  function surfaceWidth() {
    return canvas.width / (window.devicePixelRatio || 1);
  }

  function surfaceHeight() {
    return canvas.height / (window.devicePixelRatio || 1);
  }

  function paintBackground() {
    ctx.fillStyle = '#ffffff'; // the board is always white, in either theme
    ctx.fillRect(0, 0, surfaceWidth(), surfaceHeight());
  }

  /** Brush widths are authored for an 800px board and scale from there. */
  function scaledWidth(value) {
    return Math.max(1, value * (surfaceWidth() / window.DRAW.REFERENCE_WIDTH));
  }

  function toPixels([x, y]) {
    return [x * surfaceWidth(), y * surfaceHeight()];
  }

  function paintOp(op, cursor) {
    if (op.clear) {
      paintBackground();
      return null;
    }

    ctx.strokeStyle = op.color;
    ctx.fillStyle = op.color;
    ctx.lineWidth = scaledWidth(op.width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const from = op.start ? op.points[0] : cursor ?? op.points[0];

    // A tap with no movement still has to leave a mark.
    if (op.start && op.points.length === 1 && !cursor) {
      const [px, py] = toPixels(op.points[0]);
      ctx.beginPath();
      ctx.arc(px, py, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return op.points[0];
    }

    ctx.beginPath();
    ctx.moveTo(...toPixels(from));
    for (const point of op.points) ctx.lineTo(...toPixels(point));
    ctx.stroke();
    return op.points[op.points.length - 1];
  }

  /** Repaints everything from the op list — used on resize and on reset. */
  function repaint() {
    paintBackground();
    let cursor = null;
    for (const op of ops) cursor = paintOp(op, cursor);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = Math.round((cssWidth * 3) / 4); // 4:3 board
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    repaint();
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    ];
  }

  /** Sends the points collected since the last flush, if any. */
  function flush() {
    if (pending.length === 0) return;

    const op = { start: startingStroke, color: colour, width, points: pending };
    pending = [];
    startingStroke = false;

    ops.push(op);
    lastPoint = paintOp(op, op.start ? null : lastPoint);
    emit(op);
  }

  function onPointerDown(event) {
    if (!enabled) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawing = true;
    startingStroke = true;
    lastPoint = null;
    pending = [pointFrom(event)];
    flush();
  }

  function onPointerMove(event) {
    if (!enabled || !drawing) return;
    event.preventDefault();
    pending.push(pointFrom(event));
    if (pending.length >= window.DRAW.MAX_POINTS_PER_OP) flush();
  }

  function onPointerUp() {
    if (!drawing) return;
    drawing = false;
    flush();
  }

  return {
    init(element, onOp) {
      canvas = element;
      ctx = canvas.getContext('2d');
      emit = onOp;

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('pointerleave', onPointerUp);
      window.addEventListener('resize', resize);
      setInterval(flush, REPAINT_MS);

      resize();
    },

    /** Applies an op that came from the server. */
    apply(op) {
      ops.push(op);
      lastPoint = paintOp(op, op.start ? null : lastPoint);
    },

    /** Replaces the board with `nextOps` (empty for a fresh turn). */
    reset(nextOps) {
      ops = Array.isArray(nextOps) ? [...nextOps] : [];
      lastPoint = null;
      drawing = false;
      pending = [];
      repaint();
    },

    setEnabled(value) {
      enabled = value;
      if (!value) {
        drawing = false;
        pending = [];
      }
      canvas.classList.toggle('is-drawable', value);
    },

    setColour(value) {
      colour = value;
    },

    setWidth(value) {
      width = value;
    },

    /** Drops the most recent stroke and repaints from what is left. */
    undo() {
      if (ops.length === 0) return;
      ops.pop();
      lastPoint = null;
      repaint();
    },

    /** Asks the server to clear; the echo repaints everyone, including us. */
    clear() {
      const op = { clear: true };
      ops = [];
      lastPoint = null;
      repaint();
      emit(op);
    },
  };
})();
