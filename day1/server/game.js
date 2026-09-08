'use strict';

/**
 * Round lifecycle: turn order, word choice, the timer, and scoring.
 *
 * This module owns the secret word and decides when a turn ends. It never
 * touches sockets — `init()` injects the few things it needs from the server,
 * which keeps it testable and avoids a circular require with index.js.
 */

const canvas = require('./canvas');
const WORDS = require('./words');

const TURN_MS = 60_000;
const INTERMISSION_MS = 5_000;
const TURNS_PER_PLAYER = 2;
const MIN_PLAYERS = 2;
const MAX_POINTS_PER_GUESS = 100;
const MIN_POINTS_PER_GUESS = 10;
const POINTS_PER_PLAYER_GUESSED = 25;
/** How many times the drawer may swap the word in a turn. */
const SKIPS_PER_TURN = 1;

/** @type {{ getPlayers: (code: string) => Array<{id: string, name: string}>, onState: (code: string) => void, onChat: (code: string, message: object) => void, sendWord: (playerId: string, word: string|null) => void }} */
let deps = null;

/** roomCode -> game */
const games = new Map();

function init(injected) {
  deps = injected;
}

/** Strips case, accents and spacing so " Café " matches "cafe". */
function normalizeGuess(text) {
  return String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function pickWord(used) {
  const available = WORDS.filter((word) => !used.has(word));
  const pool = available.length > 0 ? available : WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function clearTimer(game) {
  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }
}

/** The public snapshot. Deliberately never includes the word while drawing. */
function publicState(code) {
  const game = games.get(code);
  if (!game) {
    return { phase: 'lobby', minPlayers: MIN_PLAYERS, turnMs: TURN_MS, scores: {} };
  }
  return {
    phase: game.phase,
    turn: game.turn,
    totalTurns: game.totalTurns,
    drawerId: game.drawerId,
    wordLength: game.phase === 'drawing' ? game.word.length : null,
    revealedWord: game.phase === 'drawing' ? null : game.word,
    msLeft: Math.max(0, game.endsAt - Date.now()),
    turnMs: TURN_MS,
    guessedIds: [...game.guessed],
    scores: Object.fromEntries(game.scores),
    minPlayers: MIN_PLAYERS,
  };
}

function scoreFor(game) {
  const fraction = Math.max(0, game.endsAt - Date.now()) / TURN_MS;
  const points = Math.round(MAX_POINTS_PER_GUESS * fraction);
  return Math.max(MIN_POINTS_PER_GUESS, points);
}

function addScore(game, playerId, points) {
  game.scores.set(playerId, (game.scores.get(playerId) ?? 0) + points);
}

/** Players currently in the room who are expected to guess this turn. */
function guessersOf(game, code) {
  return deps.getPlayers(code).filter((player) => player.id !== game.drawerId);
}

function start(code) {
  if (games.has(code)) return { error: 'The game has already started.' };

  const players = deps.getPlayers(code);
  if (players.length < MIN_PLAYERS) {
    return { error: `You need at least ${MIN_PLAYERS} players.` };
  }

  games.set(code, {
    phase: 'drawing',
    order: players.map((player) => player.id),
    turn: 0,
    totalTurns: players.length * TURNS_PER_PLAYER,
    drawerId: null,
    word: null,
    usedWords: new Set(),
    endsAt: 0,
    guessed: new Set(),
    scores: new Map(players.map((player) => [player.id, 0])),
    timer: null,
    skipsUsed: 0,
  });

  beginTurn(code);
  return { ok: true };
}

function beginTurn(code) {
  const game = games.get(code);
  if (!game) return;

  // Drop players who left, so the rotation never lands on a ghost.
  const present = new Set(deps.getPlayers(code).map((player) => player.id));
  game.order = game.order.filter((id) => present.has(id));
  for (const player of deps.getPlayers(code)) {
    if (!game.order.includes(player.id)) game.order.push(player.id);
    if (!game.scores.has(player.id)) game.scores.set(player.id, 0);
  }

  if (game.order.length < MIN_PLAYERS) {
    endGame(code, `You need ${MIN_PLAYERS} players to keep going.`);
    return;
  }
  if (game.turn >= game.totalTurns) {
    endGame(code, null);
    return;
  }

  game.phase = 'drawing';
  canvas.clear(code); // every turn starts on a blank board
  game.drawerId = game.order[game.turn % game.order.length];
  game.word = pickWord(game.usedWords);
  game.usedWords.add(game.word);
  game.guessed = new Set();
  game.endsAt = Date.now() + TURN_MS;
  game.turn += 1;

  clearTimer(game);
  game.timer = setTimeout(() => endTurn(code, 'time ran out'), TURN_MS);

  // Only the drawer ever learns the word.
  deps.sendWord(game.drawerId, game.word);

  const drawer = deps.getPlayers(code).find((player) => player.id === game.drawerId);
  deps.onChat(code, { kind: 'system', text: `Turn ${game.turn}/${game.totalTurns}: ${drawer?.name ?? '?'} is drawing.` });
  deps.onState(code);
}

function endTurn(code, reason) {
  const game = games.get(code);
  if (!game || game.phase !== 'drawing') return;

  clearTimer(game);
  game.phase = 'intermission';
  game.endsAt = Date.now() + INTERMISSION_MS;

  deps.onChat(code, { kind: 'system', text: `Turn over (${reason}). The word was "${game.word}".` });
  deps.onState(code);

  game.timer = setTimeout(() => beginTurn(code), INTERMISSION_MS);
}

function endGame(code, reason) {
  const game = games.get(code);
  if (!game) return;

  clearTimer(game);
  const finalScores = new Map(game.scores);
  games.delete(code);

  const players = deps.getPlayers(code);
  const ranking = [...finalScores.entries()]
    .map(([id, score]) => ({ name: players.find((p) => p.id === id)?.name ?? '?', score }))
    .sort((a, b) => b.score - a.score);

  const summary = ranking.map((row, i) => `${i + 1}. ${row.name} ${row.score}`).join('  ·  ');
  deps.onChat(code, { kind: 'system', text: reason ? `Game over: ${reason}` : 'Game over.' });
  if (summary) deps.onChat(code, { kind: 'system', text: `Final scores — ${summary}` });
  deps.onState(code);
}

/**
 * Handles a chat message as a possible guess.
 * Returns how the server should treat it, so index.js never sees the word.
 */
function handleGuess(code, playerId, text) {
  const game = games.get(code);
  if (!game || game.phase !== 'drawing') return { kind: 'chat' };
  if (playerId === game.drawerId) return { kind: 'blocked', reason: "You're drawing — you can't chat." };
  if (game.guessed.has(playerId)) return { kind: 'chat' };

  if (normalizeGuess(text) !== normalizeGuess(game.word)) return { kind: 'chat' };

  game.guessed.add(playerId);
  addScore(game, playerId, scoreFor(game));
  addScore(game, game.drawerId, POINTS_PER_PLAYER_GUESSED);

  const everyoneGuessed = guessersOf(game, code).every((player) => game.guessed.has(player.id));
  if (everyoneGuessed) {
    endTurn(code, 'everyone guessed it');
  } else {
    deps.onState(code);
  }
  return { kind: 'correct' };
}

/**
 * Swaps the drawer's word for a different one. Some words are much harder to
 * draw than others, and a stuck drawer wastes the whole turn for everyone.
 */
function skipWord(code) {
  const game = games.get(code);
  if (!game) return { error: 'No game is running.' };
  if (game.skipsUsed >= SKIPS_PER_TURN) return { error: 'You have already skipped this turn.' };

  game.skipsUsed += 1;
  game.word = pickWord(game.usedWords);
  game.usedWords.add(game.word);

  deps.sendWord(game.drawerId, game.word);
  deps.onChat(code, { kind: 'system', text: 'The drawer swapped the word.' });
  deps.onState(code);
  return { ok: true };
}

/** Called when a player disconnects; keeps the turn from stalling on a ghost. */
function playerLeft(code, playerId) {
  const game = games.get(code);
  if (!game) return;

  game.scores.delete(playerId);
  game.guessed.delete(playerId);
  game.order = game.order.filter((id) => id !== playerId);

  if (deps.getPlayers(code).length < MIN_PLAYERS) {
    endGame(code, `You need ${MIN_PLAYERS} players to keep going.`);
    return;
  }
  if (playerId === game.drawerId && game.phase === 'drawing') {
    endTurn(code, 'the drawer left');
    return;
  }
  if (game.phase === 'drawing' && guessersOf(game, code).every((player) => game.guessed.has(player.id))) {
    endTurn(code, 'everyone guessed it');
  }
}

/** Tears a game down with no broadcasts, for when the room itself is gone. */
function forget(code) {
  const game = games.get(code);
  if (!game) return;
  clearTimer(game);
  games.delete(code);
}

function isDrawer(code, playerId) {
  return games.get(code)?.drawerId === playerId;
}

module.exports = {
  MIN_PLAYERS,
  TURN_MS,
  forget,
  handleGuess,
  init,
  isDrawer,
  playerLeft,
  publicState,
  skipWord,
  start,
};
