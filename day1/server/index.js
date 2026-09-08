'use strict';

/**
 * Server entry point: HTTP for the static client, Socket.IO for the game.
 *
 * The server is the authority. Clients send intents; the server validates them
 * and broadcasts the resulting state. This file only wires events to the
 * modules that own the state — keep game rules in game.js.
 */

const http = require('node:http');
const { Server } = require('socket.io');

const EVENTS = require('../shared/events');
const canvas = require('./canvas');
const game = require('./game');
const rooms = require('./rooms');
const staticFiles = require('./static');

const PORT = Number(process.env.PORT) || 3000;
const MAX_CHAT_LENGTH = 120;

/**
 * Origins allowed to connect from a different host — needed when the client is
 * hosted separately (GitHub Pages) from this server. Comma-separated, e.g.
 * ALLOWED_ORIGINS="https://me.github.io". Unset means same-origin only, which
 * is the right default for local development.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const httpServer = http.createServer(staticFiles.serve);
const io = new Server(
  httpServer,
  ALLOWED_ORIGINS.length > 0
    ? {
        cors: { origin: ALLOWED_ORIGINS },
        /**
         * `cors` only sets response headers, which is what makes a *browser*
         * refuse a bad origin. The WebSocket transport is not covered by that,
         * so the origin is checked here as well or the setting would promise
         * more than it delivers. A missing Origin (curl, health checks,
         * non-browser clients) is still allowed through.
         */
        allowRequest: (req, callback) => {
          const origin = req.headers.origin;
          callback(null, !origin || ALLOWED_ORIGINS.includes(origin));
        },
      }
    : {},
);

/** Broadcasts the authoritative snapshot to everyone still in the room. */
function broadcastRoomState(code) {
  const room = rooms.snapshot(code);
  if (!room) return;
  const state = game.publicState(code);
  io.to(code).emit(EVENTS.ROOM_STATE, {
    ...room,
    ...state,
    players: room.players.map((player) => ({
      ...player,
      score: state.scores[player.id] ?? 0,
      hasGuessed: state.guessedIds?.includes(player.id) ?? false,
      isDrawer: player.id === state.drawerId,
    })),
  });
}

function sendChat(code, message) {
  io.to(code).emit(EVENTS.CHAT_MESSAGE, message);
}

game.init({
  getPlayers: (code) => rooms.snapshot(code)?.players ?? [],
  onState: broadcastRoomState,
  onChat: sendChat,
  sendWord: (playerId, word) => io.to(playerId).emit(EVENTS.ROOM_WORD, { word }),
});

io.on('connection', (socket) => {
  socket.on(EVENTS.CLIENT_JOIN, (payload = {}) => {
    // A socket may only ever be in one room, so a second join is a bug or a
    // forged payload; reject it rather than half-moving the player.
    if (rooms.roomCodeOf(socket.id)) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'You are already in a room.' });
      return;
    }

    const requested = typeof payload.roomCode === 'string' ? payload.roomCode.trim() : '';
    let code;
    if (requested === '') {
      code = rooms.generateRoomCode();
    } else {
      code = rooms.normalizeRoomCode(requested);
      if (!code) {
        socket.emit(EVENTS.ROOM_ERROR, { message: 'A room code is 4 letters.' });
        return;
      }
    }

    const name = rooms.normalizeName(payload.name, `Player-${socket.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4)}`);
    rooms.addPlayer(code, { id: socket.id, name });
    socket.join(code);
    sendChat(code, { kind: 'system', text: `${name} joined.` });
    broadcastRoomState(code);

    // Replay the turn so far, so a late joiner does not stare at a blank board.
    const ops = canvas.history(code);
    if (ops.length > 0) socket.emit(EVENTS.ROOM_CANVAS, { ops });
  });

  socket.on(EVENTS.CLIENT_START, () => {
    const code = rooms.roomCodeOf(socket.id);
    if (!code) return;
    const result = game.start(code);
    if (result.error) socket.emit(EVENTS.ROOM_ERROR, { message: result.error });
  });

  socket.on(EVENTS.CLIENT_DRAW, (payload = {}) => {
    const code = rooms.roomCodeOf(socket.id);
    if (!code) return;
    // Only the current drawer may draw; everyone else is silently ignored.
    if (!game.isDrawer(code, socket.id)) return;

    const op = canvas.append(code, payload.op);
    if (!op) return;

    // `socket.to` excludes the sender: the drawer already drew it locally, so
    // echoing it back would double-draw and add a round-trip of lag.
    socket.to(code).emit(EVENTS.ROOM_DRAW, { op });
  });

  socket.on(EVENTS.CLIENT_CHAT, (payload = {}) => {
    const code = rooms.roomCodeOf(socket.id);
    if (!code) return;

    const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, MAX_CHAT_LENGTH) : '';
    if (!text) return;

    const player = rooms.snapshot(code)?.players.find((p) => p.id === socket.id);
    if (!player) return;

    const verdict = game.handleGuess(code, socket.id, text);
    if (verdict.kind === 'blocked') {
      socket.emit(EVENTS.ROOM_ERROR, { message: verdict.reason });
      return;
    }
    if (verdict.kind === 'correct') {
      // Never echo a correct guess as chat: it would leak the word.
      sendChat(code, { kind: 'correct', text: `${player.name} guessed it!` });
      return;
    }
    sendChat(code, { kind: 'chat', name: player.name, text });
  });

  socket.on('disconnect', () => {
    const code = rooms.roomCodeOf(socket.id);
    if (!code) return;

    const player = rooms.snapshot(code)?.players.find((p) => p.id === socket.id);
    rooms.removePlayer(socket.id);

    if (!rooms.snapshot(code)) {
      game.forget(code); // room is empty; drop its timers without broadcasting
      canvas.clear(code);
      return;
    }
    if (player) sendChat(code, { kind: 'system', text: `${player.name} left.` });
    game.playerLeft(code, socket.id);
    broadcastRoomState(code);
  });
});

httpServer.listen(PORT, () => {
  console.log(`draw-and-guess listening on http://localhost:${PORT}`);
  if (ALLOWED_ORIGINS.length > 0) {
    console.log(`cross-origin clients allowed from: ${ALLOWED_ORIGINS.join(', ')}`);
  }
});
