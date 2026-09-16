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

`.claude/skills/build-feature/` is the runner for the main chain: it calls
architect → implementer → tester → reviewer in sequence, splices in
`security-analyst` on an escalation, and loops reviewer↔implementer up to three
rounds on must-fix comments. Once reviewer approves, it commits the working tree,
pushes `feature/<slug>` and opens the PR itself — the only step left for the human
is merging it. It is a skill, not an agent, precisely because the orchestrator
needs the three powers no agent is given (see below): creating the feature branch,
committing/pushing/opening the PR once the diff is approved, and stopping to ask
the user when a step comes back blocked.

Two rules hold for all of the **subagents** (architect, implementer, tester,
reviewer, security-analyst, debt-auditor, triager, release-captain): **none of
them commit** — committing is the orchestrator's job, not theirs — and none of
them can ask a question mid-run, so a blocked agent delivers everything that is
not blocked and reports the question instead of stopping.

The orchestrator (`build-feature`) is the one exception to "none of them commit":
once reviewer's verdict is `approve`, it commits, pushes and opens the PR as its
own step, per its skill file. It never merges — that stays a human step regardless
of how the rest of the cycle went. Pushing and opening the PR both need working
GitHub credentials (SSH key or HTTPS auth for `git push`, and `gh auth login` for
`gh pr create`) in the environment the orchestrator runs in; if those aren't
configured there, it stops right after the local commit and hands the user the
exact `git push` / `gh pr create` commands to run themselves — it does not treat a
missing credential as a reason to skip the commit it can make.

For the same reason, **none of them create branches either** — before kicking off the
main chain (or `debt-auditor`/`triager`/`release-captain`) for a new feature, create
and switch to `feature/<slug>` first, so the agents' edits land on that branch instead
of `main`. Naming follows the existing branches (`feature/close-guesses`,
`feature/skip-word`, …). This is the orchestrator's job, not any agent's: when the
main chain runs through `build-feature`, that skill creates the branch as its own
step 0, before `architect` is ever invoked; run manually, the user does it before
launching the first agent.

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
