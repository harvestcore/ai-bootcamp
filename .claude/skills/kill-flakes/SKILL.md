---
name: kill-flakes
description: >
    Points at a flaky test file and looks for the usual suspects — real timers, real dates, real
    network calls, iteration-order assumptions, shared mutable state — and proposes fixes. If it can't
    fix a flake with confidence, it says so and quarantines the test rather than pretending it's fixed.
    Earns its keep the first Monday morning the suite fails at random. Use when asked to fix a flaky
    test, investigate intermittent test failures, or stabilize a test suite.
---

# Kill Flakes

A flaky test is worse than a missing one: a missing test is an honest gap, a flaky test is a false
signal that erodes trust in the whole suite until people start ignoring red CI. The job here is to find
the actual mechanism causing non-determinism and fix it — not to retry harder, not to widen a timeout
until the symptom disappears, and not to weaken an assertion until it stops noticing.

## Non-negotiables

- **Never fix a flake by deleting or weakening the assertion it depends on.** A test that no longer
  checks the thing it existed to check isn't fixed, it's neutralized.
- **Never "fix" a flake by adding retries, longer sleeps, or `try/catch` swallowing around it** without
  first identifying the actual root cause. A retry can be a legitimate part of a fix (e.g. retrying a
  genuinely eventually-consistent operation with an explicit, justified reason) but is never the default
  response to "the assertion sometimes fails."
- **If you can't identify or fix the cause with confidence, say so plainly and quarantine the test**
  (skip/pending, with a comment explaining why and what's still unknown) rather than declaring it fixed.
  A quarantined test that's honestly still broken is more useful than a "fixed" one that flakes again
  next week.
- **Never quarantine a test you were actually able to fix**, just because the fix took more than one
  attempt — quarantine is for genuine uncertainty, not for the first fix that didn't stick.
- **Don't add a new dependency (a fake-timers library, a fixed-seed RNG helper, a network-mocking
  library) without asking first**, even if it's the idiomatic fix — same rule as `tester`. Recommend it,
  don't install it unasked.
- **Verify the fix by actually re-running**, not by inspection alone — flakiness is empirical, and a fix
  that looks right on paper can still miss the real interleaving that caused the failure.

## Workflow

### 1. Establish what "flaky" means here

Get concrete evidence before hypothesizing: a CI failure log, a local repro, or at minimum a clear
description of the symptom (which assertion fails, how often, under what conditions — e.g. only in CI,
only when run in parallel, only after a certain other test). If nothing concrete is available, try to
reproduce it first: run the target file repeatedly (a loop of N runs, or the runner's own repeat/retry-
count flag if it has one) before assuming a cause.

### 2. Read the test file (and what it touches) completely

Use the **Explore subagent** for anything non-trivial. For every test in the file, and every
helper/fixture/setup it relies on, check for each of the usual suspects:

- **Real timers.** `setTimeout`/`sleep`/`Thread.sleep`/real-time waits instead of a mocked or fake clock;
  races between an async operation and a fixed-duration wait that assumes the operation finishes first.
- **Real dates.** `Date.now()`, `new Date()`, `time.Now()` etc. used directly instead of an injected/
  mockable clock — anything that changes behaviour depending on which day/hour/timezone the suite runs
  in (midnight rollovers, daylight saving, "today" comparisons).
- **Real network calls.** Requests to an actual external service or even `localhost` port instead of a
  mock/stub — flaky on latency, rate limits, DNS, or the service simply being unavailable in CI.
- **Iteration-order assumptions.** Relying on object key order, `Set`/`Map`/hash-map iteration order,
  filesystem directory listing order, or test-execution order, when the language/runtime doesn't
  guarantee it.
- **Shared mutable state.** Module-level or global variables, a singleton not reset between tests, a
  shared database/fixture not cleaned up (or cleaned up by a different test that may or may not have run
  first), tests that pass alone but fail in the full suite (a strong signal of this).
- **Unseeded randomness.** `Math.random()`/`random.random()` etc. feeding into an assertion without a
  fixed seed.
- **Async races.** A missing `await`, a promise not awaited before the next assertion, a callback whose
  completion isn't actually synchronized with the test's assertion phase.
- **Parallel-execution interference.** Tests in the same file or suite that claim the same port, file
  path, or other exclusive resource when the runner executes them concurrently.

### 3. Diagnose before proposing a fix

For each suspect found, state the specific mechanism: not "this might be flaky because of timing" but
"test B writes to `shared.json` and doesn't clean it up, so test A fails when it runs second and reads
stale content." A vague diagnosis leads to a vague (and probably wrong) fix.

If, after this pass, no mechanism can be pinned down with confidence, don't force one — move to
quarantine (step 5) for that test rather than guessing.

### 4. Propose and apply fixes

Match the fix to the mechanism, using what the project already has before reaching for something new:

| Cause | Fix |
|---|---|
| Real timers | Inject or mock the clock/timer (fake timers already available in the project's test framework where possible); make the code under test accept a clock/scheduler dependency if it doesn't already. |
| Real dates | Inject a fixed/mockable clock; freeze time for the test's duration. |
| Real network | Mock/stub the call using whatever mocking approach the project already uses; if none exists, propose one rather than adding a library unasked. |
| Iteration order | Sort before comparing, or assert on a set/multiset equality instead of a sequence when order isn't actually meaningful. |
| Shared mutable state | Isolate state per test (fresh fixture/instance in setup, explicit teardown); stop relying on execution order — each test should pass in isolation and in any order. |
| Unseeded randomness | Fix the seed for the test, or inject the random source so it can be replaced with a deterministic one. |
| Async races | Add the missing `await`/synchronization point; don't paper over it with a sleep. |
| Parallel resource conflicts | Give each test its own resource (temp dir, dynamic port, isolated DB schema) instead of a shared fixed one. |

Apply the fix directly in the test (and, only if the root cause is actually in production code — e.g. a
missing dependency-injection seam for the clock — say so explicitly and ask before touching production
code, since this skill's default scope is the test file).

### 5. Quarantine what can't be confidently fixed

For any test where step 3 couldn't pin down a mechanism, or where a fix was attempted but didn't hold up
under re-running:

- Mark the test skipped/pending using the framework's own mechanism (`.skip`, `@pytest.mark.skip`,
  `t.Skip()`, ...) rather than commenting it out or deleting it.
- Add a comment directly above it stating: that it's quarantined for flakiness, what was tried, and what
  remains unknown — so the next person doesn't have to redo the investigation from scratch.
- Say so explicitly in the report (step 7) — don't let a quarantined test look like a fixed one.

### 6. Verify

Re-run the fixed test(s) repeatedly (a loop, or the runner's repeat-count flag) — enough iterations to
have actually exercised the failure condition, not just one clean pass. If the original flake was rare,
say what iteration count you used and why it's a reasonable bar, and be honest that a fixed number of
green runs reduces confidence but doesn't mathematically prove the flake is gone.

### 7. Report

- Each flaky test found, its diagnosed mechanism, and the fix applied — or, for anything quarantined,
  that it was quarantined and why (what was tried, what's still unknown).
- Verification: how many repeated runs were done post-fix, and the result.
- Anything that needed a new dependency to fix properly, held back pending the human's decision.
- Any fix that touched production code rather than just the test, called out explicitly and separately
  from test-only changes.
