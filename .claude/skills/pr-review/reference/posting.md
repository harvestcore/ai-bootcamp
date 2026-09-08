# Posting a review with `gh`

## Check who you are first

```sh
gh auth status
gh pr view <n> --json author --jq .author.login
```

If the authenticated account **is** the PR author:

- GitHub refuses `APPROVE` and `REQUEST_CHANGES` on your own PR. Only `COMMENT`
  works, so there will be no red "changes requested" badge.
- Everything posts as that user, not as Claude. Say so before posting: the user
  may expect the review to be attributed to a tool.

## Pre-flight: approval is required

Do not run the POST until the user has approved the exact comment set (phase 3a of
`SKILL.md`). Building the payload is fine beforehand, and it helps: dump it and read
back the anchors and suggestion bodies so what you present matches what would be
sent, byte for byte.

```sh
node -e "for (const c of require('./review.json').comments) console.log(c.path, c.start_line ?? c.line, '->', c.line)"
```

Post only the approved comments. If approval covered four of five, delete the fifth
from the payload rather than posting it and apologising after.

## Build one payload, post once

`gh pr review` cannot carry inline comments, so use the API with a `comments`
array. The whole review lands as a single notification.

```sh
gh api --method POST /repos/<owner>/<repo>/pulls/<n>/reviews --input review.json
```

```json
{
  "commit_id": "<full 40-char headRefOid>",
  "body": "## Summary\n\nMarkdown, ranked by severity.",
  "event": "COMMENT",
  "comments": [
    { "path": "day1/server/game.js", "line": 86, "side": "RIGHT",
      "body": "One finding.\n\n```suggestion\n    the replacement line\n```" },
    { "path": "day1/server/game.js", "start_line": 55, "line": 65,
      "side": "RIGHT", "start_side": "RIGHT",
      "body": "Multi-line finding.\n\n```suggestion\nreplacement for lines 55-65\n```" }
  ]
}
```

Generate the JSON with a script and `JSON.stringify`. Hand-escaping newlines and
backticks inside JSON strings goes wrong quickly. Write it to the scratchpad, not
the repo.

## Anchoring rules

An inline comment must land on a line inside a diff hunk. Compute the ranges before
writing any comment:

```sh
gh pr diff <n> --patch | grep -E '^(\+\+\+|@@)'
```

Each `@@ -old,n +new,m @@` gives a new-side range of `new` to `new + m - 1`. Every
`line` (and `start_line`) must fall inside one. Context lines inside a hunk are
valid anchors, which is how you comment on an unchanged line that a nearby change
broke.

- `line` alone anchors one line; `start_line` + `line` anchors a range.
- `side` / `start_side` are `RIGHT` for the post-change file.
- A file the PR does not touch **cannot** be anchored at all. Put it in the summary.
- Get line numbers from the branch, not the working tree:
  `git show <branch>:<path> | grep -n ''`

## Suggestion blocks

The block replaces the entire anchored range, so it must be the complete
replacement: every line, with **exact** original indentation. An empty block
deletes the range.

**One finding per anchor range.** Two suggestion blocks that overlap conflict, and
GitHub will not apply both. When two findings sit in the same function, give each a
non-overlapping line range rather than folding them into one comment: on a nine line
function that meant anchoring the guard clauses and the body separately, so each
suggestion stayed independently applicable. Fold two findings into one comment only
when they genuinely need the same lines rewritten.

## Verify after posting

The API accepts the review and reports nothing about dropped comments, so check:

```sh
gh api /repos/<owner>/<repo>/pulls/<n>/comments --jq 'length'
gh api /repos/<owner>/<repo>/pulls/<n>/comments \
  --jq '.[] | "\(.path):\(.start_line // .line)  \(if (.body|test("suggestion")) then "[sug]" else "[note]" end)"'
```

Confirm the count matches what you sent and each anchor is where you meant it.
Report the review URL to the user.
