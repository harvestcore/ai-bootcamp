'use strict';

/**
 * In-memory room registry. Owns *who is in which room* and nothing else —
 * round lifecycle, drawing and scoring live in their own modules so this stays
 * the one place that answers "which players are in room X".
 *
 * Deliberately knows nothing about sockets: it takes plain ids and returns
 * plain data, which keeps it testable without a server.
 */

const ROOM_CODE_PATTERN = /^[A-Z]{4}$/;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, easy to read aloud
const ROOM_CODE_LENGTH = 4;
const MAX_NAME_LENGTH = 16;

/** roomCode -> { code, players: Map<playerId, { id, name }> } */
const rooms = new Map();
/** playerId -> roomCode, so a disconnect does not have to scan every room */
const playerRooms = new Map();

function normalizeRoomCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

function normalizeName(raw, fallback) {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!name) return fallback;
  return name.slice(0, MAX_NAME_LENGTH);
}

function generateRoomCode() {
  // Rooms are short-lived and few, so retrying on collision is cheap.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('could not allocate a free room code');
}

function addPlayer(code, { id, name }) {
  let room = rooms.get(code);
  if (!room) {
    room = { code, players: new Map() };
    rooms.set(code, room);
  }
  room.players.set(id, { id, name });
  playerRooms.set(id, code);
  return room;
}

/**
 * Removes a player from whichever room they were in, tearing the room down
 * once it is empty. Returns the room code they left, or null if they were in
 * none (a socket that disconnects before joining).
 */
function removePlayer(id) {
  const code = playerRooms.get(id);
  if (!code) return null;
  playerRooms.delete(id);

  const room = rooms.get(code);
  if (!room) return code;

  room.players.delete(id);
  if (room.players.size === 0) rooms.delete(code);
  return code;
}

function roomCodeOf(id) {
  return playerRooms.get(id) ?? null;
}

/** Serializable snapshot — exactly what a client is allowed to know. */
function snapshot(code) {
  const room = rooms.get(code);
  if (!room) return null;
  return {
    code: room.code,
    players: [...room.players.values()].map((player) => ({ id: player.id, name: player.name })),
  };
}

module.exports = {
  MAX_NAME_LENGTH,
  addPlayer,
  generateRoomCode,
  normalizeName,
  normalizeRoomCode,
  removePlayer,
  roomCodeOf,
  snapshot,
};
