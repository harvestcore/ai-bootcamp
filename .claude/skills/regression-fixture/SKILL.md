---
name: regression-fixture
description: >
    Given a bug fix — a diff or a description — writes the regression test that would have caught it.
    One focused test per bug, quoting the specific misbehaviour and asserting the fix, verified by
    checking it would actually have failed against the pre-fix code. If the fix also happens to catch a
    broader class of bugs, that's a bonus, not a design goal. Use when asked to write a regression test,
    add a test for a bug fix, or pin down a fix so it can't silently regress.
---

# Regression Fixture

You are writing the one test that proves a specific bug is fixed and stays fixed. This is narrower than
general test-writing: the target is not "cover this function well," it's "reproduce exactly the failure
that happened, and assert exactly the corrected behaviour." A regression test that's broader than the
bug it documents is fine as a side effect, but chasing breadth is not the goal — chasing precision is.

## Non-negotiables

- **One test per bug.** Don't split a single misbehaviour across multiple tests, and don't bundle two
  unrelated bugs into one test because they happen to touch the same function.
- **The test must fail on the pre-fix code and pass on the post-fix code.** This is the entire point of
  a regression test — if you can't verify both halves, you haven't actually proven anything. See
  "Verify against pre-fix code" below; don't skip it because it's inconvenient.
- **State the specific misbehaviour, not a generic description.** The test name, or a comment directly
  above it, should quote or closely paraphrase what actually went wrong (e.g. "returned `undefined`
  instead of throwing when the id was missing," not "handles bad input").
- **No production code changes.** This skill writes a test against a fix that already exists (or is
  described). If no fix exists yet and the human wants one written, that's a different task — say so and
  ask, don't quietly start fixing the bug yourself.
- **Don't chase a broader class of bugs on purpose.** If the same test incidentally also catches related
  cases, mention it as a bonus in the report. Don't inflate the test with extra assertions to manufacture
  that breadth — that turns one focused regression test into an unfocused general one.
- **Mark the test as AI-generated**, same convention as the `tester` skill: `// @ai-generated` (or the
  language's equivalent), directly above the test case.

## Workflow

### 1. Establish the bug and the fix

Two possible starting points:

- **A diff.** Use `git show <commit>`, `git diff`, or a supplied patch. Identify the specific lines that
  changed and, just as importantly, the commit/PR description or surrounding context for *why* — the
  diff alone often shows "what changed" but not "what broke before this."
- **A description.** If given only a description ("the export crashed when the list was empty"), locate
  the relevant code first, and confirm your understanding of both the broken behaviour and the fix
  before writing anything. If no fix exists yet in the codebase, stop and ask whether the human wants the
  test written against a description of the *intended* fix (it will fail until that fix lands) or wants
  you to hold off.

Whichever path, end this step able to state, in one sentence each:
- **Broken behaviour**: what happened before (wrong output, exception, hang, silent no-op, etc.), under
  which exact input/state.
- **Fix**: what changed to correct it, and why that change addresses the root cause rather than papering
  over the symptom.

If either sentence can't be stated confidently, ask rather than guess — a regression test built on a
guessed-at bug can end up testing the wrong thing entirely.

### 2. Detect the existing test stack

Same as the `tester` skill: look for the project's test framework, config, and conventions before
writing anything. Match existing structure and naming; don't introduce a second style. If no test
framework exists at all, that's a blocking question — ask which one to use.

### 3. Write one test

- **Reproduce the exact pre-fix conditions**: the same input, state, or sequence of calls that triggered
  the bug. Don't simplify it into a different, easier-to-write scenario that happens to touch the same
  code — the value of a regression test is fidelity to what actually broke.
- **Assert the corrected behaviour precisely**: the specific output, thrown type/message, status code, or
  absence of a side effect that the fix produces. Avoid a loose assertion that would also pass under a
  different, still-broken fix.
- **Name/comment it so the bug is identifiable later**: a name or comment that quotes the misbehaviour
  (e.g. `regression: exporting an empty list threw TypeError instead of returning []`), so a future reader
  hitting this test in a failure log immediately knows what historical bug it's guarding.
- **Mark it `@ai-generated`** per the convention above.

### 4. Verify against pre-fix code

This is the step that actually proves the test is a regression test, not just a test:

- If the fix is an already-committed change: temporarily check out the parent commit (or stash/revert
  just the fix, being careful per the git safety rules — never discard uncommitted work without
  stashing it first) and run the new test against the pre-fix code. It must fail, and the failure must
  match the bug described in step 1 (wrong assertion failing, not an unrelated error).
- Then restore the fix and run the test again. It must pass.
- If checking out the pre-fix state isn't practical (e.g. the fix is only described, not committed yet,
  or reverting is destructive/risky in this repo), reason through the test by hand against the described
  broken behaviour and say explicitly in the report that pre-fix verification was manual reasoning, not
  an executed run — don't silently skip this and claim full verification.

### 5. Run the full suite

Confirm the new test passes alongside the rest of the suite and doesn't collide with or duplicate an
existing test. If an existing test already covers this exact scenario, say so instead of adding a
duplicate.

### 6. Report

- The bug: broken behaviour, trigger condition, and the fix, in the one-sentence form from step 1.
- The test added: file, name, and what it asserts.
- Verification result: confirmed failing on pre-fix code and passing on post-fix code (or, if manual
  reasoning was used instead of an executed pre-fix run, say that explicitly).
- Any broader class of bug this test incidentally also catches (bonus, not a design goal — keep this to
  one line, don't use it to justify scope creep in the test itself).
