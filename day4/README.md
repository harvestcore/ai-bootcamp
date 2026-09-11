# Day 4

Spec-driven development

## Projects

### LEGO Brick Inventory System

A personal inventory management app for loose LEGO bricks stored in workshop drawer organizers.

**Status:** ✅ Implemented — a local app in [`lego-inventory-helper/`](lego-inventory-helper/):
React + TypeScript + Tailwind in the browser, a small Node server behind it, and all the data in a
single SQLite file on disk (`data/inventory.sqlite`) that never leaves the machine.

```sh
cd lego-inventory-helper
npm install
npm run dev        # http://localhost:5173 (UI + API in one process)
npm run serve      # production build, served on http://127.0.0.1:4173
```

**Documentation:**
- [Full Specification](lego-inventory-spec.md) — Complete technical spec
- [UX/UI Design](lego-inventory-ux-ui.md) — Screens, states, and navigation flows
- [Session Log](SESSION_LOG.md) — Brainstorming Q&A and all decisions made
- [Implementation notes](CLAUDE.md) — stack decisions, architecture, catalog data provenance
- [Skills used](/cli/spec) — `/spec` skill for structured clarification, `grill-me` for the review pass

Architecture notes, commands, and the decisions already made live in
[day4/CLAUDE.md](CLAUDE.md) — read it before touching this project.

---

### Previous projects

- [Twitter-like app specification](twitter-like-app-clone.md)
