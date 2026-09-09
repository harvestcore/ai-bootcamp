---
name: cover-the-gaps
description: >
    Points at a file (or module) that already has tests and finds the behaviours that aren't pinned
    down by them — a different question from what a coverage tool answers, since a coverage tool tells
    you which lines aren't hit while this tells you which behaviours aren't verified even on lines that
    are. Earns its keep on legacy code and any time you've inherited a suite of green tests and want to
    know whether they'd actually notice a mistake. Use when asked to find test gaps, audit existing
    tests, check whether tests would catch a regression, or review coverage on a file that already has
    some tests.
---

# Cover the Gaps

The question this skill answers is not "which lines are unexecuted" — a coverage tool already answers
that, and often lies about the thing that actually matters. A line can be executed by a test and still
have its real behaviour completely unverified: a test that calls a function and asserts nothing about
the result, or asserts something trivially true, "covers" the line while pinning down nothing. This
skill's job is to find every behaviour of the target that isn't actually locked down by an assertion
that would fail if the behaviour broke — whether or not the line technically executes today.

This is an **analysis skill, not a test-writing skill**. It produces a gap list, the same shape of
document `enumerate-behaviours` produces, but cross-checked against what already exists. Do not write
new test code as part of this skill — hand the gap list to the human (or to the `tester` skill) to fill.

## Non-negotiables

- **Read the tests, don't just list their names.** A test named `handles invalid input` that asserts
  nothing specific about *how* it's handled is not coverage of that behaviour — check what's actually
  asserted, not what the test claims to do in its title.
- **Distinguish "no test touches this" from "a test touches this but proves nothing."** Both are gaps,
  but say which kind each one is — the fix looks different (write a new test, vs. strengthen an existing
  one).
- **Never mark something covered because a related case is.** A test for `divide(10, 2)` does not cover
  `divide(10, 0)`; a test for one branch of an `if` does not cover the `else`.
- **No test-writing in this skill's own output.** Produce the gap list, not the tests that fill it.
  Writing the tests is a separate step the human explicitly asks for next.
- **Flag ambiguity, don't resolve it.** If you can't tell whether a scenario is reachable in production,
  or whether an existing assertion is "close enough," say so rather than guessing it into either the
  covered or gap column.

## Workflow

### 1. Identify the target and its tests

Confirm the production file/module in scope, then locate its test file(s) — by naming convention
(`*.test.*`, `*.spec.*`, `test_*.py`, `*_test.go`, a parallel `tests/` tree, ...), by imports in existing
tests, or by asking if neither turns up a match. If no tests exist at all for the target, say so plainly
and suggest `enumerate-behaviours` (to build the behaviour list from scratch) instead — this skill needs
an existing suite to diff against.

### 2. Enumerate the target's real behaviours

Read the production code completely (use the **Explore subagent** for anything non-trivial) and build
the same kind of behaviour list `enumerate-behaviours` produces: happy paths, error paths, boundaries,
interactions. Don't skip this step or shortcut it by skimming the tests first — you need an independent
read of what the code actually does before you can tell what the tests missed.

### 3. Read every existing test and what it actually proves

For each existing test, note:
- What input/scenario it exercises.
- What it actually asserts (the real, specific assertion — not the test name).
- Whether that assertion would fail if the targeted behaviour broke (a real pin), or would pass
  regardless (no pin — e.g. asserting `result).toBeDefined()` on a function that always returns
  something).

### 4. Cross-reference

Match step 2's behaviour list against step 3's per-test findings. Every behaviour lands in one of:

- **Covered** — an existing test exercises it and its assertion would catch a regression.
- **Weakly covered** — a test touches the code path but the assertion is too loose to catch a real
  regression (tautological, overly generic, or checking something adjacent to the actual behaviour).
- **Uncovered** — no test exercises it at all.

### 5. Report the gap list

```
## <Target name>

### Uncovered
1. <behaviour> — no test touches this.

### Weakly covered
1. <behaviour> — <test name/location> exercises this but only asserts <what>, which would not catch
   <the specific regression that could slip through>.

### Covered
(list briefly, or omit if long and uninteresting — the point of the report is the gaps, not a full
restatement of what's already fine)
```

For each uncovered/weakly-covered entry, name the specific regression that could ship unnoticed — the
same discipline the `tester` skill applies before writing a test: if you can't state a concrete failure
scenario, don't list it as a gap.

### 6. Hand off

End by asking whether the human wants the gaps filled now (and if so, whether to invoke `tester` for
that, since this skill doesn't write tests itself) or just wants the list for now.
