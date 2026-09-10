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

| Aspect | Decision |
|--------|----------|
| **Platform** | SPA/PWA (web + installable on mobile) |
| **Storage** | Offline-first, local IndexedDB/localStorage |
| **Data entry** | Manual |
| **Organization** | By piece type, automatic color subdivisions |
| **Search** | Interactive with dynamic filters |
| **Visualization** | Visual grid of drawer units |
| **Metadata** | Part number, photo (from internet), notes, dates |
| **Users** | Single-user, no authentication |
| **Backup** | Manual export to JSON/CSV |
| **Audit** | Movement log per drawer |

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

## Files Updated

- `lego-inventory-spec.md` — Complete spec, updated with all clarifications
- `SESSION_LOG.md` — This file, record of all decisions

## Next Steps

1. ✅ Spec completed and ready
2. ⏭️ Decide open questions (LEGO API, color picker, image fallback, export frequency)
3. ⏭️ Start UI/UX design
4. ⏭️ Start development and implementation
