# CLAUDE.md

## Project

An offline-first PWA to track loose LEGO bricks salvaged from completed sets, stored in
workshop drawer organizers: search by part number or piece name, see which drawer/compartment
holds them, and get a suggested location when adding new pieces.

Full behavioural spec: [`lego-inventory-spec.md`](lego-inventory-spec.md) (contract-ready, all
acceptance criteria closed). UX/UI design: [`lego-inventory-ux-ui.md`](lego-inventory-ux-ui.md).
Decision history: [`SESSION_LOG.md`](SESSION_LOG.md). **Read the spec before changing behaviour** —
it is the source of truth for every rule below, **except** the point in "Deviations from the written
spec" — this file only covers implementation decisions the spec doesn't dictate, plus that one
explicit override.

### Deviations from the written spec

The user later asked, in-session, to override one already-"closed" part of the spec — noted here
rather than silently rewriting `lego-inventory-spec.md`'s history:

- **The LEGO part number is mandatory, not optional, and there is no free-text description field.**
  The spec (and its acceptance criteria) describe description as required and part number as
  optional. In practice: adding or editing a piece requires a part number; the piece's display name
  (`description` in the data model — the field name wasn't renamed, only how it's populated) is
  always the catalog's official name for that number, or `Part #<num>` when the number isn't in the
  bundled catalog. Personal/free-text notes remain optional and are considered sufficient for
  anything the catalog name doesn't capture. This makes the spec's "match by normalized description"
  duplicate-detection branch effectively dead code in normal use (part number is always present now),
  though `matching.js` still implements it for completeness/defensiveness.

Decided with the user, so do not re-litigate:

- **Stack:** Vite + vanilla JS (ES modules), no UI framework. Chosen over a no-build setup (like
  day1) because this app needs a real build step (PWA/service worker, multiple screens, IndexedDB)
  — but still no React/Preact, matching the bootcamp's "minimal dependencies" spirit.
- **Rendering:** each screen is a plain function that sets `innerHTML` from a template string and
  attaches listeners (event delegation where useful). No virtual DOM, no reactive framework. State
  lives in `src/lib/store.js` as an in-memory cache loaded from IndexedDB at boot; every mutation
  writes through to IndexedDB and the calling screen re-renders itself directly (there is no global
  pub/sub — each screen manages its own redraw after an action; a global "refresh on every store
  write" was tried and removed because it wiped in-progress multi-step forms, e.g. the Add-piece
  wizard, whenever any store write happened mid-flow).
- **Catalog data:** the entire [Rebrickable CSV download](https://rebrickable.com/downloads/) (every
  file it offers) is bundled under `lego-inventory-helper/public/catalog/`, but only three files are
  actually indexed into IndexedDB on first launch — `parts.csv`, `colors.csv`, and
  `inventory_parts.csv`. See `public/catalog/CATALOG.md` for the full file-by-file breakdown of what's
  used vs. kept for provenance only (sets/themes/minifigs/inventories are irrelevant to a loose-parts
  inventory tool).
  **Colors are filtered per part** (`getAvailableColorsForPart`) using `inventory_parts.csv`'s
  part+color combinations — falls back to the full palette when a part has no recorded color data.
  **Real piece photos**: `inventory_parts.csv` uniquely includes an `img_url` column pointing at
  Rebrickable's own CDN — no API key needed, unlike their REST API. Every piece shows that real photo
  when one is on record for its exact part+color combo, falling back to the generic placeholder
  silhouette otherwise (no recorded photo, a custom "Other" color, or the image fails to load). This
  is the one place the app isn't fully offline: the photo bytes are fetched from `cdn.rebrickable.com`
  at view time (only the URL is bundled/indexed, not ~100k actual images), though `public/sw.js`
  opportunistically caches any image successfully viewed once for offline reuse later. Everything else
  stays fully offline regardless.
- **PWA / offline:** hand-written `manifest.webmanifest` and `public/sw.js` (runtime cache-as-you-go
  service worker: cache-first for same-origin GETs plus `cdn.rebrickable.com` image requests, falls
  back to network then to the cached `index.html` for navigations). No `vite-plugin-pwa` or workbox —
  avoided to not add a build-time dependency decision beyond Vite itself.
  **The service worker only ever registers in a production build** (`import.meta.env.PROD`), never
  under `vite dev` — `vite dev` serves unhashed module paths (`/src/lib/db.js`), so a SW registered
  there would cache-first serve stale JS indefinitely across edits, including stale IndexedDB schema
  code (this caused a real "object store not found" bug once). `main.js#cleanUpStaleServiceWorker`
  also self-heals a browser that already has a dev-registered SW from before this fix: it unregisters
  and clears caches, and — since an *already*-controlling SW keeps intercepting this same page's own
  module fetches until the document unloads, racing any cleanup done from within it — forces exactly
  one `location.reload()` when a controller was found, so the next load has no SW involved at all.
- **Icons:** generated programmatically (`node` + built-in `zlib`, no image library) as a simple
  placeholder brick-stud silhouette — deliberately generic, no LEGO branding, per the UX doc's design
  principles.
- **IndexedDB:** hand-written wrapper (`src/lib/db.js`), no `idb` or similar helper library.

## Commands

```sh
cd lego-inventory-helper
npm install
npm run dev       # http://localhost:5173, override with --port
npm run build     # → dist/
npm run preview   # serve the production build locally
```

No test tooling is configured yet (matches day1's stance) — verified so far by building
(`npm run build`, catches syntax/import errors) and driving the running app with a scripted headless
browser (Playwright, installed ad hoc, not a project dependency) to exercise: catalog indexing on
first load, drawer setup, the full Add-piece flow (details → duplicate detection → location →
partition split), search, extraction to zero, and the setup screen's orphan-blocking. All passed with
no console errors. If real automated tests get added later, raise the tooling choice first (per the
root CLAUDE.md's "don't decide on external libraries without asking").

## Architecture

```
lego-inventory-helper/
  public/
    manifest.webmanifest   PWA manifest
    sw.js                  runtime-caching service worker (no precache manifest/build plugin)
    icons/                 generated placeholder icons (192/512/180)
    catalog/               bundled Rebrickable CSVs + CATALOG.md (provenance, what's indexed)
  src/
    main.js                boot: index catalog → load store → register routes → mount router
    router.js               tiny hash router (defineRoute/navigate/refresh), no history API
    styles.css              single stylesheet, CSS custom properties for light/dark
    lib/
      db.js                 raw IndexedDB wrapper (openDb, tx, get/put/del/getAll)
      csv.js                minimal quoted-field CSV parser (no dependency)
      catalog.js             indexes parts.csv/colors.csv into IndexedDB once; part/color lookups
      matching.js             duplicate-detection and same-type rules (spec's exact matching logic)
      store.js                in-memory state + every mutation (add/extract/edit/move/delete/setup),
                              each one also appending to the global movement log
      ids.js, format.js       id/key helpers, date + HTML-escaping helpers
    components/              grid.js (compartment grid, shared by Home's mini-grid and the full
                              Drawer unit view), colorSwatch.js, pieceImage.js (real photo + fallback
                              placeholder), badges.js, colorPicker.js (color list, filtered per part),
                              partSearch.js (catalog name/part-number autocomplete, used by Add/Edit)
    screens/                 one render(root, params, query) function per screen (see UX doc's
                              8-screen inventory); compartmentDetail.js renders as a panel inside
                              drawerUnit.js rather than its own route, matching "grid stays visible
                              behind it" from the UX doc
```

Key domain rules implemented in `store.js` (see the spec for the "why", this is just where to find
the "how"):

- **Compartments are derived, not reserved.** A compartment's occupants are computed live from the
  `pieces` store (filter by unitId+compartmentIndex); there's no separate "this partition is taken"
  flag. That's what makes reclaiming a partition after full extraction automatic (spec requirement)
  — it just falls out of the occupant count, no extra bookkeeping.
- **`partitionCount`/`partitionsFull` persist on a separate `compartments` record**, created lazily
  the first time a compartment is touched (subdivided or marked full). It does **not** shrink back to
  1 when a partition empties out — an already-subdivided compartment keeps its slots.
- **"Structurally full" vs. "manually full" are different gates.** Manually full = every partition
  marked full by the user (excluded from suggestions and disabled in the location picker, but no
  smaller test than the spec's own wording). Structurally full = 3 distinct-color occupants already
  present (the hard max), independent of any manual flag. Both exclude a compartment from
  suggestion/manual-pick; only the manual one is ever toggled by the user.
- **Duplicate detection vs. "same type" grouping use the same underlying rule** (part number when
  both pieces have one, else normalized description) — `matching.js`'s `isSameType` is that rule
  alone, `isDuplicateMatch` is `isSameType` **and** matching color. Grouping (location suggestion,
  triggering a partition split) uses `isSameType` only, deliberately ignoring color, since two
  different colors of the same piece type is exactly the case subdivisions exist for.
- **Movement log entries carry a `locations: [{unitId, compartmentIndex}, …]` array**, not a single
  location — a `move` entry gets both the destination and origin (when they differ) so filtering the
  global log by unit/compartment finds the entry from either side, without duplicating the entry.

## Don't

- Don't commit without asking first.
- Don't decide on external libraries without asking first (this includes test frameworks, an
  IndexedDB helper, a PWA build plugin, or an image library for icons) — the choices above were
  already made deliberately to avoid adding any. You can suggest, but ask before adding.
- Don't refactor day1 or touch anything outside `day4/` while working here.
- Don't reintroduce a free-text description field without checking with the user first — see
  "Deviations from the written spec" above; the current design is deliberate, not an oversight.
