# Session log: a team of subagents

Date: 2026-09-15. Work lives in [`.claude/agents/`](../.claude/agents) at the **repo root**, not inside
`day7/`: the agents are shared by every day, the same as the skills in `.claude/skills/`. This day
directory holds the log and nothing else.

Task for the afternoon: wrap the skills built in the earlier modules in agents, so each one gets an
identity, a restricted tool set and a place in a workflow. Four or five agents, tested individually,
then iterated.

---

## What was built

Eight agents, not five. Five came from the exercise's suggested team; the other three exist because
there were skills left with no agent, and `day6/` shows all three of those workflows actually get used.

| Agent              | Job                  | Skills                                                                                  | Produces                                          |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `architect`        | description → spec   | `spec`                                                                                  | `dayN/<slug>.spec.md` + acceptance criteria       |
| `implementer`      | spec → change        | `security-doctor` on a security report                                                  | edited files + per-criterion report               |
| `tester`           | change → tests       | `tester`, `enumerate-behaviours`, `cover-the-gaps`, `regression-fixture`, `kill-flakes` | test files + a real run result                    |
| `reviewer`         | diff → review        | `pr-review`                                                                             | severity-rated comments + verdict                 |
| `security-analyst` | diff → audit         | `security-analyst`, `white-hat` on request                                              | findings as entry → path → sink                   |
| `debt-auditor`     | module → debt menu   | `debt-audit`                                                                            | `dayN/debt-audit.md`, items with an interest rate |
| `triager`          | issue → automatable? | `triage`                                                                                | `AUTOMATE` / `SEMI-AUTOMATE` / `HUMAN-REQUIRED`   |
| `release-captain`  | commits → ship/hold  | `safe-release`                                                                          | `dayN/release-readiness.md` + rollback note       |

Every file answers the same four questions in the same order: what it is for, what tools it gets, what
it produces, and what it is **not** allowed to do. The "not my job" section is the one that does the
work — without it every agent drifts towards doing the whole task.

## Decisions

**The skill is the content; the agent is the scope.** No agent re-states a method the skill already
describes. What an agent adds is identity, a tool grant, an output contract and a refusal list. Where a
file does repeat something, it is a repo rule the generic skill cannot know: day isolation, never run
`npm` from the root, no root manifest or workspace, no new dependency without asking, English only.

**Subagents cannot ask a question.** This was a real bug in the first draft, not a polish item. Several
skills say _STOP and ask the user_ — `spec` most emphatically — and a subagent has no user turn to stop
into. As written, those agents would either hang or invent an answer. Every agent now has the same
instruction instead: deliver everything that is not blocked, label what you assumed (`ASSUMPTION:`),
and return the question. Only `architect` may refuse outright, and only when the whole spec is a coin
flip.

**The final message is the deliverable.** A subagent's tool output never reaches the user; only its last
message does, relayed by the main agent. So every agent is told to put the findings themselves in that
message, never "see the file above". The agents that produce long documents write them to a flat file at
the day's root — matching `day6/TRIAGE.md`, `debt-audit.md`, `release-readiness.md` — _and_ summarise in
the message.

**One writer.** `implementer` is the only agent with `Edit`/`Write` on source, and it is also the one
that runs `security-doctor`. That keeps the analyst/doctor split honest: `security-analyst` reports and
cannot patch, and the fix goes through the agent that knows the build. `architect` gets `Write` only for
its own `*.spec.md`.

**Nobody commits.** No agent has `git add`, `git commit`, `git push`, `gh pr create`, `git tag` or
`gh release create`. The repo rule is that commits are the user's; an agent that can commit turns a bad
run into history. `release-captain` in particular reads `git log` and writes a document, and cannot tag.

**Handoffs are named in the output shape.** `reviewer` escalates to `security-analyst` on any diff
touching auth, data or untrusted input, hands missing cases to `tester`, and points at `debt-auditor`
instead of relitigating rotten code inside a review. `security-analyst` ends by handing its report to
`implementer`. That is what makes the chain composable rather than five prompts in a drawer.

**`grill-me` is deliberately not wrapped.** It is an interview with the user, so an agent version of it
has nobody to interview. `architect` borrows its _method_ — walk the decision tree, justify every
decision made on the user's behalf or demote it to an open question — and runs it against itself.

**`white-hat` is opt-in.** `security-analyst` is defensive by default and only red-teams on an explicit
instruction, writes probes rather than running them, and never probes anything outside the local
project.
