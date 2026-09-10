# LEGO Brick Inventory System — Specification

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
- Movement log (audit trail per drawer)

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
- **Note:** Reorganizing drawer layout is out of scope for v1 (future feature)

### Adding inventory

**Manual piece entry**
1. User enters:
   - Piece description (required): plain text (e.g., "Brick 2×4")
   - LEGO part number (optional): numeric/alphanumeric (e.g., "3001")
   - Color (required): text field or color picker (e.g., "Red", "Dark Stone Gray")
   - Quantity (required): positive integer
   - Personal notes (optional): free text

2. System behavior:
   - If part number provided: fetch piece image and official name from LEGO database (or cache)
   - If fetch fails: use user-provided description as fallback
   - **Duplicate detection:** If piece of same type/color already exists, system suggests: "This piece already exists in Unit X Compartment Y. Add qty to that location?"
   - Suggest drawer location based on:
     - Piece type (e.g., all "Brick 2×4" grouped together)
     - User-indicated fullness (user manually marks when compartments are full)
   - User accepts suggestion, or manually selects drawer/compartment
   - Record addition timestamp

**Compartment subdivisions** (physical divisions):
- Same piece type with different colors can share one compartment with physical divisions
- System suggests multiple subdivision layouts (e.g., if 3 colors: three equal thirds; if 5R + 3B + 2V: flexible options)
- User can accept suggestion or customize layout (e.g., 1/3 + 1/3 + 1/3, or 1/2 + 1/2)
- Divisions are physical separators user maintains in real compartments

**Result:** Piece stored with:
- Description
- Part number (if provided)
- Color
- Quantity
- Drawer location (e.g., "Unit 2, Compartment 7")
- Subdivision layout (e.g., "thirds: red | blue | green")
- Added date
- User notes
- Image (fetched or blank)

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
   - Records movement in drawer log (timestamp, quantity extracted, remaining)
   - If quantity reaches 0, piece entry is removed

### Editing pieces

**Edit existing piece**
- User can modify:
  - Description
  - Part number (triggers re-fetch of image and name if changed)
  - Color
  - Personal notes
  - Quantity (absolute value, not delta)
  - Current drawer location (move to different compartment)

- Fields that cannot be edited:
  - Added date (immutable audit trail)
  - Movement history

**Delete piece**
- User can delete a piece entirely (removes all quantity and history)
- Action logs deletion timestamp in drawer log

### Drawer movement log

**Per-drawer audit trail**
- Each drawer maintains timestamped log of all changes:
  - **add:** Piece added to compartment (timestamp, piece, qty, date)
  - **extract:** Pieces removed from compartment for use (timestamp, piece, qty removed, remaining qty)
  - **move:** Piece moved to different compartment/unit (timestamp, piece, qty, from_location, to_location)
  - **delete:** Piece entry deleted entirely (timestamp, piece, last qty)
  - **edit:** Metadata changed (timestamp, piece, field changed, old value, new value)

**Piece deletion behavior:**
- When user deletes a piece, the piece entry is removed from inventory
- Log entries for that piece remain (for auditability)
- User can view what happened to deleted pieces via log

**Viewing**
- User can view log for any drawer; entries sorted by timestamp descending
- Each entry displays: timestamp, piece description, action type, quantity delta (if applicable), resulting state
- Log format is human-readable in UI; exact formatting is implementation detail

### Backup and export

**Export functionality**
- User can export entire inventory as JSON or CSV file
- File includes:
  - All pieces (description, part number, color, quantity, location, notes, dates)
  - Drawer configuration
  - Full movement history per piece
- File format: JSON (primary), with CSV option for spreadsheet use
- User can download and store locally

**Import (future, not in this spec)**
- Currently out of scope; users maintain backups manually

## Constraints

- **Offline-first:** All data stored locally in browser (IndexedDB or localStorage); no server or cloud storage
- **Single-user:** No authentication, login, or multi-device sync required
- **Network:** May be accessed only on local network (WiFi) or via Tailscale; user responsible for external access setup
- **Platform:** Progressive Web App (PWA); installable on iOS/Android; primary use case is desktop/tablet browser, secondary is mobile
- **Data persistence:** Browser storage capacity typically 5–50 MB available for IndexedDB; user must manage storage and backups
- **LEGO database:** Fetch images/names from publicly available LEGO API or cache; if API unavailable, fallback to user-provided description
- **No security hardening:** Single-device use; no encryption, no passwords, no access control beyond device ownership
- **Drawer capacity:** System supports configurations up to 10 drawer units, each up to 10×10 compartments (100 per unit, 1000 total theoretical)

## Acceptance criteria

### Setup
- [ ] User can define drawer configuration (number of units, compartments per unit)
- [ ] System stores and persists drawer configuration across browser sessions
- [ ] User can edit drawer configuration; existing piece locations remain valid if within new bounds

### Adding pieces
- [ ] User can enter piece description, part number (optional), color, quantity, and notes
- [ ] If part number provided and internet available, system fetches image and official name from LEGO database within 2 seconds
- [ ] If part number invalid or fetch fails, system uses user-provided description as fallback
- [ ] **Duplicate detection:** System detects if piece (same type + color) already exists and suggests adding to existing location
- [ ] System suggests a drawer/compartment location based on piece type and user-indicated fullness
- [ ] User can accept suggestion or manually select a different location
- [ ] If adding to existing piece location, system suggests subdivision layout (user chooses)
- [ ] Piece is stored with description, part number, color, quantity, location, subdivision layout, notes, added date, and image
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
- [ ] Clicking a compartment shows piece details (type, colors, quantities, subdivisions/layout)

### Extraction workflow
- [ ] User navigates to compartment (via grid or search result directing them there)
- [ ] User selects compartment and enters quantity to extract (≥1, ≤available)
- [ ] System reduces quantity by that amount
- [ ] Extracted pieces recorded in drawer log (type: extract, timestamp, qty removed, remaining)
- [ ] When quantity reaches 0, piece entry is removed from inventory automatically
- [ ] User cannot extract directly from search results; must navigate to grid

### Editing
- [ ] User can edit description, part number, color, notes, quantity for any piece
- [ ] Changing part number triggers re-fetch of image (if available)
- [ ] User can move a piece to a different drawer/compartment (recorded in log as "move")
- [ ] User can delete a piece entirely (inventory entry removed, log entries preserved for auditability)
- [ ] Added date cannot be edited (audit trail immutability)
- [ ] Edit actions recorded in drawer log (type: edit, field changed, old/new values)

### Subdivisions
- [ ] Same piece type with different colors can coexist in one compartment with physical subdivisions
- [ ] When adding piece with multiple colors to one compartment, system suggests subdivision layouts (e.g., thirds, halves, custom)
- [ ] User can accept suggestion or customize (e.g., 1/3 + 1/3 + 1/3 or 1/2 + 1/2)
- [ ] Subdivisions are stored and displayed in UI; user maintains physical dividers in real compartments

### Drawer log
- [ ] Each drawer maintains chronological log of all changes
- [ ] Log entry types: **add** (piece added), **extract** (qty removed), **move** (piece moved to different compartment), **edit** (metadata changed), **delete** (piece entry removed)
- [ ] User can view drawer log for any unit; entries sorted by timestamp descending
- [ ] Each entry displays: timestamp, piece description, action type, relevant details (qty, location, field changed, etc.), resulting state
- [ ] When piece is deleted, inventory entry removed but log entries remain (auditability)
- [ ] Log entries are immutable (cannot edit or delete log entries directly)
- [ ] Log format is human-readable in UI; exact formatting is implementation detail

### Backup
- [ ] User can export entire inventory as JSON file (includes all pieces, configuration, history)
- [ ] User can export entire inventory as CSV file (spreadsheet-compatible format)
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

- **LEGO public data source:** System fetches piece images and official names (e.g., LEGO API, BrickLink, or similar public dataset). If API rate-limits or unavailable, fallback to user-provided description.
- **Browser storage:** Requires IndexedDB or localStorage support (available in all modern browsers)
- **PWA support:** Requires Service Worker and manifest.json (modern browsers only; IE11 not supported)

## Open questions

1. **LEGO data source:** Which API or database should we use to fetch piece images and official names? (LEGO official API, BrickLink, or local static catalog?)
2. **Color picker UI:** Should users enter colors as free text, select from a predefined LEGO color palette, or both?
3. **Image fallback:** If image fetch fails, show placeholder, or just leave blank?
4. **Export schedule:** Should backup be manual-only, or should system auto-export periodically (e.g., daily)?
5. **Nice-to-have features:** Should v2 include undo/redo, compartment renaming, or other quality-of-life features?

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

- **LEGO API options:**
  - Official LEGO API (if available; licensing may apply)
  - BrickLink database (open source, extensive catalog)
  - Rebrickable database (LEGO parts and sets)
- **PWA documentation:** https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- **IndexedDB API:** https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Service Workers:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

---

## Spec status

**✅ 100% Ready for implementation.** 

All intent, scope boundaries, behaviour, and acceptance criteria are explicit and unambiguous. Every decision point has been clarified through structured Q&A:
- Duplicate handling (grouping strategy)
- User interface (search + grid layout)
- Subdivision management (physical divisions)
- Log structure (explicit action types)
- Deletion behavior (inventory removed, log preserved)
- Extraction workflow (grid-based, not search-based)

Remaining open questions (LEGO data source, color picker UI, image fallback, export schedule) are design decisions that do not block implementation and can be finalized during development phase.

**This spec is contract-ready:** Another engineer can implement from this spec without calling the author for clarification.
