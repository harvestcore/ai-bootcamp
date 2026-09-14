# Debt categories

A sweep list, not a scoring rubric. Skip whole categories that genuinely do not apply to the target
and say which ones you skipped. Every hit still needs evidence, a named cost and the "might this be
deliberate?" note — appearing on this list is not itself a finding.

## Structural

How the code is put together, and what that makes expensive to change.

- **Dead code.** Unreferenced exports, unreachable branches, feature flags that are permanently on or
  off, commented-out blocks kept "just in case", parameters nobody passes. Confirm with a
  repo-wide search before claiming it — dynamic dispatch, string-keyed registries, reflection and
  build-time globs all hide real callers.
- **Drifted duplication.** Copies that were once identical and now differ. Diff the copies and say
  *how* they differ — that difference is usually the bug waiting to be found.
- **Shotgun surgery.** One conceptual change requires edits in N unrelated places (add a field → touch
  the type, the validator, the mapper, the SQL, the UI). Name the change and count the places.
- **Tangled dependencies.** Import cycles, a module that imports half the project, layers reaching
  backwards (data layer importing UI), a "utils" file that everything depends on and that depends on
  everything.
- **Unclear ownership.** Two places that can both mutate the same state, no single source of truth for
  a value, state duplicated between a store and a component, caches with no invalidation owner.
- **God functions and god modules.** Rate by the number of distinct responsibilities and the number of
  reasons it would need to change — not by line count alone.
- **Leaky abstractions.** A wrapper whose callers must know what it wraps; an interface with one
  implementation that already exposes that implementation's quirks.
- **Primitive obsession on domain concepts** that have real invariants — an ID, a money amount, a
  timezone-bearing timestamp passed as a bare string or number, so nothing prevents mixing them up.

## Behavioural

What the code does at runtime that nobody can see or verify.

- **Silent failures.** `catch {}`, `catch (e) { /* ignore */ }`, errors swallowed into a default value,
  promise rejections unhandled, a `Result` or error return that callers never check, `err != nil`
  ignored.
- **Unclear error paths.** Failures that surface as `undefined`/`null`/`0`/`""` further downstream;
  one error type used for everything so callers cannot distinguish retryable from fatal; errors thrown
  as strings.
- **Tests that assert nothing.** Snapshot-only tests, `expect(x).toBeDefined()`, tests asserting on
  mocks they themselves configured, tests that would pass with the implementation deleted, skipped or
  permanently-`only` tests. (Depth here belongs to `cover-the-gaps` — report the specific case, then
  hand off.)
- **Missing observability.** No log, metric or trace on the paths you would need during an incident;
  log lines with no context (no id, no input) so they cannot be correlated; logs that print a whole
  object including secrets.
- **Hidden side effects.** A getter that writes, a pure-looking function that mutates its argument or
  touches global state, module-level code that performs I/O on import.
- **Non-determinism in logic.** `Date.now()`, `Math.random()`, locale, timezone or iteration order
  baked into behaviour rather than injected — also the root of most flaky tests (`kill-flakes`).
- **Unvalidated boundaries.** Data crossing into the program (HTTP body, file, env var, DB row, LLM
  output) trusted because a static type says so. A type is not a runtime check; find the parse point,
  or find that there isn't one.

## Contextual

Where the code and the story told about it have come apart.

- **Comments that no longer match.** Doc comments describing removed parameters or old return shapes,
  a comment explaining a workaround for a bug that is fixed, `@deprecated` with no replacement named.
- **Stale `TODO`/`FIXME`/`HACK`.** Check the date with `git blame`. Report it when the thing was
  already done, can no longer be done, has no owner and guards a real hazard, or has outlived the
  reason for it.
- **Naming from a defunct architecture.** A type, file or table named after the thing it used to be;
  "new"/"v2"/"legacy" prefixes where the old one is gone or the new one is the only one; a name whose
  meaning has inverted.
- **Docs that lie.** `README`/`CLAUDE.md` commands that no longer run, documented env vars that aren't
  read, a documented flow the code no longer implements. Verify before reporting — and note that in
  this repo `dayN/CLAUDE.md` is authoritative for that day.
- **Orphaned config and scripts.** `package.json` scripts that fail, config keys nothing reads, env
  vars set but unused (and the reverse: read but undocumented).

## Hazardous

Things that can bite in production. Anything genuinely exploitable is a security finding — surface it
and hand it to `security-analyst` rather than filing it here.

- **Race conditions and TOCTOU.** Check-then-act on shared state, uniqueness enforced in application
  code instead of the database, concurrent requests over the same row, a read-modify-write with no
  transaction or lock, `await` between a check and the action it protects.
- **Unbounded anything.** Loops with no exit guard, recursion with no depth cap, retries with no
  ceiling or backoff, a cache or in-memory array that only grows, unbounded concurrency, pagination
  the code never actually paginates, `SELECT *` over a table that will not stay small.
- **Resource leaks.** Connections, file handles, timers, intervals, listeners or subscriptions opened
  without a matching close on every path — including the error path.
- **Insecure or surprising defaults.** Permissive CORS, debug mode, verbose errors to the client, a
  fallback secret, `verify: false`, an "allow all" default in an authorisation helper.
- **Crash-prone assumptions.** Non-null assertions, unchecked array indexing, `JSON.parse` on unvalidated
  input, unchecked casts, integer/float assumptions about money, division by a value that can be zero.
- **Data-loss risks.** Destructive migrations with no rollback, delete without a guard or confirmation,
  writes with no durability story, a shell/`fs` operation built from interpolated paths.
- **N+1 and accidental quadratics** on data that grows, and work done inside a loop that could be done
  once. Only a finding with a plausible growth story — say what the input size is expected to be.

## Dependency

- Abandoned or deprecated packages; a dependency pinned to a version with a known problem; a direct
  dependency used once for something the platform now does natively.
- Duplicate libraries for the same job (two date libraries, two HTTP clients, two state stores).
- A heavy dependency for a trivial use; a dependency imported at a boundary that makes it impossible
  to replace.
- Missing or ignored lockfile; dependencies declared in the wrong section (a build tool in `dependencies`).
- Whether the project pins or floats versions, and whether that matches how it is deployed.

Do **not** recommend adding, upgrading or removing a package on your own initiative — in this repo,
library choices are always the human's call.

## Process

Only when in scope, and only with a named cost.

- No CI, or CI that does not run the tests that exist; a test suite that is red or routinely skipped.
- No way to run the thing locally in one command; setup steps that live only in someone's head.
- Manual release or deploy steps that are easy to get wrong, with no rollback path.
- Formatting/lint config present but not enforced, so every diff carries unrelated churn.
