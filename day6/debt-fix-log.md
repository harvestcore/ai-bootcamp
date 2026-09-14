# Debt paydown log: `day6/rws-nopcommerce-team-paca-hc`

Working log of the items from [`debt-audit.md`](./debt-audit.md) as they get fixed. The fork
`rws-nopcommerce-team-paca-hc` is where the fixes land; upstream `rws-nopcommerce-team-paca` is
left untouched. One item per session, always two commits: a failing test first, then the fix.

---

## Environment notes (read before starting an item)

- **.NET 9 is now installed** at `~/.dotnet` (see [`log.md`](./log.md)); use
  `export DOTNET_ROOT=$HOME/.dotnet PATH=$HOME/.dotnet:$PATH` and leave `global.json` alone.
  The note below is kept for history and no longer applies:

- **No .NET 9 SDK or runtime on this machine.** Installed: 8.x and 10.x. `global.json` pins
  `9.0.100` with `rollForward: latestFeature`, so `dotnet` refuses to load at all in this repo.
  To build and test:

  ```sh
  # temporarily flip rollForward to latestMajor in global.json, then
  export DOTNET_ROLL_FORWARD=LatestMajor
  dotnet test src/Tests/Nop.Tests/Nop.Tests.csproj --filter "FullyQualifiedName~<Fixture>"
  # and restore global.json before committing
  ```

  `DOTNET_ROLL_FORWARD` is needed for the build too, not just the test run: the `Nop.Web`
  post-build step runs `ClearPluginAssemblies.dll`, which targets net9.0 and otherwise exits 150.
  **`global.json` must not end up in a commit.**
- `Nop.Tests` references `Nop.Web`, so anything in `Nop.Web.Framework` (migrations included) is
  reachable from tests. NUnit 4 + FluentAssertions 7 + Moq are already there.
- Tests that don't need the DI container should avoid `ServiceTest` — the migration tests below run
  in ~30ms because they mock `ISettingService` instead of booting the test host.

---

## Item 1 — `SecurityHardeningMigration` generated a 16-character encryption key ✅

Audit item **#1** (`Behavioural | Interest: High | Fix: Small`). Picked first: smallest possible
edit, and the only item where the live deployment was not in the state the findings docs recorded.

**The defect.** `EncryptionService` derives the AES key from `encryptionKey[0..16]` and the IV from
`encryptionKey[^16..]`. With a 16-character key those two spans are the same bytes, so `IV == Key`.
The change set raised the key to 32 in the install path (`InstallRequiredData`) and in the admin UI
(`SettingController` rejects `< 32`) for exactly that reason — but the migration, the only path that
runs against an already-seeded database, i.e. production, still generated 16. Its comment claimed
parity with `InstallRequiredData`, which it did not have.

**Commit 1 — `2324152` (failing tests).**
`src/Tests/Nop.Tests/Nop.Web.Tests/Framework/Migrations/SecurityHardeningMigrationTests.cs`, two
tests driving the migration's private static `RotateLeakedEncryptionKey` through a mocked
`ISettingService` via reflection:

- `CanRotateLeakedEncryptionKeyToAKeyTheAdminUiAccepts` — rotated key is ≥ 32 chars.
- `RotatedEncryptionKeyDoesNotUseTheAesKeyAsItsOwnInitialisationVector` — `key[..16] != key[^16..]`.

Both failed as expected: *"Expected rotatedKey.Length to be greater than or equal to 32, but found
16"* and *"Expected aesInitialisationVector not to be "GSftMASiB0uH0083""*.

**Commit 2 — `0c2446c` (fix).** `GenerateRandomAlphanumericCode(16)` → `(32)`, and the comment now
states the length and the reason instead of asserting a parity it didn't have. Both tests pass.

**Left open.** Audit open question 1: whether the production DB holds ciphertext encrypted under the
current key. No re-encryption pass was added — the security review found none live, and the rotation
is gated on the exact leaked value — but that should be confirmed against the live instance before
the next deploy.

---

## Item 2 — HTTPS hardening disabled behind two mutually-blocking comments ✅

Audit item **#2** (`Contextual/Process | Interest: High | Fix: Medium`). Taken second as the one
item actively hurting production: with `HostingConfig.UseProxy=false`, `X-Forwarded-Proto` is
ignored and every auth, antiforgery and session cookie was issued **without `Secure`** on a public
HTTPS store.

**The deadlock.** `render.yaml` said re-enable the env var *once the migration has run*; the
migration said re-enable *both together* and had its `[NopMigration]` attribute commented out, so
FluentMigrator could never discover it. Each comment named the other as its precondition.

**Open question 2 is answered, from the code.** Both can ship in one deploy. `Program.cs` awaits
`PublishAppStartedEventAsync()` — where `AppStartedConsumer` calls `ApplyUpMigrations(...,
MigrationProcessType.Update)` — *before* `app.RunAsync()`. `HttpsRequirementAttribute` only reads
`store.SslEnabled` per request, so neither inconsistent intermediate state is ever observable by a
client. The audit's Medium estimate was right to hedge, but it resolves to Small.

**Commit 1 — `d8c296e` (failing test).** `SecurityHardeningMigrationDiscoveryTests`: every
`MigrationBase` in the `SecurityHardening` namespace must carry `[NopMigration]` and must target
`MigrationProcessType.Update`. It sweeps the namespace rather than naming a class, so a future
migration shipped without the attribute fails too. Failed with *"StoreSslEnabledMigration is only
run if it carries [NopMigration]"*.

**Commit 2 — `92c2c33` (fix).** Attribute restored, `HostingConfig__UseProxy=true` uncommented, and
both comments rewritten to state the single-deploy ordering and "don't disable one half on its own"
instead of pointing at each other.

**Still needs a human.** The code change is done and the tests pass, but the thing that actually
failed last time was a deploy, and there is no test for a redirect loop. **Verify on staging, or on
a deploy someone is watching, before considering this closed.** If it loops, the rollback is to
revert this one commit — both halves together, never one.

---

## Item 6 — `--allow-untrusted` in the Dockerfile ✅ (unverified)

Audit item **#6** (`Dependency | Interest: Medium | Fix: Small`). Cheap-and-obvious batch.

**Commit — `7115f8a`.** Dropped `--allow-untrusted` from both `apk add` lines, so apk verifies
package signatures against `/etc/apk/keys` instead of only trusting TLS. The old comment claimed the
download "can't be MITM'd in transit" while the flag disabled the control that actually matters:
TLS proves we reached dl-cdn, the signature proves the package is Alpine's.

**Not verified, and this is the one item shipped on reasoning rather than a green check.** Docker is
unavailable in this environment — the same blocker the original `TODO` named. `alpine-keys` ships
the keys in the `aspnet:9.0-alpine` base, so it is expected to build, and the comment now records
the fallback: if a build fails with `UNTRUSTED signature`, install the key (`apk add --no-cache
alpine-keys`), don't re-add the flag. **The next image build is the test.**

No test was written: there is nothing in `Nop.Tests` that can meaningfully assert on Dockerfile
content without a brittle walk up to the repo root.

The unpinned Alpine `edge` repositories were deliberately left alone — inherited from upstream, and
the audit is right that bundling them buys nothing.

---

## Item 4 — import picture-path guard: wrong comparison base, silent rejection ✅

Audit item **#4** (`Behavioural | Interest: Medium | Fix: Small`). First of the behavioural items.

**Open question 3 is answered, and the answer is worse than the audit assumed.** Tracing it out:
`MapPath` strips a leading `/` and combines with `Root`, so it *re-roots absolute paths under the
content root* — an exported absolute path like `/app/wwwroot/images/x.jpg` becomes
`/app/app/wwwroot/images/x.jpg`. Meanwhile the allowed root was `GetAbsolutePath("images")`, i.e.
`wwwroot`-relative. So the guard accepted **only** a literal `wwwroot/images/...` spelling: both
`images/shirt.jpg` (what a sheet naturally uses) and the absolute path the export writes were
rejected. It was a wrong comparison base, not just a missing log line. The hard-coded `"images"`
also ignored `MediaSettings.PicturePath`, which is where every other caller looks via
`GetLocalImagesPath`.

**Commit 1 — `afb8868` (failing tests).** `ImportManagerLocalPicturePathTests`, four tests. Three
failed: the absolute spelling, the webroot-relative spelling, and the missing log line. The fourth
— that `/etc/passwd`, `../../../../etc/passwd` and `~/appsettings.json` are still rejected — passed
**before** the fix, deliberately, so it could prove the fix doesn't loosen the guard.

**Commit 2 — `1090b3c` (fix).** Allowed roots now use `GetLocalImagesPath(_mediaSettings)`; the
candidate is resolved for each spelling (absolute as-is, content-root, webroot) and every candidate
goes through the **unchanged** prefix containment check; rejection logs a warning naming the value.
All four pass, containment test included — accepting more spellings cannot admit a path outside the
allowed roots, because the comparison that decides is untouched.

The guard still fails closed, which the audit is right to call debt worth keeping. Silence was the
debt; the rejection stays.

---

## Item 3 — PBKDF2 cutover had no test ✅ (no bug found)

Audit item **#3** (`Behavioural | Interest: High | Fix: Medium`). The largest remaining item.

**Commit — `af02f11`.** One commit, not two: **no production bug was found.** All five tests passed
against the existing code, so the debt here was exactly what the audit said it was — the missing
coverage, not a defect behind it.

`CustomerPasswordUpgradeTests`, against a row written the way a pre-cutover row looks
(`PasswordFormat.Hashed`, plain fast hash, no prefix, no record of the algorithm): a legacy SHA512
hash still verifies; a verified legacy hash is rewritten as `PBKDF2$…` with a fresh salt; the
rewritten row verifies again on the next login *and* still rejects a wrong password; an
already-PBKDF2 password is not rewritten on every login; and a store configured with a third
algorithm uses its own rather than the fallback.

**Mutation-checked, because tests that never failed prove nothing.** Making
`GetHashedPasswordFormat` always report PBKDF2 fails four of the five.

**One wrong turn worth recording.** The configured-algorithm test first failed with
`WrongPassword`, which looked like the bug the audit predicted. It wasn't: `GetService
<CustomerSettings>()` returns a *different instance* from the one injected into the service, so the
setting never changed. A test that changes store configuration has to reach the injected instance.
Worth knowing before reading a similar failure as a finding.

---

## Item 5 — service-layer ownership checks report denial as success ⏸ deferred

Audit item **#5** (`Structural | Interest: Medium | Fix: Small`). **Not done, deliberately.**

`MoveItemToCustomWishlistAsync` returns `Task`, so "denied" and "moved" are the same value, and it
now reads the customer from `_workContext`, binding a `Nop.Services` method to an ambient HTTP
request.

**Why it's deferred, and not just "left for later":**

- **No live symptom.** The sole caller, `ShoppingCartController`, performs both ownership checks
  itself and returns a proper `success = false` before the service is ever reached. The service-side
  checks are unreachable belt-and-braces today. Nothing is currently wrong in production, which is
  the opposite of items #1 and #2.
- **The fix is a signature change, which is the expensive-when-wrong kind.** Passing the customer in
  as a parameter and throwing on denial means touching the caller and reasoning about call paths
  that don't exist yet. That is structural work, and the ordering rule puts it last for a reason.
- **It is blocked on a question only the team can answer:** is the service meant to be callable
  outside an HTTP request (a scheduled task, a plugin, admin impersonation)? If yes, the customer
  becomes a parameter and denial throws. If no, the `IWorkContext` dependency is fine and only the
  `void` return needs changing. Guessing decides the API shape for the next person on no evidence.
- **The payoff is entirely future-facing** — it pays off when a second caller appears, and the cost
  of waiting is that the next caller gets a method that returns normally and does nothing. That is a
  real cost, but a deferrable one, and the audit's own verdict is that it "will not wake anyone up".

**To pick it up:** get the answer to the question above, then it is a small, well-understood change
with a test per denial path. **Keep the duplicated ownership checks either way** — that duplication
is deliberate defence in depth after an IDOR finding.

---

## State after this pass

Eight commits on top of `91ffacc`, always test-then-fix except where noted:

| Commit | Item | What |
|--------|------|------|
| `2324152` / `0c2446c` | #1 | 16 → 32 character encryption key |
| `d8c296e` / `92c2c33` | #2 | HTTPS hardening re-enabled, both halves |
| `7115f8a` | #6 | Alpine signature verification (build not run) |
| `afb8868` / `1090b3c` | #4 | Import path guard + rejection logging |
| `af02f11` | #3 | PBKDF2 cutover coverage (no bug found) |

**Test suite: 1063 passed, 2 failed, 8 skipped.** The 2 failures (`CanPreparePaymentMethodModel`,
`PreparePaymentMethodModelShouldDependOnSettings`) are **pre-existing and unrelated** — verified by
running the full suite in a worktree at `91ffacc`, which fails the same two. They pass under a
filtered run and fail in a full run, so they are a test-isolation problem in an area none of this
work touched: a `kill-flakes` candidate, not a regression. 1050 (base) + 13 new tests = 1063.

**Nothing here has been pushed, and #2 has not been deployed.**

### Before this ships

1. **#2 needs a watched deploy.** The failure mode is a redirect loop that took the live site down
   once already. Revert `92c2c33` whole if it recurs — never one half.
2. **#6 needs one image build.** Docker was unavailable here.
3. **#1's open question is still open:** is there ciphertext in the production DB under the old key?
   If yes, rotating the key needs a re-encryption pass. The migration only rotates instances still
   holding the exact leaked value, and the security review found no live ciphertext, but that was
   not re-verified against the database in this pass.

---
## The ordering, in hindsight

The rule used: **hazardous first, cheap-and-obvious next, behavioural third, structural last.**

| # | Item | Class | Status |
|---|------|-------|--------|
| 1 | 16-character encryption key | Hazardous | ✅ fixed |
| 2 | HTTPS hardening disabled | Hazardous | ✅ fixed, needs a watched deploy |
| 6 | `--allow-untrusted` | Cheap-and-obvious | ✅ fixed, needs one image build |
| 4 | Import path guard | Behavioural | ✅ fixed |
| 3 | PBKDF2 cutover untested | Behavioural | ✅ covered, no bug found |
| 5 | Denial reported as success | Structural | ⏸ deferred — see above |

Two things the ordering got right and one it got wrong.

**Right:** doing the hazardous pair first meant the two items where production was genuinely not in
the state the findings claimed got fixed before anything cosmetic. And keeping the structural item
last was correct for a reason that only became visible on reading it closely — it is blocked on a
question, so any work done earlier would have been a guess at an API shape.

**Right:** writing the test first paid for itself twice, in both cases by *not* finding what was
expected. On #4, the failing test forced tracing `MapPath` properly, which showed the guard was
narrower than the audit thought (no spelling worked except one) — a log line alone would have left
the imports still broken. On #3, the tests found no bug at all, which is a real answer: the debt was
the absent coverage, exactly as the audit hedged.

**Wrong:** #6 was classed cheap-and-obvious, but "cheap" assumed it could be verified. It couldn't —
no Docker here — so it shipped on reasoning with a documented fallback. A one-line change you cannot
run is not in the same risk class as one you can, and it should have been ordered after the items
that had a green test, or held back with #5.

## Not on this list

Everything under *Debt worth keeping*, *Checked and ruled out* and *Outside scope* in the audit. The
two items in *Outside scope* are security findings, not debt — they go to `security-analyst`, not to
a cleanup pass:

- Session and antiforgery cookies without `Secure` — **resolved as a side effect of #2.**
- `IsPublicHttpUrlAsync` resolves DNS and then makes a separate request, so a rebinding attacker can
  still reach internal addresses between the two, and `100.64/10` (CGNAT) is not blocked. **Still
  open.** Untouched by #4, which only changed the non-URL branch of `DownloadFileAsync`.
