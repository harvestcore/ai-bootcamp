---
name: build-feature
description: >
    End-to-end feature build that orchestrates the architect, implementer,
    tester and reviewer subagents (escalating to security-analyst when the
    diff warrants it), looping reviewer↔implementer up to three times before
    handing off to the human. Use when asked to build, implement or ship a
    feature "end to end" or to "wire the agents together" for a change.
---

# Build Feature

You are the orchestrator. The subagents cannot commit, cannot branch and cannot ask
you a follow-up question — this skill exists to cover exactly those three gaps: it
creates the branch before any agent runs, carries every artefact from one agent to
the next, and is the one place that stops and asks the user when an agent reports
back blocked.

## Handoff shape (read this before running anything)

Main pipeline is **sequential**: architect → implementer → tester → reviewer, each
producing the artefact the next one consumes. `security-analyst` is inserted into
that sequence, not run alongside it, whenever reviewer's `Escalate` line fires.
reviewer↔implementer is the one **feedback loop**: reviewer can hand work back with
notes, implementer addresses them, and the loop runs again — capped at 3 rounds so a
disagreement doesn't run forever.

| From              | To                | Artefact                                                    |
| ----------------- | ----------------- | ------------------------------------------------------------ |
| you (orchestrator)| architect         | the raw description + `dayN` + slug                          |
| architect         | implementer       | `dayN/<slug>.spec.md` path, plus its Intent/Acceptance/Risks |
| implementer       | tester            | files changed (`path:line`) + criteria met/not met            |
| tester            | reviewer          | test files added + real run result                            |
| reviewer          | security-analyst  | *(conditional)* the same working-tree diff, only on Escalate  |
| reviewer / security-analyst | implementer (loop) | the must-fix comment list / findings, unchanged        |
| reviewer          | you (approve)     | verdict: approve                                              |
| you               | user              | final summary; nothing is committed, pushed or opened as a PR |

Every artefact that matters is also a message in *your* turn, not just a file on
disk — an agent's tool calls are invisible to you, only its final message is, so
this table is what you pass forward in each `Agent` prompt, not "see the file above".

## What I need from the caller

- The feature description, however rough.
- Which `dayN/` it belongs to, and a short kebab-slug for the branch and spec name
  (`feature/<slug>`, `dayN/<slug>.spec.md`). If either is missing and not obvious
  from the description, ask the user before doing anything — guessing the wrong day
  means every downstream agent works in the wrong place.

## Method

### 0. Create the branch — your job, not an agent's

No agent is allowed to branch (see root `CLAUDE.md`). Before invoking `architect`:

```
git status                       # confirm a clean tree; stash/report if not
git checkout -b feature/<slug>
```

If the tree is not clean, stop and ask the user — do not stash their work silently.

### 1. architect

Invoke `architect` with the description and the `dayN`. It writes
`dayN/<slug>.spec.md` and returns Intent, Acceptance criteria, Open questions,
expected files and a Risks line.

- **BLOCKING** response (whole spec is a coin flip) → stop, relay the readings to the
  user, do not proceed.
- Non-blocking `ASSUMPTION:` / open questions → carry them forward, do not resolve
  them yourself; implementer and reviewer both need to see them.

### 2. implementer

Invoke `implementer` with the spec path (or its content) and the `dayN`. Pass along
any open questions from step 1 so it can report against them rather than silently
assume.

- If it reports a blocking question with nothing else to give, treat it like
  architect's BLOCKING case — stop and ask the user.
- Otherwise carry forward: files changed, criteria met/not met, anything deliberately
  left out.

### 3. tester

Invoke `tester` with: the `dayN`, the spec (for what the change is supposed to do),
and implementer's file list (so it knows what's actually new). Let it pick
`enumerate-behaviours` / `cover-the-gaps` / `regression-fixture` per its own routing.

- If tester says the day has no test setup and stops — that matches its own "not my
  job" — stop the pipeline here and report to the user; do not invent a framework
  choice for it.
- Otherwise carry forward: test files added, one line per case, the real run output.

### 4. reviewer

Invoke `reviewer` with target **"the working tree"** (nothing is committed, so there
is no PR or branch diff to point at yet) and the artefacts from steps 1–3 for
context. Explicitly tell it: **do not post anywhere** — that stays out of scope for
this whole pipeline.

Read its output:

- **Escalate** fires → invoke `security-analyst` on the same working tree before
  looping back. Its findings get merged into the same "must-fix" bucket as
  reviewer's own must-fix comments for step 5.
- **Verdict: approve** (with or without comments, but no must-fix items) → go to
  step 6.
- **Verdict: request changes**, or any `must-fix` items → go to step 5.

### 5. The reviewer↔implementer loop (max 3 rounds)

Round counter starts at 1 the first time this step runs.

1. Invoke `implementer` again, this time with the must-fix comments (and
   security-analyst's findings if step 4 escalated) as the "report to close" —
   exactly the shape it already expects from a security/debt report. Nothing else
   changes: same spec, same day.
2. If the fix touched code tester already covered, re-invoke `tester` only for the
   affected area — do not redo the whole suite from scratch.
3. Re-invoke `reviewer` on the working tree again.
4. If it now approves → step 6.
5. If it still has must-fix items and round < 3 → round += 1, repeat from 5.1.
6. If it still has must-fix items and round == 3 → stop the loop. Do not iterate a
   4th time. Go to step 6 and report as **unresolved after 3 rounds**, not as a
   success.

### 6. Report to the user — nothing is committed

Whatever the outcome (approved, blocked, or unresolved after 3 rounds), your final
message to the user is the whole deliverable:

- the branch name and spec path,
- files changed and files added (from implementer/tester),
- the test run result,
- the reviewer's final verdict and any outstanding comments,
- for a blocked/unresolved run: exactly which step stopped it and what decision the
  user needs to make.

**Do not commit, push, or open a PR.** Per root `CLAUDE.md`, commits are the user's
call; this skill only gets as far as a clean, reviewed working tree on
`feature/<slug>`, ready for the user to inspect and commit themselves.

## Not my job

- No merging, no marking anything "done" beyond reviewer's verdict — that stays a
  human step.
- No resolving an architect/implementer BLOCKING question myself — relay it.
- No more than 3 reviewer↔implementer rounds — a 4th round is a human call, not an
  automation problem.
- No touching a day other than the one named in step 0.
