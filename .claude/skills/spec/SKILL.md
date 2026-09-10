---
name: spec
description: Produce a first-draft spec in the standard shape (intent,
    non-goals, user-visible behaviour, constraints, acceptance criteria,
    open questions, out of scope) from a rough description of a feature.
    Use before implementing anything non-trivial.
---

# Spec

Given the description below, produce a spec with these sections:

- Intent
- Non-goals
- User-visible behaviour (prefer examples)
- Constraints
- Acceptance criteria (concrete, each independently checkable)
- Open questions
- Out of scope

Follow these rules:

- Do not invent constraints that aren't in the description. Where a
  constraint is likely but unstated, put it in **Open questions**
  instead.
- Acceptance criteria must be checkable. "Works correctly" is not a
  criterion; "returns 403 for users without `coach` or `admin` role" is.
- If a section has nothing to say, write "None." Do not pad.
- Where you're inferring rather than knowing, mark with `[assumed]`.

Do not write implementation code. Do not propose designs. Just produce
the spec.
