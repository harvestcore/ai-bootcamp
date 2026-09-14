---
name: debt-audit
description: Read the given file or module and produce a list of possible
    technical debt findings, categorised and hedged. Use before deciding
    what debt to pay down.
---

# Debt Audit

Read the target code carefully. Produce findings in these categories:

- **Structural.** Dead code, tangled dependencies, unclear ownership,
  duplication that has drifted.
- **Behavioural.** Silent failures, unclear error paths, tests that assert
  nothing, missing observability.
- **Contextual.** Comments that no longer match the code, `TODO`s older
  than a year, naming that reflects a defunct architecture.
- **Hazardous.** Anything that could bite in production — race conditions,
  unbounded loops, insecure defaults.

For each finding:

- Quote the specific line(s).
- Describe what looks wrong.
- **Note explicitly** whether this might be intentional and, if so, what
  question a human should ask before changing it.

Do not propose fixes yet. Just find and characterise.
