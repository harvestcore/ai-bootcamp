/**
 * Client shell. It renders whatever the server says and never keeps its own
 * copy of the game state — the server is the authority.
 *
 * The only local state is `myWord` (the drawer's private word) and the
 * countdown, which ticks between snapshots so the bar moves smoothly.
 */
'use strict';

// An empty serverUrl means same origin, which is the local `npm start` case.
const socket = CONFIG.serverUrl ? io(CONFIG.serverUrl) : io();

const el = (id) => document.getElementById(id);

const joinView = el('join');
const joinForm = el('join-form');
const joinButton = joinForm.querySelector('button');
const roomView = el('room-view');
const errorBox = el('error');
const startButton = el('start');
const startHint = el('start-hint');
const chatForm = el('chat-form');
const chatInput = el('chat-input');
const chatLog = el('chat');

let myWord = null;
let lastState = null;
let msLeft = 0;
let turnMs = 1;

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  clearTimeout(showError.timer);
  showError.timer = setTimeout(() => { errorBox.hidden = true; }, 4000);
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  joinButton.disabled = true;
  socket.emit(EVENTS.CLIENT_JOIN, { name: el('name').value, roomCode: el('room').value });
});

startButton.addEventListener('click', () => socket.emit(EVENTS.CLIENT_START));

// --- board ---

Board.init(el('board'), (op) => socket.emit(EVENTS.CLIENT_DRAW, { op }));
el('clear').addEventListener('click', () => Board.clear());
el('skip').addEventListener('click', () => socket.emit(EVENTS.CLIENT_SKIP));

/** Builds the colour and brush pickers from the shared palette. */
function buildTools() {
  const colours = el('colours');
  DRAW.PALETTE.forEach((colour, index) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.background = colour;
    swatch.title = colour === '#ffffff' ? 'Eraser' : colour;
    swatch.setAttribute('aria-label', swatch.title);
    swatch.addEventListener('click', () => {
      Board.setColour(colour);
      colours.querySelectorAll('.swatch').forEach((el2) => el2.classList.remove('selected'));
      swatch.classList.add('selected');
    });
    if (index === 0) swatch.classList.add('selected');
    colours.append(swatch);
  });

  const widths = el('widths');
  DRAW.WIDTHS.forEach((value, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'brush';
    button.setAttribute('aria-label', `Brush ${value}`);
    const dot = document.createElement('span');
    dot.style.width = `${value}px`;
    dot.style.height = `${value}px`;
    button.append(dot);
    button.addEventListener('click', () => {
      Board.setWidth(value);
      widths.querySelectorAll('.brush').forEach((el2) => el2.classList.remove('selected'));
      button.classList.add('selected');
    });
    if (index === 1) button.classList.add('selected');
    widths.append(button);
  });
}
buildTools();

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit(EVENTS.CLIENT_CHAT, { text });
  chatInput.value = '';
});

/** Blanks the word for guessers, shows it in full to the drawer. */
function wordDisplay(state) {
  if (state.phase === 'drawing') {
    if (state.drawerId === socket.id && myWord) return myWord.toUpperCase().split('').join(' ');
    return '_ '.repeat(state.wordLength ?? 0).trim();
  }
  if (state.revealedWord) return state.revealedWord.toUpperCase().split('').join(' ');
  return '';
}

function statusFor(state) {
  const drawer = state.players.find((player) => player.isDrawer);
  if (state.phase === 'lobby') {
    return state.players.length < state.minPlayers
      ? `Waiting for players (${state.minPlayers} minimum).`
      : 'Ready to start.';
  }
  if (state.phase === 'intermission') return 'Next turn in a moment…';
  if (state.drawerId === socket.id) return "It's your turn to draw. Don't type the word!";
  return `${drawer?.name ?? '?'} is drawing — guess in the chat.`;
}

function render(state) {
  joinView.hidden = true;
  roomView.hidden = false;

  el('room-code').textContent = state.code;
  el('player-count').textContent = String(state.players.length);
  el('turn-label').textContent = state.turn ? `Turn ${state.turn}/${state.totalTurns}` : '';
  el('word').textContent = wordDisplay(state);
  el('status').textContent = statusFor(state);

  const canStart = state.phase === 'lobby' && state.players.length >= state.minPlayers;
  startButton.hidden = state.phase !== 'lobby';
  startButton.disabled = !canStart;
  startHint.hidden = canStart || state.phase !== 'lobby';
  startHint.textContent = `Share code ${state.code} so more players can join.`;

  const drawing = state.phase === 'drawing';
  const iAmDrawer = drawing && state.drawerId === socket.id;
  Board.setEnabled(iAmDrawer);
  el('tools').hidden = !iAmDrawer;

  chatInput.disabled = !drawing || state.drawerId === socket.id;
  chatInput.placeholder = state.drawerId === socket.id ? "You're drawing" : 'Type your guess…';

  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  el('players').replaceChildren(
    ...ranked.map((player) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = player.name;
      if (player.id === socket.id) label.classList.add('is-you');
      if (player.isDrawer) label.textContent += ' ✏️';
      if (player.hasGuessed) label.textContent += ' ✅';
      const score = document.createElement('b');
      score.textContent = String(player.score);
      item.append(label, score);
      return item;
    }),
  );
}

function tick() {
  if (!lastState) return;
  msLeft = Math.max(0, msLeft - 200);
  const fraction = lastState.phase === 'drawing' ? msLeft / turnMs : 0;
  el('timer-bar').style.width = `${Math.round(fraction * 100)}%`;
}
setInterval(tick, 200);

socket.on(EVENTS.ROOM_STATE, (state) => {
  // A new turn means the old private word is stale.
  if (state.phase !== 'drawing' || state.drawerId !== socket.id) myWord = null;
  // A new turn means a blank board for everyone.
  if (!lastState || state.turn !== lastState.turn) Board.reset([]);

  lastState = state;
  turnMs = state.turnMs || 1;
  msLeft = state.msLeft;
  render(state);
});

socket.on(EVENTS.ROOM_WORD, ({ word }) => {
  myWord = word;
  if (lastState) render(lastState);
});

socket.on(EVENTS.ROOM_DRAW, ({ op }) => Board.apply(op));

socket.on(EVENTS.ROOM_CANVAS, ({ ops }) => Board.reset(ops));

socket.on(EVENTS.CHAT_MESSAGE, (message) => {
  const item = document.createElement('li');
  item.className = message.kind;
  item.textContent = message.name ? `${message.name}: ${message.text}` : message.text;
  chatLog.append(item);
  while (chatLog.children.length > 100) chatLog.firstElementChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
});

socket.on(EVENTS.ROOM_ERROR, ({ message }) => {
  joinButton.disabled = false;
  showError(message);
});

const offlinePanel = el('offline');
const serverForm = el('server-form');

serverForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = el('server-url').value.trim();
  if (!url) return;
  // Reload with the address in the query string; config.js remembers it.
  window.location.search = `?server=${encodeURIComponent(url)}`;
});

socket.on('connect', () => {
  offlinePanel.hidden = true;
});

socket.on('connect_error', () => {
  // Static hosting (GitHub Pages) cannot run the server, so this is the
  // expected first-run state there until a server address is given.
  joinView.hidden = true;
  roomView.hidden = true;
  offlinePanel.hidden = false;
  el('offline-detail').textContent = CONFIG.isRemote
    ? `Could not reach the game server at ${CONFIG.serverUrl}. It may be asleep or the address may be wrong.`
    : 'This page is served as static files, which cannot run the game server. Enter the address of a running server.';
  el('server-url').value = CONFIG.serverUrl;
});

socket.on('disconnect', () => {
  // Socket.IO reconnects on its own, but room membership is gone, so the
  // player has to re-join rather than silently sit in a dead room.
  roomView.hidden = true;
  joinView.hidden = false;
  joinButton.disabled = false;
  lastState = null;
  showError('Connection lost. Please join again.');
});
