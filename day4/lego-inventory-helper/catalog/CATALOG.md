# Bundled LEGO catalog

Source: [Rebrickable free CSV downloads](https://rebrickable.com/downloads/), no API key needed.
The **full** dataset is bundled here (every file the downloads page offers).

These CSVs are *not* served to the browser: on first start the server imports the three files it
needs into the `catalog_*` tables of `data/inventory.sqlite` (see `server/catalog.ts`), and from then
on every lookup is a SQL query.

| File | Rows | Used by the app? |
|---|---|---|
| `parts.csv` | 64,620 | **Yes** — `part_num` → official name |
| `colors.csv` | 276 | **Yes** — the color palette |
| `inventory_parts.csv` | 1,557,383 | **Yes** — see below |
| `elements.csv` | 114,245 | No |
| `part_categories.csv` | 76 | No |
| `part_relationships.csv` | 37,394 | No |
| `sets.csv` | 28,278 | No |
| `themes.csv` | 496 | No |
| `minifigs.csv` | 17,225 | No |
| `inventories.csv` | 47,453 | No |
| `inventory_sets.csv` | 5,210 | No |
| `inventory_minifigs.csv` | 25,820 | No |

The unused files are kept for completeness/provenance — this app is a loose-parts inventory for one
collector, not a set/minifig browser, so nothing in the spec needs set, theme, minifig, or inventory
(as in "boxed set") data.

## What gets indexed into IndexedDB on first launch

`src/lib/catalog.js#ensureCatalogIndexed` parses and indexes three files:

- **`parts.csv`** → `catalogParts` store: `part_num` → official name. Powers "look up the official
  name for a part number."
- **`colors.csv`** → `catalogColors` store: the predefined color palette shown when adding/editing a
  piece (sorted by how common each color is, via `num_parts`).
- **`inventory_parts.csv`** → `catalogElements` store, aggregated to one record per `part_num`:
  `{ part_num, colors: [{ colorId, imgUrl }] }`. This is every part+color combination Rebrickable has
  on record across every official set's inventory — far more complete than `elements.csv`'s
  official-element-ID list, since it includes older/rarer color-part combinations that never got a
  retail element ID. It powers two things:
  - **"Only show colors that exist for this piece"** when adding/editing a piece (see
    `getColorIdsForPart`/`getAvailableColorsForPart`). Falls back to the full palette if a part has no
    recorded color data.
  - **Real piece photos.** `inventory_parts.csv` uniquely among Rebrickable's free CSVs includes an
    `img_url` column (a direct link to their CDN) — no API key needed. See "Images" below.

1,557,383 raw rows dedupe down to ~103,900 unique part+color combinations across ~62,700 parts, which
is what actually gets written to IndexedDB (not 1.5M rows) — parsing + deduping this file takes a
couple of seconds on a modern machine, done once on first launch.

## Images

Every piece shows a **real Rebrickable photo** when one is on record for its exact part+color
combination (`getImageForPartColor`), with a generic placeholder silhouette as fallback when there's
no recorded photo, the piece uses a custom "Other" color (no Rebrickable color id to look one up
with), or the image fails to load.

**This is the one place the app needs the internet**: the photo itself is fetched from
`cdn.rebrickable.com` by the browser at view time — only the URL is imported into the database, not
the image bytes (storing ~100k actual photos isn't practical). Without a connection, pieces you
haven't loaded before fall back to the placeholder. Everything else (search, add/extract/edit/move/
delete, the movement log) runs entirely against the local SQLite file and never touches the network.

## Refreshing the catalog

1. Download fresh CSVs from `https://cdn.rebrickable.com/media/downloads/{parts,colors,inventory_parts}.csv.gz`.
2. Replace the corresponding files in this folder.
3. Bump `CATALOG_VERSION` in `server/catalog.ts` so the next server start re-imports them into the
   database. The import only rewrites the `catalog_*` tables; your inventory is untouched.

## Attribution

Part, color, and image data © Rebrickable, used under their free-download terms. Attribution is
shown in the app's home screen footer and here.
