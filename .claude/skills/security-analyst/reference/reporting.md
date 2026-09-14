# Rating and reporting

## Severity — impact from a starting privilege

Rate what an attacker **actually achieves in this system**, from the lowest privilege that reaches the
bug. Not a generic CVSS vibe, and not the worst case the class can theoretically produce elsewhere.

| Severity | Means |
|---|---|
| **Critical** | An unauthenticated attacker gets code execution, full auth bypass, read/write of arbitrary users' data, or the credentials that unlock those. Ship-stopper. |
| **High** | An authenticated, unprivileged attacker reads or modifies another user's or tenant's data, escalates privilege, takes over an account, or obtains a secret. Also: unauthenticated disclosure of sensitive data without write access. |
| **Medium** | Real impact, but gated — needs user interaction (a click, a paste), a non-default configuration, a specific race, or chaining with another bug. Or: unauthorised access to low-sensitivity data. |
| **Low** | A defence-in-depth layer is missing with no demonstrated path to impact today: a missing header, a token living longer than needed, an over-broad log. |
| **Info** | No security impact. A note the reader may want anyway (a test fixture's fake password, a deliberate insecure demo). |

Two rules. **Chains are rated as the chain:** two Mediums that compose into account takeover are one
High or Critical finding, written as one path — say so explicitly rather than filing them apart.
**Deployment context moves the rating:** a localhost-only single-user tool does not get Critical for
something an internet-facing multi-tenant service would. If the context is unknown, rate under a
stated assumption and say which way it moves.

## Confidence — how sure are you the path is real

Separate axis from severity. Never let one bleed into the other.

- **Confirmed** — traced end to end in the code you read. The entry point is reachable, no guard
  exists, the sink does what you say. You went looking for the guard and can say where you looked.
- **Probable** — the path exists but one link depends on something not in the repo (a proxy, an env
  var's real value, how it is deployed, a library's internal behaviour you did not read). Name the
  unproven link and what would settle it.
- **Speculative** — the pattern is present and worrying, but reachability is unproven. Rare in a good
  report; if you have several, you stopped verifying too early. Never use prose to promote one of
  these — no "clearly", no "obviously exploitable".

## Finding format

One entry per **root cause**, most severe first, with every affected call site listed under it.

````
### [Critical · Confirmed] Unauthenticated SQL injection in the search endpoint

**Where:** `day6/server/routes/search.js:42` (also `:88`, same helper)

**Entry point → sink:** `GET /api/search?q=` (no auth middleware on this router,
`server/index.js:17`) → `buildQuery(q)` → `db.exec()` with the value concatenated.

```js
// routes/search.js:42
const rows = db.exec(`SELECT * FROM items WHERE name LIKE '%${req.query.q}%'`);
```

**Impact:** any internet user can read or modify every table in the database, including
`users.password_hash`. `db.exec` allows stacked statements, so this is write access, not
just read.

**Why no guard:** the router is mounted before `requireAuth` (`index.js:17`); no validation
of `q` exists between the handler and the query; grepped `search` across the repo for a
middleware or a sanitiser and found none.

**Fix:** use a prepared statement with a bound parameter —
`db.prepare('SELECT * FROM items WHERE name LIKE ?').all(`%${q}%`)` — and move the router
below `requireAuth` if the endpoint is not meant to be public.

**Regression test:** a request with `q=%' OR 1=1 --` must return no rows rather than the
whole table (hand this to `tester` / `regression-fixture`).
````

Drop `Regression test` when it does not apply. Keep `Why no guard` always — it is the proof you
verified rather than pattern-matched.

## Document shape

1. **Verdict** — two or three sentences: what was reviewed, the worst thing found, and whether the
   change/codebase is safe to ship as-is.
2. **Findings** — the entries above, ordered by severity then confidence.
3. **Hardening notes** — real but no demonstrated path (Low/Info), one line each, not padded out.
4. **Patching notes** — dependency advisories, each marked reachable / not reachable / unknown after
   your triage.
5. **Fix order** — a short numbered list: what to do first and why, so the reader has a plan and not
   just a pile.
6. **Checked and ruled out** — the classes and specific candidates you examined and dismissed, with
   the one-line reason. This is what makes the rest of the report trustworthy, and it stops the next
   reviewer redoing your work. Include the sections of the checklist you skipped as not applicable.
7. **Open questions** — anything whose severity or existence depends on an answer only the human has.

## Tone

Write for an engineer who has to act on this today. No preamble, no lecture on why security matters,
no praise. State the bug, the impact and the fix. When something is genuinely done well and the
reader might otherwise "fix" it away, one line saying so is useful; a compliments section is not.
