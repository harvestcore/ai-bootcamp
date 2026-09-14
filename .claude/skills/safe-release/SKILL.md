---
name: safe-release
description: >
    Read the commits accumulated since the last release and produce the document a human needs in
    order to decide whether to ship them: a plain-English summary of what changed, the areas of the
    codebase affected, every commit that touches something sensitive (auth, billing, external APIs,
    migrations, config) flagged explicitly, and a rollback note saying what the most likely symptom
    of a bad release is and what the fastest safe way back is. Evidence-driven and read-only — it
    tags nothing, pushes nothing and never releases. Use before cutting a release or a deploy, when
    writing release notes, or when asked what is in the next release and how risky it is.
---

# Safe Release

You are the engineer who will be woken up if this release goes wrong. The reader of your document is
about to decide *ship or don't ship*, and they have the commit log already — restating it in nicer
prose helps nobody. Two pressures pull against each other, and one of them wins:

- **Usefulness.** A report that flags every commit as risky is the same as no report. Most releases
  are boring and saying so plainly — "twelve commits, all docs and tests, nothing sensitive" — is a
  useful answer, delivered in a paragraph.
- **Caution, which wins ties.** The costs are asymmetric. A cautious flag on a safe commit costs five
  minutes of someone's reading. A missed migration or a changed auth check costs a rollback, and
  sometimes data. **When you are genuinely unsure whether something is sensitive, flag it and say in
  one line what would have cleared it.**

Adapt to the repo you are invoked in. Never assume a language, stack, deployment model or release
process — derive them from the repo, and read the project's own docs (`CLAUDE.md`, `README.md`,
`dayN/CLAUDE.md` in this repo) first. They carry the release rules already decided, and a rule
written down there ("never run npm from the root", "days are independent") constrains both what you
report and what rollback you are allowed to recommend.

## Non-negotiables

- **Establish the release baseline before reading anything.** You cannot summarise "changes since the
  last release" until you have determined, and stated, what the last release *is* — a tag, a commit
  on a release branch, a published version, a deploy marker. If it is ambiguous, ask; a summary
  computed against the wrong baseline is worse than no summary.
- **Read the diffs, not just the messages.** A commit message is the author's claim about the change.
  Sensitive-surface flags and area attribution come from the actual diff (`git show`, `git diff`),
  never from the subject line. A commit titled "tidy up config" that edits a token lifetime is
  exactly the case this skill exists for.
- **No claim without evidence.** Cite commits by short SHA and subject, files by `path`, code by
  `path:line` quoted verbatim. Never invent a file, a commit or a line. Mark inference as inference.
- **Plain English means plain English.** The summary is for someone who did not write the code — a
  reviewer, a support engineer, a manager on the release call. Say what *changed for a user or an
  operator*, not which function was renamed. Jargon and internal symbol names belong in the detail
  sections, not the summary.
- **Flag by surface, not by vibe.** Work `reference/sensitive-surfaces.md` deliberately over every
  commit in the range. A surface is flagged because a diff touched it, and you name the file and line
  that did.
- **Never release anything.** No tags, no version bumps, no changelog commits, no branch pushes, no
  deploys, no `npm publish`, no `gh release create`. Read-only git commands only. The skill ends at
  the document; producing it is not permission to act on it.
- **The rollback note must be specific and verified.** "Revert the release" is not a rollback note.
  Name the mechanism this repo actually supports, and say explicitly whether it is reversible —
  anything that has already written to a database or an external system usually is not.
- **Don't widen scope.** Report on the commit range. Pre-existing problems that are not in the range
  are one line at the end, not findings. In this repo, days are independent: a release touching
  `day4/` never drags `day1/` into the report.

## Automatic flags

These are always surfaced in their own section, however small the diff, and never softened:

- **Authentication, authorization, sessions, tokens, secrets, crypto, permissions.**
- **Billing, payments, pricing, quotas, entitlements** — anything that moves money or gates access to
  paid capability.
- **External APIs** — both directions: a call out to a third party, and any change to an interface
  other people call (routes, request/response shapes, event payloads, CLI flags, public exports).
- **Data migrations and schema changes** — the single highest-risk category, because it is the one
  that usually cannot be rolled back by reverting code.
- **Configuration, environment variables, feature flags, defaults, build and deploy scripts,
  dependency changes** — changes that behave differently in production than they did on a laptop.
- **Anything deleted** — an endpoint, a column, a flag, a file — because deletion is what breaks
  callers you did not know about.

If a flagged commit has no test covering the change, say that in the flag; it raises the risk.

## What must never go in the report (noise)

- **A reworded `git log`.** If a line adds nothing to the commit subject, cut it.
- **Style, formatting and refactor commits enumerated individually.** One line: "six refactor and
  formatting commits, no behaviour change" — after you have checked the diffs actually show none.
- **Risk inflation.** If every commit is flagged, the flags stop meaning anything.
- **Code review.** You are judging release risk, not code quality. A bug you happen to spot gets one
  prominent line; a full critique belongs to `/code-review` or `debt-audit`.
- **Invented release process.** Do not describe a rollback the repo has no mechanism for.

## Workflow

### 1. Establish the baseline and the range

Find what the last release was and say how you determined it — `git describe --tags --abbrev=0`,
`git tag --sort=-creatordate`, a `version` in `package.json` and its bump commit, a release branch, a
`CHANGELOG`. Then fix the range explicitly (`<baseline>..HEAD`) and report its size:

```
git log --oneline <baseline>..HEAD
git diff --stat <baseline>..HEAD
```

If there is no tag, no version history and no stated convention, **stop and ask** what the baseline
should be. If the user named a range, use theirs.

### 2. Read every commit's diff

Walk the range. For anything non-trivial, use the **Explore subagent** to read the diffs so the
release report keeps its own context for judgement. For each commit record: what changed in
user-or-operator terms, which files and which areas, whether it touches a sensitive surface, and
whether tests moved with it.

### 3. Map the affected areas

Group by the codebase's own structure — the directories, modules or packages that actually exist, and
in this repo the `dayN/` directory — not by a taxonomy you invented. For each area say what changed
and how concentrated the change is. A release that rewrites one module is a different risk from one
that touches thirty files across six.

### 4. Sweep the sensitive surfaces

Work `reference/sensitive-surfaces.md` over the whole range, category by category, including the
grep patterns it lists. Say at the end which categories you checked and found clean — that list is
what makes the flags credible.

### 5. Build the rollback note

This is the part nobody else will write, so do it properly, and reason forward from the change:

1. **What is the most likely symptom?** Pick the failure this specific release makes most probable,
   given the diffs — not a generic outage. "Existing sessions are logged out on deploy", "the
   `/export` route 500s for users without a team", "the nightly job silently stops writing".
2. **How would you notice?** The signal that would show it — a log line, an error rate, a support
   report, a test that would already have failed.
3. **What is the fastest safe way back?** Name the concrete mechanism (revert commit, redeploy the
   previous tag, flip a flag, restore a backup) and the exact commands where the repo supports them.
4. **What does rolling back NOT undo?** Migrations already applied, rows already written, messages
   already sent, caches, external state, anything a third party has consumed. Be blunt here.
5. **Is there a safer order?** If part of the release is reversible and part is not, say what to ship
   first and what to hold, and whether a flag would let the risky part land dark.

If any commit is not safely revertible, say so in the summary, not only in the rollback section.

### 6. Report

```
## Release readiness: <baseline>..<head>

**Baseline** — <what the last release is and how you determined it>
**Range** — <n> commits, <n> files, +<x>/-<y>

### What changed

<Plain English. A short paragraph or a handful of bullets, written for someone who did not
write the code. What can a user or an operator now do, or no longer do, differently.>

### Areas affected

| Area | Commits | What changed | Notes |
|---|---|---|---|

### Sensitive commits

#### `<sha>` <subject>                        [Auth | Migration | External API | …]
**What it touches** — `path:line`
```<lang>
<verbatim quote>
```
**Why it is flagged** — <the specific risk, not the category name>
**Tests** — <the test that covers it, by path, or "none found">
**Before shipping** — <the one check or question that would clear it>

<or, if there are none: "No commit in this range touches a sensitive surface. Checked: <categories>.">

### Rollback note

**Most likely symptom** — …
**How you would notice** — …
**Fastest safe rollback** — … (with commands)
**What a rollback will not undo** — …
**Safer shipping order** — … (omit if the release is uniformly reversible)

### Verdict

<SHIP / SHIP WITH CHECKS / HOLD> — <one line, and for anything but SHIP, exactly what would
change it>
```

Close with **Checked and clear** (the surfaces you swept and found nothing in) and **Open questions**
(what you could not settle, and what would settle it).

### 7. Hand off

The report ends at the decision. When the human wants to act:

- A flagged security surface → **`security-analyst`** (and **`security-doctor`** to fix).
- A flagged commit with no test → **`cover-the-gaps`**, then **`tester`**.
- A commit that looks wrong, not just risky → **`/code-review`** scoped to that range.
- The release is held and needs a plan → **`spec`**, then **`grill-me`**.

Launch sibling skills in a **subagent via the `Agent` tool**, not inline, and fold what comes back
into the one document.

## When to stop and ask the human

Ask in one batched message, not a trickle. Blocking:

- **The baseline is ambiguous or absent** — no tags, no version history, no stated convention.
- **A live secret appears in the range** — redact the value, surface it immediately, say rotation is
  the fix, and do not finish the report first.
- A migration is in the range and you cannot determine whether it has already been applied anywhere.
- The deployment model is unknown and it changes the rollback advice entirely (a library published to
  a registry cannot be rolled back the way a service can).
- The range contains a merge of work you were explicitly told not to read.

Non-blocking (proceed with the assumption stated in the report): the exact wording of the summary,
whether a borderline refactor counts as user-visible, the ordering of equally risky items.
