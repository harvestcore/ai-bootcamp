# Category sweep

Work this list after taint-tracing, not instead of it. Skip whole sections the stack genuinely cannot
suffer and say which ones you skipped. The greps are for *finding candidates fast* — a grep hit is
never a finding, and the absence of a grep hit is never proof of safety. Read the code.

## Injection into an interpreter

| Sink | Look for | The real bug |
|---|---|---|
| Shell | `child_process.exec`, `execSync`, `spawn(..., {shell:true})`, `os.system`, `subprocess(..., shell=True)`, backticks, `Runtime.exec` | Any request value reaching the command string. `spawn(cmd, [args])` without a shell is safe; the shell variants are not, and quoting by hand is not a fix |
| SQL | string concatenation or template literals inside `query`/`execute`/`prepare`/`raw`, `db.exec(...)`, ORM `.raw()`/`whereRaw` | Interpolated values; also interpolated **identifiers**, `ORDER BY`, `LIMIT` and `IN (...)` lists, which parameter binding cannot cover — those need an allow-list |
| NoSQL | request body spread straight into a filter (`find(req.body)`), `$where`, `$regex` | Operator injection: a JSON body supplying `{"$ne": null}` where a string was expected. Validate types, don't just check presence |
| Templates | `eval`, `new Function`, `vm.runInNewContext`, Jinja/Handlebars/EJS compiled from user input | SSTI — reaches RCE in most engines |
| XML/YAML | `libxml` without `noent`, `yaml.load` (vs `safe_load`), DTD processing enabled | XXE: file read and SSRF; YAML deserialisation: object instantiation |
| Headers / logs | user data written into a header value or a log line without stripping `\r\n` | Response splitting; log forging that hides the rest of the attack |

## Authorisation — read this section even when nothing greps

The most common and most under-reported class. Pattern matching cannot find it; only reasoning about
ownership can.

- For **every** handler that takes an identifier from the request (path param, query, body, header,
  cookie, socket payload): find the line that proves the caller is entitled to that object. If the
  query is `SELECT * FROM x WHERE id = ?` with no owner/tenant predicate and no check after the fetch,
  that is IDOR.
- Unguessable IDs are not authorisation. Neither is "the UI never shows that button".
- **Vertical escalation:** is the admin check on the route, or only on the menu that renders the link?
  Is it applied to every method (`GET` guarded, `DELETE` forgotten)? Is it on the parent router but
  bypassed by a route registered before the middleware?
- **Mass assignment:** an update handler that passes the whole body into the ORM lets the caller set
  `role`, `isAdmin`, `ownerId`, `price`, `credits`. Look for `Object.assign(entity, req.body)`,
  spreads, `update(req.body)`, `**request.data`.
- **Multi-tenant:** every query needs the tenant predicate. One missing `WHERE tenant_id = ?` is a
  cross-tenant breach. Check the shared/cached layers too: a cache key without the tenant in it serves
  one tenant's data to another.
- Authorisation decided on the client, or passed from the client (`role` in a request body, a
  `X-User-Id` header trusted without verification, a JWT read with `decode` instead of `verify`).

## Authentication, sessions and tokens

- **JWT:** `jwt.decode()` used where `jwt.verify()` was meant; algorithm not pinned (`alg: none`,
  HS256/RS256 confusion); signature verified but `exp`, `aud`, `iss` ignored; secret from a default or
  a literal; no revocation path where one is needed.
- **Passwords:** stored with `md5`/`sha1`/`sha256` or unsalted, instead of bcrypt/scrypt/argon2; no
  work-factor; comparison with `==` on a hash (use the library's own compare); reset tokens that are
  guessable, long-lived, single-use only in theory, or leaked in a redirect/`Referer`.
- **Sessions:** cookies without `HttpOnly`, `Secure`, `SameSite`; session ID not rotated on login
  (fixation); logout that clears the client cookie but leaves the server session valid; "remember me"
  tokens stored in plaintext.
- **Timing:** secret/token comparison with `===` rather than a constant-time compare, on anything an
  attacker can retry.
- **Anonymous reachability:** compare the route inventory against the auth middleware. The finding is
  usually one route registered outside the guarded router.

## Secrets

- Literals in source: `password =`, `api_key`, `secret`, `token`, `Bearer `, `-----BEGIN`, `AKIA`,
  `sk-`, `ghp_`, connection strings with credentials.
- **Git history**, not just the working tree: `git log -p -S'<marker>'`, `git log --all --diff-filter=A
  -- '*.env*'`. A secret removed in a later commit is still exposed.
- `.env` files tracked by git; `.gitignore` missing them; `.env.example` filled with real values.
- **Secrets shipped to the browser:** anything in a client bundle, and in particular a real secret
  behind a build-time public prefix (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `PUBLIC_`) — that prefix
  means "compiled into JS that every visitor can read".
- Secrets in logs, error responses, stack traces, telemetry, or URLs (query strings end up in proxy
  logs and `Referer`).
- Overly-broad tokens: a deploy key or API key with write scope where read would do.

## Files and paths

- Path traversal: request data reaching `path.join`/`open`/`readFile`/`sendFile`/`createReadStream`
  without resolving and then checking the result is inside the intended root (`..%2f` decodes after
  your check if you check the raw string).
- Uploads: type trusted from the client (`Content-Type`, extension) instead of content; filename used
  as the stored path; no size limit; files written inside a served static directory (upload `.js`/
  `.html` → stored XSS or worse).
- Archive extraction: entries with `..` or absolute paths (zip slip), symlink entries, decompression
  bombs.
- Temp files created with predictable names in a shared directory; permissions wider than needed.

## Server-side requests (SSRF)

- Any URL from a request reaching `fetch`/`axios`/`request`/`curl`/an image fetcher/a webhook/a
  PDF-or-screenshot renderer.
- Blocking `localhost` by string match is not a fix: `127.0.0.1`, `[::1]`, `0.0.0.0`, decimal/octal IPs,
  a DNS name that resolves to a private range, redirects to one, and cloud metadata endpoints
  (`169.254.169.254`) all get past it. The fix is an allow-list plus resolving and checking the IP, with
  redirects disabled or re-checked.
- Blind SSRF still matters: internal POSTs, port scanning by timing.

## Deserialisation and object handling

- `pickle`, `yaml.load`, Java/`.NET` native deserialisation, `node-serialize`, `unserialize()` on
  untrusted bytes — treat as RCE.
- **Prototype pollution (JS):** recursive merge/clone/`set`-by-path helpers, `Object.assign` into a
  fresh object from a parsed body, query parsers that build nested objects — a `__proto__`/`constructor`
  key mutating `Object.prototype` turns into auth bypass or RCE downstream. Check for
  `Object.create(null)`, key filtering, or a schema parse.
- `JSON.parse` output used as if it matched a TypeScript type: types vanish at runtime. Find the
  validation boundary (zod/valibot/ajv/pydantic or hand-written); if there isn't one, every downstream
  assumption is attacker-controlled.

## Browser-side

- XSS sinks: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`,
  `dangerouslySetInnerHTML`, `v-html`, `[innerHTML]`, `eval`, `setTimeout("string")`, jQuery `.html()`,
  and `href`/`src` set from data (`javascript:`, `data:`).
- Markdown/rich-text rendered without sanitising; a sanitiser configured with `ALLOW_UNKNOWN_PROTOCOLS`
  or used after the HTML was already inserted.
- `postMessage` handlers that don't check `event.origin`; `window.opener` reachable without
  `rel="noopener"`.
- CORS: `Access-Control-Allow-Origin` reflecting the request's `Origin` **with** credentials allowed,
  or a wildcard on an authenticated API; `Origin` checked with `startsWith`/`includes` (so
  `evil-example.com.attacker.net` passes).
- Tokens in `localStorage` where an XSS is reachable; CSRF on cookie-authenticated state changes
  (`SameSite=None` or a top-level GET that mutates).
- Redirects built from request data (open redirect → phishing and token theft via fragment).

## Real-time / event transports (WebSocket, Socket.IO)

- Is the connection authenticated at handshake, and is the identity **re-checked per event**, or does
  the server trust a `userId`/`room` the client sends with each message?
- Can a client join or emit into an arbitrary room/channel it does not belong to?
- Is per-connection state keyed by socket id but looked up by client-supplied key?
- Missing origin check on the upgrade (cross-site WebSocket hijacking — `SameSite` does not protect it).
- Unbounded message size/rate, and unbounded server-side state per connection.

## Crypto

- `Math.random()`, `Date.now()`, incrementing counters or UUIDv1 used for tokens, session IDs, reset
  codes, nonces — anything unguessable is required. Use the CSPRNG (`crypto.randomBytes`,
  `crypto.getRandomValues`, `secrets`).
- ECB mode, a hardcoded or reused IV/nonce, encryption without authentication (no GCM/no MAC),
  key derivation by hashing a password once.
- Home-rolled crypto or signature schemes; signatures verified over a different string than the one
  used; MAC compared non-constant-time.

## Business logic and concurrency

- Signs and bounds: negative quantities/amounts, zero, overflow, float money, rounding in the
  attacker's favour.
- Totals, prices, discounts or permissions computed client-side and accepted.
- Replay: a request that can be sent twice (double-spend, double-redeem), missing idempotency key.
- Order of operations: a state machine that accepts a step out of sequence (ship before pay, verify
  after activate).
- **TOCTOU / races:** read-then-write on a balance/quota/uniqueness without a transaction, a row lock,
  or a DB constraint. Uniqueness enforced only by a preceding `SELECT` is not uniqueness. Two
  concurrent requests are the test.
- Quota/rate limits enforced per-process while the service runs multiple processes.

## Availability

- ReDoS: a regex with nested quantifiers or alternation applied to user input; check any regex used on
  a request field.
- Unbounded work from one request: no pagination cap, `limit` taken from the query unchecked, recursion
  depth from the payload, decompression, image resizing, `JSON.parse` of an unbounded body.
- Missing body-size limits on upload/JSON endpoints.

## Dependencies and supply chain

- Lockfile present and committed? Versions pinned, or floating (`^`, `*`, `latest`, a git branch)?
- `npm audit` / `pip-audit` / `cargo audit` findings **triaged for reachability**, not pasted.
- Dependencies with install scripts, or that arrived recently from an unknown publisher;
  names that look like typosquats of a real package.
- CI/CD: workflow triggers that run untrusted code with secrets (`pull_request_target`), actions
  pinned by tag rather than SHA, secrets echoed into logs, a step interpolating
  `${{ github.event.* }}` into a shell.

## LLM, agent and tool wiring

Treat this as a first-class surface whenever the code calls a model.

- **Prompt injection, direct and indirect.** Any text the model reads — user input, a fetched page, a
  retrieved document, a file, a tool's output, another model's output — is attacker-controlled and can
  instruct the model. The question is never "can it be injected" (it can); it is **what the injected
  instruction is able to do**: which tools are exposed, with which privileges.
- Model output used as code, SQL, a shell command, a URL, or HTML without validation — the model is an
  untrusted source, not a trusted one.
- Tool/function handlers that don't re-authorise the caller: the tool runs with the server's
  privileges, so the authorisation check belongs in the tool, not in the prompt telling it to behave.
- Secrets, other users' data, or system prompts placed where the model can echo them back.
- No cap on tool-call loops, spend, or output size; user-supplied model names, temperatures or system
  prompts; user input concatenated into the system prompt rather than passed as a user message.
- Logged prompts and completions containing PII or credentials.

## Data at rest, privacy, and exposure

- PII/credentials stored unencrypted where the threat model expects otherwise; database file
  permissions; backups.
- Error handling: stack traces, SQL text, internal paths or dependency versions returned to the client;
  a debug flag or verbose error handler on by default.
- Exposed endpoints and files: `/debug`, `/metrics`, `/.git`, `/.env`, source maps, admin UIs, a static
  directory rooted higher than intended (`express.static(__dirname)`).
- Excessive data in a response the UI doesn't use (password hashes, other users' emails, internal
  flags) — the API response is the boundary, not the screen.
- Logging: tokens, passwords, session IDs, full request bodies, card/PII data.
