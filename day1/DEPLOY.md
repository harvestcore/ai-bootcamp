# Deploying

The game has two halves, and they deploy to different places:

| Half | What it is | Where it can live |
| --- | --- | --- |
| `dist/` (the client) | static HTML/CSS/JS | GitHub Pages |
| `server/` (the game) | Node + Socket.IO, holds the secret word, the timer and the scores | **not** GitHub Pages |

GitHub Pages serves static files only — it cannot run Node and cannot accept
WebSocket connections. So Pages can host the page, but the server has to run
somewhere that executes Node.

## 1. The client, on GitHub Pages

`npm run build` assembles `dist/`. There is no bundler: it copies `client/`,
`shared/`, and the browser Socket.IO client out of the `socket.io` dependency.

Pushing to `main` runs `.github/workflows/pages.yml`, which builds and deploys
that directory. One-time setup in the repository: **Settings → Pages → Build and
deployment → Source: GitHub Actions**.

All asset paths are relative, so the page works both at a domain root and at
`https://<user>.github.io/<repo>/`.

## 2. The server, somewhere that runs Node

Any host that runs a Node process works. The requirements are small:

- `npm ci && npm start`
- it must honour the `PORT` environment variable (the server already reads it)
- it must allow WebSocket connections
- set `ALLOWED_ORIGINS` to the Pages origin, e.g.
  `ALLOWED_ORIGINS=https://<user>.github.io` — without it the server accepts
  same-origin requests only and the Pages client will be refused by CORS

Free tiers on services like Render, Railway, or Fly.io fit this. Note that free
tiers usually sleep when idle, so the first connection after a pause can take a
few seconds — the client shows a "No server" panel while that happens.

## 3. Point the client at the server

Any one of these, in the order the client checks them:

1. Append `?server=https://your-server` to the page URL. It is remembered in
   `localStorage`, so the long link is only needed once per browser.
2. Set `SERVER_URL` in `client/config.js` before building — best for a
   permanent deployment.
3. Leave it empty for local development: `npm start` serves the client and the
   server together on one origin, so no configuration is needed.

## Running it all locally

```sh
npm install
npm start          # http://localhost:3000 — client and server together
```

Building is only needed for the Pages deployment; local development serves
`client/` directly.
