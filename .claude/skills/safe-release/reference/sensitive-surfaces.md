# Sensitive surfaces

A sweep list for the commit range, not a scoring rubric. Skip whole categories that genuinely do not
apply to this repo and say which ones you skipped — "no billing code exists in this project" is a
useful line. Every hit still needs a file, a quoted line and a named risk; appearing on this list is
not itself a flag.

The grep patterns are starting points for finding candidates in the diff, never evidence on their
own. Run them against the range, then read what they hit:

```
git diff <baseline>..HEAD --stat
git log <baseline>..HEAD -p -S'<pattern>'
git diff <baseline>..HEAD -- '<path glob>'
```

## Authentication, authorization and secrets

The classic "it worked on my machine, everyone is logged out in production" category.

- **Auth checks changed, added or removed** — a middleware, a guard, a decorator, a role comparison, a
  route moved from a protected group to an unprotected one. Removing a check is obvious; *reordering*
  one so it runs after the handler is the one that gets missed.
- **Session and token behaviour** — lifetimes, refresh logic, cookie flags (`httpOnly`, `secure`,
  `sameSite`), signing keys, algorithm choices. A changed signing secret invalidates every live
  session on deploy — that is a rollback symptom, not a bug.
- **Password and credential handling** — hashing parameters, reset flows, lockout thresholds.
- **Secrets in the diff.** Any literal that looks like a key, token or connection string. If you find
  one, stop and surface it: redact the value, say rotation is the fix, and note that reverting the
  commit does **not** un-leak it.

Patterns: `auth`, `login`, `session`, `token`, `jwt`, `password`, `permission`, `role`, `isAdmin`,
`secret`, `apiKey`, `Authorization`, `cookie`, `bcrypt`, `crypto`.

## Billing, payments and entitlements

Anything that moves money or gates paid capability. Errors here are visible to customers and to
finance, and are frequently not reversible by reverting code.

- Price, plan, currency, tax or discount values and the arithmetic around them — including rounding
  and unit changes (cents vs units is a recurring disaster).
- Charge, refund, invoice and subscription flows; webhook handlers from a payment provider;
  idempotency keys (removing one turns a retry into a double charge).
- Quota, limit, trial and entitlement checks — the gate that decides who gets the paid thing.

Patterns: `price`, `plan`, `charge`, `refund`, `invoice`, `subscription`, `stripe`, `paypal`,
`currency`, `amount`, `quota`, `limit`, `trial`, `entitle`.

## External APIs — both directions

- **Calls out**: a new third-party dependency at runtime, a changed endpoint, base URL, API version,
  timeout, retry policy or auth header. Ask what happens when it is slow or down — a new
  synchronous call on a hot path is a release risk even when the code is correct.
- **Interfaces others call**: routes added, renamed or removed; request or response shapes; status
  codes; event and message payloads; CLI flags; public exports of a package. **A removed or renamed
  field is a breaking change even when every in-repo caller was updated** — the callers you cannot
  see are the point.
- **Contract compatibility**: can the old client talk to the new server, and the new client to the old
  server? If not, the release is not independently rollbackable and you must say so.

Patterns: `fetch(`, `axios`, `http`, `https://`, `endpoint`, `baseUrl`, `webhook`, `router.`,
`app.get`, `app.post`, `socket.on`, `emit(`, `export `.

## Data migrations and schema

The highest-risk category, because reverting the code does not revert the data.

- Migration files added, edited or deleted; any change to a schema, a table, a column, an index or a
  constraint; `ALTER`, `DROP`, `CREATE TABLE`; changes to an ORM model that generate DDL.
- **Destructive operations** — dropping or renaming a column or table, narrowing a type, adding a
  `NOT NULL` without a default, backfills that rewrite rows. These need an explicit answer to "how do
  we get the data back?" and the honest answer is often "from a backup".
- **Editing an already-applied migration** rather than adding a new one — environments now disagree
  about what has run.
- **Code/schema coupling** — whether the new code runs against the old schema and vice versa. If it
  does not, order matters and you say which goes first.
- In a SQLite-file project (as in `day4/` here), the equivalent is any change to the file's shape or
  to code that writes it: the file *is* the production data.

Patterns: `migration`, `migrate`, `schema`, `ALTER`, `DROP`, `CREATE TABLE`, `NOT NULL`, `INDEX`,
`prisma`, `knex`, `sequelize`, `sqlite`.

## Configuration, environment and deployment

Changes that behave differently in production than on a laptop — the defining trait of this category.

- Environment variables read, added, renamed or removed. **A new required env var with no default is
  an instant production crash** even though every local run passes.
- Changed defaults — a timeout, a page size, a retry count, a log level, a feature flag's default
  value. A flag flipped on by default ships the feature, whatever the commit message says.
- Build, bundle, Docker, CI and deploy scripts; start commands; port and host bindings; `engines` and
  runtime version constraints.
- Dependency changes: new dependencies (new code you have not read), major version bumps (breaking by
  definition), removals, and lockfile changes that move versions without touching the manifest.

Patterns: `process.env`, `ENV`, `config`, `default`, `timeout`, `flag`, `Dockerfile`, `.github/`,
`package.json`, `lock`.

## Concurrency, jobs and background work

Failures here are silent and are noticed days later, which makes them bad rollback candidates.

- Scheduled jobs, cron entries, queue consumers and their retry or dead-letter behaviour.
- Anything touching locks, transactions, batching or ordering guarantees.
- Long-running work started at boot: it may keep running against the new code after a partial rollback.

## Deletions and removals

Run this as its own pass, because deletion rarely announces itself in a commit message:

```
git diff <baseline>..HEAD --diff-filter=D --name-only
git diff <baseline>..HEAD | grep '^-' | grep -v '^---'
```

Any deleted route, export, column, flag, config key or file is a flag until you have shown who used
it — and you cannot show that for consumers outside the repo.

## Blast radius modifiers

Not categories of their own; they raise or lower the risk of everything above, and belong in the
rollback note:

- **No test moved with the change.** Always stated in the flag.
- **Touches a hot path** — every request, every page load, startup — so a failure is total rather than
  partial.
- **Concentrated vs scattered.** Thirty files across six modules is harder to reason about, and harder
  to revert cleanly, than one rewritten module.
- **Fixes a previous release's bug.** Reverting re-introduces the original bug; say so.
- **Already partly deployed.** If any of this range is live somewhere, "roll back" means something
  different and you must find out what.
