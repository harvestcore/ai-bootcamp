/**
 * Where the game server lives.
 *
 * GitHub Pages can only host these static files — it cannot run the Node
 * server — so a Pages deployment has to point at a server running elsewhere.
 *
 * Resolution order:
 *   1. `?server=https://host` in the URL (remembered, so the long link is
 *      only needed once per browser)
 *   2. `SERVER_URL` below, baked in for your own deployment
 *   3. the page's own origin — which is what `npm start` serves locally
 */
window.CONFIG = (function () {
  /** Set this to your server before deploying, e.g. 'https://my-game.example.com'. */
  const SERVER_URL = '';

  const STORAGE_KEY = 'draw-and-guess:server';

  function remembered() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return ''; // private mode, or site data blocked
    }
  }

  function remember(url) {
    try {
      window.localStorage.setItem(STORAGE_KEY, url);
    } catch {
      /* nothing we can do, and nothing that needs doing */
    }
  }

  const fromQuery = new URLSearchParams(window.location.search).get('server');
  if (fromQuery) remember(fromQuery.trim());

  const serverUrl = (fromQuery || SERVER_URL || remembered()).trim();

  return {
    /** Empty means "same origin", which `io()` handles by default. */
    serverUrl,
    /** True when the page and the server are not the same host. */
    isRemote: serverUrl !== '',
  };
})();
