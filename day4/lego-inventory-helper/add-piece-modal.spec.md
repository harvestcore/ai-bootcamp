# Add-a-piece modal (from a compartment) — spec

Status: **Ready for implementation**, except the three items under
[Open questions](#open-questions). Two of them (`Q1` URL reflection, `Q2` discard guard) have a
decision written into this spec, labelled `ASSUMPTION:` where it is mine rather than the
user's; `Q3` is a pre-existing defect this change does not fix.

Companion to [`../lego-inventory-spec.md`](../lego-inventory-spec.md) (behaviour),
[`../lego-inventory-ux-ui.md`](../lego-inventory-ux-ui.md) (screens and states) and
[`3d-drawer-view.spec.md`](3d-drawer-view.spec.md) (the other feature on the same page).
None of them is amended: the add-piece wizard's *rules* are unchanged, only where it is
rendered when it is opened from a compartment.

## Intent

When the user is already looking at a compartment on `DrawerUnitPage`, pressing "Add a piece
here" throws them off the page they are working in and onto a full-screen wizard that then has
to navigate them back. Open that one entry point as a modal over the unit page instead, so
adding piece after piece out of a salvaged set never loses the drawer the user is standing in
front of.

## Scope boundaries

Touches:

- `CompartmentPanel.tsx`: the "Add a piece here" button stops navigating and asks its parent to
  open the modal instead.
- `DrawerUnitPage.tsx`: owns the modal's open/closed state and renders it.
- `AddPiecePage.tsx`: the wizard body is extracted so that one implementation serves both the
  page and the modal (see [Constraints](#constraints), C1). The page keeps its route, its URL
  contract and its current on-page appearance.
- One new modal shell component, and one new wizard component (the extracted body).
- `day4/CLAUDE.md`: the architecture tree gains the new modules and the note that the wizard has
  two hosts.

Does not touch:

- `src/types.ts`, the database schema, `server/*`, the HTTP API, `src/lib/store.ts`,
  `src/lib/inventory.ts`, `src/lib/matching.ts`. This change adds no new kind of write and no
  new derived query: it re-hosts existing UI.
- The route table in `src/App.tsx`. No new route, no new param name. `/add` stays exactly as it
  is, including `/add?unit=<id>&compartment=<n>`.
- `ConfirmDialog.tsx`, `CompartmentGrid.tsx`, `DrawerUnit3D*.tsx`, `AppShell.tsx`.
- The `view` search param and the Grid/3D toggle. The modal reads and writes no search param
  (`ASSUMPTION:` Q1) and, on the one navigation it can still perform, carries the current
  search string along unchanged, the way `select` and the panel's `onClose` already do.
- Every other entry point into adding a piece: the "Add piece" tab in `AppShell`, the "Add a
  piece" button in the `DrawerUnitPage` header, and the one in `PiecesPage` all keep navigating
  to `/add` and keep getting the full page. **Confirmed by the user.**
- `EditPiecePage`: moving/editing a piece is not modalised.

## Non-goals

- **Not a redesign of the wizard.** Same five steps (details → duplicate? → location →
  partition? → done), same copy, same validation, same order, same step indicator. The only
  behavioural differences are the ones enumerated in [Behaviour](#behaviour).
- **Not a replacement for the page.** `/add` remains a real, linkable, standalone screen, and
  remains what every other entry point opens. A saved or shared `/add?unit=…&compartment=…`
  link keeps working and keeps rendering the full page, not a modal.
- **No modalisation of anything else** — not extract, not edit, not delete, not the 3D view.
- **No URL for the open modal** (`ASSUMPTION:` Q1): the modal is React state on
  `DrawerUnitPage`, so a reload with it open lands on the unit page with the modal closed.
- **No draft persistence.** An abandoned draft is not stored anywhere; the browser still
  persists nothing (per `day4/CLAUDE.md`).
- **No multi-piece / bulk entry form.** The "add another" loop stays the way pieces are entered
  one after another.
- **No change to the preselected-location rule.** Opened from a compartment, the location step
  is still skipped, and a detected duplicate still offers "put them somewhere else" — which
  still leads to the full location picker, now inside the modal.
- **Does not fix the already-full-compartment dead end** (Q3).

---

## Behaviour

### Opening

- On `DrawerUnitPage`, with a compartment selected, the panel's **"Add a piece here"** button
  opens a modal over the page. The URL does not change: it stays
  `#/unit/<id>/compartment/<n>` with whatever search string it had (including `?view=3d`).
- The modal shows, from the moment it opens:
  - heading **"Add a piece"**;
  - under it, the target location as `locationLabel(snapshot, unitId, compartmentIndex)` —
    the same string the wizard already uses elsewhere, e.g. `Workshop cabinet · Compartment 3`;
  - a **Cancel** button (top right, ghost), which becomes **Done** once at least one piece has
    been added in this modal session;
  - the step indicator and the **details** step, identical to what `/add?unit=…&compartment=…`
    renders today.
- The page behind is dimmed and inert: it does not scroll under the modal, and nothing behind
  the backdrop is clickable or reachable by Tab.
- The modal covers the sticky header and the mobile tab bar (both `z-30` today).
- Focus moves into the modal on open; Tab and Shift+Tab cycle within it and never reach the
  page behind.
- On a phone the modal fills the viewport width and its content scrolls inside the modal when
  taller than the screen. The compartment panel's own mobile `scrollIntoView` behaviour is
  unchanged and must not fire again because the modal opened.

### The wizard inside the modal

Identical to the page with `?unit=&compartment=` set, with exactly these differences:

| Action | Page today | Modal |
| --- | --- | --- |
| Cancel (nothing added yet) | `navigate(-1)` | close the modal |
| Done (≥1 piece added) | `navigate('/')` | close the modal |
| "See the compartment →", when the piece landed in the compartment the modal was opened from | navigate to `/unit/<id>/compartment/<n>` | close the modal (the panel is already behind it) |
| "See the compartment →", when the piece landed somewhere else (reached via a duplicate's "Put them somewhere else", or after the location picker) | navigate to that compartment | close the modal **and** navigate to `/unit/<thatUnit>/compartment/<thatIndex>`, preserving the current search string |
| "Set up a drawer unit first" empty state | shown when there are no units | unreachable — the modal only opens from an existing unit; the branch stays in the page |

Everything else is the same: duplicate detection and the merge option, the partition split step,
"Add another piece", "Same part, another color", the `N pieces added so far` counter, the
validation messages ("Enter or search for a LEGO part number first.", "Pick a color for this
piece."), and every step's Back button.

After each successful add, the compartment panel and the grid/3D view behind the modal show the
new piece immediately (the store already re-renders every `useInventory()` consumer), while the
modal stays open on the confirmation step.

### Closing

- **Cancel/Done button**, **Escape**, and a **click on the backdrop** all request a close.
- A close request is honoured immediately when the current draft is untouched — part number
  empty, no colour picked, notes empty, quantity 1 — or when the wizard is on the `done`
  (confirmation) step.
- Otherwise (`ASSUMPTION:` Q2) the request is confirmed first, through the existing
  `ConfirmDialog`: title **"Discard this piece?"**, body **"The details you entered won't be
  saved. Pieces you already added stay in your inventory."**, confirm **"Discard"**
  (destructive), cancel **"Keep editing"**. Discard closes the modal; "Keep editing" returns to
  the wizard with the draft intact. Escape while this confirmation is up dismisses the
  confirmation only, not the modal.
- Closing returns focus to the "Add a piece here" button that opened it.
- Closing keeps the compartment selected and the URL unchanged (except the one "see another
  compartment" case above).
- Reopening the modal after a close starts a fresh wizard: empty draft, `details` step, counter
  back to zero.
- Clicking inside the modal — including on a part-search suggestion, a colour swatch or the
  compartment grid of the location step — never closes it.

### Error cases

- A failed write (the local API is down, the server rejects the action) behaves as it does
  today on the page: the wizard stays on the step it was on and the buttons re-enable. The
  modal does not close on a failed add.
- Navigating with the browser Back button while the modal is open leaves `DrawerUnitPage` (to
  whatever was there before); the modal goes with the page. It does **not** act as "close the
  modal" (`ASSUMPTION:` Q1).
- If the piece that made the compartment interesting is deleted from another tab mid-flow, the
  wizard behaves as today: the snapshot re-renders under it and the partition step recomputes
  its choices from the fresh snapshot.

---

## Constraints

- **C1 — one implementation of the wizard, two hosts.** The five steps, the step machine and the
  draft state must exist once. **Decision, with justification:** extract the body of
  `AddPiecePage` into a host-agnostic wizard component (suggested `src/components/AddPieceWizard.tsx`,
  moving `DetailsStep`, `DuplicateStep`, `LocationStep`, `PartitionStep`, `AddedStep` and
  `QuantityInput` with it), parameterised by `openedFrom` and by what "cancel" and "see the
  compartment" mean; `AddPiecePage` becomes the thin route wrapper that reads `unit`/`compartment`
  from `useSearchParams` and maps those two callbacks to navigation. Rationale: the step
  components are already pure presentational functions taking props, and all wizard state is
  already local `useState` with no sub-routes, so the body lifts out without behaviour change.
  The two alternatives are worse: rendering `<AddPiecePage/>` inside the modal would make it read
  `DrawerUnitPage`'s own search params (`view`, and no `unit`/`compartment`) and call `navigate`
  on cancel — the two things the modal must not do; duplicating the steps would fork 400 lines of
  wizard that must not drift. Something like:

  ```ts
  interface AddPieceWizardProps {
    openedFrom: { unitId: string; compartmentIndex: number } | null
    onRequestClose: () => void            // page: navigate away. modal: close.
    onGoToCompartment: (unitId: string, compartmentIndex: number) => void
  }
  ```

  is enough; the exact signature is the implementer's.
- **C2 — no new dependency.** No modal/dialog/focus-trap library, no portal helper package. The
  existing stack (React, react-router-dom, Tailwind) only — per `day4/CLAUDE.md`'s "Don't decide
  on external libraries without asking". Native `<dialog>` or `createPortal` are both allowed;
  both are React/DOM built-ins.
- **C3 — no data access from the modal.** Reads through `useInventory()`, writes through
  `src/lib/store.ts`, exactly as the page does today.
- **C4 — real focus containment.** Unlike `ConfirmDialog` (two buttons, no trap), this modal
  contains text inputs, a searchable part picker, a colour picker and a compartment grid, so Tab
  must not walk out of it into the page behind.
- **C5 — the standalone `/add` route keeps its current behaviour, byte for byte in user terms**,
  including the `unit`/`compartment` query params and the `navigate('/')` / `navigate(-1)` /
  `navigate('/unit/…')` exits.
- **C6 — no interference with `?view=`.** The modal neither reads nor writes search params, and
  the one navigation it can trigger preserves the existing search string.
- **C7 — the modal must sit above `z-30`** (the app header and mobile tab bar) and must not clip
  the part-search suggestion dropdown (`z-20`, absolutely positioned inside its field).

---

## Acceptance criteria

Happy path

1. With `#/unit/<id>/compartment/2` open, clicking "Add a piece here" shows the add-piece wizard
   in a modal over the unit page, and the URL is still `#/unit/<id>/compartment/2`.
2. The modal's first visible step is the details step (part number, colour, quantity, notes) —
   no location step.
3. The modal shows the target compartment's `locationLabel` under the "Add a piece" heading.
4. Entering a valid part number, a colour and quantity 1, then pressing Continue, adds the piece
   to compartment 2 of that unit and shows the confirmation step inside the modal.
5. After that add, the compartment panel behind the modal lists the new piece without the modal
   being closed or the page being reloaded.
6. Pressing "Add another piece" on the confirmation step returns the modal to an empty details
   step, the modal stays open, and the header reads "1 piece added so far".
7. Pressing "Same part, another color" returns to the details step with the part number retained
   and the colour cleared.
8. After one add, the top-right button reads "Done"; before any add it reads "Cancel".
9. Pressing "See the compartment →" when the piece landed in the compartment the modal was
   opened from closes the modal and leaves the URL unchanged.
10. Pressing "See the compartment →" when the piece landed in a different compartment closes the
    modal and navigates to `#/unit/<thatUnit>/compartment/<thatIndex>`.
11. Entering a part number and colour that already exist in the inventory shows the duplicate
    step inside the modal, with the "Add N there" and "Put them somewhere else" options.
12. Choosing "Put them somewhere else" shows the full location picker (unit chips when there is
    more than one unit, and the compartment grid) inside the modal.
13. Picking a compartment that already holds one piece of a different colour shows the partition
    split step inside the modal, and choosing "Halves" saves the piece and shows the
    confirmation step.

URL and view-toggle interaction

14. Opening the modal adds no search param and removes none: from `#/unit/<id>/compartment/2?view=3d`
    the URL is unchanged while the modal is open.
15. Closing the modal from `#/unit/<id>/compartment/2?view=3d` leaves the URL at
    `#/unit/<id>/compartment/2?view=3d`, i.e. the 3D view is still selected behind it.
16. The "see the compartment" navigation of criterion 10, performed from a page with `?view=3d`,
    lands on `#/unit/<thatUnit>/compartment/<thatIndex>?view=3d`.
17. Reloading the browser while the modal is open lands on the unit page with the compartment
    selected and the modal closed.

Closing and the discard guard

18. With nothing typed into the details step, Escape closes the modal.
19. With nothing typed into the details step, clicking the dimmed area outside the modal closes
    it.
20. With a part number typed, Escape shows the "Discard this piece?" confirmation instead of
    closing; "Keep editing" returns to the wizard with the part number still there.
21. With a part number typed, "Discard" on that confirmation closes the modal, and no piece was
    added.
22. On the confirmation (`done`) step, Escape closes the modal with no discard prompt.
23. Clicking a part-search suggestion inside the modal selects it and does not close the modal.
24. Closing the modal leaves the compartment panel open on the same compartment.
25. Reopening the modal after closing it shows an empty details step and no "pieces added so far"
    counter.

The page keeps working

26. Navigating directly to `#/add` shows the full-page wizard with the location step, unchanged.
27. Navigating directly to `#/add?unit=<id>&compartment=2` shows the full-page wizard with the
    location step skipped, unchanged, and **not** a modal.
28. The "Add piece" tab in the bottom nav / header still opens the full page `#/add`.
29. The "Add a piece" button in the `DrawerUnitPage` header still navigates to `#/add` (no
    preselected compartment, no modal).
30. On the full page, "Cancel" with nothing added still goes back, and "Done" after an add still
    goes to `#/`.
31. On the full page, "See the compartment →" still navigates to the compartment.
32. With no drawer units set up, `#/add` still shows the "Set up a drawer unit first" empty state.

Accessibility

33. While the modal is open, repeated Tab presses stay inside the modal and never focus a control
    on the page behind.
34. The modal element exposes `role="dialog"`, `aria-modal="true"` and an accessible name tied to
    its "Add a piece" heading.
35. On open, focus is inside the modal (on its first interactive control).
36. On close, focus is back on the "Add a piece here" button.
37. The modal renders above the sticky app header and the mobile tab bar (neither shows through
    or overlaps it).

Non-regression

38. `npm run typecheck` passes.
39. `npm test` passes unchanged (the domain suite is untouched by this change).
40. No new console errors or React warnings while opening, using and closing the modal.

---

## Dependencies

- The existing wizard behaviour defined in [`../lego-inventory-spec.md`](../lego-inventory-spec.md)
  (duplicate detection, location suggestion, partition split) and the overrides in
  `day4/CLAUDE.md` ("Deviations from the written spec" — part number mandatory, no free-text
  description).
- [`3d-drawer-view.spec.md`](3d-drawer-view.spec.md), only as the owner of the `view` search
  param this change must leave alone.
- No new external dependency (C2).

## Open questions

- **Q1 — should an open modal be reflected in the URL?** This spec assumes **no**: the modal is
  in-memory state, a reload closes it (criterion 17), and browser Back leaves the page rather
  than closing the modal. Reasons: the wizard's own state (step, draft, added count) is local and
  could not be restored anyway, so a URL-restored modal would reopen empty — a shareable link to
  "the add form, blank, for compartment 3" adds little over the already-shareable
  `/add?unit=…&compartment=…`; and pushing a history entry for the modal interacts awkwardly with
  the `view` param, which is deliberately written with `replace`. **But this is a product call,
  and there is a real argument the other way:** on a phone, Back is how people dismiss a sheet,
  and today's behaviour (a full page) does close on Back. If the user wants Back to close the
  modal, the change is a history entry (e.g. `?add=1` on the unit page, pushed on open and popped
  on close) plus criteria 14, 15 and 17 rewritten. **Decide before implementing.**
- **Q2 — is the discard confirmation wanted, or should closing just discard?** This spec assumes
  the guard described under [Closing](#closing) because a backdrop click is easy to hit by
  accident and the wizard can hold a couple of minutes of typing, unlike the two-button
  `ConfirmDialog` that set the click-outside precedent. The cheaper alternative is: no
  confirmation, and instead the backdrop is inert (only the Cancel button and Escape close).
  That would replace criteria 19–22. **Decide before implementing.**
- **Q3 — a pre-existing dead end this feature makes easier to hit.** "Add a piece here" is
  offered even on a compartment that already holds `MAX_PARTITIONS` (3) distinct pieces. Today
  that path ends on the partition step with no choices at all (`needsPartitionSplit` is true,
  `minimum` is 4, `choices` is empty) — only a "← Back". This spec keeps parity and does not fix
  it, but in a modal the user has fewer escape hatches. Options: hide/disable "Add a piece here"
  when the compartment is structurally full; or show an explanatory message on the partition step
  when there is no legal split. **Not in scope unless the user says so.**

## Out of scope

- Modalising Edit/Move (`EditPiecePage`), extract, or the drawer setup screens.
- A modal add flow from the Home unit previews, `PiecesPage`, or the 3D view's own compartment
  click (the 3D view routes through the same `CompartmentPanel`, so it inherits this modal for
  free; nothing else in 3D changes).
- Retiring the `/add` route or the "Add piece" nav tab.
- A generic reusable `Modal` primitive promoted into `ui.tsx` and adopted by `ConfirmDialog`.
  The shell may well end up reusable, but refactoring `ConfirmDialog` onto it is a separate
  change with its own regression surface (every destructive action in the app).
- Keyboard shortcut to open the add modal.
- Bulk/multi-row piece entry.
- Any change to duplicate detection, location suggestion or partition rules.

## Reference documentation

- [`../lego-inventory-spec.md`](../lego-inventory-spec.md) — the behavioural contract for adding
  a piece.
- [`../lego-inventory-ux-ui.md`](../lego-inventory-ux-ui.md) — screens and states, incl. the
  add-piece flow's visual design.
- [`3d-drawer-view.spec.md`](3d-drawer-view.spec.md) — the `view` param and the Grid/3D toggle on
  the same page.
- `day4/CLAUDE.md` — the authority for this project: stack, no-new-dependency rule, client/server
  split, and the spec deviations that govern the wizard's fields.
- Existing code this spec is written against: `src/components/CompartmentPanel.tsx` (the button,
  line ~79), `src/pages/AddPiecePage.tsx` (the wizard), `src/pages/DrawerUnitPage.tsx` (the host
  page and the `view` param), `src/components/ConfirmDialog.tsx` (the modal precedent),
  `src/App.tsx` (the route table).
