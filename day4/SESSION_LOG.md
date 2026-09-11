# Session Log — LEGO Inventory System Brainstorming

**Date:** 2026-09-10  
**Project:** Day 4 - LEGO Brick Inventory System  
**Status:** Spec complete, ready for implementation

---

## Session Summary

Clarification and specification session for a LEGO brick inventory management system. The user has a workshop with organized drawer organizers and wanted to create software to:

- Track loose LEGO pieces left over from completed sets
- Know where those pieces are when building something new
- Manage inventory visually and interactively

12 key questions were asked to clarify each aspect of the project. After clarification, a **complete formal specification** was written, ready for implementation.

---

## Questions and Answers

### Question 1: **What platform do you prefer?**

**Answer:**

- SPA (Single Page App) that works as a PWA
- Installable as a native app on Android and iOS
- Also accessible from web browser

---

### Question 2: **How are pieces added to inventory?**

**Answer:**

- **Manual entry** for now
- User enters information manually at the moment

---

### Question 3: **How do you describe a piece when you add it?**

**Answer:**

- **Description** (required): free text (e.g., "Brick 2×4 red")
- **LEGO part number** (optional): can get it from set instructions
- **Both fields** should be usable for later search

---

### Question 4: **How do you define the drawer organizers?**

**Answer:**

- User defines physical structure (e.g., "4 drawer units, each 4×4 compartments")
- **System tells user where to put pieces** automatically
- No custom names, software organizes placement

---

### Question 5: **How should the system decide where to place a piece?**

**Answer:**

- System **automatically suggests** where to place each piece
- **Organization by piece type** (all 2×4 bricks together, etc.)
- Same compartment can **be subdivided by color** (e.g., 3 color variants of same brick in one compartment with internal divisions)
- System decides subdivisions automatically

---

### Question 6: **How do you search for a piece when building something new?**

**Answer:**

- **Search by type** (e.g., "2×4") → lists all compartments with that type
- **Filter by color** (e.g., "red") → refines results
- **Interactive and dynamic search**
- Result: exact location (drawer unit + compartment) and available quantity

---

### Question 7: **What information should the system track for each piece?**

**Answer:**

- LEGO part number
- **Automatic photo** (fetched from internet using part number)
- Personal notes (optional)
- Addition date
- Extraction date (movement)
- **NOT:** price/value

---

### Question 8: **Is it just for you or to share?**

**Answer:**

- **Single-user** (just you)
- In your personal workshop
- **Visual drawer interface** (grid showing where pieces are)

---

### Question 9: **Does it need internet or would you prefer offline?**

**Answer:**

- **Offline-first** (no server connection)
- Everything stored locally on device
- Mobile access: only on local network or via Tailscale
- No complex security concerns (only you access)

---

### Question 10: **Do you need to export data or import information?**

**Answer:**

- **Backup is important**: export to CSV or JSON
- Flexible format (CSV, JSON, doesn't matter)
- To make local backups

---

### Question 11: **What happens when you use a piece from the drawer?**

**Answer:**

- Quantity is **reduced** (from 5 to 3, for example)
- When searching, you see available quantity
- Can specify how many to extract
- **Movement log** for each drawer (audit trail of changes over time)

---

### Question 12: **Can you edit or delete pieces after adding them?**

**Answer:**

- **Yes, edit** any piece field
- If you enter LEGO part number, system fetches info from internet (photo, official name)
- Personal notes always controlled by you
- Editable after adding

---

## Key Decisions Made

| Aspect            | Decision                                         |
| ----------------- | ------------------------------------------------ |
| **Platform**      | SPA/PWA (web + installable on mobile)            |
| **Storage**       | Offline-first, local IndexedDB/localStorage      |
| **Data entry**    | Manual                                           |
| **Organization**  | By piece type, automatic color subdivisions      |
| **Search**        | Interactive with dynamic filters                 |
| **Visualization** | Visual grid of drawer units                      |
| **Metadata**      | Part number, photo (from internet), notes, dates |
| **Users**         | Single-user, no authentication                   |
| **Backup**        | Manual export to JSON/CSV                        |
| **Audit**         | Movement log per drawer                          |

---

## Deliverable

**File generated:** `/Users/angel/fontoxml/bootcamp/day4/lego-inventory-spec.md`

Formal specification 400+ lines including:

- Intent and scope
- Detailed behavior (setup, adding, search, edit, logs)
- 40+ testable acceptance criteria
- Constraints and open questions
- Dependencies

**Status:** ✅ Ready for implementation

---

## Round 2: Additional Clarifications (09/10 - Continuation)

### Clarification 1: Fullness algorithm

**Question:** How is "fullness" of a compartment measured?  
**Answer:** User manually indicates when compartment is full. System suggests grouping by piece type, but user decides location.

### Clarification 2: Duplicate pieces

**Question:** If you add 5 red bricks and then 3 more identical bricks, what happens?  
**Answer:** They group automatically in same compartment. System detects existing piece and suggests "add to this location".

### Clarification 3: Initial interface

**Question:** What does user see when opening app?  
**Answer:** Search bar + visual grid of all drawer units. Can search or select a drawer unit to see details.

### Clarification 4: CSV export

**Question:** What does CSV contain?  
**Answer:** Two sections: current pieces table + movement log table (for complete restoration).

### Clarification 5: Movement logging

**Question:** How are movement types recorded?  
**Answer:** Explicit types: additions, moves, deletions, extractions, edits. UI-readable format, implementation details TBD.

### Clarification 6: Reorganizing drawer layout

**Question:** Is changing drawer layout allowed?  
**Answer:** Not a priority (out of scope). If implemented in future: swap compartments within a unit, or reorder units in matrix. Pieces move with their compartment.

### Clarification 7: Automatic subdivisions within compartments

**Question:** If 5 red, 3 blue, 2 green of same type in one compartment, how organize?  
**Answer:** Divisions are physical (real separators). System suggests multiple division options (equal, proportional, flexible), user chooses.

### Clarification 8: Piece deletion and history

**Question:** When deleting a piece, what happens to its log?  
**Answer:** Piece disappears from current inventory, but log/history remains (for auditability).

### Clarification 9: Extraction from search

**Question:** Can you extract pieces directly from search results?  
**Answer:** No. Search locates/shows where it is. To extract, user must go to compartment grid and extract from there.

### Clarification 10: Empty search results

**Question:** If search has no matches, what does user see?  
**Answer:** Clear message "No results found".

## ✅ Final Result

**Spec: 100% ready for implementation**

Clarified 10 ambiguities through 2 rounds of Q&A:

### Round 1 (5 initial questions)

1. ✅ Fullness algorithm → user indicates manually
2. ✅ Duplicates → auto-group, system detects
3. ✅ Initial interface → search + grid visual
4. ✅ CSV export → two sections (pieces + log)
5. ✅ Movement logging → explicit types (add/move/delete/extract/edit)

### Round 2 (5 critical questions)

6. ✅ Reorganize drawers → out of scope (future)
7. ✅ Subdivisions → physical, system suggests options, user chooses
8. ✅ Deletion → piece removed, log remains
9. ✅ Extraction → grid-based only, not from search
10. ✅ No results → "No results found"

## Round 3: Second Review Pass (09/10 - Continuation)

Used the `grill-me` skill to interview the spec for remaining ambiguities and internal inconsistencies before implementation.

### Clarification 11: Quantity edit vs. extraction

**Question:** The spec allowed editing `quantity` directly (as an absolute value) _and_ had a separate extraction workflow, with different log semantics (`edit` vs `extract`). Which is correct?
**Answer:** Editing is only for piece details. Quantity is **not** an editable field — the only ways to change it are adding more (merges into an existing entry via duplicate detection) or extracting.

### Clarification 12: Duplicate detection matching rule

**Question:** What exactly counts as "the same piece" for duplicate detection?
**Answer:** Part number + color when both entries have a part number; otherwise normalized description (case-insensitive, trimmed) + color.

### Clarification 13: Fullness mechanism

**Question:** How does the manual "full" marker work, and does it affect search?
**Answer:** Manual boolean toggle, decided per partition (see Clarification 14). Excludes that partition/compartment from add-time location suggestions only — search and grid views are unaffected. Unmarking is always manual.

### Clarification 14: Subdivision algorithm

**Question:** How are subdivision suggestions generated for compartments shared by multiple colors?
**Answer:** A compartment supports at most 3 equal partitions (halves or thirds). The system always suggests equal parts; the user picks how many partitions to use and can resize manually beyond that. Fullness is marked per partition; a compartment counts as full once every partition is full. When a partition's piece is fully extracted, that partition automatically becomes available again.

### Clarification 15: Movement log scope

**Question:** The log was "per drawer" — what happens when a piece moves between two different drawer units? Duplicate entries in both logs, or just one?
**Answer:** Made the log **global** instead of per-drawer: a single system-wide log, filterable by unit and/or compartment, with a global unfiltered view too. A cross-unit `move` produces one entry, not two.

### Clarification 16: CSV export

**Question:** CSV export of nested movement history doesn't map cleanly to a flat file — one file, several files, or drop it?
**Answer:** Dropped CSV entirely. Export is **JSON only**.

### Clarification 17: Drawer reconfiguration and orphaned pieces

**Question:** What happens if shrinking the drawer configuration (fewer units, or fewer compartments per unit) would leave existing pieces without a valid location?
**Answer:** Blocked. The system refuses the change (deleting a unit with pieces in it, or reducing compartments below an occupied one) until the user relocates or removes the affected pieces.

### Clarification 18: Part number re-fetch failure on edit

**Question:** If a user changes a piece's part number and the re-fetch fails, does the old image/name stay, or clear?
**Answer:** Clears back to the placeholder — keeping data tied to the previous part number would be misleading.

### Clarification 19: Color input (previously open question)

**Question:** Free text, predefined palette, or both?
**Answer:** Hybrid — predefined LEGO color palette, plus an "Other" option with free text for colors outside the catalog.

### Clarification 20: Image fallback (previously open question)

**Question:** Placeholder or blank when no image is available?
**Answer:** Generic placeholder image, always — keeps the grid visually consistent.

### Clarification 21: Export schedule (previously open question)

**Question:** Manual-only, or also automatic/periodic?
**Answer:** Manual-only. No backend to push an automatic export to; a periodic reminder (not a silent auto-export) would be a v2 nice-to-have at most.

## Round 4: LEGO Data Source Decision (09/10 - Continuation)

### Clarification 22: LEGO parts catalog source

**Question:** Which free source should provide piece images and official names? Considered the Rebrickable REST API (on-demand fetch by part number, requires a personal API key, matches the original fetch+cache+fallback design) versus Rebrickable's free CSV catalog download (`rebrickable.com/downloads/` — parts/colors/elements with image URLs, free for any use with attribution, no API key needed to use the data once downloaded).
**Answer:** Use the **Rebrickable CSV download**, bundled as the **full catalog** with the app (not a filtered subset, not fetched on demand). It ships as a static asset, gets indexed into IndexedDB on first launch, and needs no network access or API key at runtime — a better fit for an offline-first app than a live API call. The catalog is refreshed by re-downloading the dataset and rebuilding/redeploying the app, not at runtime. If a part number isn't found in the bundled catalog, the system falls back to the user-provided description (same fallback behavior as before).

This changes the "fetch within 2 seconds" acceptance criterion from Round 1 into a local lookup, held to the same ~100ms bar as search, since there's no network round-trip anymore.

## Round 5: UX/UI Design (09/10 - Continuation)

### Clarification 23: Format for the UX/UI design

**Question:** How should the UI/UX design be delivered — an interactive visual mockup canvas, or a written document?
**Answer:** A separate written document, `lego-inventory-ux-ui.md`, following the same pattern already used in this project (spec + session log as standalone markdown files rather than an interactive artifact).

**Deliverable:** `lego-inventory-ux-ui.md` — screen inventory (8 screens: Home, Drawer unit view, Compartment detail, Add piece, Search results, Edit piece, Movement log, Drawer setup), a navigation map, per-screen layout/states/interactions, shared component notes (color swatch, piece image/placeholder, fullness indicator, log action-type tags), and a responsive summary (desktop/tablet vs. mobile). No new product decisions were introduced — every screen maps directly to behaviour and acceptance criteria already defined in `lego-inventory-spec.md`. Visual identity (exact colors, typography, spacing) was deliberately left open, to be settled in a later visual-design pass.

## Files Updated

- `lego-inventory-spec.md` — Complete spec, updated with all clarifications (rounds 1-4) and cross-linked to the UX/UI document
- `lego-inventory-ux-ui.md` — UX/UI design: screens, states, navigation flows
- `SESSION_LOG.md` — This file, record of all decisions

## Next Steps

1. ✅ Spec completed and ready
2. ✅ Second review pass closed all behavioral ambiguities and the color/image/export open questions
3. ✅ LEGO data source decided: Rebrickable full catalog, bundled locally
4. ✅ UX/UI design completed (`lego-inventory-ux-ui.md`)
5. ⏭️ Start development and implementation

**Deferred to a future iteration:** a dedicated visual design pass (concrete colors, typography, spacing scale). Not needed for v1 — `lego-inventory-ux-ui.md` already defines structure, states, and interactions; implementation can proceed with a plain/utilitarian look and this can be revisited later.

## Round 6: React rewrite + visual design pass (09/11)

### Clarification 24: Rewrite the implementation in React

**Question:** The first implementation was vanilla JS with template strings and a hand-rolled
router/renderer. Keep it, or rewrite?
**Answer:** Rewrite it in **React**. Reason given: the hand-rolled rendering style is hard to follow
for someone who doesn't work in it day-to-day, and ordinary React code is what tutorials, colleagues
and AI assistants all assume. Behaviour stays exactly as specified — this is an implementation and
design change, not a product change.

### Clarification 25: Routing, styling and language

**Question:** Which router, which styling approach, JavaScript or TypeScript?
**Answer:** A **single-page app**, so `react-router-dom` (with `HashRouter`, keeping the app working
offline and from any path without server rewrites); **Tailwind CSS** for styling; **TypeScript** for
the code. Full dependency list is now React, react-dom, react-router-dom (runtime) plus Vite,
TypeScript, Tailwind and the two Vite plugins (dev).

### Clarification 26: Visual design

**Question:** The deferred visual-design pass (Round 5) — what should it produce?
**Answer:** A friendlier look than the utilitarian v1: a warm palette built on semantic design tokens
(with automatic dark mode), a persistent app shell with a header and a mobile tab bar instead of a
per-screen back link, cards and empty states, real confirmation dialogs for destructive actions
instead of a button that relabels itself, a stats row on the home screen, and compartment grids
capped at a readable cell size. No web fonts — an offline-first app shouldn't depend on the network
to render its text.

**This closes the "deferred visual design pass" left open at the end of Round 5.**

## Round 7: Storage moves to a SQLite file (09/11)

### Clarification 27: What "local storage" should mean

**Question:** The app already kept everything locally, in the browser's IndexedDB. Asked for "local
storage, in a SQLite for example", which can mean three quite different things: SQLite compiled to
WebAssembly inside the browser (still a PWA), a real `.sqlite` file on disk (needs a process outside
the browser), or SQLite-over-IndexedDB.
**Answer:** A **real `.sqlite` file on disk**, holding **both the inventory and the catalog**.
Accepted consequence: the app stops being an installable offline PWA and needs a local process
running to serve it.

### Clarification 28: What runs the database

**Question:** Electron, Tauri, or a small local server?
**Answer (implementation call, not a product decision):** a small **Node server using the built-in
`node:sqlite`** module, serving the same React UI. It adds **zero runtime dependencies** — Electron
or Tauri would each pull in a desktop build chain (and Tauri a Rust toolchain) for what is, today, a
storage change. Node also runs TypeScript directly now, so the server shares the app's domain types
and pure domain rules instead of duplicating them. Wrapping this in Electron/Tauri later would not
require touching the logic.

**Consequences recorded here so they aren't rediscovered later:**

- The bundled CSVs moved out of `public/` (the browser never reads them now, and Vite was copying
  ~150 MB into `dist/` on every build) into `catalog/`, and are imported into the database on first
  start.
- The service worker was deleted: it served same-origin GETs cache-first, which would now mean
  serving stale API responses. Browsers carrying the old one are cleaned up at boot.
- A one-time migration reads whatever the previous IndexedDB version stored and hands it to the
  server, which only accepts it into an empty database. Records from the very first version are
  missing fields added later (piece photos, notes), so the import normalizes every record — the
  first attempt failed on exactly that (`Provided value cannot be bound to SQLite parameter 15`),
  and a failed import now leaves the app usable with a visible warning instead of refusing to start.
