# Fix patterns

Per-class remediation recipes, mirroring the class taxonomy `security-analyst` reports under. For each
class: the correct fix, the anti-patterns that only *look* like a fix, and what "verified" means. Pick
the fix that closes the specific path in front of you — these are defaults, not a substitute for
reading the code.

The golden rules that cut across every class:

- **Allow-list, don't deny-list.** Enumerate what is permitted and reject the rest. A block-list of bad
  tags / extensions / hosts / characters leaks the case you didn't think of.
- **Validate/escape at the boundary of the sink, for that sink.** The same value is safe for one sink
  and lethal for another. Encode for HTML when it goes to HTML, parameterise when it goes to SQL, quote
  for the shell only if you cannot avoid the shell.
- **Enforce the check where the decision is made.** A guard an attacker can route around (in one caller,
  in the UI, in a type) is not a guard.
- **Fail closed.** On error, missing data, or an unexpected type, deny — don't fall through to allow.

---

## Injection into an interpreter (SQL / NoSQL / OS / template / LDAP / XPath)

- **SQL:** use parameterised queries / bound parameters or the ORM's safe API. Never build SQL by string
  concatenation or interpolation with request data. Identifiers that cannot be parameters (table/column
  names) must come from a fixed allow-list, never from input.
- **OS command:** avoid the shell — use the exec API that takes an argument array (`execFile`,
  `subprocess.run([...], shell=False)`, `ProcessStartInfo` with an argument list). If a shell is truly
  unavoidable, allow-list the command and pass data as separate args, never spliced into the string.
- **Template / SSTI:** never compile a template from a string that contains user input. Keep user data
  as template *data*, not template *source*. Disable raw-HTML/eval features of the template engine.
- **Anti-patterns:** blacklisting quotes or keywords; `mysql_real_escape`-style manual escaping;
  "the ORM so it's safe" over a `raw()`/`FromSqlRaw` call that still interpolates.
- **Verified when:** the attacker payload is now a literal value (returns no rows / no execution), and a
  legitimate value with a quote/space in it still works.

## Authorisation (IDOR/BOLA, vertical escalation, tenant isolation, mass assignment)

- **Object ownership (IDOR):** every object loaded by an id from the request must be checked against the
  caller's identity — `resource.OwnerId == currentUser.Id` (or the tenant predicate) — *before* it is
  read, returned, or mutated. Put the check at the service boundary so every entry point inherits it,
  not only the one handler the report cited. "The id is a UUID/sequential" is irrelevant.
- **Vertical escalation:** the permission/role check goes on the route/handler, not on the menu that
  renders the link. When a family of sibling actions all carry a permission attribute and one doesn't,
  add the missing one — match the siblings exactly.
- **Multi-tenant:** every query carries the tenant predicate. Centralise it (a scoped repository, a
  query filter) so a new query can't forget it.
- **Mass assignment:** bind an explicit allow-list of fields (a DTO / view-model), never the whole
  request body into the entity. Strip server-controlled fields (role, price, ownerId, isAdmin).
- **Anti-patterns:** a `user == null` check where the framework returns a non-null guest/anonymous
  principal (a no-op); checking the *target* object's ownership but not the *source*; trusting a hidden
  form field or client-sent id for identity.
- **Verified when:** caller A requesting/mutating caller B's object is denied (403/404), caller A on
  their own object still succeeds, and every entry point to the operation enforces it.

## Authentication, sessions and tokens

- **JWT:** verify, don't decode — pin the algorithm, reject `alg:none`, validate signature, issuer,
  audience, and expiry. Keep the signing key out of the repo.
- **Passwords:** hash with a stretched/memory-hard KDF (argon2, scrypt, bcrypt, or PBKDF2 with a high
  iteration count) and a per-user salt. Replacing a fast hash (md5/sha1/sha256/single-round) is a
  migration: hash-on-next-login or force reset — **this needs a human decision** (it invalidates or
  re-formats existing hashes). Don't silently change the format.
- **Sessions/cookies:** set `HttpOnly`, `Secure` (always, not "same as request"), and an appropriate
  `SameSite`; rotate the session id on login; invalidate server-side on logout.
- **Tokens (reset/activation):** CSPRNG-generated, bound to the account, single-use, expiring; compare
  constant-time if the token is short or guessable.
- **Anti-patterns:** moving a weak hash to "double md5"; lengthening a token instead of making it random;
  `HttpOnly` without `Secure`.
- **Verified when:** the forged/expired/foreign token is rejected, and a genuine login/reset still works.

## Secrets

- **A committed live secret is already compromised.** The fix is **rotation**, done by the human, plus
  removing it from code *and history* and loading it from the environment / a secret manager going
  forward. Moving it to an env var without rotating fixes nothing. Never print the value.
- Add the path to `.gitignore`; scrub history only with the human's sign-off (it rewrites shared
  history). Secrets that shipped to a client bundle are public — rotate.
- **Verified when:** the code reads the secret from config/env, the value is gone from the tree, and you
  have told the human to rotate (and, if needed, purge history).

## Files and paths (traversal, arbitrary read/write, upload)

- **Path traversal:** resolve the final path (`Path.GetFullPath`/`realpath`) and assert it is inside the
  intended base directory (`StartsWith(base + separator)`), after stripping the caller's directory
  components (`GetFileName`/`basename`). Never build a served/opened path from a raw request filename.
- **Upload:** allow-list the extension **and** verify the content type/magic bytes; store outside the
  web root or under a path that is never executed; generate the stored name (don't trust the client's).
  For images, re-encode through an image library to strip payloads.
- **Zip/archive extraction (Zip Slip):** for every entry, resolve the target and assert containment
  before writing; prefer the framework's hardened extract-to-directory over a hand-rolled loop.
- **Anti-patterns:** blocking only `../` (misses encodings, absolute paths, `..\\`); allow-listing by
  content-type header (client-controlled); checking the extension but writing under the web root anyway.
- **Verified when:** `../`, absolute, and encoded paths are rejected; a legitimate filename still saves;
  an executable/`.html` upload is refused or rendered inert.

## Server-side requests (SSRF)

- Allow-list the destination (scheme, host) where possible. Otherwise resolve the hostname and **block
  private, loopback, link-local and cloud-metadata ranges** (169.254.169.254, `::1`, `10/8`, `127/8`,
  `192.168/16`, `169.254/16`, fc00::/7) — and re-check after redirects. Disable auto-following of
  redirects to internal targets. Set timeouts.
- **Anti-patterns:** blocking the string `localhost` only; checking the URL before DNS resolution
  (rebinding); allowing redirects to bypass the check.
- **Verified when:** a URL/path pointing at an internal address or metadata endpoint is refused, and a
  legitimate external fetch still works.

## Deserialisation and object handling (incl. prototype pollution)

- Don't deserialise untrusted data into arbitrary types. Use a data-only format (JSON without type
  handling); disable polymorphic type resolution (`TypeNameHandling.None`, no `BinaryFormatter`).
- **Prototype pollution (JS):** guard recursive merge/`set`-by-path against `__proto__`/`constructor`/
  `prototype` keys, or use a null-prototype object / `Map`.
- **Verified when:** a payload carrying a type/`__proto__` directive no longer instantiates a type or
  mutates the prototype, and normal data round-trips.

## Browser-side (XSS, open redirect, CSRF, clickjacking)

- **XSS:** let the framework auto-encode; remove the raw-output escape hatch (`Html.Raw`,
  `dangerouslySetInnerHTML`, `v-html`, `innerHTML`) over user data. When HTML *must* be allowed, run it
  through a real allow-list sanitiser (DOMPurify, HtmlSanitizer/Ganss, Bleach) that strips attributes to
  an allow-list — **not** a hand-rolled tag deny-list. Encode for the exact context (HTML body, attribute,
  JS, URL).
- **Open redirect:** validate the target is a local/relative URL (`Url.IsLocalUrl`, `LocalRedirect`) or
  is on an allow-list of hosts; otherwise fall back to a safe default.
- **CSRF:** require the framework's anti-forgery token on every state-changing request; don't
  `[IgnoreAntiforgeryToken]`. State-changing operations must not be `GET`.
- **Clickjacking:** `X-Frame-Options: DENY` / a `frame-ancestors` CSP.
- **Anti-patterns:** a tag/`onclick`-substring deny-list (misses `onerror`, `onload`, `onfocus`, `svg`,
  data-URIs); escaping for HTML when the value lands in a JS or URL context; a CSP so broad it allows
  `unsafe-inline`.
- **Verified when:** the payload renders as inert text (or is stripped), a legitimate rich-text/redirect
  still works, and the state-changing request without a token is rejected.

## Crypto

- Use AEAD (AES-GCM, ChaCha20-Poly1305) with a **random per-message IV/nonce** stored alongside the
  ciphertext; never a static or key-derived IV, never ECB. Keys from a CSPRNG at full length, from a
  KDF or a secret manager — not a short/digit-only string, not hardcoded. Use constant-time comparison
  for MACs/tokens.
- Changing a key or scheme over existing data is a **migration** — needs a human decision and usually a
  re-encrypt pass. Don't change it silently.
- **Anti-patterns:** "AES so it's fine" in ECB mode or with a fixed IV; `Math.random()`/`new Random()`
  for keys/tokens; rolling your own construction.
- **Verified when:** two encryptions of the same plaintext differ, decryption round-trips, and the key
  is no longer low-entropy or in the tree.

## Business logic and concurrency (TOCTOU/races)

- Enforce invariants at the database: unique constraints, `CHECK` constraints, atomic
  conditional updates (`UPDATE ... WHERE balance >= ?`), row locks or transactions around read-then-write
  on balances/quotas/uniqueness. Validate quantities/amounts server-side (reject negatives, overflow);
  never trust a client-computed price/total.
- **Anti-patterns:** enforcing uniqueness with an application-level "check then insert"; re-validating in
  the same non-atomic window.
- **Verified when:** concurrent requests can't double-spend/duplicate, and a negative/overflow input is
  rejected.

## Availability (DoS)

- Bound the expensive thing: rate-limit the specific abusable route (login, reset, expensive query,
  upload), cap request/body/upload sizes, cap pagination and regex/parse input, add timeouts. Fix
  catastrophic-backtracking regexes.
- **Verified when:** the unbounded input is now rejected/limited, and normal load is unaffected.

## Dependencies and supply chain

- Upgrade to the patched version once you've confirmed the vulnerable path is actually reached by this
  project; pin it. Adding/upgrading a dependency is a **human decision** (`CLAUDE.md`) — recommend, then
  ask. Report advisories you couldn't reach as *not reachable* rather than churning versions.

## LLM / agent / tool wiring

- Treat every text the model reads (user input, fetched pages, tool results, retrieved docs) as
  untrusted — don't let it authorise actions. Keep tool arguments on an allow-list; put a human/gate in
  front of destructive or outbound tools; never interpolate model output into a shell/SQL/eval sink.
- **Verified when:** an injected instruction in the model's input can't trigger a privileged tool call
  or reach a raw sink.

## Data at rest, privacy, exposure

- Remove sensitive data from logs, error responses, and client bundles; scope over-broad queries;
  encrypt or tokenise stored PII/secrets. Return generic errors to the client, detail to the server log.
- **Verified when:** the sensitive field is gone from the response/log, and the feature still functions.

---

## Cross-cutting anti-patterns (a fix that looks done but isn't)

- **Fixing the quoted line, not the root cause** — the same bug lives at three other call sites.
- **A deny-list where an allow-list was needed** — closes the reported payload, leaves the class open.
- **A guard an attacker routes around** — added in the UI, one caller, or a type; not at the sink.
- **Wrong-sink encoding** — HTML-escaping a shell/SQL/URL value.
- **A no-op guard** — `user == null` where the principal is never null; a check whose result is ignored.
- **Weakening a test/type/permission to get green** — the fix now hides behind a broken oracle.
- **Silent breaking changes** — a stricter validator that also rejects legitimate input, shipped without
  saying so.
- **Relocating a secret instead of rotating it** — still compromised.
- **Scope creep** — an unrelated refactor riding along in the security diff, so the real fix can't be
  reviewed.
