# LEGO Brick Inventory System — Specification

**Related documents:** [`lego-inventory-ux-ui.md`](lego-inventory-ux-ui.md) (screens, states, navigation flows) · [`SESSION_LOG.md`](SESSION_LOG.md) (decision history)

> **Amendment (post-implementation):** the user later overrode this spec's "description required, part
> number optional" design. In the shipped app, **the LEGO part number is mandatory** and **there is no
> free-text description field** — the piece's display name always comes from the bundled catalog
> (official name for the part number, or `Part #<num>` when unrecognized); personal notes remain
> optional. Every "description" reference below should be read as "the catalog-derived name." See
> `day4/CLAUDE.md`'s "Deviations from the written spec" for the authoritative note — this file is left
> otherwise unchanged as a record of the original design.

## Intent

Enable a single collector to organize and quickly locate loose LEGO bricks from completed sets stored in workshop-style drawer organizers. When building a new creation, the system provides fast, visual lookup of which drawers contain needed pieces.

## Scope boundaries

**This feature touches:**
- Inventory data model (pieces, quantities, locations, metadata)
- Local storage (offline persistence in browser)
- Search and filter UI
- Visual drawer representation (grid view)
- Piece editing and deletion
- Export for backup
- Movement log (global audit trail, filterable by unit/compartment)

**Does not touch:**
- User authentication or multi-user access
- Cloud synchronization or remote storage
- Payment or pricing
- LEGO set purchasing or recommendations
- AR visualization or 3D rendering

## Non-goals

- Multi-user collaborative editing
- Cloud backup or real-time sync
- Mobile app distribution (PWA only, installed by user)
- Integration with LEGO official marketplace or catalog APIs beyond image lookup
- Advanced analytics or statistics dashboards
- Automatic LEGO set import from set codes (manual entry only)
- Barcode scanning or OCR

## Behaviour

### Initial interface & home screen

**On first load or with no search active:**
- Display: Search bar (top) + visual grid of all drawer units
- Grid shows compartments with pieces highlighted; empty ones grayed out
- User can:
  - Type in search bar to find pieces (displays location and quantity)
  - Click a drawer unit to expand and see compartments
  - Click a compartment to view/extract pieces

### Setup Phase

**Create drawer structure**
- User defines physical drawer layout: "4 drawer units, each 4×4 compartments" (16 compartments per unit, 64 total)
- System stores this configuration for location suggestions
- User can edit drawer structure at any time; existing piece locations remain valid if within new bounds
- **Reducing bounds:** If reducing the number of units, deleting a unit, or reducing compartments per unit would leave any existing piece without a valid location, the system blocks the change. The user must move or remove the affected pieces first.
- **Note:** Reorganizing drawer layout is out of scope for v1 (future feature)

### Adding inventory

**Manual piece entry**
1. User enters:
   - Piece description (required): plain text (e.g., "Brick 2×4")
   - LEGO part number (optional): numeric/alphanumeric (e.g., "3001")
   - Color (required): selected from a predefined LEGO color palette (e.g., "Red (21)", "Dark Stone Grey (85)"), or "Other" with free text for colors outside the catalog
   - Quantity (required): positive integer
   - Personal notes (optional): free text

2. System behavior:
   - If part number provided: look up piece image and official name in the bundled LEGO parts catalog (Rebrickable dataset, embedded locally — no network call needed)
   - If part number is not found in the catalog: use user-provided description as fallback, and show a generic placeholder image
   - **Duplicate detection:** a piece is considered the same as an existing one when:
     - both have a part number: match on part number + color, or
     - either is missing a part number: match on normalized description (case-insensitive, trimmed) + color
     - If a match is found, system suggests: "This piece already exists in Unit X Compartment Y. Add qty to that location?"
   - Suggest drawer location based on:
     - Piece type (e.g., all "Brick 2×4" grouped together)
     - User-indicated fullness: compartments/partitions manually marked "full" are excluded from suggestions (see Compartment subdivisions below)
   - User accepts suggestion, or manually selects drawer/compartment
   - Record addition timestamp

**Compartment subdivisions** (physical divisions):
- Same piece type with different colors can share one compartment with physical divisions
- A compartment can be split into at most 3 equal partitions (halves or thirds); the system always suggests equal parts and the user chooses how many partitions to use (1 = whole compartment, 2 = halves, 3 = thirds)
- There is no automatic proportional suggestion based on quantity — the user resizes/customizes a partition manually if equal parts don't fit their case
- Divisions are physical separators user maintains in real compartments
- **Fullness marking** applies per partition (or to the whole compartment when it isn't subdivided). A compartment is treated as full once every one of its partitions is marked full. Fullness only affects add-time location suggestions — it has no effect on search or grid visibility.
- When a partition's piece is fully extracted (quantity reaches 0) and its entry is removed, that partition automatically becomes available again for new location suggestions — no manual step needed to reclaim it.

**Result:** Piece stored with:
- Description
- Part number (if provided)
- Color
- Quantity
- Drawer location (e.g., "Unit 2, Compartment 7, Partition 2")
- Subdivision layout (e.g., "thirds: red | blue | green")
- Added date
- User notes
- Image (fetched, or generic placeholder if unavailable)

### Searching and retrieval

**Interactive search**
1. User begins typing piece description or part number in search field
2. Results update in real-time, showing:
   - All drawers/compartments currently containing that piece type
   - Quantity available in each location
   - Color variants listed separately (e.g., "Brick 2×4 Red: 5 in Unit 1 Comp 3")
   - If no matches: displays "No results found"

3. User can refine with filters:
   - By color (e.g., "Red" → shows only red Brick 2×4s)
   - By drawer unit (e.g., "Unit 2" → shows all piece types in that unit)
   - Filters apply dynamically; results update immediately

**Visual drawer representation**
- Grid view shows all compartments of a selected drawer unit
- Compartments with pieces are highlighted; empty ones are grayed out
- Compartments/partitions marked "full" are shown normally here and in search results — the full flag only affects location suggestions when adding new pieces, never visibility or searchability
- Clicking a compartment shows:
  - Piece type
  - Colors stored in that compartment
  - Quantity of each color
  - Subdivisions and their layout (physical divisions)

**Retrieval workflow**
1. User searches for piece (results show location) or navigates to grid
2. User navigates to the compartment in the grid view
3. User selects quantity to extract (≥1, ≤current quantity)
4. System:
   - Reduces quantity by that amount
   - Records an `extract` entry in the global movement log (timestamp, piece, location, quantity extracted, remaining)
   - If quantity reaches 0, piece entry is removed, and if it occupied a partition, that partition becomes available again for new location suggestions

### Editing pieces

**Edit existing piece**
- User can modify:
  - Description
  - Part number (triggers re-fetch of image and name if changed; if the re-fetch fails, image and name are cleared back to the no-image placeholder rather than keeping the previous part number's data)
  - Color
  - Personal notes
  - Current drawer location (move to a different compartment/partition)

- **Quantity is not an editable field.** The only ways to change quantity are adding more (see Adding inventory, with duplicate detection merging into the existing entry) and extracting (see Retrieval workflow). This keeps "edit" limited to correcting piece details, and "add"/"extract" as the only actions that touch stock levels.

- Fields that cannot be edited:
  - Added date (immutable audit trail)
  - Movement history

**Delete piece**
- User can delete a piece entirely (removes all quantity and history)
- Action logs deletion timestamp in the global movement log

### Global movement log

**Single system-wide audit trail**
- The system maintains **one global log** for all changes across every unit and compartment (not one log per drawer) — this avoids ambiguity when an action spans two units, e.g., a `move` from Unit 1 to Unit 2 produces a single entry, not one per unit:
  - **add:** Piece added to compartment/partition (timestamp, piece, location, qty, date)
  - **extract:** Pieces removed from compartment/partition for use (timestamp, piece, location, qty removed, remaining qty)
  - **move:** Piece moved to a different compartment/partition/unit (timestamp, piece, qty, from_location, to_location)
  - **delete:** Piece entry deleted entirely (timestamp, piece, last location, last qty)
  - **edit:** Metadata changed — description, part number, color, or notes (timestamp, piece, field changed, old value, new value)

**Piece deletion behavior:**
- When user deletes a piece, the piece entry is removed from inventory
- Log entries for that piece remain (for auditability)
- User can view what happened to deleted pieces via log

**Viewing**
- User can view the full global log, or filter it by unit and/or compartment; entries sorted by timestamp descending
- Each entry displays: timestamp, piece description, action type, location(s), quantity delta (if applicable), resulting state
- Log format is human-readable in UI; exact formatting is implementation detail

### Backup and export

**Export functionality**
- User can manually trigger an export of the entire inventory as a **JSON file** (no CSV option, no automatic/periodic export)
- File includes:
  - All pieces (description, part number, color, quantity, location, notes, dates)
  - Drawer configuration
  - Full global movement history
- User can download and store locally

**Import (future, not in this spec)**
- Currently out of scope; users maintain backups manually

## Constraints

- **Offline-first:** All data stored locally in browser (IndexedDB or localStorage); no server or cloud storage
- **Single-user:** No authentication, login, or multi-device sync required
- **Network:** May be accessed only on local network (WiFi) or via Tailscale; user responsible for external access setup
- **Platform:** Progressive Web App (PWA); installable on iOS/Android; primary use case is desktop/tablet browser, secondary is mobile
- **Data persistence:** Browser storage capacity typically 5–50 MB available for IndexedDB for user inventory data; the bundled LEGO catalog (parts, colors, images) is additional storage on top of that and may require the browser to grant a larger persistent storage quota (most modern browsers allow this for installed PWAs)
- **LEGO catalog:** Full Rebrickable parts/colors/images dataset bundled locally with the app (no live API, no network access needed for lookup); if a part number isn't in the catalog, fallback to user-provided description
- **No security hardening:** Single-device use; no encryption, no passwords, no access control beyond device ownership
- **Drawer capacity:** System supports configurations up to 10 drawer units, each up to 10×10 compartments (100 per unit, 1000 total theoretical)

## Acceptance criteria

### Setup
- [ ] User can define drawer configuration (number of units, compartments per unit)
- [ ] System stores and persists drawer configuration across browser sessions
- [ ] User can edit drawer configuration; existing piece locations remain valid if within new bounds
- [ ] If reducing units/compartments (or deleting a unit) would leave any piece without a valid location, the system blocks the change until the user relocates/removes those pieces

### Adding pieces
- [ ] User can enter piece description, part number (optional), color (from predefined LEGO palette or "Other" free text), quantity, and notes
- [ ] If part number provided, system looks up image and official name in the bundled LEGO parts catalog (local, no network required); lookup completes within 100ms, same as search
- [ ] If part number is not found in the catalog, system uses user-provided description as fallback and shows a generic placeholder image
- [ ] **Duplicate detection:** system detects an existing piece by part number + color (when both have a part number) or normalized description + color (otherwise), and suggests adding to that existing location
- [ ] System suggests a drawer/compartment/partition location based on piece type, excluding any compartment/partition the user has manually marked "full"
- [ ] User can accept suggestion or manually select a different location
- [ ] If adding to a compartment already holding the same piece type in a different color, system suggests splitting into up to 3 equal partitions (user picks how many to use)
- [ ] Piece is stored with description, part number, color, quantity, location (including partition if applicable), subdivision layout, notes, added date, and image
- [ ] Timestamp recorded at time of addition

### Initial interface
- [ ] Home screen shows search bar (top) + visual grid of all drawer units
- [ ] Grid highlights compartments with pieces; empty ones are grayed out
- [ ] User can click a drawer unit to expand/view compartments
- [ ] User can click a compartment to see piece details and manage pieces

### Search and retrieval
- [ ] User enters search text; results appear within 100ms (local search, no latency)
- [ ] Results show all compartments containing matching piece type, with quantities and colors
- [ ] When no matches found, display "No results found"
- [ ] User can filter by color; results update in real-time
- [ ] User can filter by drawer unit; results update in real-time
- [ ] Filters can be combined (e.g., "Brick 2×4" + "Red" + "Unit 2"); results reflect all active filters
- [ ] Visual grid view displays selected drawer unit with all compartments
- [ ] Compartments with pieces are visually distinct from empty ones
- [ ] Compartments/partitions marked "full" appear normally in search results and grid views — the flag only affects add-time location suggestions, not visibility or searchability
- [ ] Clicking a compartment shows piece details (type, colors, quantities, subdivisions/layout)

### Extraction workflow
- [ ] User navigates to compartment (via grid or search result directing them there)
- [ ] User selects compartment and enters quantity to extract (≥1, ≤available)
- [ ] System reduces quantity by that amount
- [ ] Extracted pieces recorded in the global movement log (type: extract, timestamp, location, qty removed, remaining)
- [ ] When quantity reaches 0, piece entry is removed from inventory automatically, and its partition (if any) becomes available again for new location suggestions
- [ ] User cannot extract directly from search results; must navigate to grid

### Editing
- [ ] User can edit description, part number, color, and notes for any piece
- [ ] **Quantity cannot be edited directly** — it only changes via adding more (with duplicate-detection merge) or extracting
- [ ] Changing part number triggers re-fetch of image/name; if the re-fetch fails, image/name are cleared to the placeholder rather than keeping the previous data
- [ ] User can move a piece to a different drawer/compartment/partition (recorded in the global log as "move", as a single entry even when moving across units)
- [ ] User can delete a piece entirely (inventory entry removed, log entries preserved for auditability)
- [ ] Added date cannot be edited (audit trail immutability)
- [ ] Edit actions (description, part number, color, notes) recorded in the global log (type: edit, field changed, old/new values)

### Subdivisions
- [ ] Same piece type with different colors can coexist in one compartment with physical subdivisions
- [ ] A compartment supports at most 3 equal partitions (halves or thirds); the system always suggests equal parts and the user chooses how many to use (1, 2, or 3)
- [ ] User can manually resize/customize a partition layout beyond the equal-parts suggestion if needed
- [ ] Subdivisions are stored and displayed in UI; user maintains physical dividers in real compartments
- [ ] "Full" can be marked per partition (or for the whole compartment when not subdivided); a compartment counts as full once every partition is marked full
- [ ] When a partition's piece is fully extracted and removed, that partition automatically becomes available for new location suggestions

### Movement log
- [ ] The system maintains one global chronological log of all changes across every unit and compartment
- [ ] Log entry types: **add** (piece added), **extract** (qty removed), **move** (piece moved to a different compartment/partition/unit — one entry even when crossing units), **edit** (metadata changed), **delete** (piece entry removed)
- [ ] User can view the full global log, or filter it by unit and/or compartment; entries sorted by timestamp descending
- [ ] Each entry displays: timestamp, piece description, action type, relevant details (qty, location(s), field changed, etc.), resulting state
- [ ] When piece is deleted, inventory entry removed but log entries remain (auditability)
- [ ] Log entries are immutable (cannot edit or delete log entries directly)
- [ ] Log format is human-readable in UI; exact formatting is implementation detail

### Backup
- [ ] User can manually export entire inventory as a JSON file (includes all pieces, configuration, and full movement history)
- [ ] No CSV export and no automatic/periodic export — JSON, manual only
- [ ] Exported file is downloadable and saved locally by user
- [ ] File size ≤ 5 MB for typical collections (< 5,000 pieces)

### Data persistence
- [ ] All data persists across browser sessions without manual save
- [ ] Data survives browser refresh and PWA app restart
- [ ] Data is stored locally (IndexedDB or localStorage); no network required after initial load

### Visual and interaction
- [ ] Search is interactive: updates as user types
- [ ] All filters apply dynamically without page reload
- [ ] Drawer grid is visually clear: pieces vs. empty compartments easily distinguishable
- [ ] Color representation is accurate (use CSS color names or LEGO standard colors where possible)
- [ ] Mobile (PWA on iOS/Android): all interactions work with touch; layout responsive to screen size

### PWA installation
- [ ] App can be installed on iOS as standalone app (add to home screen)
- [ ] App can be installed on Android as standalone app (install prompt or menu option)
- [ ] Installed app has icon, name, and splash screen
- [ ] App works offline after installation (all data loaded locally)

## Dependencies

- **LEGO parts catalog:** The full Rebrickable LEGO parts/colors/elements dataset ([rebrickable.com/downloads](https://rebrickable.com/downloads/) — free CSV download, includes part images and official names; attribution to Rebrickable required per their terms) is bundled with the app as a static asset and indexed into IndexedDB on first launch. No live API calls or network access are needed for part lookup; if a part number isn't found in the bundled catalog, the system falls back to the user-provided description.
- **Catalog updates:** The bundled catalog is refreshed by re-downloading Rebrickable's dataset and rebuilding/redeploying the app (not fetched at runtime); staying current with new LEGO part releases depends on how often the app is rebuilt.
- **Browser storage:** Requires IndexedDB support (available in all modern browsers); the bundled catalog plus user inventory must fit within the browser's storage quota (see Constraints)
- **PWA support:** Requires Service Worker and manifest.json (modern browsers only; IE11 not supported)

## Open questions

1. **Nice-to-have features:** Should v2 include undo/redo, compartment renaming, or other quality-of-life features?

Previously open questions on color input, image fallback, export schedule, and LEGO data source were resolved in review passes — see `SESSION_LOG.md` ("Round 3" and "Round 4").

## Out of scope (v1)

- LEGO set import (auto-detect set code and import all pieces)
- Barcode scanning or OCR
- Multi-device synchronization or cloud storage
- User accounts or authentication
- Collaborative editing or sharing
- Real-time inventory analytics or dashboards
- Wishlist or shopping functionality
- Integration with LEGO Marketplace
- 3D or AR visualization
- Advanced ML-based organization suggestions
- Reorganizing drawer layout (reordering units, swapping compartments within units)
- Undo/redo of actions
- Renaming compartments or drawer units
- Exporting/importing from other LEGO apps or inventory systems

## Reference documentation

- **UX/UI design:** [`lego-inventory-ux-ui.md`](lego-inventory-ux-ui.md) — screen-by-screen layout, states, and navigation flows for every behaviour defined in this spec
- **LEGO parts catalog:** [Rebrickable free CSV downloads](https://rebrickable.com/downloads/) (`parts.csv`, `colors.csv`, `elements.csv`; attribution to Rebrickable required per their terms)
- **PWA documentation:** https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- **IndexedDB API:** https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Service Workers:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

---

## Spec status

**✅ 100% Ready for implementation.**

All intent, scope boundaries, behaviour, and acceptance criteria are explicit and unambiguous. Every decision point has been clarified through structured Q&A across two review passes (see `SESSION_LOG.md`):
- Duplicate handling (matching rule: part number + color, falling back to normalized description + color)
- User interface (search + grid layout)
- Subdivision management (physical divisions, max 3 equal partitions, per-partition fullness)
- Log structure (explicit action types, single global log instead of per-drawer)
- Deletion behavior (inventory removed, log preserved)
- Extraction workflow (grid-based, not search-based)
- Quantity changes (only via add/extract, never a direct edit)
- Drawer reconfiguration (blocked if it would orphan a piece)
- Backup format (JSON only, manual only)
- Color input, image fallback (predefined palette + "Other"; generic placeholder image)
- LEGO data source (full Rebrickable catalog, bundled locally with the app, no live API)

The remaining open question (v2 nice-to-haves) is non-blocking and can be finalized during development.

UX/UI design (screens, states, navigation) is also complete — see [`lego-inventory-ux-ui.md`](lego-inventory-ux-ui.md). It introduces no new product decisions, only the interaction shape of the ones already made here.

**This spec is contract-ready:** Another engineer can implement from this spec without calling the author for clarification.
