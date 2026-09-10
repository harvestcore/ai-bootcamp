---
name: spec
description: Produce a first-draft spec in the standard shape—intent, non-goals,
    user-visible behaviour, constraints, acceptance criteria, open questions, out
    of scope—from a rough description. Use before implementing anything non-trivial
    to align on scope and acceptance before code.
---

# Spec

Given a feature description, produce a formal spec that defines WHAT will be built,
not HOW. A spec is the contract between stakeholder intent and implementation: it
must be precise enough to guide code, unambiguous enough to pass to another engineer.

## Before you start: STOP and ask if anything is unclear

**CRITICAL: Do not assume anything. Do not write the spec until every detail is clear.**

If the description has ANY of these issues, **STOP immediately** and ask the user:
- **Vague or ambiguous terms:** "What exactly do you mean by 'X'?"
- **Missing scope boundaries:** "Does this also handle Y? Where are the limits?"
- **Conflicting or contradictory statements:** "This says A but also says B—which is correct?"
- **Undefined constraints:** "You said 'fast'—what's the actual latency target in ms?"
- **Unknown dependencies:** "Does this depend on system X, or do we build it fresh?"
- **Unclear success criteria:** "How will we measure if this is working correctly?"
- **Unspecified edge cases:** "What happens when X, Y, or Z occurs?"
- **Anything you're tempted to fill in:** "I'm about to assume [blank]—is that right?"

**Do not use `[assumed]` tags in the final spec.** If you're about to write something 
with `[assumed]`, that means you don't know the answer. **Ask the user instead of 
guessing.** A spec with assumptions is not a spec—it's a guess that will break 
implementation.

**The process:**
1. Read the description
2. Identify EVERY gap or ambiguity
3. Ask the user to clarify—don't proceed until they do
4. Once everything is clear and aligned, write the spec
5. The final spec has zero `[assumed]` tags—everything is stated fact or explicit 
   open question

**This takes time upfront, but prevents hours of wasted work later.**

## Output structure

Produce these sections in order:

### Intent

- The WHY: problem being solved, user need, business goal
- Keep it one or two sentences. This frames every trade-off that follows
- Link to any upstream requirement or ticket if one exists
- Examples: "Users need to reset forgotten passwords without contacting support" or 
  "Reduce API latency for mobile clients on slow networks"

### Scope boundaries

- Explicit statement of what this feature DOES touch and what it DOES NOT
- Maps the feature's footprint: does it affect auth, storage, UI, APIs, databases?
- Example: "This feature touches: user signup flow, email delivery, database user 
  schema. Does not touch: password reset, 2FA, admin panel, billing"
- Prevents hidden dependencies and surprises during implementation
- If boundaries are obvious or fully covered in Non-goals, write "Clear from 
  non-goals above"

### Non-goals

- Explicitly name things the feature does NOT do, especially things that sound like 
  they should but don't
- Often related to boundaries but focuses on use cases not addressed
- Examples: "This does not persist answers across sessions", "This does not send 
  notifications", "Does not backfill historical data"
- If none, write "None."

### Behaviour

- Concrete observable behaviour from the user's perspective (UI, API response, CLI 
  output, event, etc.)
- Prefer examples and flows over abstract description
  - ❌ Abstract: "The system validates input"
  - ✅ Concrete: "When a user submits `email: "not-an-email"`, the form shows red 
    outline on the field and the text 'Not a valid email address' appears below it"
  - ❌ Abstract: "Admins can list users"
  - ✅ Concrete: "GET /api/admin/users returns 200 with JSON array `[{id, email, 
    created_at}, ...]`, limited to 100 per page, sorted by created_at descending"
- Cover happy path, edge cases (boundary values, empty states, missing data), and 
  error cases
- Include UI copy, error messages, exact API responses, status codes, headers
- Reference related features or constraints that affect behaviour

### Constraints

- Immovable facts: performance budgets, platform limits, compatibility requirements, 
  legal/security mandates, team capacity, third-party service limits
- **Key distinction:** A constraint is a limitation you cannot negotiate; an acceptance 
  criterion is how you verify you respect the constraint
  - Constraint: "Database query must complete within 200ms"
  - Acceptance criterion: "Query returns results in ≤200ms under 10k row dataset"
- Do NOT invent constraints. If a constraint is likely but unstated, put it in 
  **Open questions** instead
- Examples: "Must work on iOS 12+", "P99 response time ≤500ms", "Cannot store PII 
  unencrypted", "Notification delivery SLA: 99.9%"
- Technical constraints (DB schema limits, browser API availability, rate limits) 
  belong here

### Acceptance criteria

- Concrete, independent, checkable statements—each one is something you can verify 
  or fail in isolation
- Precise enough that two engineers would agree on pass/fail without calling the author
- Use specific values, states, outcomes, and edge cases
  - ❌ Vague: "The feature works"
  - ✅ Concrete: "Signup form accepts email, password ≥8 chars, returns 201 with 
    auth token in body when both are valid"
- **Split compound criteria:** one per line. If you see "and" or "or", split it
  - ❌ Combined: "Form accepts emails and validates format and rejects invalid ones"
  - ✅ Split:
    - "POST /signup with valid email and password ≥8 chars returns 201"
    - "POST /signup with invalid email format returns 400 with error message 'Invalid email'"
    - "POST /signup with password <8 chars returns 400 with error message 'Password too short'"
- **No `[assumed]` tags in the final spec.** If you're about to add an assumption, 
  that means the requirement is unclear. Go back and ask the user to clarify instead
- List the happy path first, then error cases

### Dependencies

- Other specs, features, or systems this spec depends on or integrates with
- Examples: "Requires email service integration (spec TBD)", "Depends on user 
  authentication (day1/auth)", "Integrates with payment provider API v2.1"
- If none, write "None."

### Open questions

- Ambiguities, unstated constraints, decisions not yet made
- Format as question or decision point; what needs clarification before coding starts?
- Examples:
    - "Should failed login attempts be rate-limited? If so, how many per window?"
    - "Do we support OAuth, or email-only?"
    - "Should admins see a real-time live feed or is eventual consistency OK?"
    - "Is this behind a feature flag initially? How long should the flag stay?"
- This section keeps out-of-sync specs honest; don't pretend you know what you don't

### Out of scope

- Things closely related to this feature that are NOT part of this scope
- Prevents scope creep; gives a named place to park good ideas for later phases
- Examples: "Bulk import", "CSV export", "Audit logging of user edits", "Single sign-on"
- If none, write "None."

### Reference documentation

- Links to related specs, existing APIs, mockups, design docs, standards, or similar 
  features in other systems
- Helps implementers understand context without re-explaining
- Examples: "See day2/auth spec for login flow", "Follows RFC 7231 for HTTP semantics", 
  "Similar to Slack's /remind API", "Mockup: [link to Figma]"
- If none, write "None."

## Rules

- **Never assume. Ever.** If the description doesn't explicitly state something, and 
  you're tempted to fill it in yourself, STOP. Ask the user instead. `[assumed]` 
  tags should never appear in the final spec—if you're using them, you haven't 
  clarified with the user yet
- **Be precise in acceptance criteria.** Each must be testable without calling the
  author for clarification. "Works correctly" fails; "returns 200 with Content-Type: 
  application/json" passes. If you can't be specific, the requirement is unclear and 
  needs clarification from the user
- **Ask, don't guess.** Before writing the spec, if something is unclear, ambiguous, 
  or missing, ask the user. This is not optional—it's the core of the skill
- **No implementation.** This spec is WHAT, not HOW. Do not propose how to build it,
  suggest libraries, sketch schemas, or describe algorithms. Those are design decisions
  that come after acceptance of the spec
- **No padding.** Every sentence earns its place. If a section is empty, write "None."
  and move on. Verbosity obscures precision
- **Constraints vs criteria.** Constraints are limits (≤200ms, iOS 12+, 99.9% uptime).
  Criteria verify you respect them ("returns in 150ms on test dataset", "no crash on 
  iOS 12", "99.95% successful requests over 30 days")
- **Format examples clearly.** Use code blocks for API responses, pseudocode, or
  exact copy. Use tables for state machines or decision trees. Bullet lists for flows
- **Separate happy path from error cases.** Acceptance criteria that test errors are
  as important as happy path. List happy path first, then errors
- **Link outward.** Reference existing systems, related features, specs, or standards
  where they apply. This saves rewriting and clarifies dependencies
- **One sentence per criterion.** If a criterion needs a paragraph to explain, it's
  too vague

## When to use this skill

- **Before any non-trivial feature, refactor, or API endpoint** — "non-trivial" = more 
  than a few hours work or affects other teams
- **When a feature description is vague or has missing details** — specs force clarity; 
  if you can't write a spec, the description needs more work
- **To align a team on scope before diving into code** — write the spec together, 
  disagree early, change scope while it's cheap
- **To document decisions made in async discussions** — if a decision exists, the 
  spec should reflect it
- **When integrating with external systems** — specs prevent misalignment between 
  teams

## What a good spec enables

- An engineer (or your future self) can implement this from the spec alone without 
  asking clarifying questions
- A code reviewer can check implementation against acceptance criteria; if code doesn't 
  match a criterion, it's a bug
- You've named all unknowns (Open questions section), so scope expansion mid-build is 
  a choice, not a surprise
- Stakeholders see exactly what they're getting and can reject it before code starts
- Teams can parallelize: spec clarity means other teams can depend on this feature 
  without waiting for implementation details

## Spec maturity levels

- **Under review:** User is being asked clarifying questions. Once answers arrive, 
  will move to ready
- **Ready for implementation:** Intent clear and explicit, boundaries set and 
  confirmed, behaviour fully specified with examples, acceptance criteria are 
  specific and testable, zero assumptions (no `[assumed]` tags), dependencies 
  documented, open questions only for true unknowns (not clarifiable with the user). 
  Implementer can build from this spec alone
- **Done:** Same as ready, plus reference docs confirmed, acceptance criteria 
  validated with user
