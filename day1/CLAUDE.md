# CLAUDE.md

## Project

A browser multiplayer **draw-and-guess** game: players join a room by code, one player
draws a secret word on a shared canvas each round while the others guess in chat, and points are awarded
for guessing fast and for being guessed.

Decided with the user, so do not re-litigate:

- **Game:** draw-and-guess with rooms, rounds, a per-round timer, and a scoreboard.
- **Server:** Node + **Socket.IO** (chosen for built-in rooms, auto-reconnect, and transport fallback).
- **Client:** served as static files, no frontend framework and no build step.
- **Language:** all user-facing copy (UI labels, chat and system messages, the word list) is in
  **English**. Do not mix languages — the code and comments are English too.

## Commands

- Install: `npm install`
- Run: `npm start` (http://localhost:3000; override with `PORT=3100 npm start`)
- Dev with reload: `npm run dev` (uses `node --watch`)
- Build the static client: `npm run build` → `dist/` (no bundler; it copies
  `client/` + `shared/` + the Socket.IO browser bundle out of `node_modules`)
- Lint / format: none configured yet.
- Test: **no test tooling in the repo.** Verifying a change means starting the server and driving it by
  hand, or writing a throwaway script. Committing real tests needs an explicit dependency
  (`socket.io-client`), which has not been agreed — raise it before adding one.
  Known gaps, both only reasoned about rather than exercised: the turn-expiry `setTimeout` path in
  `game.js` (a 60s turn is impractical to wait out by hand), and `client/board.js` rendering, which
  has no browser-free test — its element ids and script order are checked statically instead.

Only `socket.io` is a dependency. Static files are served by `server/static.js` on Node's built-in
`http`, deliberately, so there is no Express. `ws` appears in `node_modules` only as a transitive
dependency of Socket.IO — do not import it directly.

## Deployment

The two halves deploy separately, and this constraint shapes the client:

- **`dist/` (client)** → GitHub Pages, via `.github/workflows/pages.yml` on push to `main`.
- **`server/`** → anywhere that runs Node. **Not** Pages: it serves static files only, runs no Node
  and accepts no WebSockets.

Consequences to preserve when editing the client:

- **Asset paths in `client/index.html` must stay relative.** A Pages project site is served from
  `/<repo>/`, so a leading `/` breaks every asset.
- **The Socket.IO browser bundle is vendored, not loaded from a CDN.** `server/static.js` exports
  `VENDORED`, which maps `/socket.io.min.js` to the copy inside the `socket.io` dependency;
  `scripts/build.js` copies the same file into `dist/`. One relative path works in both cases.
- **The server address is configurable** in `client/config.js`: `?server=` query param (remembered in
  `localStorage`), then a baked-in `SERVER_URL`, then same origin. Same origin is the local case, so
  `npm start` needs no configuration.
- **`ALLOWED_ORIGINS`** (comma-separated) is what lets a Pages-hosted client reach the server. It is
  enforced twice on purpose: `cors` for the polling transport, and `allowRequest` for the WebSocket
  upgrade, which `cors` does not cover. A request with no Origin header is still allowed through, so
  this locks out other _websites_, not other clients.

See DEPLOY.md for the user-facing steps.

## Architecture

```
server/index.js    HTTP + Socket.IO wiring; validates events, owns no game rules
server/game.js     round lifecycle: turn order, word, timer, scoring
server/canvas.js   stroke history per room (no socket knowledge)
server/rooms.js    room registry: who is in which room (no socket knowledge)
server/words.js    the word list
server/static.js   static file serving for client/ and shared/
shared/events.js   socket event names, loaded by both sides (CJS + browser global)
shared/draw.js     palette, brush widths, coordinate space — shared the same way
client/board.js    canvas: pointer input and rendering, nothing else
client/            index.html, main.js, styles.css — no build step
```

`game.js` owns the secret word and decides when a turn ends. It never touches sockets: `init()` injects
`getPlayers` / `onState` / `onChat` / `sendWord` from index.js, which avoids a circular require and lets
the rules be tested without a server. `handleGuess()` returns a verdict (`chat` / `correct` / `blocked`)
so index.js can relay a message without ever seeing the word.

There is **one** authoritative snapshot event, `ROOM_STATE`, carrying room + game + scores together.
Resist adding a second state event; two snapshots drift apart. Phases are `lobby` → `drawing` →
`intermission` → (next turn, or back to `lobby` when the game ends).

`shared/events.js` is dual-mode on purpose: `module.exports` in Node, `window.EVENTS` in the browser.
Always add a new event name there rather than typing the string in two places.

`server/rooms.js` takes plain ids and returns plain data, never sockets, so it can be tested without a
running server. Keep it that way.

Three subsystems share one room state; keep them separate in the code:

1. **Room & round lifecycle** (**built**) — join/leave by code, turn rotation, word choice, the 60s
   timer, scoring, and ending the game when players drop below two.
2. **Drawing sync** (**built**) — the drawer emits _ops_ (stroke deltas), never canvas frames.
   `canvas.js` stores the turn's ops; replaying them in order reproduces the drawing, which is how a
   late joiner catches up (`ROOM_CANVAS` on join) and how `client/board.js` repaints on resize.
   Coordinates are normalised 0..1 and brush widths scale from `REFERENCE_WIDTH`, so every player
   sees the same drawing at any canvas size. A clear op empties the history rather than being stored,
   since a cleared board replays as blank. The drawer's own strokes are drawn locally and relayed
   with `socket.to` (not `io.to`), so they are never echoed back.
3. **Chat & guessing** (**built**) — chat messages double as guesses. A correct guess is broadcast as
   `kind: 'correct'` with the player's name and never as plain chat, which would leak the word.

Ground rules that cut across all three:

- **The server is the authority.** It owns the word, the timer, the turn order, and the scores; the
  client only renders what it is told. Never send the secret word to non-drawing clients.
- **Validate every inbound event against the sender's role.** Only the current drawer may emit strokes;
  only non-drawers may guess. Clients can forge any payload.
- **Disconnections are normal, not exceptional.** Handle the drawer leaving mid-round, the last player
  leaving a room (tear it down), and a player rejoining with the round already in progress.

## Don't

- Don't commit without asking first.
- Don't decide on external libraries without asking first. You can suggest though.
