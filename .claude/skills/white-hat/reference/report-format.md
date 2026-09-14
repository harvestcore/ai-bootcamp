# Report format

Order chains by **exploitability × impact** — the one you'd actually run first goes first. One entry
per chain (root cause), not per step.

## Confidence

- **Confirmed** — every link traced in code you read; entry reachable from the stated start; no guard
  found (and you looked). Runnable probe included.
- **Probable** — the chain holds but one link depends on something outside the repo (deploy config, an
  env value, a library internal). Name the unproven link and what settles it.
- **Speculative** — pattern present, reachability unproven. Keep these few; say what you'd read to
  promote them.

## Per-chain entry

````
### [Confirmed · High] Anonymous account takeover via reset-token leak

**Goal:** take over any account.
**Start:** external, unauthenticated.

**Chain:**
1. `POST /reset` with a victim email — token is `md5(email + Date.now())`
   (`day6/server/auth.js:31`). `Date.now()` is observable from any response's
   `Date` header, so the token space is seconds-wide, not random.
2. The reset link is returned in a `302 Location` to a URL taken from
   `req.query.next` with no allow-list (`auth.js:44`) — set `next` to an
   attacker host and the token lands in the attacker's logs via `Referer`.
3. `GET /reset/confirm?token=` sets a session with no rate limit (`auth.js:58`).

**Impact:** full takeover of any account whose email is known. No auth required.

**Probe (run against your own test instance only):**
```sh
# 1. trigger reset for a test account you own
curl -s -D- "http://localhost:3000/reset?next=https://CANARY.example/x" \
  --data 'email=victim-test@local' | grep -i '^location:'
# vulnerable: Location points at CANARY host and carries the token
```

**What would kill this:** a CSPRNG token (`auth.js:31`) OR an allow-list on
`next` (`auth.js:44`) — either link breaks the chain. Verify both are absent
before relying on this.
````

Fields: goal, start privilege, numbered chain with `path:line` per step, impact, a safe runnable probe,
and "what would kill this" (the guard whose absence you're betting on — the honest statement of what
makes you wrong).

## Document shape

1. **Summary** — one line per chain: `[Confidence · Impact] one-sentence goal`, ranked.
2. **Chains** — the entries above, best first.
3. **Chased and killed** — attacks you tried to build and couldn't, with the guard that stopped each.
   This is not filler: it proves you verified, and it stops the next researcher re-walking dead ends.
4. **Would-need-to-confirm** — Speculative items and exactly what you'd read or ask to settle them.
5. **Handoff** — the confirmed chains to pass to `security-analyst` for fixes and regression tests.

No fixes anywhere in this document — naming the weakness class is fine, writing the remediation is not
this skill's job.
