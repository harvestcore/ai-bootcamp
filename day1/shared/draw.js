/**
 * Drawing constants shared by server and client, so the client can never offer
 * a colour or brush the server would reject.
 *
 * Loads as a CommonJS module in Node and as a `window.DRAW` global in the
 * browser, same dual-mode trick as events.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DRAW = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  return {
    /** The last entry is white, which doubles as the eraser on a white board. */
    PALETTE: [
      '#1f1d1b', '#8b8781', '#d64545', '#dd8a2e',
      '#d9c02c', '#3f9455', '#3a7bd5', '#8a4fbd',
      '#8a5a2b', '#ffffff',
    ],
    WIDTHS: [3, 9, 20],
    /** Points are batched per frame; this caps one message. */
    MAX_POINTS_PER_OP: 128,
    /** Strokes are stored in a 0..1 space so any canvas size renders the same. */
    REFERENCE_WIDTH: 800,
  };
});
