# CLAUDE.md

## Project

Personal repository for an **AI bootcamp**: one directory per day, each holding a self-contained
project. `README.md` is the index of days.

```
day1/    Draw & Guess — multiplayer draw-and-guess game (Node + Socket.IO)
```

## How this repo is organised

- **Each `dayN/` is a standalone project.** It owns its `package.json`, its dependencies, its scripts
  and its own docs. Nothing is shared between days.
- **There is no root `package.json` and no workspace.** Never run `npm` from the repo root — `cd` into
  the day directory first. Don't add a root manifest, a monorepo tool, or workspaces without asking.
- **`dayN/CLAUDE.md` is the authority for that day.** Read it before touching anything inside the
  directory; it carries the decisions already made, the commands, and the architecture. This file only
  covers what cuts across days. If the two ever disagree, the day's file wins.
- **Don't refactor across days.** Duplication between `day1/` and a later day is intentional: each day
  is a record of what was built that day. Do not hoist common code into a shared package, and do not
  "fix" an earlier day while working on a later one.
- **New day, new directory.** Adding `dayN/` means adding its own `CLAUDE.md` and a section in the root
  `README.md`.
- **One license for the whole repo:** MIT, in the root `LICENSE`. Don't add per-day `LICENSE` files or
  `license` fields to a day's `package.json` (the day packages are `private`).

## Agents

`.claude/agents/` holds the subagents shared by every day. Each one has a single job,
a restricted tool set, an explicit output shape and a "not my job" section, and each
is a thin wrapper that gives a skill in `.claude/skills/` an identity and a place in
the workflow.

| Agent | Job | Skills it uses | Produces |
| --- | --- | --- | --- |
| `architect` | description → spec | `spec` | `dayN/<slug>.spec.md` + acceptance criteria |
| `implementer` | spec → change | `security-doctor` (on a security report) | edited files + per-criterion report |
| `tester` | change → tests | `tester`, `enumerate-behaviours`, `cover-the-gaps`, `regression-fixture`, `kill-flakes` | test files + a real run result |
| `reviewer` | diff → review | `pr-review` | severity-rated comments + verdict |
| `security-analyst` | diff → security audit | `security-analyst`, `white-hat` (only on request) | findings with entry→path→sink + fixes to apply elsewhere |
| `debt-auditor` | module → debt menu | `debt-audit` | `dayN/debt-audit.md`, items with an interest rate |
| `triager` | issue → automatable? | `triage` | `AUTOMATE` / `SEMI-AUTOMATE` / `HUMAN-REQUIRED` |
| `release-captain` | commits → ship/hold | `safe-release` | `dayN/release-readiness.md` + rollback note |

The main chain is architect → implementer → tester → reviewer, with
`security-analyst` on any diff touching auth, data or external input, and
`implementer` re-invoked with its report to close the findings. `debt-auditor`,
`triager` and `release-captain` are entry points of their own.

Two rules hold for all of them: **none of them commit** — that stays with the user —
and none of them can ask a question mid-run, so a blocked agent delivers everything
that is not blocked and reports the question instead of stopping.

`grill-me` is deliberately not wrapped in an agent: it is an interview with the user,
so it only works invoked directly.

## Language

**Everything written in this repository is in English** — docs, `CLAUDE.md` files, code, comments,
commit messages and user-facing copy alike. Do not mix languages, even when the conversation is in
Spanish.

## Don't

- Don't commit without asking first.
- Don't decide on external libraries without asking first. You can suggest though.
- Don't touch a day's directory while the task is about another day.
