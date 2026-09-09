---
name: enumerate-behaviours
description: >
    Before any tests get written, takes a target function or module and produces a list of the
    behaviours worth pinning down — happy paths, error paths, boundaries, and interactions. Writes no
    test code at this stage, just the list, so a human can read it, prune it, extend it, and catch
    behaviours the code is silently handling wrong. Use when starting test coverage on a function or
    module from scratch, before writing any test, or when asked to enumerate/list behaviours,
    scenarios, or cases for a piece of code.
---

# Enumerate Behaviours

You are producing a **list, not tests**. The deliverable of this skill is a document a human reads —
it is a forcing function for thinking before code gets written, not a shortcut to skip that thinking.
Never emit test code, test file scaffolding, or "here's how I'd assert this" snippets while this skill
is active; that belongs to a later step (e.g. the `tester` skill), not this one.

The value of the list comes from the human reading it critically: they will delete entries that don't
matter, add ones you missed, and — often — notice that a behaviour you listed is one the code actually
handles wrong. That last case is the whole point: don't smooth it over or silently "fix" the list to
match current behaviour. List what the code *appears* to do, even when it looks like a bug.

## Non-negotiables

- **No test code, ever, in this skill's output.** Not a snippet, not a "for example, you'd assert...".
  If you catch yourself writing an assertion, stop and turn it back into a plain-language behaviour
  statement.
- **Boundaries and interactions each get their own entries.** Don't fold a boundary condition into the
  happy-path entry it's adjacent to ("handles empty input" bundled into "returns the sum" is two
  behaviours, not one) and don't skip interactions between parameters/branches just because each one
  individually looks simple.
- **Flag uncertainty instead of guessing.** If the intended behaviour for a case isn't clear from the
  code, comments, tests, or docs, write the entry as `(assumed)` and say what you assumed and why. Never
  quietly resolve an ambiguity by picking the plausible-looking answer — that's the human's call, and
  the whole reason this list exists is to surface exactly these cases.
- **Describe current behaviour, not intended behaviour, when they diverge.** If the code looks like it
  mishandles a case, list what it *actually does*, flagged, e.g. `(looks unintentional — confirm)`. Do
  not fix it, and do not silently list the behaviour you think it *should* have instead.
- **Stay read-only.** This skill reads code; it does not edit it. If enumerating surfaces something that
  looks like a real bug, flag it in the list and say so out loud in your report — don't fix it here.

## Workflow

### 1. Identify the target

Confirm the exact function, method, module, endpoint, or component in scope. If the request is vague
("enumerate behaviours for the auth module") and the module is large, ask whether to cover the whole
surface or a specific entry point — don't silently pick a subset.

### 2. Read the target completely

For anything beyond a small function, use the **Explore subagent** rather than chaining manual reads.
Read for:

- Every parameter, its type, and whether it's optional/nullable.
- Every branch (`if`/`else`, `switch`/`match`, ternaries, short-circuit operators) and both sides of it.
- Every loop and its boundary conditions (zero, one, many iterations).
- Every explicit error path: validation failures, thrown/raised exceptions, rejected promises, non-2xx
  responses, returned error values.
- Every external dependency touched (network, filesystem, database, clock, randomness, another
  module/service) and what happens when each one fails or returns something unexpected.
- Every place this code's output feeds into or depends on another piece of state (interactions).
- Existing tests, docstrings, or comments that state an intended contract — these are a source of truth
  for "intended" behaviour, separate from what the code currently does.

### 3. Enumerate, by category

Produce the list grouped under these headings. Don't skip a heading just because you can't immediately
think of an entry — check it against the code once more before concluding it's empty.

- **Happy paths** — the well-formed, expected-input cases, including more than one where the function
  branches internally (each branch that produces a materially different valid result is its own entry).
- **Error paths** — every way the target can fail, reject, throw, or return an error shape, and what
  triggers each one.
- **Boundaries** — edge values: empty/null/undefined/zero/negative, minimum/maximum length or size,
  off-by-one around any comparison, first/last iteration of a loop, exactly-at-threshold values.
- **Interactions** — behaviour that only emerges from a combination: two parameters that interact,
  ordering dependencies, state built up across multiple calls, a flag that changes what another
  parameter means, concurrency/ordering effects on shared state.

Within each category, one entry per distinct observable behaviour — not one entry per line of code. If
two inputs produce the same observable outcome through different code paths, that's still two entries if
the *reason* they might diverge is worth pinning down (e.g. two different validation branches that both
happen to reject with the same error today).

### 4. Mark assumptions

For any entry where the correct/intended behaviour isn't determinable from the code, docs, or existing
tests, mark it `(assumed)` inline and add a one-line note on what you assumed and why. Do not silently
drop a case just because it's ambiguous — ambiguous is exactly the kind of thing this list exists to
surface.

### 5. Present the list

Output format:

```
## <Target name>

### Happy paths
1. <behaviour, plain language>
2. ...

### Error paths
1. ...

### Boundaries
1. ...

### Interactions
1. ...
```

Follow the list with a short **Flags** section (only if non-empty) calling out:
- Any entry marked `(assumed)`, with the assumption stated.
- Any behaviour that looks like the code is silently handling something wrong, with the file/line.

Do not add a test plan, priority ranking, or effort estimate unless asked — the list itself is the
deliverable.
