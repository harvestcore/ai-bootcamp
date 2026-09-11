# CLAUDE.md

## Project

A local app to track loose LEGO bricks salvaged from completed sets, stored in workshop drawer
organizers: search by part number or piece name, see which drawer/compartment holds them, and get a
suggested location when adding new pieces. It runs on your own machine — a small Node server plus a
React UI in the browser — and keeps everything in one SQLite file.

Full behavioural spec: [`lego-inventory-spec.md`](lego-inventory-spec.md) (contract-ready, all
acceptance criteria closed). UX/UI design: [`lego-inventory-ux-ui.md`](lego-inventory-ux-ui.md).
Decision history: [`SESSION_LOG.md`](SESSION_LOG.md). **Read the spec before changing behaviour** —
it is the source of truth for every rule below, **except** the points in "Deviations from the written
spec" — this file only covers implementation decisions the spec doesn't dictate, plus those explicit
overrides.

### Deviations from the written spec

The user later asked, in-session, to override parts of the spec that were already "closed" — noted
here rather than silently rewriting `lego-inventory-spec.md`'s history:

- **The LEGO part number is mandatory, not optional, and there is no free-text description field.**
  The spec (and its acceptance criteria) describe description as required and part number as
  optional. In practice: adding or editing a piece requires a part number; the piece's display name
  (`description` in the data model — the field name wasn't renamed, only how it's populated) is
  always the catalog's official name for that number, or `Part #<num>` when the number isn't in the
  bundled catalog. Personal/free-text notes remain optional and are considered sufficient for
  anything the catalog name doesn't capture. This makes the spec's "match by normalized description"
  duplicate-detection branch effectively dead code in normal use (part number is always present now),
  though `matching.ts` still implements it for completeness/defensiveness.
- **The UI is a React single-page app, not the vanilla-JS one the first implementation used.** The
  behaviour didn't change; the implementation and the visual design did. See "Stack" below.
- **Search matches more than the spec asks for, and there is an Import.** The spec's search covers
  description and part number; `searchPieces` also matches the color name and the notes, because
  "the red plates" is how people actually look for a piece. The spec also settled on manual export
  only — there is now a matching **restore from an exported JSON** (Setup → Backups), plus a
  download of the `.sqlite` file itself. Restoring replaces the whole inventory and is confirmed
  first; an empty payload is refused.
- **Storage is a SQLite file on disk, not browser storage.** The spec says "all data stored locally
  in browser (IndexedDB or localStorage)" and lists browser storage quotas as a constraint; the user
  asked instead for a real `.sqlite` file they own. It is still *local-only* — nothing leaves the
  machine, there is no cloud and no account — but the data now lives in `data/inventory.sqlite`,
  served by a Node process on localhost, and the browser storage quota constraint no longer applies.
  The trade-off accepted with this: the app is no longer an installable offline PWA you can open on a
  phone with no server running; it needs `npm start` on the machine that holds the file.

Decided with the user, so do not re-litigate:

- **Stack:** Vite + **React 19 + TypeScript + Tailwind CSS v4 + react-router-dom**. This *replaces*
  the original vanilla-JS-with-template-strings implementation, at the user's request: they don't
  work with the hand-rolled rendering style day-to-day and wanted code that reads like ordinary
  React, which is also what any tutorial (or AI) will assume. TypeScript for the domain model,
  Tailwind for styling — both explicitly chosen by the user over the alternatives (plain CSS with
  design tokens, plain JS). The app is client-only: no framework beyond React itself, no state
  library, no component kit.
- **Routing:** `HashRouter`. Every URL stays inside `index.html`, so the app needs no server rewrite
  rules and works from any subfolder. Route table lives in `src/App.tsx`.
- **Storage: one SQLite file, `data/inventory.sqlite`** (override with `LEGO_DB_PATH`), holding
  *both* the inventory and the imported Rebrickable catalog. Written through Node's **built-in
  `node:sqlite`** — no npm dependency, no native module to compile. The file is the backup: copy it,
  inspect it with any SQLite tool, delete it to start over. WAL mode, so the long catalog import
  doesn't block reads.
- **Client/server split:** the browser holds no persistent data at all. `server/` owns the database
  and every write; the React app calls a small local HTTP API. **Every write answers with the entire
  new inventory**, so there is one round trip per action and the screen can never drift from the
  file. The API is mounted into the Vite dev server as middleware (`vite.config.ts`), so `npm run
  dev` is still one process, and served by `server/index.ts` in production — one handler, never two
  implementations.
- **The server runs TypeScript directly** (`node server/index.ts`, Node's type stripping): no build
  step, and the server imports the same `src/types.ts` and the same pure domain helpers the UI uses,
  so the two can't disagree about the rules. Type stripping needs full import specifiers, which is
  why the shared modules (`src/types.ts`, `src/lib/{ids,matching,inventory}.ts`) and everything under
  `server/` import with explicit `.ts` extensions. Keep it that way, and keep those shared files free
  of DOM APIs.
- **Client state:** `src/lib/store.ts` keeps the last snapshot the server sent and exposes one
  function per action. Components read it through `useInventory()` (`src/hooks/useInventory.ts`), a
  `useSyncExternalStore` subscription, so every screen showing the data updates itself after any
  action. The original vanilla implementation deliberately had *no* global refresh, because
  re-rendering everything wiped in-progress forms (e.g. the Add-piece wizard); that trade-off is gone
  — a React re-render keeps each component's own state. Don't reintroduce manual "redraw this
  screen" plumbing.
- **Migration from the browser-stored version:** on boot, if the database is empty and the browser
  still has the old IndexedDB inventory, it is read once, handed to the `importLegacy` action (which
  refuses to touch a non-empty database) and the old IndexedDB is deleted —
  `src/lib/legacyBrowserData.ts` + `src/boot.ts`. Leave this in place; it is the only path back for
  data that predates the SQLite file.
- **Pure queries vs. mutations:** `src/lib/inventory.ts` holds every read-only question about a
  snapshot (occupants, suggestions, duplicates, search, stats) as a pure function taking the
  snapshot; `src/lib/store.ts` holds the writes. Keep new derived logic in `inventory.ts` — it is
  safe to call during render and easy to reason about in isolation.
- **Visual design:** one palette of semantic CSS variables (`canvas`, `surface`, `ink`, `brand`, …)
  in `src/index.css`, re-exported to Tailwind via `@theme inline`, so utilities read `bg-surface` /
  `text-ink-muted` and dark mode only redefines the variables (no `dark:` duplicate per utility).
  Warm amber accent with near-black text on it — amber with white text fails contrast. No web fonts:
  a local-only app shouldn't need the network to render its text, so it uses the system stack.
  Shared primitives (`Button`, `Card`, `Field`, `Chip`, `EmptyState`, `Callout`) live in
  `src/components/ui.tsx`; compose those instead of repeating long class lists.
- **Catalog data:** the entire [Rebrickable CSV download](https://rebrickable.com/downloads/) (every
  file it offers) lives in `lego-inventory-helper/catalog/` — deliberately *not* in `public/`, since
  the browser never reads it and Vite would otherwise copy ~150 MB into `dist/` on every build. On
  first server start, three of those files are streamed into the database's `catalog_*` tables
  (`parts.csv`, `colors.csv`, `inventory_parts.csv`); `inventory_parts.csv` is ~127 MB / 1.5M rows,
  so it is read line by line and never loaded into memory whole. See `catalog/CATALOG.md` for the
  file-by-file breakdown of what's used vs. kept for provenance only, and for how to refresh it.
  Catalog lookups are then plain SQL — searching 64k parts no longer means loading 64k parts into the
  browser.
  **Colors are filtered per part** (`getColorsForPart`) by joining `catalog_part_colors` — falls back
  to the full palette when a part has no recorded color data.
  **Real piece photos**: `inventory_parts.csv` uniquely includes an `img_url` column pointing at
  Rebrickable's own CDN — no API key needed, unlike their REST API. Every piece shows that real photo
  when one is on record for its exact part+color combo, falling back to the generic placeholder
  silhouette otherwise (no recorded photo, a custom "Other" color, or the image fails to load). This
  is the one place the app touches the network: the photo bytes are fetched from
  `cdn.rebrickable.com` by the browser at view time (only the URL is imported, not ~100k actual
  images). Everything else runs against the local file and works with no connection at all.
- **No service worker any more.** It used to be an offline-first PWA with a cache-first service
  worker; with the data behind a local API that worker would happily serve stale API responses, so
  `public/sw.js` is gone. `src/boot.ts#removeObsoleteServiceWorker` unregisters any worker a browser
  still carries from the old version (and forces one reload when it is actively controlling the page,
  since it keeps intercepting this document's requests until unload). Don't add a service worker back
  without a plan for the API. `manifest.webmanifest` stays — it only makes the local app installable
  as its own window.
- **Icons:** generated programmatically (`node` + built-in `zlib`, no image library) as a simple
  placeholder brick-stud silhouette — deliberately generic, no LEGO branding, per the UX doc's design
  principles.
- **No ORM, no query builder, no migration tool:** SQL is written by hand in `server/`, and the
  schema is a single idempotent `CREATE TABLE IF NOT EXISTS` block in `server/db.ts`.

## Commands

```sh
cd lego-inventory-helper
npm install
npm run dev        # dev server + API on http://localhost:5173 (one process)
npm run typecheck  # tsc --noEmit (checks src/ and server/ together)
npm run build      # typecheck + build to dist/
npm start          # production: serve dist/ + API on http://127.0.0.1:4173
npm run serve      # build, then start
```

Environment variables: `LEGO_DB_PATH` (default `data/inventory.sqlite`), `LEGO_CATALOG_DIR`
(default `catalog/`), `PORT`/`HOST` for `npm start`. The first start imports the catalog — a few
seconds — and the UI shows the progress the server reports via `GET /api/status`.

Useful while debugging: the database is an ordinary SQLite file, so
`sqlite3 data/inventory.sqlite 'select * from pieces'` (or any GUI) shows exactly what the app sees.

No test tooling is configured yet (matches day1's stance) — verified so far by `npm run build`
(which typechecks first, catching import/type errors) and by driving the running app with a scripted
headless browser (Playwright, installed ad hoc in a scratch directory, **not** a project dependency)
to exercise: the catalog import, drawer setup, the full Add-piece flow (details → duplicate
detection → location → partition split), search, extraction to zero, editing, the history view, the
mobile and dark-mode layouts, the production server, and the one-time migration from the old
browser-stored data (including records shaped like the very first version, missing the fields added
later). All passed with no console errors. If real automated tests get added later, raise the
tooling choice first (per the root CLAUDE.md's "don't decide on external libraries without
asking").

## Architecture

```
lego-inventory-helper/
  index.html               mounts #app, loads src/main.tsx
  vite.config.ts           base './', react + tailwind plugins, and the API as dev middleware
  tsconfig.json            strict, bundler resolution, react-jsx; covers src/ AND server/
  data/inventory.sqlite    THE DATABASE (gitignored): inventory + imported catalog
  catalog/                 the Rebrickable CSVs + CATALOG.md — import source, never served
  public/
    manifest.webmanifest   makes the local app installable as its own window
    icons/                 generated placeholder icons (192/512/180)
  server/                  runs as TypeScript directly (no build step)
    index.ts               production server: static dist/ + the API, prints the db path
    api.ts                 the HTTP API: GET status/inventory/catalog*/export/database,
                           POST actions/<name>
    actions.ts             every write, one SQLite transaction each; also the backup restore and
                           the legacy import, both normalizing records they didn't create
    repository.ts          row <-> domain mapping, snapshot reads, the individual writes
    catalog.ts             streams the CSVs into the catalog_* tables once; catalog SQL queries
    db.ts                  the file location, the schema, transaction helper, meta table
    csv.ts                 minimal quoted-field CSV splitter (no dependency)
  src/
    main.tsx               createRoot + <App/>
    App.tsx                boot gate (loading/error screen) then HashRouter + the route table
    boot.ts                wait for the server → hand over legacy data → load; once per page load
    index.css              Tailwind import, design tokens, base styles, custom utilities
    types.ts               the domain model, shared with the server (Piece, DrawerUnit, …)
    lib/
      api.ts                thin fetch client for the local API
      store.ts              the last snapshot from the server + one function per action
      inventory.ts          PURE queries over a snapshot (occupants, suggestions, search, stats),
                            imported by BOTH the UI and the server so the rules can't diverge
      matching.ts           duplicate-detection and same-type rules (spec's exact matching logic)
      catalog.ts            catalog lookups over the API, memoized per part number
      legacyBrowserData.ts  reads (and then deletes) the previous IndexedDB storage
      ids.ts, format.ts, cn.ts   id/key helpers, date formatting, className joining
    hooks/
      useInventory.ts       useSyncExternalStore bridge to the store
      useCatalog.ts         async catalog lookups (part name, per-part colors, catalog search)
      useDebouncedValue.ts  shared debounce
    components/
      AppShell.tsx          persistent header + mobile tab bar + <Outlet/>, Export, import warning
      ui.tsx                Button/Card/Field/TextInput/TextArea/Chip/EmptyState/Callout/SectionTitle
      CompartmentGrid.tsx   one unit's grid; same component for the Home preview, the unit view
                            and the location/move pickers
      CompartmentPanel.tsx  what's inside one compartment (extract, mark full, edit, delete);
                            scrolls itself into view on phones, where it renders below the grid
      PieceRow.tsx          one piece as a row, shared by the home search and the All pieces list
      ColorPicker.tsx, ColorSwatch.tsx, PartSearch.tsx, PieceImage.tsx, ActionTag.tsx
      PieceIdentityFields.tsx   the part-number + catalog-name + color block shared by Add and Edit
      ConfirmDialog.tsx     modal confirmation for destructive actions
    pages/
      HomePage.tsx          search + stats + unit cards
      PiecesPage.tsx        the whole inventory as one list: sort by name/quantity/location,
                            filter by color and unit — what the drawer grids can't answer
      DrawerUnitPage.tsx    one unit's grid with the compartment panel beside/below it; the title
                            is click-to-rename
      AddPiecePage.tsx      the add wizard (details → duplicate? → location → partition split? →
                            confirmation). The confirmation step keeps you in the flow ("add
                            another", "same part, another color") because salvaging a set means
                            entering pieces one after another
      EditPiecePage.tsx     edit identity/notes, move, delete
      DrawerSetupPage.tsx   first-run setup, rename/resize/delete units, and the Backups section
      MovementLogPage.tsx   history with unit/compartment filters in the URL
```

Key domain rules (see the spec for the "why", this is just where to find the "how" — the reads are
in `src/lib/inventory.ts`, shared by both sides; the writes are in `server/actions.ts`):

- **Compartments are derived, not reserved.** A compartment's occupants are computed live from the
  pieces (filter by unitId+compartmentIndex); there's no separate "this partition is taken" flag.
  That's what makes reclaiming a partition after full extraction automatic (spec requirement) —
  it just falls out of the occupant count, no extra bookkeeping.
- **`partitionCount`/`partitionsFull` persist on a separate `compartments` record**, created lazily
  the first time a compartment is touched (subdivided or marked full). It does **not** shrink back to
  1 when a partition empties out — an already-subdivided compartment keeps its slots.
- **"Structurally full" vs. "manually full" are different gates.** Manually full = every partition
  marked full by the user (excluded from suggestions and disabled in the location picker, but no
  smaller test than the spec's own wording). Structurally full = `MAX_PARTITIONS` (3) distinct
  occupants already present (the hard max), independent of any manual flag. Both exclude a
  compartment from suggestion/manual-pick; only the manual one is ever toggled by the user.
- **Duplicate detection vs. "same type" grouping use the same underlying rule** (part number when
  both pieces have one, else normalized description) — `matching.ts`'s `isSameType` is that rule
  alone, `isDuplicateMatch` is `isSameType` **and** matching color. Grouping (location suggestion,
  triggering a partition split) uses `isSameType` only, deliberately ignoring color, since two
  different colors of the same piece type is exactly the case subdivisions exist for.
- **Movement log entries carry a `locations: [{unitId, compartmentIndex}, …]` array**, not a single
  location — a `move` entry gets both the destination and origin (when they differ) so filtering the
  global log by unit/compartment finds the entry from either side, without duplicating the entry.

## Don't

- Don't commit without asking first.
- Don't decide on external libraries without asking first (this includes test frameworks, a state
  library, a component/UI kit, an HTTP framework like Express, an ORM or query builder, a migration
  tool, or an image library for icons) — the current set (React, react-router-dom, Tailwind,
  TypeScript, Vite, plus `@types/node`) is deliberately the whole list, and the server deliberately
  uses only Node built-ins. You can suggest, but ask before adding.
- Don't write data access straight from a page or component: the browser has no database. Reads go
  through `useInventory()`, writes through the action functions in `src/lib/store.ts`, and the SQL
  itself stays in `server/`.
- Don't change the shape of the domain types without thinking about `server/repository.ts` (the
  column mapping) and `importLegacy`'s normalizers — old records in someone's browser won't have any
  field you add today.
- Don't refactor day1 or touch anything outside `day4/` while working here.
- Don't reintroduce a free-text description field without checking with the user first — see
  "Deviations from the written spec" above; the current design is deliberate, not an oversight.
- Don't put derived/computed logic in components when it belongs in `lib/inventory.ts`, and don't
  read or mutate the store's internals from a component — go through `useInventory()` and the
  exported actions.
