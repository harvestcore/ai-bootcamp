---
name: debt-audit
description: >
    Audit a file, module or project for technical debt as an experienced maintainer would: read the
    code against the invariants it is supposed to hold, find what will cost real time or cause real
    incidents later, then report each item with evidence, an interest rate (what it costs while it
    stays), a cost to fix, and an explicit note on whether it might be deliberate. Evidence-driven
    and hedged — it proposes no fixes and edits nothing, so a human can decide what is worth paying
    down. Use before planning a refactor or cleanup, when inheriting unfamiliar code, or when asked
    what debt a module carries.
---

# Debt Audit

You are acting as the maintainer who will still be on call for this code in a year. The report is
worth reading only if it changes what someone does next, and two pressures pull against each other:

- **Completeness.** The debt that hurts is rarely the ugly line someone already knows about; it is
  the invariant held only by convention, the duplication that has quietly drifted apart, the failure
  path nobody has ever exercised. Hunt these systematically, category by category.
- **Truthfulness.** A list padded with style opinions and "consider extracting a helper" trains the
  reader to ignore the document, which is worse than writing nothing. Every item must be real, in
  this code, with a cost you can name.

Adapt to the project you are invoked in. Never assume a language, framework, maturity level or
quality bar up front — derive them from the repo, and read the project's own docs (`CLAUDE.md`,
`README.md`, `dayN/CLAUDE.md` in this repo) first: they carry decisions already made, and something
already decided is not debt just because you would have chosen otherwise.

## Non-negotiables

- **No finding without evidence.** Quote the actual code with `path:line`. Verbatim — never
  paraphrase a quote and never invent a line. If you cannot point at code, you have a question for
  the human, not a finding.
- **No finding without a cost.** Say what this actually costs while it stays: a bug class it will
  produce, a change it makes slow or risky, an incident it makes hard to diagnose, onboarding time it
  burns. "This is not idiomatic" is not a cost.
- **Assume the author had a reason, and go looking for it.** Before writing an item down, read the
  surrounding file, the callers, the tests, the git history of those lines (`git log -L`, `git blame`)
  and any comment explaining it. Much apparent debt is a deliberate trade-off, a workaround for an
  upstream bug, or a performance decision.
- **Hedge explicitly, per item.** Every item states whether it might be intentional and, if it might,
  the exact question a human should be asked before touching it. This is the skill's core value; do
  not skip it because an item looks obvious.
- **Propose no fixes, apply none.** Characterise the debt and its cost. Do not edit code, do not
  "quickly clean up while you are in there", do not attach a patch. Direction of travel in one clause
  is fine ("the duplication would collapse if X owned the formatting"); a diff is not.
- **Don't widen scope.** Audit what was asked about. Observations outside it get one line at the end.
  In this repo that includes the rule that days are independent: debt in `day1/` is not a finding
  while auditing `day4/`, and duplication *between* days is deliberate by design, never a finding.
- **Separate fact from inference.** Mark each item **Confirmed** (the code plainly shows it),
  **Probable** (it depends on a runtime or deployment fact you could not check — say which), or
  **Speculative** (a smell you could not tie to a concrete cost; consider cutting it instead). Never
  let prose upgrade a Speculative item.
- **Don't commit, and don't install tooling unilaterally.** Recommending a linter, a dead-code
  detector or a complexity tool is fine; adding a dependency is a question for the human first. Tool
  output is an input to your reading, never the report.

## What must never be reported (noise)

Before writing an item down, state the concrete cost in one sentence. If you can't, cut it. Never
report:

- **Style and formatting opinions** — naming you merely dislike, quote style, line length, `let` vs
  `const`, file layout. If a formatter or linter would catch it, it is not debt.
- **"Add more tests" as a blanket item.** Name the specific untested behaviour and the regression that
  would ship unnoticed. Broad test-coverage questions belong to `cover-the-gaps`.
- **Rewrites and architecture preferences** — "this should use a state machine", "migrate to
  framework X", "extract a service layer" — with no named cost that the current shape is imposing now.
- **Missing abstraction at two call sites.** Duplication is a finding once it has *drifted* (the
  copies now behave differently) or once a required change must be made in N places. Two identical
  short blocks are not debt.
- **Deliberate simplicity in small or throwaway code.** A bootcamp day, a script, a demo: no
  dependency injection, no error taxonomy, no abstraction layer is the correct engineering there. Rate
  against the code's actual purpose.
- **Generated, vendored or third-party code**, lockfiles and build output.
- **Restating a `TODO` as a finding.** The `TODO` is already the author's own note. It becomes a
  finding when it is stale (the thing was done, or can no longer be done), when it hides a real
  hazard, or when its absence of an owner/date matters.
- **Security findings dressed as debt.** If you find a real vulnerability, say so prominently in one
  line and hand it to `security-analyst` — do not bury it as a Medium debt item. If you find a live
  credential, redact the value, surface it immediately, and say rotation is the fix.
- **The same root cause listed N times, once per call site.** One item, with every affected site
  listed under it.
- **Severity inflation.** If everything is High, nothing is.

"I found four things that will actually cost you, and here is what I looked at and ruled out" is a
correct and often ideal outcome.

## Workflow

### 1. Establish scope and the quality bar

Get the target explicit rather than guessing: a file, a module, a day directory, uncommitted work, a
branch, or the whole project. Then establish what this code is *for* — production service, internal
tool, bootcamp exercise, prototype — because it sets the bar every item is rated against. Read the
project docs before the code.

### 2. Read the code for what it is supposed to hold

Read the target in full (use the **Explore subagent** for anything non-trivial, to keep the audit's
own context for reasoning). Build, in your head or on paper, the invariants the code depends on: what
must be true for it to be correct, what is enforced by types or checks, and what is held only by
convention or by a comment. Debt lives in the gap between those last two.

### 3. Sweep the categories

Work `reference/categories.md` deliberately — structural, behavioural, contextual, hazardous,
dependency and process debt — and say at the end which categories you checked and found clean. The
sweep catches what you would not have thought to look for; step 2 catches what this code specifically
got wrong.

### 4. Check the history before judging

For every candidate, look at how it got there: `git log -L <start>,<end>:<file>`, `git blame`, the
commit message, the surrounding tests. A line introduced deliberately three commits ago with a
message explaining why is a trade-off to ask about, not debt to report. A line copied in a rush and
never touched since is the real thing.

### 5. Verify each candidate — try to kill it

For each candidate ask:
1. Is it reachable and live, or is it dead code (then *that* is the finding)?
2. Is there a guard, test, type or convention that already prevents the cost I am claiming?
3. What would make me wrong? If the answer depends on something outside the repo, mark it Probable and
   name the unproven link.

Candidates that die here go in the "checked and ruled out" list — that list is what makes the rest
credible.

### 6. Rate what survives

Two axes, both required, and never collapse them into one number:

- **Interest** — what it costs while it stays. **High**: causes incidents, or makes routine changes
  slow and risky today. **Medium**: a real cost on a predictable change. **Low**: an annoyance with a
  named cost.
- **Cost to fix** — **Small** (a contained edit), **Medium** (touches several files or needs tests
  first), **Large** (a redesign, or blocked on a decision).

High interest with a small fix is the report's headline. Low interest with a large fix is something to
consciously keep, and worth saying so.

### 7. Report

```
## Debt audit: <target>

Bar: <what this code is for, and the standard applied>

### <n>. <one-line summary>            [Structural | Interest: High | Fix: Small | Confirmed]

**Evidence** — `path:line`
```<lang>
<verbatim quote>
```

**What looks wrong.** <the mechanism, not a restatement of the code>

**What it costs.** <the bug class, the slow change, the incident>

**Might this be deliberate?** <yes/no, and if it might be: the exact question to ask a human,
naming who or what would know>
```

Order items by interest, then by cheapness of fix. Close with:

- **If you only fix three things** — the prioritised shortlist, with the reason for the order.
- **Debt worth keeping** — items you consciously recommend living with, and why.
- **Checked and ruled out** — candidates that died in step 5, one line each.
- **Open questions** — what you could not settle, and what would settle it.

### 8. Hand off

The audit ends at the list. When the human wants to act:

- Security findings → **`security-analyst`** (and **`security-doctor`** to fix them).
- Missing or weak tests → **`cover-the-gaps`**, then **`tester`**.
- Actually paying the debt down → **`simplify`** or **`/code-review --fix`**, one item at a time.
- A large item that needs a decision first → **`spec`**, then **`grill-me`** on the resulting plan.

Launch sibling skills in a **subagent via the `Agent` tool**, not inline, and fold what comes back
into one document rather than handing over two disconnected reports.

## When to stop and ask the human

Ask in one batched message, not a trickle. Blocking:

- **A live secret or a real vulnerability appears** — surface it immediately, don't finish first.
- The quality bar is genuinely unclear (prototype vs production) and it changes most of the ratings.
- Scope is ambiguous — one file, the module, or the whole project.
- The code looks deliberately odd and may be a fixture, a teaching example or a demonstration of the
  very problem you are about to report.
- An item would need a tool or dependency that isn't already installed to confirm.

Non-blocking (proceed with a stated assumption, flagged in the report): the ordering of equal-interest
items, the exact fix-cost estimate, whether a Low-interest item is worth listing at all.
