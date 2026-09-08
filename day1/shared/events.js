/**
 * Socket event names, shared by server and client so a typo fails loudly
 * instead of silently never firing.
 *
 * Loads as a CommonJS module in Node and as a `window.EVENTS` global in the
 * browser, so there is no build step.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EVENTS = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  return {
    /** client -> server: { roomCode, name } — empty roomCode asks for a new room */
    CLIENT_JOIN: 'client:join',
    /** server -> room: authoritative room snapshot; the only source of truth */
    ROOM_STATE: 'room:state',
    /** server -> one client: { message } when a request is rejected */
    ROOM_ERROR: 'room:error',

    /** client -> server: start the game (any player in the room may) */
    CLIENT_START: 'client:start',
    /** client -> server: { text } — chat, which doubles as a guess */
    CLIENT_CHAT: 'client:chat',

    /** server -> the drawer only: { word } — never broadcast */
    ROOM_WORD: 'room:word',
    /** server -> room: { kind: 'chat'|'system'|'correct'|'close', name?, text } */
    CHAT_MESSAGE: 'chat:message',

    /** client -> server: { op } — a stroke delta; only the drawer may send */
    CLIENT_DRAW: 'client:draw',
    /** server -> the rest of the room: { op } to replay */
    ROOM_DRAW: 'room:draw',
    /** server -> one client: { ops } — the turn so far, for catching up */
    ROOM_CANVAS: 'room:canvas',
  };
});
