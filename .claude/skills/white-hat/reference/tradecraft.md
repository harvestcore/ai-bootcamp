# Tradecraft: chains and pivots

The point of this file is to help you see the *link between two weaknesses* — the move that turns a
minor issue into a compromise. Each entry is "you have X → you can reach Y". Use it after you've
inventoried the raw weaknesses, to assemble them into chains.

## Escalation ladder — where each rung's win becomes the next start

- **Anonymous → any-user data:** an unauthenticated read endpoint, an IDOR on a public identifier,
  directory listing, an exposed `/debug`/`/metrics`/backup/source map, a verbose error leaking data.
- **Anonymous → a session:** auth bypass (route registered before the auth middleware; JWT `decode`
  not `verify`; `alg:none`; default/guessable secret), SQLi in login, password-reset token that is
  guessable or leaked, credential stuffing surface with no lockout.
- **Low-priv user → other users' data:** IDOR/BOLA (object fetched by request ID with no ownership
  predicate), missing tenant filter, a cache key without the tenant, over-broad API response the UI
  hides but the wire exposes.
- **Low-priv → admin:** mass assignment (`role`/`isAdmin` accepted in an update body), an admin route
  guarded only in the UI, a privilege check on the parent router bypassed by an earlier-registered
  route, forced browsing to an admin endpoint.
- **App access → code execution:** reachable command/template/deserialisation sink, file upload into a
  served or executable path, SSTI, prototype pollution reaching a gadget, a dependency's known RCE on
  a reached path.
- **Server foothold → secrets/lateral:** read env/config/`.env`, cloud metadata via SSRF, tokens in
  logs, DB creds in source, an over-scoped key that unlocks another service.

## Classic chains worth trying to assemble

- **Open redirect + token in URL → account takeover.** A redirect built from a request param, plus any
  flow that puts a token in the URL or `Referer` (OAuth `redirect_uri`, a magic link), lets you
  harvest it. Look for `res.redirect(req.query.*)`, `window.location = param`.
- **IDOR + mass assignment → privilege escalation.** Read another account's object by ID (IDOR to get
  the shape/ID), then write to it with fields the form never showed (`role`, `ownerId`).
- **Reflected value + missing CSP → XSS → session/token theft.** Injection point + tokens reachable
  from JS (`localStorage`, non-`HttpOnly` cookie). If the token is in `localStorage`, XSS = full ATO.
- **SSRF + cloud metadata / internal service → creds or RCE.** A server-side fetch from a user URL
  reaches `169.254.169.254`, an internal admin panel, or an unauthenticated internal API. Remember the
  bypasses: DNS rebinding, redirect to internal, decimal/octal/IPv6 forms of localhost.
- **Path traversal + file write → RCE / stored XSS.** Traversal on an upload/write path drops a file
  into a served or code-loaded directory. Traversal on read → source, `.env`, keys.
- **Prototype pollution + a downstream gadget → auth bypass or RCE.** A `__proto__` key in a merged
  body pollutes a default that a later check reads (`isAdmin`, a template option, a `child_process`
  option object).
- **Second-order injection.** Input stored benign, rendered/queried dangerously later. The source and
  sink are in different files — trace stored values, not just request-to-response.
- **Race / TOCTOU → double-spend or uniqueness bypass.** Two concurrent requests against a
  read-then-write on a balance, quota, coupon, or a "unique" check enforced in app code. Probe: fire N
  identical requests in parallel and compare the result to the sequential one.
- **Error verbosity + predictable IDs → full enumeration.** A stack trace or a distinct
  "not found" vs "forbidden" response oracle, plus sequential IDs, enumerates the whole table.

## Pivots for LLM / agent systems

- **Indirect prompt injection → tool abuse.** Attacker text lands somewhere the model later reads (a
  stored record, a fetched page, a retrieved doc, a filename, a prior tool result), carrying
  instructions. Impact = the union of the tools the agent can call. Map the tools first, then ask what
  the injection can make them do.
- **Model output → injection sink.** Completion used as SQL/shell/HTML/a URL without validation: the
  model is an untrusted source. Injection can steer the output into the payload.
- **Tool handler missing its own authorisation.** The tool runs with server privileges; if it trusts
  the model (or the prompt) for "who is allowed", prompt injection = privilege escalation.
- **Context exfiltration.** Get the model to emit its system prompt, another user's data in context, or
  a secret placed in the prompt — via injection or a crafted question.

## Bypass reflexes (assume the naive guard, look for the escape)

- Deny-list/`startsWith`/`includes`/regex host checks → `evil.com#@target`, `target.attacker.com`,
  case, trailing dot, userinfo `@`, unicode.
- Extension/`Content-Type` upload checks → double extension, null byte, content sniffing, `.svg`/`.html`.
- Path checks on the raw string → URL-encoded `..%2f`, decoded after the check; absolute paths; symlinks.
- SSRF localhost string block → `127.1`, `0.0.0.0`, `[::1]`, decimal/octal IP, DNS rebinding, redirect.
- Client-side validation / hidden fields / disabled buttons → replay the request directly; nothing
  server-side re-checks.
- Rate limit per-IP → rotate; per-account → the endpoints that don't need an account.

## How to probe safely (non-destructive proofs)

- RCE: run `id`, `whoami`, `echo <random-canary>` — never anything that writes or deletes. A reflected
  canary or an out-of-band DNS/HTTP callback the human controls proves execution without damage.
- SQLi: a boolean/time oracle (`' AND SLEEP(2)-- ` vs `' AND SLEEP(0)-- `), or `SELECT` of a harmless
  known value — never `UPDATE`/`DROP`/`INTO OUTFILE`.
- IDOR/authz: request *your own* second test account's object, or a canary record you created — not a
  real user's data.
- SSRF: point at a callback host the human owns; confirm the request arrives. Don't hit real internal
  services blind.
- Traversal: read a known-harmless marker file, not `/etc/shadow` or real secrets.
- Race: N parallel requests against a test resource; compare to sequential.

Every probe: one target the human authorised, minimal volume, read-only, reversible. If the only proof
would be destructive, describe it — don't run it.
