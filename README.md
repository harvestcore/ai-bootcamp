# AI Bootcamp

Personal repository where I keep what I build during an AI bootcamp. One
directory per day, each a self-contained project with its own dependencies,
scripts and documentation.

## Layout

```
day1/    Draw & Guess — multiplayer draw-and-guess game
```

Every `dayN/` directory stands alone: it is installed and run on its own, and
shares no code with the others.

## Days

### Day 1 — Draw & Guess

A browser multiplayer game: players join a room by code, one of them draws a
secret word on a shared canvas and the rest try to guess it in chat. It has
rounds, a per-round timer and a scoreboard.

- **Server:** Node + Socket.IO (rooms, auto-reconnect and transport fallback
  come for free). The server is the authority: it owns the word, the timer, the
  turn order and the scores.
- **Client:** HTML/CSS/JS served as static files — no framework, no build step.
- **Drawing sync:** the drawer emits *ops* (stroke deltas) with coordinates
  normalised to 0..1, never canvas frames, so replaying the ops in order
  reproduces the drawing. That is what lets a late joiner catch up and the
  canvas repaint on resize.

```sh
cd day1
npm install
npm start          # http://localhost:3000
```

Architecture notes live in [day1/CLAUDE.md](day1/CLAUDE.md), and the deployment
steps (client on GitHub Pages, server on any Node host) in
[day1/DEPLOY.md](day1/DEPLOY.md).

## How I work here

These projects are built with [Claude Code](https://claude.com/claude-code).
Each day carries a `CLAUDE.md` with the project's context: decisions already
made, commands, architecture, and the rules not to break. It is the file to read
— by me and by the agent — before touching anything.

## Requirements

- Node.js >= 20

## License

[MIT](LICENSE).
