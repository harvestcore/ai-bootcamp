---
name: pr-review
description: Review a pull request or diff end to end: establish the true scope,
  analyse it, write a structured review document with severity rated issues and a
  verdict, then post it to the PR as one review with inline code suggestions. Use
  when reviewing a PR or a diff, when leaving review comments, or when asked to post
  suggestions or messages on a pull request.
---

# PR Review

Four phases. Do not skip phase 0: every phase after it is worthless on a diff you
have not fully seen.

## 0. Establish the real scope

**Never analyse a truncated diff.** Piping `gh pr diff` through `head` has silently
hidden an entire commit (including the branch's worst bug) for a whole review. Write
the diff to a file and read the file.

```sh
gh pr view <n> --json headRefOid,commits,author,isDraft,reviewDecision \
  --jq '{oid: .headRefOid, author: .author.login, commits: [.commits[].messageHeadline]}'
gh pr diff <n> --patch > /tmp/pr<n>.patch   # --patch is required, or gh refuses
```

Reconcile all of this before reading a line of code:

- **Commit count.** Does the patch contain every commit `gh pr view` listed? Two
  commits mean two intents, and they can contradict each other.
- **File count.** Compare against `git diff --name-only main...<branch>`. A file in
  one list and not the other means you have the wrong merge base.
- **Whitespace churn.** If a file's diff is mostly reindentation, re-read it with
  `git show -w` or `git diff -w`. A reindented file hid three changed constants (one
  of which broke the product) in 90 lines of noise.
- **Consumers of anything the diff changes.** For every changed constant, event
  name, message string or exported signature, grep the whole repo for who reads it.
  The most serious finding of the day was a constant changed in one file whose two
  consumers were left untouched, and one of those files was not in the diff at all.
- **Claims in docs.** Verify, do not trust. `CLAUDE.md` documented a CI workflow
  that has never existed in the repo's history.

## 1. Analyse

Three passes over the reconciled diff, then a verification step. Keep notes with
file paths and line numbers as you go: they feed the document in phase 2.

**Scope.** What the PR is trying to do, what it changes, and what it deliberately
does not touch. Hold this to three sentences: the limit forces a decision about what
the PR is actually about.

**Assumptions.** What the code assumes about the rest of the system, and what breaks
if each assumption is wrong. Separate the assumptions that are already false from the
ones that are latent. "Works today, and here is the specific reason why" is a
finding, not a pass.

**Test coverage.** For every behaviour the PR introduces or changes, decide whether a
test would fail if it regressed. Check, never assume: look for a test script, test
files, a linter, and CI workflows on every branch. When the answer is "no test" for
everything, the useful question becomes what would actually catch each one (a unit
test, an HTML validator, loading the page, a human reading the copy). Flag any
finding that even a well-written test of the changed module would miss.

**Verify before writing anything down.** Where a module can be driven cheaply, run
it instead of reasoning about it. A finding reached by reading alone is often subtly
wrong in a way that survives into the document: a skip-word bug once read as "the
active secret leaks", and driving the module showed the active secret is never
exposed at all (the field in question is null in that phase), so the real defect was
a false reveal plus a value burned from a pool. State what you observed, not what
the code looks like it does.

Modules written with injected dependencies exist for this. In this repo `game.js`
takes them, so a whole round costs four stub functions:

```js
game.init({
  getPlayers: () => players,
  onState: () => {},
  onChat: (code, message) => log.push(message.text),
  sendWord: (id, word) => { priv[id] = word; },
});
```

Call the teardown (`forget(code)` here) at the end, or the round timers keep the
process alive and the script looks like it hung.

## 2. Write the review document

The document is the deliverable. Structure it exactly like this.

### Summary

Three sentences from the scope pass.

### Issues

A numbered list of concrete issues. Each issue must include:

- **Severity**: `critical` | `major` | `minor` | `suggestion`
- **Location**: file path and line range (if applicable)
- **Problem**: What is wrong or suboptimal and why.
- **Recommendation**: Exactly what to do to fix it. Include a code snippet if a
  better implementation is clearly evident.

Use `critical` for correctness bugs, security issues, or violations of core
architecture. Use `major` for significant design or maintainability problems. Use
`minor` for style or small logic issues. Use `suggestion` for optional improvements.

Order the list by severity, highest first. Never bury a `critical` beside a `minor`.

### Missing Tests

List any cases the current tests do not cover, or flag if tests are absent entirely.

### Verdict

One of: **Approve** | **Approve with suggestions** | **Request changes**

Followed by one sentence justifying the verdict.

## 3. Post it to the PR

Ask the user before posting: it notifies people, and the PR is theirs. Two questions
settle it, scope (critical and major only, or every issue) and form (summary plus
inline suggestions, or a single comment).

Then read `reference/posting.md` and follow it. It carries the `gh` mechanics, the
payload shape, the anchoring rules and the verification step.

Rules that hold regardless of mechanics:

- **One review, not N comments.** One notification instead of twenty.
- **Anchor `critical` and `major` issues inline.** `minor` and `suggestion` can be
  grouped in the summary body.
- **Attach a `suggestion` block only when the fix is unambiguous.** When the right
  direction is the author's call (revert this, or update the other two files), state
  both options and attach nothing.
- **Say when suggestions must be applied together.** Interdependent suggestions that
  change a signature will break the file if applied piecemeal. Label them.
- **Issues outside the diff cannot be anchored.** Keep them in the document and say
  explicitly that they are easy to lose.
- **The written verdict is not the API event.** GitHub refuses `APPROVE` and
  `REQUEST_CHANGES` on your own PR, so a self review posts as `COMMENT` whatever the
  verdict says. State the verdict in the document text and tell the user the badge
  will not appear.

## Rules

- DO NOT implement changes yourself. Your role is to analyze and document. Posting
  the review (phase 3) is delivery, not implementation: it adds no commit and edits
  no file.
- DO NOT give vague feedback like "consider improving this". Be specific and
  actionable.
- DO NOT praise for the sake of it. Focus on what matters.
- ONLY produce a single review document as the final output. Phase 3 delivers that
  same document to the PR, so there is one artifact, not two.

## Tone and Style

- Be direct and specific. Refer to exact file paths and line numbers where possible.
- If you suggest a better implementation, show the code. Don't just describe it.
- Assume the developer is competent. Skip obvious explanations.
- Follow the workspace Markdown conventions: no em dashes, en dashes, or plain
  hyphens in running text. Use commas, parentheses, or colons instead.
