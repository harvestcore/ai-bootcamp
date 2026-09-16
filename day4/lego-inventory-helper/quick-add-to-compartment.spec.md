# Quick-add units to a piece already in a compartment — spec

Status: **Ready for implementation**, with the caveats labelled `ASSUMPTION:` below and
listed under [Open questions](#open-questions). None of them changes the shape of the
change; the biggest (`Q1`) only decides whether the new button adds one unit immediately
or opens the same inline quantity row "Take out" already uses.

Companion to [`../lego-inventory-spec.md`](../lego-inventory-spec.md) (behaviour) and
[`add-piece-modal.spec.md`](add-piece-modal.spec.md) (the add-piece flow's two hosts).
Neither is amended: the add-piece wizard, its duplicate detection and its rules are
untouched. This spec adds a second, shorter path to a write the app already performs.

## Intent

Restocking a piece the user already stores — the common case when a second copy of the
same set is stripped down — currently means running the whole add-piece wizard (part
number search, color, quantity, then the duplicate-merge step) even though the user is
already looking at the exact piece in the exact compartment. Give each occupant row in
the compartment panel its own "Add" button so more units of that piece land in that
compartment without searching the catalog or picking a location.

## Scope boundaries

Touches:

- `src/components/CompartmentPanel.tsx` — the `OccupantRow` gains one button and (per
  `ASSUMPTION:` Q1) one inline quantity row, sharing the slot the extract form uses.
- `day4/CLAUDE.md` — one line in the `CompartmentPanel.tsx` entry of the architecture
  tree, which currently reads "extract, mark full, edit, delete".

Does not touch:

- `src/types.ts`, the SQLite schema, `server/db.ts`, `server/repository.ts`. No new field,
  no new table, no migration.
- `server/actions.ts` and the HTTP API. The write already exists:
  `addToExistingPiece({ pieceId, quantity })` bumps `pieces.quantity`, appends the `add`
  movement entry (`+N → <location label>`) and answers with the whole new snapshot.
- `src/lib/store.ts`. `addToExistingPiece(pieceId, quantity)` is already exported and is
  already what the wizard's duplicate-merge step calls.
- `src/lib/inventory.ts` and `src/lib/matching.ts`. No new derived query: the row being
  clicked already *is* the piece, so nothing has to be matched or looked up.
- `src/components/AddPieceWizard.tsx` behaviour, and every existing entry point into it
  (the "Add piece" tab, the unit-page header button, `PiecesPage`, `/add`, and the
  panel's own "Add a piece here").
- `src/components/PieceRow.tsx`, `PiecesPage`, `HomePage` search results — those rows are
  navigation links to a compartment, not editors (see [Out of scope](#out-of-scope)).
- `CompartmentGrid.tsx`, `DrawerUnit3D*.tsx`, the `?view=3d` param, routing.

## Non-goals

- **Not a new way to create a piece.** The button only ever increments a piece that is
  already an occupant of the selected compartment; it cannot introduce a new part number,
  a new color, or occupy an empty partition. Empty partitions keep only "Add a piece here".
- **Not a quantity editor.** Lowering stock stays with "Take out"; setting an absolute
  quantity is not offered here, and `EditPiecePage` still does not edit quantity.
- **No new modal.** Nothing about this opens a dialog, a wizard step or a route.
- **No new movement type and no new log copy.** The entry the server already writes for
  `addToExistingPiece` is the audit trail and the undo affordance (undo = "Take out" the
  same amount).
- **No bulk or repeat mode.** No "add 1 to everything in this compartment", no keyboard
  shortcut, no last-used-quantity memory.
- **Does not change duplicate detection.** `findDuplicate` / `isDuplicateMatch` are
  untouched; this path bypasses the question rather than answering it differently.

## Behaviour

All of it lives in the compartment panel that `DrawerUnitPage` shows beside (desktop) or
below (phone) the grid, for the compartment the user selected.

### Happy path

1. A compartment with occupants is selected. Each occupant row shows, as today: image,
   partition label, catalog name, color, `#partNumber`, notes, "Added <date>", the
   quantity with "in stock", and the action row `Take out · Edit · Delete · [ ] Full`.
2. The action row gains a button labelled **Add** as its first item, before "Take out".
   It is a `Button size="sm"` with the default `secondary` variant, so it reads as a
   sibling of "Take out" rather than a second primary action competing with "Add a piece
   here" at the foot of the panel.
3. Pressing **Add** replaces the action row with an inline row in the same place, and with
   the same `rounded-xl bg-sunken p-2` framing, that the extract form already uses
   (`ASSUMPTION:` Q1): a quantity control starting at `1`, a primary button **Add**, and a
   ghost button **Cancel**.
4. The quantity control is the existing `QuantityInput` (`−`, a numeric field, `+`;
   `aria-label`s "One less" / "One more"), with no `max`. It clamps to a minimum of 1 and
   to integers, exactly as it does in the wizard's "How many" field.
5. Pressing the primary **Add**, or `Enter` in the numeric field, calls
   `addToExistingPiece(piece.id, n)`. While the call is in flight both **Add** and
   **Cancel** are disabled.
6. When it resolves, the whole screen re-renders off the new snapshot: the row's quantity
   reads the old value + `n`, the inline row closes, the action row comes back, and the
   quantity reset to `1` for the next time. The compartment grid's occupancy and the
   home-page stats update in the same render (they already read the store).
7. `/log` (and the unit/compartment-filtered views of it) shows a new `add` entry for the
   piece with detail `+<n> → <unit name>, C<index+1>[, P<partition+1>]`, written by the
   server action that already exists.

### Edge cases

- **Only one inline form at a time, per row.** Opening the add form closes the extract
  form and vice versa; the two never render together.
- **Other rows are unaffected.** Opening the add form on partition 2 leaves partition 1's
  action row as it was.
- **Changing the selection while a form is open** (clicking another compartment, or the
  panel's ✕) leaves no form open when the panel comes back: the panel's per-row state is
  local and is remounted with the new selection.
- **A partition marked "Full" still accepts the quick-add** and the "Full" checkbox is
  left as the user set it (`ASSUMPTION:` Q4). This matches the wizard, whose duplicate
  merge also ignores the flag — "Full" gates *suggestions* and the location picker, not
  writes to a piece that is already there.
- **Quantity typed as empty, `0`, negative or non-numeric** is clamped by `QuantityInput`
  to `1`, so the primary **Add** can never submit an invalid amount. There is no error
  copy for this case and no new validation message anywhere in the panel.
- **The piece is not in the catalog** (`catalogMatched === false`, "Not found in the
  catalog." shown): the button behaves identically — the quick-add does not consult the
  catalog at all.

### Error cases

- **The piece no longer exists** (deleted in another tab, or the row is stale): the server
  action answers `null` and a fresh snapshot in which the row is gone. The panel shows the
  compartment as it now is, with no error banner. No new copy.
- **The HTTP call fails.** Out of scope for new copy: this change inherits whatever the
  app already does with a rejected store action (today, the promise rejects and nothing in
  the panel reports it — see `Q3`). The only requirement here is that the buttons do not
  stay disabled forever: the inline row must be usable again after a failure.

## Constraints

- No new dependency. The change composes `Button`, `QuantityInput` and the existing
  `addToExistingPiece` store action.
- No write may be issued from the component directly; it goes through `src/lib/store.ts`,
  per `day4/CLAUDE.md`.
- No derived logic added to the component: the row already holds the `Piece`.
- Every write answers with the whole snapshot (existing architecture), so the panel must
  not keep its own copy of the quantity or optimistically patch it.
- Tailwind utilities must come from the existing semantic tokens (`bg-sunken`, `text-ink`,
  …); no `dark:` variants, no new color.
- `npm run typecheck` and `npm test` must stay green; `npm test` covers only the pure
  domain helpers, and this change adds none, so no new domain test is expected.
- Touch-target and contrast rules of the existing panel apply: `size="sm"` buttons (h-8)
  are already the panel's baseline for this action row.

## Acceptance criteria

Happy path:

1. With a compartment selected that holds at least one piece, each occupant row renders a
   button whose accessible name is `Add`, positioned before the `Take out` button.
2. Pressing `Add` hides the row's `Take out` / `Edit` / `Delete` / `Full` controls and
   shows a quantity control, a confirm button and a `Cancel` button in their place.
3. The quantity control shows `1` when the inline row opens, every time it opens.
4. Pressing `+` once makes it show `2`; pressing `−` from `1` leaves it at `1`.
5. Confirming with the value `3` on a piece showing `5 in stock` leaves the row showing
   `8 in stock` and no inline row open.
6. That same action produces exactly one new movement-log entry, of type `add`, for that
   piece, with detail text beginning `+3 →` and naming the compartment the piece is in.
7. That same action leaves the piece's `unitId`, `compartmentIndex`, `partitionIndex`,
   `partNumber`, `color`, `notes` and `addedAt` unchanged.
8. Pressing `Enter` inside the numeric field commits the same add as pressing the confirm
   button.
9. Pressing `Cancel` closes the inline row, restores the action row, and leaves the
   quantity `in stock` unchanged, with no movement-log entry added.
10. Reopening the inline row after a successful add shows `1` again, not the previously
    used amount.
11. The compartment grid's occupancy/stock rendering for that compartment reflects the new
    quantity without a page reload.

Edge and error paths:

12. Pressing `Add` on a row whose extract form is open replaces the extract form with the
    add form; the two are never both visible on one row.
13. Pressing `Take out` on a row whose add form is open replaces the add form with the
    extract form.
14. Opening the add form on one occupant leaves every other occupant row's action row
    rendered normally.
15. Typing `abc`, `0` or `-2` into the numeric field results in a displayed value of `1`,
    and confirming then adds exactly 1.
16. Both the confirm and `Cancel` buttons are disabled while the add request is in flight,
    and enabled again once it settles (resolved or rejected).
17. Two rapid presses of the confirm button result in exactly one movement-log entry.
18. A piece whose partition is checked `Full` can still be quick-added to, and the `Full`
    checkbox remains checked afterwards.
19. A piece with `catalogMatched === false` exposes the same `Add` button with the same
    behaviour.
20. Empty partition rows render no `Add` button — only the existing `Full` checkbox and
    the panel-level "Add a piece here".
21. `Add a piece here` at the foot of the panel still opens the add-piece modal, unchanged.

## Dependencies

- `addToExistingPiece` in `src/lib/store.ts` and `server/actions.ts` — existing, unchanged.
- `QuantityInput`, currently exported from `src/components/AddPieceWizard.tsx` — existing,
  unchanged in behaviour (see `Q2` for where it should live).
- The compartment panel as re-specified by [`add-piece-modal.spec.md`](add-piece-modal.spec.md)
  (the panel asks its page to open the modal rather than navigating).

## Open questions

- **Q1 — one click = +1, or an inline quantity row?** This spec assumes the inline row,
  because the panel already has exactly that interaction for "Take out", so the user
  learns nothing new, and pieces are usually salvaged in batches. The cost is one extra
  press for the single-unit case. The alternative — `Add` adds exactly 1 per press, no
  inline row — is strictly simpler and closer to the verbatim request ("only a new
  button"), and the movement log makes it undoable. If the user prefers it, criteria 2–5,
  8–10, 12–17 change and everything else stands.
- **Q2 — should `QuantityInput` move out of `AddPieceWizard.tsx` into `ui.tsx`?** It is
  already exported, so `CompartmentPanel` can import it as-is; but `day4/CLAUDE.md` says
  shared primitives live in `src/components/ui.tsx`. Moving it is a two-line refactor with
  one extra import site touched; importing across components is zero. Implementer's call
  unless the user objects; the behaviour is identical either way.
- **Q3 — what should the panel do when a store action rejects?** Pre-existing gap: "Take
  out", "Delete" and the panel's other writes report nothing on failure. This change does
  not fix it and should not invent a per-row error banner on its own.
- **Q4 — should adding units to a partition marked `Full` do anything about that flag?**
  Assumed no (leave it checked, no warning), matching the wizard's duplicate merge. The
  other reading is that restocking a compartment the user declared full deserves at least
  a hint.
- **Q5 — button label.** `Add` is assumed, for symmetry with `Take out`. `Add more` and
  `＋` are the alternatives; `＋` alone risks being read as the panel-level add.

## Out of scope

- The same quick-add on the search results / all-pieces rows (`PieceRow`), on
  `EditPiecePage`, or in the 3D view.
- A quick-extract counterpart (`−1` in one press) on the occupant row.
- Remembering the last-used quantity per piece or per session.
- An in-app undo for the add beyond "Take out" the same amount.
- Any change to how the add-piece wizard detects or merges duplicates.
- Component-level tests for the panel — they would need a DOM runner and a testing
  library, which `day4/CLAUDE.md` requires asking the user about first.

## Reference documentation

- [`../lego-inventory-spec.md`](../lego-inventory-spec.md) — the behavioural source of
  truth, including the add/extract rules and the movement log.
- [`../lego-inventory-ux-ui.md`](../lego-inventory-ux-ui.md) — screens and states.
- [`add-piece-modal.spec.md`](add-piece-modal.spec.md) — the add-piece flow's hosts and
  the panel's "Add a piece here" contract.
- `src/components/CompartmentPanel.tsx` (`OccupantRow`, the extract inline form) — the
  pattern this change mirrors.
- `server/actions.ts#addToExistingPiece` — the write and the log entry it appends.
