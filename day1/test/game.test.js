'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const game = require('../server/game');

let nextCode = 0;
/** Every test gets its own room code; the module keeps a single `games` map for the process. */
function freshCode() {
  nextCode += 1;
  return `game${nextCode}`;
}

/** Builds a fake index.js: a mutable player list plus recorders for what game.js sends out. */
function createDeps(players) {
  const chat = [];
  const stateCalls = [];
  const wordsSent = new Map();
  const deps = {
    getPlayers: () => players,
    onState: (code) => stateCalls.push(code),
    onChat: (_code, message) => chat.push(message),
    sendWord: (playerId, word) => wordsSent.set(playerId, word),
  };
  game.init(deps);
  return { chat, stateCalls, wordsSent };
}

// @ai-generated
test('start enforces MIN_PLAYERS and rejects starting twice', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }];
  createDeps(players);

  assert.equal(game.start(code).error, 'You need at least 2 players.');
  assert.equal(game.publicState(code).phase, 'lobby');

  players.push({ id: 'b', name: 'Bob' });
  assert.deepEqual(game.start(code), { ok: true });
  assert.equal(game.start(code).error, 'The game has already started.');

  game.forget(code);
});

// @ai-generated
test('handleGuess treats a message as plain chat when no game has started for the room', () => {
  const code = freshCode();
  createDeps([{ id: 'a', name: 'Alice' }]);

  assert.deepEqual(game.handleGuess(code, 'a', 'hello'), { kind: 'chat' });
});

// @ai-generated
test('playerLeft is a no-op when no game has started for the room', () => {
  const code = freshCode();
  createDeps([{ id: 'a', name: 'Alice' }]);

  assert.doesNotThrow(() => game.playerLeft(code, 'a'));
});

// @ai-generated
test('start sends the word only to the drawer', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  const { wordsSent } = createDeps(players);

  game.start(code);
  const state = game.publicState(code);
  const guesserId = players.find((p) => p.id !== state.drawerId).id;

  assert.equal(typeof wordsSent.get(state.drawerId), 'string');
  assert.equal(wordsSent.has(guesserId), false);
  assert.equal(state.revealedWord, null);
  assert.equal(state.wordLength, wordsSent.get(state.drawerId).length);

  game.forget(code);
});

// @ai-generated
test('a correct guess scores the guesser and the drawer exactly once', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Cara' }];
  const { wordsSent } = createDeps(players);

  game.start(code);
  const drawerId = game.publicState(code).drawerId;
  const [guesserId] = players.map((p) => p.id).filter((id) => id !== drawerId);
  const word = wordsSent.get(drawerId);

  assert.deepEqual(game.handleGuess(code, guesserId, word), { kind: 'correct' });
  const afterFirst = game.publicState(code);
  assert.ok(afterFirst.scores[guesserId] >= 95, 'guesser should score close to the max for a near-instant guess');
  // The drawer's per-guess bonus (POINTS_PER_PLAYER_GUESSED) is fixed, not time-based.
  assert.equal(afterFirst.scores[drawerId], 25);

  // Guessing again after already being marked correct must not double-score.
  assert.deepEqual(game.handleGuess(code, guesserId, word), { kind: 'chat' });
  const afterRepeat = game.publicState(code);
  assert.equal(afterRepeat.scores[guesserId], afterFirst.scores[guesserId]);
  assert.equal(afterRepeat.scores[drawerId], afterFirst.scores[drawerId]);

  game.forget(code);
});

// @ai-generated
test('a guess matches regardless of case and surrounding whitespace', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  const { wordsSent } = createDeps(players);

  game.start(code);
  const { drawerId } = game.publicState(code);
  const guesserId = players.find((p) => p.id !== drawerId).id;
  const word = wordsSent.get(drawerId);

  const verdict = game.handleGuess(code, guesserId, `  ${word.toUpperCase()}  `);

  assert.deepEqual(verdict, { kind: 'correct' });
  game.forget(code);
});

// @ai-generated
test('the awarded score decays as time in the turn elapses', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  const { wordsSent } = createDeps(players);

  game.start(code);
  const { drawerId } = game.publicState(code);
  const guesserId = players.find((p) => p.id !== drawerId).id;

  t.mock.timers.tick(game.TURN_MS / 2); // halfway through the turn, before it expires

  game.handleGuess(code, guesserId, wordsSent.get(drawerId));

  const score = game.publicState(code).scores[guesserId];
  assert.ok(score >= 45 && score <= 55, `expected a roughly halved score for a half-elapsed turn, got ${score}`);

  game.forget(code);
});

// @ai-generated
test('a wrong guess is plain chat, and the drawer is blocked from guessing', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  createDeps(players);

  game.start(code);
  const { drawerId } = game.publicState(code);
  const guesserId = players.find((p) => p.id !== drawerId).id;

  assert.deepEqual(game.handleGuess(code, guesserId, 'definitely-not-the-word'), { kind: 'chat' });
  assert.deepEqual(game.handleGuess(code, drawerId, 'anything'), {
    kind: 'blocked',
    reason: "You're drawing — you can't chat.",
  });

  const state = game.publicState(code);
  assert.equal(state.scores[drawerId], 0);
  assert.equal(state.scores[guesserId], 0);

  game.forget(code);
});

// @ai-generated
test('the turn ends immediately once every guesser has guessed correctly', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  const { chat, wordsSent } = createDeps(players);

  game.start(code);
  const { drawerId } = game.publicState(code);
  const guesserId = players.find((p) => p.id !== drawerId).id;

  game.handleGuess(code, guesserId, wordsSent.get(drawerId));

  assert.equal(game.publicState(code).phase, 'intermission');
  assert.ok(chat.some((m) => m.text.includes('everyone guessed it')));

  game.forget(code);
});

// @ai-generated
test('playerLeft ends the turn when the current drawer leaves', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Cara' }];
  const { chat } = createDeps(players);

  game.start(code);
  const { drawerId } = game.publicState(code);
  players.splice(players.findIndex((p) => p.id === drawerId), 1); // rooms.js already removed them

  game.playerLeft(code, drawerId);

  assert.equal(game.publicState(code).phase, 'intermission');
  assert.ok(chat.some((m) => m.text.includes('the drawer left')));

  game.forget(code);
});

// @ai-generated
test('playerLeft ends the turn when the last remaining guesser already guessed correctly', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Cara' }];
  const { chat, wordsSent } = createDeps(players);

  game.start(code);
  const { drawerId } = game.publicState(code);
  const [staying, leaving] = players.map((p) => p.id).filter((id) => id !== drawerId);

  game.handleGuess(code, staying, wordsSent.get(drawerId));
  players.splice(players.findIndex((p) => p.id === leaving), 1); // rooms.js already removed them
  game.playerLeft(code, leaving);

  assert.equal(game.publicState(code).phase, 'intermission');
  assert.ok(chat.some((m) => m.text.includes('everyone guessed it')));

  game.forget(code);
});

// @ai-generated
test('the game ends naturally once every scheduled turn has been played', (t) => {
  t.mock.timers.enable();
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  const { chat } = createDeps(players);

  game.start(code); // turn 1 of 4 (TURNS_PER_PLAYER * 2 players)

  // Nobody guesses; force each turn to expire and its intermission to elapse so
  // beginTurn keeps rotating until it hits totalTurns on its own (no disconnects
  // involved, unlike the MIN_PLAYERS-driven endGame covered elsewhere).
  const INTERMISSION_MS = 5_000; // mirrors game.js's private constant, not exported
  for (let i = 0; i < 4; i += 1) {
    t.mock.timers.tick(game.TURN_MS);
    t.mock.timers.tick(INTERMISSION_MS);
  }

  assert.deepEqual(game.publicState(code), {
    phase: 'lobby',
    minPlayers: game.MIN_PLAYERS,
    turnMs: game.TURN_MS,
    scores: {},
  });
  assert.ok(chat.some((m) => m.text === 'Game over.'));
});

// @ai-generated
test('playerLeft ends the game once players drop below MIN_PLAYERS', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  const { chat } = createDeps(players);

  game.start(code);
  players.pop();
  game.playerLeft(code, 'b');

  assert.deepEqual(game.publicState(code), {
    phase: 'lobby',
    minPlayers: game.MIN_PLAYERS,
    turnMs: game.TURN_MS,
    scores: {},
  });
  assert.ok(chat.some((m) => m.text.startsWith('Game over')));
});

// @ai-generated
test('isDrawer reflects the current drawer, including for an unknown room', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  createDeps(players);

  game.start(code);
  const { drawerId } = game.publicState(code);
  const otherId = players.find((p) => p.id !== drawerId).id;

  assert.equal(game.isDrawer(code, drawerId), true);
  assert.equal(game.isDrawer(code, otherId), false);
  assert.equal(game.isDrawer('no-such-room', drawerId), false);

  game.forget(code);
});

// @ai-generated
test('forget tears a game down to the lobby state and is a no-op otherwise', () => {
  const code = freshCode();
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];
  createDeps(players);
  game.start(code);

  game.forget(code);
  assert.equal(game.publicState(code).phase, 'lobby');

  assert.doesNotThrow(() => game.forget(code));
  assert.doesNotThrow(() => game.forget(freshCode()));
});
