# Categories

One per issue, chosen by **the work the fix requires**, not by how the issue is written. Each carries
a default verdict; the issue's own evidence can only push that verdict *down*, never up.

---

## Trivial fix — default AUTOMATE

A change whose correct form is obvious once you have read the code, contained in one or two files,
with no behavioural choice in it: a typo, a wrong constant, a copy fix, an off-by-one with a stated
expected value, a missing null check on a path the issue names, a broken link, a lint or type error.

- **Holds at AUTOMATE when** the issue states the expected result, and tests cover the touched code.
- **Pushes down when** the "typo" is in user-facing copy that someone may have chosen deliberately,
  the constant is used elsewhere, or the file has no tests at all.
- **Trap:** a one-line fix in a shared helper is *not* trivial. Trivial is about blast radius as much
  as diff size.

## Dependency bump — default SEMI-AUTOMATE

Moving a dependency to a new version, including automated bot PRs.

- **AUTOMATE only when** it is a patch or a security patch within the same major, the lockfile is
  committed, and the suite genuinely exercises the dependency.
- **SEMI-AUTOMATE** for minors, and for anything where the changelog mentions behaviour changes.
- **HUMAN-REQUIRED** for majors, anything with a migration guide, anything touching the build, and
  **any bump that adds or replaces a dependency** — in this repo, choosing a library is explicitly a
  question for the human.
- Always read the changelog between the two versions. "Tests pass" is weak evidence for a dependency
  whose failure mode is runtime or platform-specific.

## Minor bug — default SEMI-AUTOMATE

A real, reproducible misbehaviour in existing code, with a diagnosis you can confirm in the source.

- **AUTOMATE when** there is a reliable repro *and* a test that would fail before the fix and pass
  after — or one that can be written first, cheaply, from what the issue already states.
- **SEMI-AUTOMATE** when the repro is solid but the fix has more than one reasonable shape, or the
  right layer to fix it at is a judgement call.
- **HUMAN-REQUIRED** when the repro is missing or you could not find the misbehaving code. A bug
  nobody can trigger is a bug an agent cannot verify it fixed.
- **Trap:** the issue's proposed fix may be wrong even when the report is right. Rate the fix you
  would make, not the one the reporter suggested.

## Small feature — default SEMI-AUTOMATE

New behaviour, additive, with the *what* already decided — by the issue body, a maintainer comment or
an obvious existing convention to copy.

- **SEMI-AUTOMATE** when the shape is decided and the change is additive; a human reads the diff.
- **HUMAN-REQUIRED** when any user-visible naming, API shape or UX detail is still open, when it
  touches a public interface, or when it needs a new dependency.
- Never AUTOMATE a feature. New behaviour has no prior test to contradict it, so "the suite is green"
  proves only that nothing else broke.

## Ambiguous scope — default HUMAN-REQUIRED

The issue could reasonably resolve to a one-line change or to a week of work, and the code does not
settle which. Symptoms: "improve", "clean up", "make it faster" or "it feels wrong" with no target;
several problems in one issue; a thread that ends mid-discussion; a maintainer comment that
contradicts the body.

- The useful output here is not a verdict but a **question**: name the one answer that would collapse
  the ambiguity, and what the verdict becomes in each case.
- A SEMI-AUTOMATE is only available if you can carve out a genuinely self-contained sub-task and say
  explicitly that the rest is out of scope.

## Needs-human — HUMAN-REQUIRED, by category

The work is fine; letting an unattended agent do it is not. Any item on the skill's
**Automatic HUMAN-REQUIRED** list lands here: security-relevant surface, money or data loss or
migrations, a product/API decision, a new dependency, unbounded blast radius, no test that would
notice, or a stale/contested issue.

State *which* trigger fired. "Needs a human" without the reason is not a triage.

---

## Rating risk against the category

Risk is **what happens if the agent gets it wrong**, not how hard the task is. Four inputs:

| Input | Low | Medium | High |
| --- | --- | --- | --- |
| Blast radius | one file, no other callers | a module, callers you enumerated | shared helper, public API, config, CI |
| Reversibility | obvious and cheap to revert | revert is fine, detection may lag | persisted state, released artefact, anything already shipped outward |
| Surface | inert code — docs, local helpers, tests | normal application logic | the automatic list: auth, secrets, money, migrations, shell/SQL/deserialisation |
| Verification | a failing test turns green | tests exist but are indirect | only a human eye can tell it worked |

Take the **worst** column any input lands in; do not average. One High input is a High rating.

## Composing the verdict

Start at the category default, then apply, in order:

1. Any automatic trigger → **HUMAN-REQUIRED**. Stop.
2. High risk → at most **SEMI-AUTOMATE**; with a thin test surface, **HUMAN-REQUIRED**.
3. No test that would catch a wrong fix → at most **SEMI-AUTOMATE**.
4. Genuinely torn between two verdicts → take the lower one, and name the fact that would raise it.
