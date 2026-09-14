# Release readiness: 91ffacc..864eca9

Repository: `harvestcore/rws-nopcommerce-team-paca` (fork of `makersacademy/rws-nopcommerce-team-paca`), branch `main`.
Date: 2026-09-14. Produced with the `safe-release` skill. Nothing was tagged, pushed, released or deployed.

**Baseline** — there are no tags in either repo, no version history and no changelog, so the baseline is not
a release marker but the deploy: `91ffacc` ("rename"), the current head of `makersacademy/main`, which is the
branch `render.yaml` auto-deploys. Everything below is what this fork's `main` carries that production does not.

**Range** — 10 commits, 17 files, +4377/−3736. Of those, 3719/3694 are a CRLF→LF renormalisation of one file
(see below); the real diff is about 700 lines, most of it new tests.

## What changed

Four things an operator would notice, and one they would not:

1. **The site starts trusting Render's proxy headers, and every store is switched to SSL-enabled** — the pair
   that a teammate disabled by hand in `833308f` after it took the live site down with a redirect loop. This
   release deliberately re-enables both, together.
2. **The container image now verifies Alpine package signatures** at build time. This has never been built.
3. **Product imports that reference local picture files start working** where they previously dropped the image
   silently, and rejected paths now appear in the log.
4. **A leaked encryption key is rotated to a longer one** — but only on a database that still holds the exact
   leaked value, and the key length change is the only part of that migration new in this range.
5. Not user-visible: the admin "Published" filter now maps identically in the grids and their exports (the PR
   merged earlier today), plus three commits of tests only.

## Areas affected

| Area | Commits | What changed | Notes |
|---|---|---|---|
| Deploy config (`render.yaml`, `Dockerfile`) | `92c2c33`, `7115f8a` | `HostingConfig__UseProxy=true` re-enabled; `--allow-untrusted` dropped from two `apk add` | Both flagged |
| Security migrations (`Nop.Web.Framework/Migrations/SecurityHardening/`) | `0c2446c`, `92c2c33` | Encryption key 16→32 chars; `StoreSslEnabledMigration` made discoverable | Both write to the live DB, neither is reversible |
| Import (`Nop.Services/ExportImport/ImportManager.cs`) | `1090b3c` | Local picture path resolution + warning log | Path-traversal guard; allow-list unchanged |
| Admin catalog filter | `1add511`, `864eca9` | Shared `ToOverridePublished()` | Behaviour-neutral for every value the UI posts |
| Tests only | `2324152`, `d8c296e`, `afb8868`, `af02f11` | 4 new test files, ~470 lines | No production code |

## Sensitive commits

### `92c2c33` Re-enable the HTTPS hardening: UseProxy and StoreSslEnabledMigration together — [Deploy config | Data write | Sessions/cookies]

**What it touches** — `src/Presentation/Nop.Web.Framework/Migrations/SecurityHardening/StoreSslEnabledMigration.cs:27` and `render.yaml:66`

```csharp
[NopMigration("2026-09-14 14:00:00",
    "Security hardening: enable SslEnabled on all stores to match HTTPS-only deployment",
    MigrationProcessType.Update)]
```

```yaml
- key: HostingConfig__UseProxy
  value: "true"
```

**Why it is flagged** — the attribute was commented out, so FluentMigrator never discovered this migration. It
now runs **for the first time** against the production database and sets `SslEnabled = true` on every row of
`Store`. Its `Down()` is empty, so reverting the code does not undo it. The env var and the migration are only
consistent *together*: either one alone produces a 301 redirect loop, which is exactly the outage `833308f`
was reverting. The in-repo safety argument — that `Program.cs` awaits `PublishAppStartedEventAsync`, where
Update migrations run, before `app.RunAsync` — is sound on reading, but it assumes the migration *succeeds*.
If it throws (DB permissions, connection), the container comes up with `UseProxy=true` and `SslEnabled=false`,
which is the loop.

**Tests** — `SecurityHardeningMigrationDiscoveryTests.cs` asserts the attribute is present and is an `Update`
migration. Nothing exercises the redirect behaviour, and nothing can: no test renders a request pipeline.

**Before shipping** — confirm the app can actually write to `Store` with the credentials in `DATABASE_URL`, and
watch the first request after deploy rather than assuming.

### `0c2446c` Generate a 32-character encryption key in SecurityHardeningMigration — [Crypto/secrets | Data write]

**What it touches** — `src/Presentation/Nop.Web.Framework/Migrations/SecurityHardening/SecurityHardeningMigration.cs:71` and `:28,:64`

```csharp
securitySettings.EncryptionKey = CommonHelper.GenerateRandomAlphanumericCode(32);
```

```csharp
private const string LeakedEncryptionKey = "9786194773409509";
if (securitySettings.EncryptionKey != LeakedEncryptionKey)
    return; //already rotated by an operator, or this instance never had the leaked value
```

**Why it is flagged** — it rotates a secret, and `Down()` is a deliberate no-op: **not reversible**. The guard
is good — it only touches a key still holding the leaked literal — but that same guard means the effect in
production is unknown from here: if the deployed database has already been rotated, this commit changes
nothing there; if it has not, a new key is written and anything encrypted under the old one stops decrypting.
The migration performs no re-encryption pass. The commit asserts a security review found no live ciphertext;
that claim is not verifiable from the repo.

**Tests** — `SecurityHardeningMigrationTests.cs` pins the 32-char length and that the derived IV differs from
the key. No test covers the decryptability of existing data, because no such data exists in the test DB.

**Before shipping** — one query against the production database: is `securitysettings.encryptionkey` still
`9786194773409509`? That single answer decides whether this commit is a no-op or an irreversible rotation.

### `7115f8a` Verify Alpine package signatures: drop --allow-untrusted — [Build | Dependencies]

**What it touches** — `Dockerfile:47-50`

```dockerfile
RUN apk add tiff --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/main/
RUN apk add libgdiplus --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/community/
```

**Why it is flagged** — it changes how the image is built, and by the commit's own admission it was never
built: Docker was unavailable. If the signing keys are absent from the base image, the build fails with
`UNTRUSTED signature`. That failure is fail-closed — no deploy happens — so the cost is a broken pipeline,
not a broken site. The Alpine `edge` repositories remain unpinned, which is pre-existing.

**Tests** — none possible; this needs a real image build.

**Before shipping** — `docker build .` once, locally. It is the whole check.

### `1090b3c` Make the import picture guard match how picture paths are actually written — [Path traversal | External interface]

**What it touches** — `src/Libraries/Nop.Services/ExportImport/ImportManager.cs:1118`, `:1125-1152`, `:1220-1230`

```csharp
_fileProvider.GetLocalImagesPath(_mediaSettings)
```

**Why it is flagged** — it widens which *spellings* of a path resolve before the allow-list check, on a guard
whose job is to stop imports reading files outside the pictures directory. The allow-root `StartsWith` check
itself is unchanged, so the set of admitted directories does not grow — but this is the kind of change where
that distinction is the whole security property. It also changes what an admin's import file is accepted to
mean, which is an external interface.

**Tests** — `ImportManagerLocalPicturePathTests.cs`, written before the fix and including a case asserting
traversal is still rejected.

**Before shipping** — nothing blocking; the traversal case is covered.

**Note on the same commit:** it renormalised `ImportManager.cs` from CRLF to LF, which is why the range looks
like 7400 changed lines. `git diff --ignore-all-space` reduces it to 30 insertions and 5 deletions. No runtime
effect, but it will conflict with any other in-flight branch touching that file.

## Rollback note

**Most likely symptom** — every page 301-redirect-loops and the store is unreachable, because `UseProxy` and
`Store.SslEnabled` ended up out of step. Second most likely: the deploy never completes, because the Docker
build fails on package signature verification.

**How you would notice** — the site returns `ERR_TOO_MANY_REDIRECTS` in a browser on the first request after
deploy; Render's log shows the container healthy and serving 301s. The build failure is louder and safer: it
shows up as a failed deploy in Render with `UNTRUSTED signature`, and production keeps running the old image.

**Fastest safe rollback** — reverting the code is **not sufficient on its own**, and this is the important
part. `git revert 92c2c33` removes the env var and re-disables the migration, but `Store.SslEnabled` is already
`true` in the database and `Down()` does nothing — so a code-only revert leaves you in the *other* redirect
loop. Both halves must move together:

```
git revert --no-commit 92c2c33
```

and, against the production database:

```sql
UPDATE "Store" SET "SslEnabled" = false;
```

Then redeploy. If only the build failed, there is nothing to roll back: the previous image is still serving.

**What a rollback will not undo** — the encryption key, if it was rotated (anything encrypted under the leaked
key stays undecryptable; there is no re-encryption pass and no stored copy of the old key); the deactivation
of the seeded `@nopCommerce.com` accounts and the `CustomerPassword` rows this migration inserts; the
`FailedPasswordAllowedAttempts`/`LockoutMinutes` defaults; and any warning rows the new import logging wrote.

**Safer shipping order** — ship the reversible part first. `1add511`, `864eca9`, `1090b3c` and the four
test-only commits carry no irreversible effect and could go alone. Then ship `92c2c33` and `0c2446c` as their
own deploy, at a time someone is watching, so that if the site loops you know which change did it. Shipping
all ten at once means the redirect loop and the key rotation land in the same minute, and the rotation is the
one you cannot take back.

## Verdict

**SHIP WITH CHECKS** — the risky changes are deliberate, argued in the code itself, and the coupling that
caused the previous outage is now documented in both files. Three things would clear it, and all three are
minutes of work:

1. `docker build .` succeeds without `--allow-untrusted`.
2. `SELECT value FROM "Setting" WHERE name = 'securitysettings.encryptionkey'` — is it still the leaked value?
3. Someone loads the site in a browser within a minute of the deploy finishing, with the SQL rollback above
   ready to paste.

Without (1) the deploy probably just fails, which is survivable. Without (3) the most likely failure of this
release is an outage nobody catches quickly. If you cannot do (2) before shipping, split the release as
described above and hold `0c2446c`.

## Checked and clear

Billing, payments, pricing and quotas: no change in range. Public routes, controllers' action signatures and
response shapes: unchanged except the admin export selection, which is behaviour-neutral for every value the UI
posts. Schema: no table, column or index is created, altered or dropped — the migrations write rows only.
Dependencies: no package reference added, removed or upgraded (`git diff` over `*.csproj` is empty). Deletions:
no production file, endpoint or flag is deleted; the only deletion in range is a test file renamed. Password
verification: unchanged — the PBKDF2 cutover is `ae29293`, an ancestor of the baseline, and `af02f11` adds
tests only.

## Open questions

- **Does the production database still hold the leaked encryption key?** Decides whether `0c2446c` is a no-op
  or an irreversible rotation. Only a query against the live DB answers it.
- **Has `StoreSslEnabledMigration` ever run anywhere?** It was undiscoverable until this range, so almost
  certainly not — but a store restored from a dump where `SslEnabled` was already true would change the risk.
- **Does the image build?** Unverified: no Docker available in this environment.
- **Is any live ciphertext encrypted under the old key?** The commit says a review found none; not verifiable
  from the repo.
- **There is no CI.** No `.github/workflows` exists and `render.yaml` is build-and-deploy only, so no test run
  gates this deploy. Every "green" in this document is from a local run of `dotnet test src/Tests/Nop.Tests`
  (1074 passed, 0 failed, 8 skipped) on this machine.
