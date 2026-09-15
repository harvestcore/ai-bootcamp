# 3D drawer unit view — spec

Status: **Ready for implementation**, with the open questions below answered by the user
where they say "before implementing".

Companion to [`../lego-inventory-spec.md`](../lego-inventory-spec.md) (behaviour) and
[`../lego-inventory-ux-ui.md`](../lego-inventory-ux-ui.md) (screens and states). Neither is
amended by this document: the 3D view is an additional *presentation* of state those
documents already define.

## Intent

Seeing one unit as a flat grid loses the thing the user actually has in the workshop — a
physical cabinet they look at from an angle. Add a real, interactive 3D rendering of a
drawer unit, selectable with a toggle next to the existing grid, so the on-screen unit
matches what the user sees when standing in front of it, while the grid stays the default
and the only view any other screen uses.

## Scope boundaries

Touches:

- `DrawerUnitPage` (the unit detail screen): gains a view toggle and a second renderer, and
  reads/writes the `view` search param of its own URL.
- A new presentational component for the 3D unit.
- `src/lib/inventory.ts`: one new pure helper for a compartment's row/column position.
- `package.json` / lockfile: three new client dependencies.
- `day4/CLAUDE.md`: the dependency list and the architecture tree it documents.

Does not touch:

- The domain model (`src/types.ts`), the database schema, `server/*`, or the HTTP API. The
  3D view is read-only over the existing snapshot and issues no new kind of write.
- `CompartmentGrid.tsx` and `CompartmentPanel.tsx`: both are reused as they are. If the 3D
  view needs a change in either, that is a signal the parity rule below is being broken.
- Every other screen that renders `CompartmentGrid`: `HomePage`, `AddPiecePage`,
  `EditPiecePage`, `DrawerSetupPage` are unchanged. **Confirmed by the user:** the toggle is
  not extended to any of them in this increment.
- Routing (`src/App.tsx`): no new route. The chosen view lives in a query param, which needs
  no entry in the route table; `unit/:id` and `unit/:id/compartment/:index` stay exactly as
  they are.
- The links into the unit page from other screens (`HomePage`, `PieceRow`, the redirects at
  the end of Add and Edit): they add no `view` param, so arriving from elsewhere shows the
  grid.

## Non-goals

- **Not a replacement.** The grid remains the default view on `DrawerUnitPage` and the only
  view everywhere else.
- **No 3D location picker.** Choosing where a piece goes (`AddPiecePage`,
  `EditPiecePage`) and the resize preview (`DrawerSetupPage`) stay 2D.
- **No toggle outside `DrawerUnitPage`.** Confirmed by the user: the Home unit previews, the
  location pickers and the Setup resize preview keep the grid and get no toggle. The compact
  Home previews are links rather than interactive scenes, and a picker needs the greyed-out
  "unavailable" affordance (`disableUnavailable`) that reads much worse in 3D. Extending it is
  a separate increment.
- **No multi-unit scene.** One unit per scene; the 3D view never shows two cabinets.
- **No drawer open/close.** Compartments are open-fronted so contents are visible without an
  animation or an extra interaction.
- **No modelled bricks.** A piece is represented by its colour, not by a mesh of the actual
  part; the real Rebrickable photo is not used as a texture.
- **No auto-rotation, no idle animation, no camera fly-through.** The camera moves only when
  the user moves it.
- **No new write actions.** Extract / mark full / edit / delete are reached only through
  `CompartmentPanel`, exactly as from the grid.
- **No persistent browser storage.** The chosen view lives in the URL and nowhere else: no
  `localStorage`, no `sessionStorage`, no cookie, no server-side preference. The browser still
  persists nothing, per `day4/CLAUDE.md`.
- **No editing of layout in 3D** (no drag to move a piece between compartments).

## Behaviour

### The toggle, and the view in the URL

On `DrawerUnitPage`, above the unit card, a two-option control:

- Two buttons, labelled exactly `Grid` and `3D`, in that order.
- The active button is visually marked and carries `aria-pressed="true"`; the inactive one
  `aria-pressed="false"`.
- Both are reachable by keyboard and activate on Enter/Space.
- Switching view does not clear the selected compartment and does not re-fetch anything.

**The active view is derived from the `view` search param of the page's own URL**, not from
component state that dies on unmount. The app uses `HashRouter`, so the shareable form is
`…/#/unit/<unitId>?view=3d` and, with a compartment open,
`…/#/unit/<unitId>/compartment/<index>?view=3d`.

| URL | View at mount |
|---|---|
| no `view` param | Grid |
| `?view=3d` | 3D |
| `?view=grid`, `?view=`, `?view=anything-else` | Grid |

- The comparison is against the exact string `3d`; any other value, including a different
  case, falls back to Grid rather than erroring.
- An unrecognised value is **not** rewritten or stripped at mount — the URL is left as the
  user typed it, and the page simply shows the grid.
- Pressing `3D` sets `view=3d` on the current URL. Pressing `Grid` **removes** the `view`
  param entirely rather than writing `view=grid`, so the default URL stays clean.
- Both buttons preserve any other search param on the URL.
- Because the view is in the URL, a reload, a bookmark, a shared link or a new tab opens on
  the same view; `?view=3d` renders the 3D view on first paint with no extra interaction.
- **Navigation inside the page preserves the param.** Selecting a compartment (today
  `navigate('/unit/<id>/compartment/<index>')`) and closing the panel (today
  `navigate('/unit/<id>')`) must both carry the current `view` value, or selecting a
  compartment while in 3D would throw the user back to the grid.
- Navigation *into* the page from elsewhere carries no param and therefore shows the grid;
  those call sites are unchanged.

ASSUMPTION: pressing a toggle button **replaces** the current history entry instead of
pushing a new one, so the browser Back button leaves the unit page rather than stepping back
through view switches. Rationale: the view is a presentation choice, not a destination, and
`MovementLogPage` is the only precedent for search-param filters here (it pushes, but its
filters change *what* is listed). See **Open questions**.

### The 3D scene

- The unit is drawn as one cabinet: an outer shell plus `rows × cols` open-fronted
  compartments, laid out so compartment index 0 is the **top-left of the front face** and
  indexes increase left-to-right then top-to-bottom — the same order the grid uses.
- The front face points at the camera in the default pose, tilted enough that the top and one
  side face are both visible (so it reads as a solid object, not a flat picture).
- A compartment number is readable for every compartment, as in the grid where cells are
  always numbered. It is rendered in HTML overlaid on the canvas, not as 3D text (see
  Constraints: no downloaded font).
- The scene has a single light setup and a plain background matching the surrounding card;
  no reflections of, or references to, anything outside the unit.

### Compartment state, view for view

The 3D view is a re-presentation of `getCompartmentInfo(snapshot, unit.id, index)` — the same
call `CompartmentGrid` makes. For every compartment the two views must agree:

| State (from `getCompartmentInfo`) | Grid today | 3D |
|---|---|---|
| `occupants.length === 0`, `partitionCount === 1` | `bg-cell-empty`, `border-cell-line`, no contents | compartment interior in the `--cell-empty` colour, nothing inside |
| One occupant, `partitionCount === 1` | `bg-cell-filled`, colour swatch + quantity | interior in `--cell-filled`, one solid body filling the compartment in the piece's colour |
| `partitionCount > 1` | cell split into `partitionCount` horizontal bands, top band = partition 0 | compartment split by `partitionCount - 1` dividers along the **same axis** (top band = partition 0), so the reading order matches the grid |
| A partition with no occupant inside a subdivided compartment | band drawn, no swatch | that sub-volume drawn empty in the `--cell-empty` colour |
| `record.partitionsFull[i] === true` | that band gets the `hatched` overlay | that partition's visible surface carries a diagonal-stripe pattern — the same signal, not a colour change |
| `manuallyFull === true` (every partition flagged) | the whole cell is `hatched` | every partition striped, i.e. the whole compartment reads as striped |
| `structurallyFull === true` (3 occupants) | **no special styling** on this page — `disableUnavailable` is `false` here | likewise no special styling: three occupied partitions *are* the signal |
| `selectedIndex === index` | `ring-2 ring-brand` | the compartment is outlined/emphasised in the `--brand` colour |
| A custom `{source: 'other'}` colour (no `rgb`) | `ColorSwatch` shows a neutral `?` disc | a neutral placeholder material, visibly not a palette colour, never a guessed RGB |

Quantities and piece names are **not** drawn in 3D. They appear in the HTML overlay for the
hovered compartment and, as today, in `CompartmentPanel` for the selected one.

### Interaction

- **Rotate:** drag with the mouse, or one finger on touch. Vertical rotation is clamped so
  the camera never goes below the floor plane or past straight-down.
- **Zoom:** mouse wheel, or pinch on touch, clamped to a minimum and maximum distance so the
  unit can neither be lost in the distance nor clipped through.
- **Select:** click, or tap, on a compartment navigates to
  `/unit/:id/compartment/:index` — keeping the `view` param — which is the identical
  navigation the grid's `onSelect` performs on `DrawerUnitPage`, and `CompartmentPanel` opens
  beside (desktop) or below (mobile) the scene, unchanged.
- A pointer gesture that moved more than a small threshold between press and release is a
  camera drag and selects nothing.
- Clicking the background, or any part of the shell that is not a compartment, changes
  nothing (it does not close the panel).
- Clicking the currently selected compartment again leaves the panel open on it.
- **Hover** (pointer devices only) highlights the compartment under the cursor and shows its
  label — compartment number, and for each occupant the piece name, colour name and
  quantity; the same information the grid puts in its `title` attribute.
- **Reset view:** a control labelled `Reset view` returns the camera to the default pose. It
  resets the camera only; it does not change the URL or the active view.
- The legend below the unit (`empty` / `in use` / `marked full`) is shown in both views and
  keeps the same three entries.

### Live updates

The 3D view reads the snapshot through `useInventory()`, so an action taken in
`CompartmentPanel` while 3D is showing is reflected without a reload:

- Extracting the last of a piece: that partition becomes empty in the scene.
- Ticking `Full` on a partition: that partition becomes striped.
- Adding a piece from the panel and returning to the unit: the new occupant is there.
- Renaming the unit, or resizing it in Setup and coming back: the scene rebuilds at the new
  `rows × cols`.

### Edge and error cases

- **A unit with one compartment** (`1×1`) renders as a single-compartment cabinet, not as an
  empty scene.
- **A large unit** (say `10×10`) renders every compartment; the default camera distance is
  derived from the unit's size so the whole unit is in frame on first render.
- **Selected index out of range:** `DrawerUnitPage` already reduces it to `null`
  (`validSelection`); the 3D view shows no selection and no panel.
- **WebGL unavailable or context creation fails:** the 3D pane shows the message
  `3D isn't available in this browser.` plus a `Back to the grid` action; the grid renders
  when that action is used — which also drops `view=3d` from the URL, so a reload does not
  land back on the broken pane — and the app does not crash or blank. This applies equally
  when the page is opened directly on `?view=3d`.
- **WebGL context lost** (GPU reset, tab backgrounded on some devices): the same message and
  action, not a frozen or black canvas.
- **First switch to 3D** may show a `Loading 3D…` state while the code loads; the grid
  remains interactive up to the moment the switch happens. Opening the page directly on
  `?view=3d` may show the same `Loading 3D…` state instead of the grid.
- **The unit is deleted while the 3D view is open:** the page's existing
  "That drawer unit no longer exists" empty state takes over.

## Constraints

- **Approved libraries, and only these three:** `three`, `@react-three/fiber`,
  `@react-three/drei`, added to `day4/lego-inventory-helper` only. No other 3D, animation,
  post-processing, physics, font or loader package, and nothing added to any other `dayN/`.
  This overrides the "current dependency set is the whole list" line in `day4/CLAUDE.md`
  **for these three packages only**; that file must be updated to say so.
- **The URL is read and written through the router already in the stack.**
  `react-router-dom` (v7, already a dependency) exposes the search params of the current
  location; no new dependency, no manual `window.location.hash` parsing, and no new route.
- **No network at runtime.** The app touches the network in exactly one place today
  (`cdn.rebrickable.com` piece photos, in `PieceImage`). The 3D view must add no second
  place: no HDRI/environment presets, no CDN-hosted fonts or typefaces, no remote models,
  no draco/basis decoders fetched at runtime. Everything it needs ships in the bundle.
- **The 3D libraries must not be in the initial page load.** Opening Home, or a unit page on
  the grid view, must not download them. A unit page opened on `?view=3d` may download them,
  since that is the view being asked for.
- **No new derived domain logic in the component.** Any new pure question about a snapshot or
  a unit goes in `src/lib/inventory.ts`, per `day4/CLAUDE.md`. The one this needs:

  ```ts
  /** Where a compartment sits on the unit's front face. Row 0 is the top row. */
  export function compartmentPosition(unit: DrawerUnit, index: number): { row: number; col: number }
  ```

  Reading the `view` param is view state, not domain logic, and stays in the page.

- **No changes to the domain types, the SQL, or the API.** Read-only feature.
- **Colours come from the existing design tokens** (`--cell-empty`, `--cell-filled`,
  `--brand`, `--cell-line`, `--surface`), not from new hardcoded hexes, so light and dark
  mode stay consistent with the grid (`src/index.css`).
- **Touch targets:** the on-canvas controls and the toggle meet the app's 44px minimum on
  touch (`lego-inventory-ux-ui.md`, "Responsive summary").
- **The accessible path stays 2D.** A WebGL canvas is not keyboard-navigable; the grid, whose
  cells are real `<button>`s, remains the default and must keep working unchanged, so no
  action becomes reachable only through 3D.
- **Test tooling is unchanged.** `npm test` is Node's built-in runner over pure modules only;
  the React components have no DOM runner and adding one needs the user's approval
  (`day4/CLAUDE.md`). So only `compartmentPosition` is unit-testable here; the view and the
  URL behaviour are verified by `npm run build` plus the scripted-headless-browser pass
  already used in this project.
- **`npm run typecheck` must stay clean** under the project's `strict` config.

## Acceptance criteria

Happy path:

1. `DrawerUnitPage` renders a control with exactly two options labelled `Grid` and `3D`.
2. Opening `#/unit/<unitId>` with no `view` param shows `Grid` as the active option and
   `CompartmentGrid` on screen.
3. Activating `3D` replaces the grid with a WebGL canvas showing the unit; activating `Grid`
   brings the grid back.
4. Opening `#/unit/<unitId>?view=3d` directly renders the 3D view with `3D` active, without
   pressing the toggle.
5. Opening `#/unit/<unitId>?view=grid`, `?view=`, or `?view=banana` shows the grid with
   `Grid` active, and the page does not throw.
6. Activating `3D` puts `view=3d` in the page's URL, and reloading the browser at that URL
   renders the 3D view again.
7. Activating `Grid` leaves no `view` param in the URL at all (not `view=grid`).
8. Selecting a compartment while 3D is active lands on
   `#/unit/<unitId>/compartment/<index>?view=3d` and the 3D view is still the one on screen.
9. Closing `CompartmentPanel` while 3D is active lands on `#/unit/<unitId>?view=3d` and the
   3D view is still the one on screen.
10. Reaching the unit page from a `HomePage` unit card, from a `PieceRow` link, or from the
    redirect after adding or editing a piece shows the grid, and the URL carries no `view`
    param.
11. `HomePage`, `AddPiecePage`, `EditPiecePage` and `DrawerSetupPage` render the same
    `CompartmentGrid` they render today, with no toggle and no 3D.
12. In 3D, the number of compartments drawn equals `compartmentCount(unit)` for units of
    `1×1`, `4×4` and `10×10`.
13. In 3D, the compartment drawn at the top-left of the front face is index 0, and the
    compartment to its right is index 1.
14. Dragging on the canvas rotates the camera around the unit; releasing leaves it at the new
    angle.
15. The wheel (desktop) and a two-finger pinch (touch) change the camera distance, and the
    distance stops at a near and a far limit instead of passing through or losing the unit.
16. Vertical rotation stops before the camera goes under the unit's floor plane.
17. Clicking a compartment in 3D navigates to `/unit/<unitId>/compartment/<index>` and opens
    `CompartmentPanel` for that compartment.
18. Tapping a compartment on a touch device does the same.
19. The compartment matching the route's `:index` is drawn emphasised in the `--brand`
    colour while the panel is open.
20. A compartment with no occupants and `partitionCount === 1` is drawn empty, in the same
    `--cell-empty` colour the grid uses for it.
21. A compartment with one occupant and `partitionCount === 1` shows one body in that
    piece's `color.rgb`.
22. A compartment with `partitionCount === 3` is drawn with three sub-volumes, ordered so the
    top one is partition 0 — the same order as the grid's bands.
23. A partition with `partitionsFull[i] === true` is drawn with a diagonal-stripe pattern;
    the partitions of the same compartment with `false` are not.
24. A compartment whose `manuallyFull` is `true` reads as striped across all of its
    partitions.
25. A compartment with three occupants (`structurallyFull`) is drawn with three occupied
    partitions and no additional styling — matching the grid on this page, which does not
    grey it out.
26. A piece whose colour is `{source: 'other'}` is drawn in the neutral placeholder material,
    and no RGB value is invented for it.
27. Hovering a compartment on a pointer device shows a label containing the compartment
    number and, for each occupant, its name, colour name and quantity.
28. `Reset view` returns the camera to the pose it had on first render, and does not change
    the URL.
29. Extracting the last unit of the only piece in a compartment, from the panel while 3D is
    showing, leaves that compartment drawn as empty with no reload.
30. Ticking `Full` for a partition from the panel while 3D is showing makes that partition
    striped with no reload.
31. Resizing the unit in Setup and returning to the unit page in 3D shows the new
    `rows × cols` layout.
32. The legend (`empty`, `in use`, `marked full`) is present in both the grid and the 3D
    view.
33. `compartmentPosition(unit, index)` returns `{row: 0, col: 0}` for index 0 and, for a
    `4×3` unit (`rows: 4, cols: 3`), `{row: 1, col: 0}` for index 3 and `{row: 3, col: 2}`
    for index 11.
34. The 3D palette in dark mode uses the dark values of `--cell-empty` / `--cell-filled` /
    `--brand`, so an empty compartment is not light-mode beige on a dark page.
35. Loading Home and loading a unit page **without** `view=3d` download no chunk containing
    `three`.
36. `npm run typecheck` passes.
37. `npm test` passes, including new cases for `compartmentPosition`.
38. Both views work with the machine offline except for piece photos: no request other than
    the app's own assets and `cdn.rebrickable.com` is made while the 3D view is open.

Error and edge cases:

39. With WebGL unavailable, activating `3D` shows `3D isn't available in this browser.` and a
    `Back to the grid` action, and the page does not blank or throw.
40. Using that `Back to the grid` action shows the working grid and leaves no `view` param in
    the URL.
41. Opening `#/unit/<unitId>?view=3d` directly with WebGL unavailable shows the same message
    and action rather than a blank page.
42. A lost WebGL context shows the same message rather than a frozen or black canvas.
43. A pointer gesture that starts on a compartment, moves beyond the drag threshold, and
    releases on another compartment changes the camera and does not navigate.
44. With the route at `/unit/<id>/compartment/999?view=3d` for a 16-compartment unit, the 3D
    view shows no selected compartment and no panel.
45. Deleting the unit while the 3D view is open shows the existing
    "That drawer unit no longer exists" empty state.
46. Switching from 3D to Grid and back does not accumulate WebGL contexts (repeat 10 times
    without a browser context-limit warning in the console).
47. No console errors or warnings are produced by any of the flows above.

## Dependencies

- The snapshot and its queries: `src/lib/inventory.ts` (`getCompartmentInfo`,
  `compartmentCount`, `getUnit`) and `useInventory()` — unchanged.
- `CompartmentPanel` as the compartment detail, and the existing
  `unit/:id/compartment/:index` route.
- `react-router-dom`'s search-param access on the current location (already in the stack;
  `MovementLogPage` and `AddPiecePage` already read search params).
- Design tokens in `src/index.css`.
- New: `three`, `@react-three/fiber`, `@react-three/drei` (approved by the user for day4
  only).

## Open questions

1. **Should toggling the view push a history entry or replace the current one?** The spec
   assumes replace (see the ASSUMPTION above), so Back leaves the unit page. Pushing would
   make Back undo a view switch instead. Cheap to change either way; affects only the page.
2. **Is "the grid is the accessible path" acceptable, or does the 3D view need keyboard
   selection of its own** (arrow keys moving a focused compartment)? Not specified here.
3. **Should a live OS theme switch while the 3D view is open recolour the scene**, or is
   matching the theme at mount enough? Criterion 34 only requires the latter.
4. **Is anything beyond the three approved packages needed?** If the implementer finds it
   does (a bundled font file for 3D labels, a post-processing package for the outline, a
   pattern texture), that is a question for the user, not a decision to take — this spec
   deliberately specifies labels in HTML and the stripe pattern as something a shader or a
   generated canvas texture can do without a new dependency.
5. **How much bundle growth is acceptable?** `three` + `drei` is on the order of hundreds of
   kilobytes gzipped. Lazy loading keeps it off the first paint (criterion 35), but no budget
   number was given.

**Resolved by the user** (kept here so the decisions are not re-litigated):

- *Persistence of the chosen view* → in the URL as `?view=3d`. Not `localStorage`, and not
  "not remembered at all". See "The toggle, and the view in the URL".
- *Extending the toggle to Home / the pickers / Setup* → no. `DrawerUnitPage` only; see
  Non-goals.

## Out of scope

- A 3D location picker, or a 3D view of the resize preview.
- A toggle on any screen other than `DrawerUnitPage`.
- Modelled brick meshes, or piece photos as textures.
- Several units in one scene, or navigating between units inside the 3D view.
- Drag-and-drop of pieces between compartments in 3D.
- Drawer open/close animation, exploded views, labels printed on the cabinet.
- Screenshot/export of the 3D view.
- Remembering the view across units or across sessions beyond what the URL itself carries.
- A DOM test runner or a component testing library for the new component.
- Any change to the grid's own appearance.

## Reference documentation

- `day4/CLAUDE.md` — the authority for this project: dependency policy, the
  pure-queries-vs-mutations rule, the design-token approach, the test story, and
  `HashRouter` as the routing decision.
- `day4/lego-inventory-spec.md` — the behavioural contract for compartments, partitions and
  fullness.
- `day4/lego-inventory-ux-ui.md` §2 "Drawer unit view" (the cell states this view mirrors),
  §3 "Compartment detail", "Shared components", "Responsive summary".
- `src/components/CompartmentGrid.tsx` — the view this one must agree with, state for state.
- `src/lib/inventory.ts#getCompartmentInfo` — the single source of the states above.
- `src/pages/MovementLogPage.tsx` — the existing precedent for keeping view state in search
  params on this project.
