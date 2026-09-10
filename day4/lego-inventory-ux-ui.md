# LEGO Brick Inventory System — UX/UI Design

Companion document to `lego-inventory-spec.md`. Describes screens, layout, states, and
navigation. Every interaction here maps to a behaviour or acceptance criterion already
defined in the spec — this document does not introduce new product decisions, only the
visual/interaction shape of the ones already made (see `SESSION_LOG.md` for the decision
history).

## Design principles

- **Utilitarian, not decorative.** This is a personal workshop tool used while building —
  fast scanning and low-friction actions matter more than visual flourish.
- **No LEGO branding or trademarks.** Generic placeholder iconography (a simple stud-brick
  silhouette) stands in for official LEGO imagery; this is a personal hobby project, not an
  official LEGO product.
- **Grid-first.** The drawer grid is the spatial mental model the user already has in their
  workshop; the UI mirrors it rather than replacing it with abstract lists.
- **Two densities.** Desktop/tablet (primary) gets a denser grid and inline panels; mobile
  (secondary, touch) collapses to full-screen steps and bottom sheets, with 44px+ tap targets.
- **State visibility over navigation depth.** Fullness, partitions, and quantities are always
  visible at the grid level — the user shouldn't have to open a compartment just to see
  whether it's worth going there.

## Screen inventory

| # | Screen | Purpose |
|---|--------|---------|
| 1 | Home | Search bar + grid of all drawer units |
| 2 | Drawer unit view | Grid of one unit's compartments |
| 3 | Compartment detail | Pieces/partitions in one compartment; extract; mark full |
| 4 | Add piece | Manual entry, duplicate detection, partition suggestion |
| 5 | Search results | Live filtered results across the whole inventory |
| 6 | Edit piece | Detail-only edit (no quantity) |
| 7 | Movement log | Global log, filterable |
| 8 | Drawer setup | Define/edit unit and compartment counts |

## Navigation map

```
Home ──search──> Search results ──"go to grid"──> Drawer unit view ──> Compartment detail
  │                                                                          │  │
  └──click unit──> Drawer unit view ──click compartment──> Compartment detail│  ├─ Extract
                                                                              │  ├─ Edit piece
                                                                              │  ├─ Add piece
                                                                              │  └─ Mark partition full
Home / any screen ──> Movement log (global, always reachable)
Home ──> Drawer setup
```

Search results never link directly to extraction — per spec, the user must land on the grid
first ("User cannot extract directly from search results; must navigate to grid"). A search
result's "Go to compartment" action always routes through the Drawer unit view.

---

## 1. Home screen

**Layout (desktop):** search bar spans the top, full width. Below it, a grid of cards, one
per drawer unit, arranged left to right, wrapping. Each unit card shows a small thumbnail
grid of its own compartments (a "grid within a grid") so fullness/occupancy is visible
without opening the unit.

**Unit card:**
- Unit label ("Unit 1")
- Mini compartment grid: filled compartments highlighted (accent fill), empty ones grayed
  out, full compartments/partitions marked with a distinct badge (e.g. a small corner flag)
- Click anywhere on the card → Drawer unit view (screen 2)

**Search bar:**
- Placeholder: "Search by description or part number…"
- Typing routes to Search results (screen 5) inline (results appear below the bar, grid
  fades behind or is replaced — see screen 5 for exact behavior); this satisfies "no search
  active → grid" and "search active → results" from the spec without a page transition.

**Empty states:**
- No drawer units configured yet → the grid area is replaced with a single prompt: "Set up
  your first drawer unit" → button to Drawer setup (screen 8). This is the only way a
  first-time user reaches setup without hunting for it.

**Mobile:** search bar sticks to the top; unit cards stack in a single column, each full
width, mini-grid scaled down but still tappable to jump straight to a compartment (skip
level 2 entirely on a confident tap — optional shortcut, not required by spec).

---

## 2. Drawer unit view

**Layout:** header shows the unit name/number and a "back to Home" affordance. Below it, the
full compartment grid for that unit, sized to the unit's configured rows × columns (e.g.
4×4).

**Compartment cell states** (mirrors spec's "highlighted vs grayed out"):
- **Empty:** gray fill, no content.
- **Occupied, single piece type:** accent fill, shows a tiny piece icon + color swatch,
  quantity badge in the corner.
- **Occupied, subdivided (2 or 3 partitions):** the cell is visually split into 2 or 3 equal
  horizontal bands, each with its own color swatch + quantity; a partition marked "full" gets
  a small lock/flag icon on that band only (not the whole cell) — reflects that fullness is
  per-partition.
- **Whole compartment full** (all partitions full, or unsubdivided and marked full): the
  entire cell gets a subtle diagonal-hatch overlay in addition to its normal fill — visually
  distinct from "empty/gray" so the user doesn't confuse "full" with "unused."

**Interaction:** clicking any compartment (regardless of state) opens Compartment detail
(screen 3) for that compartment. Empty compartments open the same detail view but it opens
directly into "Add a piece here" instead of a piece list.

**Persistent action:** an "Edit drawer structure" link/icon in the header routes to Drawer
setup (screen 8), scoped to this unit.

---

## 3. Compartment detail

Presented as a side panel on desktop (grid stays visible behind it) and a full-screen sheet
on mobile.

**Header:** "Unit X, Compartment Y" + close button.

**Body — one row per partition (or one row total if not subdivided):**
- Color swatch + piece description + part number (if any) + official image (or placeholder)
- Quantity, large and legible
- **Extract** button → inline quantity stepper (≥1, ≤ current quantity) + confirm. On
  confirm: quantity decreases; if it reaches 0, that row disappears from the list (and the
  partition becomes reusable — reflected instantly if the user reopens Add piece from here).
- **Mark full** toggle for that partition (independent per row when subdivided)
- **Edit** link → Edit piece screen (screen 6), scoped to this piece
- **Delete** action (with a confirmation step) — removes the piece entirely; log entry is
  created but this screen doesn't show history (see Movement log, screen 7, for that)

**Footer:** "Add a piece to this compartment" button — opens Add piece (screen 4) pre-filled
with this location, entering the duplicate-detection / partition-suggestion flow described
below if applicable.

**Empty compartment variant:** body shows a single empty-state message ("Nothing stored
here yet") and only the "Add a piece" footer action.

---

## 4. Add piece flow

A single-column form (modal on desktop, full-screen step flow on mobile). Steps are shown
here as logical stages; on desktop they can render as one scrollable form, on mobile as
sequential screens with a progress indicator.

**Step A — Piece details**
- Description (text, required)
- Part number (text, optional)
- Color: a swatch grid drawn from the predefined LEGO color palette, plus a distinct "Other…"
  swatch at the end that reveals a free-text field when selected
- Quantity (number stepper, required, positive integer)
- Notes (multi-line text, optional)
- If a part number is entered, the piece image/name area updates live from the local bundled
  catalog lookup (near-instant, no spinner needed beyond a brief skeleton state); if not
  found, shows the generic placeholder icon plus a small "not found in catalog — using your
  description" note. No network indicator is ever shown, since lookup is local.

**Step B — Duplicate detection** (only shown when a match is found per the spec's matching
rule: part number + color, or normalized description + color)
- Inline banner above the form fields, not a separate screen: "This piece already exists in
  Unit X, Compartment Y (12 in stock). Add your 5 to that location?"
- Two actions: **"Add to that location"** (primary — skips location/partition selection
  entirely, merges quantities) or **"Choose a different location"** (secondary — proceeds to
  Step C as if it were a new piece).

**Step C — Location** (skipped if Step B's "add to that location" was chosen)
- Suggested location shown as a highlighted cell in a mini version of the target unit's grid,
  with the reasoning as a caption ("Suggested: grouped with other Brick 2×4 pieces").
  Compartments/partitions marked full are never suggested and appear disabled in this
  mini-grid.
- User can accept the suggestion or tap any other compartment in the mini-grid to pick
  manually.

**Step D — Partition choice** (only shown when the chosen compartment already holds the same
piece type in a different color)
- Shows the compartment as a rectangle the user can split into 1, 2, or 3 equal segments
  (tap to choose a count) — this is a direct manipulation control, not a dropdown, so the
  physical result is obvious.
- Existing color(s) already occupy their segment(s); the new color previews in the remaining
  segment.
- A short note under the control: "Partitions are physical dividers you place in the
  compartment yourself."

**Confirm:** a single "Add piece" primary action at the bottom, always visible/sticky on
mobile. On success, the flow closes back to wherever it was opened from (compartment detail,
or the grid if opened from an empty cell).

---

## 5. Search results

Rendered inline below the Home search bar (not a separate page) so search always starts from
where the user already is.

**As the user types (debounced, but must feel instant — 100ms budget per spec):**
- Results grouped by piece type, then by color variant, one row per color-variant-location:
  `Brick 2×4 — Red: 5 in Unit 1, Compartment 3` (matches the spec's example format exactly).
  If the same color/type is spread across multiple locations, each location is its own row.
- Each row has a **"Go to compartment"** action, which navigates to Drawer unit view (screen
  2) with that compartment highlighted/scrolled into view — never a direct extract control
  here, per spec.

**Filters bar** (appears once there's a search term or is always visible, collapsed by
default): color filter (chips drawn from colors actually present in the current results) and
drawer-unit filter (chips per unit). Filters combine with AND semantics and update results
immediately, no "apply" step.

**Empty state:** when there's a search term and zero matches, replace the results area with:
"No results found" (verbatim, per spec) plus a subtle suggestion to check the drawer grid
directly.

**Clearing the search bar** returns to the plain Home grid view.

---

## 6. Edit piece screen

Same modal/full-screen-step shell as Add piece, but simpler (no location or partition
stages — those are only touched via a dedicated "Move" action).

**Editable fields:** description, part number (re-fetches image/name from the local catalog
on change; on a miss, image/name reset to the placeholder — no stale data from the previous
part number lingers), color (same palette + "Other" control as Add piece), notes.

**Quantity — deliberately not editable here.** Shown as a read-only line: `Quantity: 12` with
a small inline note: "To change quantity, use Extract (compartment view) or Add (to bring in
more)." This is a UI decision that exists specifically to prevent the confusion the spec
review resolved — quantity must never look like a field you can just retype.

**Move action:** a separate, clearly distinct button — "Move to a different compartment" —
opens the same mini-grid location picker used in Add piece's Step C (respecting full
compartments/partitions the same way). This is visually separated from the field-editing
form so it doesn't read as "just another field."

**Non-editable fields shown for context, not editable:** Added date, at the bottom, in muted
text, with a tooltip/caption "Cannot be changed."

**Delete:** available here too (same confirmation step as in Compartment detail).

---

## 7. Movement log

A dedicated full-page/full-screen view, reachable from Home (icon/link, always present, e.g.
top-right of the header) — not nested under any single drawer, since the log is global.

**Default view:** every entry across the whole system, newest first.

**Filters (top of the page, not a modal):** unit selector (including "All units") and,
once a unit is chosen, an optional compartment selector scoped to that unit. Filters compose
with the same immediate-update behavior as search filters.

**Entry row:** timestamp, piece description, a colored tag for the action type (`add`,
`extract`, `move`, `edit`, `delete` — five distinct tag colors, consistent everywhere they
appear), and a one-line human-readable detail string built from the entry's specifics:
- `add`: "+5 → Unit 1, Compartment 3"
- `extract`: "−3 (9 remaining) — Unit 1, Compartment 3"
- `move`: "Unit 1, Compartment 3 → Unit 2, Compartment 1" (single row, since the log is
  global — no duplicate rows per unit)
- `edit`: "Color changed: Red → Dark Red"
- `delete`: "Removed (last known: 4 in Unit 1, Compartment 3)"

**Deleted pieces:** their log rows remain and are visually identical to any other row —
there's no special "ghost" styling, since the spec treats them as ordinary history, just for
a piece that no longer exists in current inventory.

**Read-only:** no edit or delete affordance anywhere on this screen — log entries are
immutable, and the UI simply never offers an action that would imply otherwise.

---

## 8. Drawer setup / configuration

**Initial state (no units yet):** a single, welcoming form: "How many drawer units do you
have?" → number input, then per-unit "rows × columns" inputs (defaulting to a common size
like 4×4, editable). A "Create" action generates the units and takes the user to Home.

**Editing an existing configuration:** a list of current units, each showing its
rows/columns and occupied-compartment count. Editing a unit's dimensions or removing a unit
is blocked inline (not with a popup) whenever it would orphan an occupied compartment: the
affected compartments are highlighted in red in a preview grid, and the save action is
disabled with a message: "Move or remove the pieces in the highlighted compartments first."
This makes the constraint visible before the user tries to save, rather than after.

**Adding a new unit:** always allowed (never orphans anything) — a lightweight "+ Add unit"
action with the same rows/columns inputs as initial setup.

---

## Shared components

- **Color swatch:** a small circle/square filled with the palette color, with the color name
  as a tooltip/label; the "Other" swatch is visually distinct (a plus icon or dashed border)
  rather than a color, so it never gets mistaken for an actual color option.
- **Piece image:** fixed-aspect-ratio square; shows the fetched image when available, or the
  generic placeholder brick silhouette otherwise — same visual weight either way, so the grid
  never looks "broken" for pieces without a photo.
- **Fullness indicator:** a small flag/lock icon, consistently placed at the top-right corner
  of whatever it's marking (a partition band or a whole compartment cell) — one icon,
  reused everywhere fullness is shown (grid cells, compartment detail, location pickers).
- **Action-type tag** (log): five fixed colors, one per action type, reused between the
  Movement log and any inline log excerpts (e.g. if a future screen shows "recent activity"
  for a single piece).

## Responsive summary

| Screen | Desktop/tablet | Mobile |
|---|---|---|
| Home | Search bar + wrapping grid of unit cards | Search bar + single-column unit cards |
| Drawer unit view | Full grid, side panel for detail | Full-screen grid, detail as a sheet |
| Compartment detail | Side panel | Full-screen sheet |
| Add/Edit piece | Single scrollable modal | Sequential full-screen steps |
| Search results | Inline below search bar | Inline below search bar, filters collapse into a sheet |
| Movement log | Full page, filters inline at top | Full page, filters collapse into a sheet |
| Drawer setup | Full page | Full page |

All interactive targets meet a 44px minimum on touch, per standard mobile accessibility
practice — this is an implementation detail, not a new product requirement.

## Out of scope for this document

Visual identity (exact colors, typography, spacing scale) is intentionally left open — this
document defines structure, states, and interaction, not a finished visual style. A separate
visual-design pass (mockups) can apply a concrete style on top of this without changing any
of the flows described here.
