# Session log: orchestrating the agent team

Date: 2026-09-16. Work lives in [`.claude/skills/build-feature/`](../.claude/skills/build-feature)
at the **repo root**, the same as the agents in `.claude/agents/` and the skills they wrap: it
orchestrates all of them, so it isn't scoped to one day. This directory holds the log and nothing
else.

Task for the day: design a handoff shape on paper for the agents built on
[day7](../day7/log.md), then implement it as a runner skill — `/build-feature` — that calls
architect, implementer, tester and reviewer in sequence and loops reviewer↔implementer on
must-fix comments.

## Handoff design

Two shapes, per the exercise's own framing:

- **Sequential** for the main pipeline: architect → implementer → tester → reviewer, plus
  `security-analyst` spliced in (not run alongside) whenever reviewer's `Escalate` line fires.
  Each step's artefact is exactly what that agent already returns in its final message — a spec
  path and its Intent/Acceptance/Risks, a file-and-criteria list, a test report — carried forward
  in the next agent's prompt rather than re-derived.
- **Feedback loop** for reviewer↔implementer only: reviewer can hand must-fix comments back to
  implementer, which addresses them and gets re-reviewed, capped at 3 rounds. A 4th round is a
  human call, not something worth automating away.

## Decisions

**The orchestrator branches; no agent does.** Root `CLAUDE.md` already says branch creation is
"a step for whoever is orchestrating the agents, not a job for any agent itself" — so
`build-feature`'s step 0 is `git checkout -b feature/<slug>` before `architect` ever runs, done by
the calling context, not delegated.

**No PRs anywhere in the loop.** The exercise's skeleton has `implementer` open a PR and later
steps reference "the PR". That doesn't fit this repo: no agent has `gh pr create` (root
`CLAUDE.md`'s "nobody commits" rule), and `gh` isn't authenticated in this environment either.
`reviewer` already accepts `"the working tree"` as a target, so the pipeline reviews uncommitted
changes on the feature branch directly and skips PRs entirely — the user opens one later if they
want to.

**Nothing gets committed, ever, even on approval.** The exercise skeleton stops short of merging
but still has `implementer` push a PR. Root `CLAUDE.md` is stricter: "Don't commit without asking
first" applies to the orchestrator too, not just the subagents. So the pipeline's terminal state,
approved or not, is a clean-or-not-clean working tree on `feature/<slug>` and a summary message —
the user commits by hand.

**Escalation reuses the must-fix bucket.** `reviewer` already says "recommend
`security-analyst`, do not audit yourself" instead of doing security review inline. The skill
takes that literally: on Escalate, `security-analyst`'s findings get merged into the same
must-fix list that drives the implementer loop, instead of becoming a parallel review track.

**Partial failure still reports, never invents.** Same rule as the agents themselves: if
`architect` returns BLOCKING, or `tester` finds no test setup and stops, the skill surfaces that
to the user immediately rather than guessing a framework or resolving an open question on its
own. The skill's only "not my job" items are the ones the agents already can't do (merge, decide
a 4th loop round, resolve a BLOCKING question) — it doesn't add new judgement calls of its own.
