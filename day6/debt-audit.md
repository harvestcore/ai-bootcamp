# Debt audit: `day6/rws-nopcommerce-team-paca`

**Bar.** A bootcamp red/blue-team exercise on a nopCommerce 4.x fork, deployed live on Render. ~10,300 files, of which the team touched **25 code files / ~2,400 lines** (`git diff db40fb8..HEAD`). Everything else is upstream nopCommerce and out of scope. The work is almost entirely security remediation driven by `findings/*.md`, and the standard applied is the one that work implies: *does the fix actually hold in the deployed instance, and will the next person be able to tell?* The code quality is genuinely good — careful comments, idempotent migrations, timing-safe comparisons. The debt is concentrated where the fixes meet reality.

---

## 1. The hardening migration was written against the pre-hardening constants, so in production it re-creates the defect the same commit fixed elsewhere

`[Behavioural | Interest: High | Fix: Small | Confirmed]`

**Evidence** — `src/Presentation/Nop.Web.Framework/Migrations/SecurityHardening/SecurityHardeningMigration.cs:70`

```csharp
        securitySettings.EncryptionKey = CommonHelper.GenerateRandomAlphanumericCode(16);
```

`src/Libraries/Nop.Services/Security/EncryptionService.cs:77`

```csharp
        provider.Key = Encoding.ASCII.GetBytes(encryptionKey[0..16]);
        provider.IV = Encoding.ASCII.GetBytes(encryptionKey[^vectorBlockSize..]);
```

Same change set, two other sites, both moved to 32:

`src/Libraries/Nop.Services/Installation/InstallRequiredData.cs:1799` — `GenerateRandomAlphanumericCode(32)`, with the comment *"32 characters: the first 16 are the AES key and the last 16 the IV, so the IV is no longer the key itself"*. `src/Presentation/Nop.Web/Areas/Admin/Controllers/SettingController.cs:1849` — `newEncryptionPrivateKey.Length < 32` throws.

Second site, same root cause — `SecurityHardeningMigration.cs:138`:

```csharp
                Password = encryptionService.CreatePasswordHash(randomPassword, saltKey, customerSettings.HashedPasswordFormat),
```

while every other write path in the change set was switched to `NopCustomerServicesDefaults.PasswordHashFormat` (PBKDF2).

**What looks wrong.** The install path and the admin UI were raised to a 32-character key precisely so that AES `Key` and `IV` stop being the same 16 bytes. The migration — the only path that actually ran against the live database, since production was seeded, not installed — still generates 16. With AES's 16-byte block, `[0..16]` and `[^16..]` are the identical span, so the deployed instance has `IV == Key`, which is the exact condition the other two edits exist to prevent. The migration's own comment compounds it: it claims to use *"the same generator nopCommerce itself uses to create this key at install time"* and cites `InstallRequiredData` — which uses 32.

**What it costs.** Three concrete costs. The live store did not get the fix everyone believes it got, and the findings docs record it as remediated. The value the app wrote for itself (16 chars) is one the app's own admin UI now refuses to accept, so the first operator who opens Settings → Security and saves anything hits `EncryptionKey.TooShort` on a key they never chose — a confusing bug report whose cause is two files away. And the invariant "encryption key is ≥ 32 chars" is now enforced in one place and violated in another, so nobody can trust it when reading either.

**Might this be deliberate?** Almost certainly not — the migration's comment asserts parity with the install path that it does not have, which reads as the migration being written before, and not revisited after, the 16→32 decision. Worth confirming with whoever wrote `SecurityHardeningMigration` whether a shorter key was chosen to avoid re-encrypting existing ciphertext; the comment says no ciphertext was found live, which would remove that reason. Raising it to 32 also means any value already encrypted under the current key must be re-encrypted, so check the deployed DB for `Encrypted`-format settings first.

---

## 2. The HTTPS hardening is switched off in production behind two comments that block each other

`[Contextual/Process | Interest: High | Fix: Medium | Confirmed]`

**Evidence** — `render.yaml:52`

```yaml
      # TEMPORARILY DISABLED: with Store.SslEnabled=false in the DB, enabling this makes the app
      # correctly detect HTTPS and HttpsRequirementAttribute then 301s every request down to
      # http://, which the edge immediately bounces back to https:// - a redirect loop. Re-enable
      # once StoreSslEnabledMigration has actually run against the production DB.
      # - key: HostingConfig__UseProxy
      #   value: "true"
```

`src/Presentation/Nop.Web.Framework/Migrations/SecurityHardening/StoreSslEnabledMigration.cs:19`

```csharp
// TEMPORARILY DISABLED (attribute commented out so FluentMigrator won't discover/run this): paired
// with HostingConfig__UseProxy in render.yaml, which is also disabled for now. Re-enable both
// together - running this alone (without UseProxy) would flip the app into the opposite redirect
// loop, since HttpsRequirementAttribute would then see SslEnabled=true but the connection always
// reported as insecure.
//[NopMigration("2026-09-14 14:00:00",
```

**What looks wrong.** `render.yaml` says: re-enable the env var *once the migration has run*. The migration says: re-enable *both together*, and it cannot run at all because its `[NopMigration]` attribute is commented out — FluentMigrator discovers migrations by that attribute, so this class is now inert code that no path reaches. Following either comment literally is impossible: the precondition each states is the thing the other one disables. The "temporary" state is the only stable state the instructions permit, and nothing carries an owner, a date or a tracking issue.

**What it costs.** Two things, and the second is worse than the first. Right now, by the team's own analysis in `render.yaml:46-51`, `HostingConfig.UseProxy=false` means `X-Forwarded-Proto` is ignored and every auth, antiforgery and session cookie is issued **without the `Secure` flag** on a public HTTPS store — the regression this env var was added to fix. Separately, `StoreSslEnabledMigration` is now dead code that looks live: it is a normal-looking class in a `Migrations/` folder, and the next person to grep for migrations will count it as one that runs. The two-step ordering needed to escape (deploy with the migration enabled *and* the env var enabled in the same release) is knowledge that exists only in these two comments, which contradict each other.

**Might this be deliberate?** The disabling plainly is — commit `833308f "Comment temporarily"` was a live-site incident response, and reverting a redirect loop on a demo store is the right call under time pressure. The debt is not the rollback; it is that the exit path is unexecutable as written. Ask the author of `833308f` (`ngavrilas`) the single question the comments don't answer: **can both be re-enabled in one deploy?** From reading `HttpsRequirementAttribute`, they can — the migration runs at app start, before requests are served, so a single deploy flipping both lands in the consistent state. If that is right, this is a Small fix, not Medium; it is marked Medium because the ordering could not be tested against the live Render instance.

---

## 3. The PBKDF2 cutover has no test, and its failure mode is "nobody can log in"

`[Behavioural | Interest: High | Fix: Medium | Confirmed]`

**Evidence** — `src/Libraries/Nop.Services/Customers/CustomerRegistrationService.cs:135`

```csharp
    protected virtual string GetHashedPasswordFormat(CustomerPassword customerPassword)
    {
        if (customerPassword.Password?.StartsWith(HashHelper.Pbkdf2HashPrefix, StringComparison.Ordinal) ?? false)
            return NopCustomerServicesDefaults.PasswordHashFormat;

        var legacyFormat = _customerSettings.HashedPasswordFormat;

        return string.IsNullOrEmpty(legacyFormat) || legacyFormat == NopCustomerServicesDefaults.PasswordHashFormat
            ? NopCustomerServicesDefaults.LegacyHashedPasswordFormat
            : legacyFormat;
    }
```

`git diff --stat db40fb8 HEAD -- src/Tests` → empty. Not one test file was touched. The existing `src/Tests/Nop.Tests/Nop.Services.Tests/Customers/CustomerRegistrationServiceTests.cs` exercises `PasswordFormat.Clear` (lines 75, 93) and `PasswordFormat.Encrypted` (104, 115) against `ValidateCustomerAsync`, and touches `Hashed` only as the *target* of a change-password call at line 120 — never as a stored credential being verified.

**What looks wrong.** This function is a three-way discriminator (prefixed PBKDF2 / configured legacy algorithm / fallback `SHA512`) reconstructing a format that is not recorded in the row, driving both verification and the silent re-hash in `UpgradePasswordHashAsync`. It is the single most consequential branch in the change set and the only one whose correctness depends on stored data the tests never create. The specific untested behaviours: a pre-existing `SHA512` hash still verifies; that same row is rewritten as `PBKDF2$…` after a successful login and verifies again on the *next* login; and a store whose `_customerSettings.HashedPasswordFormat` is neither `SHA512` nor empty still uses its own algorithm rather than the fallback.

**What it costs.** Get any of those three wrong and every customer whose password predates the cutover is locked out, with `WrongPassword` and an incrementing `FailedLoginAttempts` — which, thanks to `EnableAccountLockout` in the same migration, now escalates to a 30-minute lockout after 5 tries. The bug is invisible in dev (fresh installs write PBKDF2 from the start, so `GetHashedPasswordFormat` only ever takes its first branch) and appears only against a seeded or migrated database. It is also silent: re-hashing happens as a side effect of login, so a broken `UpgradePasswordHashAsync` leaves passwords on the fast hash indefinitely with no signal.

**Might this be deliberate?** Skipping tests under bootcamp time pressure, yes. But the skip is not visible: nothing in the code or `findings/` records that the legacy-verify-and-upgrade path is unverified, so the next reader sees a well-commented function and assumes it is exercised. Ask whether the team ran a manual login against a seeded pre-PBKDF2 account, and if so, capture that as the test — it is the whole of the missing coverage. `Nop.Tests` is already in the solution, so there is no setup cost.

---

## 4. The import path guard fails closed and silent, against allowed roots that don't match how these paths are written

`[Behavioural | Interest: Medium | Fix: Small | Confirmed]`

**Evidence** — `src/Libraries/Nop.Services/ExportImport/ImportManager.cs:1113`

```csharp
        var allowedRoots = new[]
        {
            //where the import itself stages downloaded pictures
            _fileProvider.MapPath(ExportImportDefaults.UploadsTempPath),
            //the store's own picture directory
            _fileProvider.GetAbsolutePath("images")
        };
```

The two helpers resolve against **different** bases — `NopFileProvider.cs:507` `MapPath` combines with `Root` (content root), `NopFileProvider.cs:262` `GetAbsolutePath` prepends `WebRootPath` (`wwwroot`). And at `ImportManager.cs:1206`, a non-URL value now yields `string.Empty` on rejection, which is swallowed without a word at `ImportManager.cs:347` and `ImportManager.cs:417`:

```csharp
                if (string.IsNullOrEmpty(picturePath))
                    continue;
```

**What looks wrong.** A spreadsheet cell is turned into a candidate path by `MapPath` (content-root-relative) but validated against an allowed root built by `GetAbsolutePath` (`wwwroot`-relative). A value written as `images/shirt.jpg` resolves to `<content>/images/shirt.jpg`, which is not under `<content>/wwwroot/images/`, and is rejected. Only the fully-qualified `~/wwwroot/images/...` spelling survives. Whether that matters depends on which spelling the team's actual import files use — hence Probable on the *impact*; the root mismatch itself is Confirmed from the two helper bodies.

**What it costs.** The failure is indistinguishable from success. An import of a few thousand products reports no error, no warning and no log line, and simply arrives with missing images — and the person debugging it has to get from "some pictures didn't import" to a path-prefix comparison four call frames away, with nothing pointing there. That is a long afternoon the first time, and it recurs on every import.

**Might this be deliberate?** Failing closed is correct and deliberate — this guard exists to stop arbitrary server files being read through an import sheet, and it should stay. Silence is the debt, not the rejection. One question for the team: which of the two roots did you mean by "the store's own picture directory"? If the answer is `wwwroot/images`, the guard is right and only needs a log line; if it is the content-root `images`, the comparison base is wrong as well.

---

## 5. Service-layer ownership checks report denial as success

`[Structural | Interest: Medium | Fix: Small | Confirmed]`

**Evidence** — `src/Libraries/Nop.Services/Orders/ShoppingCartService.cs:1834`

```csharp
        //ensure that the shopping cart item belongs to the current customer
        var customer = await _workContext.GetCurrentCustomerAsync();
        if (shoppingCartItemFrom.CustomerId != customer.Id)
            return;

        //and that the wishlist it is moved into is the current customer's own
        if (wishlistId.HasValue)
        {
            var wishlist = await _customWishlistService.GetCustomWishlistByIdAsync(wishlistId.Value);
            if (wishlist == null || wishlist.CustomerId != customer.Id)
                return;
        }
```

The sole caller, `ShoppingCartController.cs:1878-1911`, performs the same two checks first and returns a proper `success = false` JSON for each — then calls this method, and unconditionally returns `Json(new { redirect = redirectUrl })`.

**What looks wrong.** Two things, one structural and one about layering. `MoveItemToCustomWishlistAsync` returns `Task`, so "denied" and "moved" are the same value; the controller can only answer "redirect". Today that is harmless because the controller's own guards catch everything first, which means these service-side checks are unreachable belt-and-braces — a second caller is exactly when they start mattering, and exactly when the void return hides the denial. Separately, the method changed from deriving the customer *from the cart item* to reading `_workContext.GetCurrentCustomerAsync()`, which binds a `Nop.Services` method to an ambient HTTP request: a scheduled task, a plugin or an admin-impersonation path calling it now silently no-ops rather than throwing.

**What it costs.** A future caller — a plugin, an admin tool, a bulk operation — gets a method that returns normally and does nothing, with no exception to catch and no log to read. That is the debugging session where you conclude the database is lying to you. Cheap now (one method, one caller); it gets more expensive with every caller added.

**Might this be deliberate?** The duplicated checks, yes — defence in depth after an IDOR finding, and worth keeping. The `void` return and the `IWorkContext` dependency look like the shortest edit that closed the finding rather than a decision. Ask whoever fixed the IDOR whether the service is meant to be callable outside a request; if yes, the customer should come back as a parameter and denial should throw.

---

## 6. `--allow-untrusted` survived the supply-chain fix it was part of

`[Dependency | Interest: Medium | Fix: Small | Confirmed]`

**Evidence** — `Dockerfile:44`

```dockerfile
# HTTPS + official CDN so the package download can't be MITM'd in transit.
# TODO: drop --allow-untrusted once verified the edge signing keys are present in the base image
# (requires a full image build to confirm the build still succeeds).
RUN apk add tiff --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/main/ --allow-untrusted
RUN apk add libgdiplus --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/community/ --allow-untrusted
```

**What looks wrong.** This is a `TODO` that would normally not be reported, but it does not merely defer work — it documents that the stated goal of the edit was not reached, in a comment whose first line claims it was. Moving `http://dl-3` to `https://dl-cdn` fixes transport, but `--allow-untrusted` means the package *signatures* are still not checked, which is the control that actually matters here; TLS only proves you reached the CDN. Both packages are also pulled unpinned from Alpine `edge` into a stable `aspnet:9.0-alpine` base, so two builds of the same commit can install different `tiff` and `libgdiplus` — that part is inherited from upstream nopCommerce, not introduced here.

**What it costs.** No integrity check on two native libraries installed into the production image, and an unpinned `edge` dependency that makes "it built last week, it fails today, nothing changed" a real and very annoying outcome. The `TODO` names the blocker honestly (needs a full image build) but has no owner and no date, and it sits in the one file nobody opens between incidents.

**Might this be deliberate?** The deferral is deliberate and reasonably justified — verifying the signing keys genuinely requires a full image build, which is slow. The question is just whether that build ever happened: ask whoever owns the Render deploy to run one build with `--allow-untrusted` removed. If it succeeds, this closes in one line. Treat the `edge`-pinning as a separate, inherited item — don't bundle the two.

---

## If you only fix three things

1. **#1, the 16-character key** — smallest possible edit (`16` → `32`), and it is the only item where the live deployment is currently *not* in the state the team's own findings record it as being in. Check for existing ciphertext before rotating.
2. **#2, the SSL deadlock** — not because the code is wrong but because the documented escape route provably cannot be followed, and until it is, the store issues non-`Secure` cookies. Likely one deploy once someone answers the ordering question.
3. **#3, the PBKDF2 tests** — the largest of the three, and the one that pays off in the scenario nobody wants to debug live.

#4, #5 and #6 are all real but none of them will wake anyone up.

## Debt worth keeping

- **Duplicated ownership checks** between `ShoppingCartController` and `ShoppingCartService` (#5). Deliberate defence in depth after an IDOR; the duplication is the point. Fix the `void` return, keep both checks.
- **`ImportManager` failing closed** (#4). Rejecting an unresolvable path is correct. Add a log line; don't loosen the guard.
- **Both the allow-list and the deny-list in `NopRoxyFilemanDefaults`.** Redundant by construction — the allow-list already subsumes the extended deny-list — but the deny-list is upstream's, and removing it for tidiness buys nothing and risks a merge conflict on every upstream pull.

## Checked and ruled out

- **New locale keys** (`Wishlist.NotFound`, `Wishlist.MultipleWishlistNotForGuest`, `Wishlist.NotAllowMultipleWishlist`) — all three already exist in `defaultResources.nopres.xml`; no missing-resource placeholders.
- **DI cycle from injecting `ICustomWishlistService` into `ShoppingCartService`** — `CustomWishlistService` depends only on `IRepository<CustomWishlist>`; no cycle.
- **`FixedTimeEquals` on differing-length byte arrays** (`CustomerRegistrationService.cs:127`, `CustomerService.cs:1486`) — short-circuits on length, so hash/token *length* leaks; for fixed-width hashes and GUID tokens this reveals nothing.
- **Ordinal vs. `InvariantCultureIgnoreCase`** in the recovery-token comparison — behaviour change is real but the token is a GUID; no reachable difference.
- **Entrypoint quoting in the generated `/app/entrypoint.sh`** — the `\"` escaping survives the `printf` correctly; a password containing `"` would break it, which the author already documents in the same block.
- **The `HtmlSanitizer` static field being shared** — `Sanitize` is thread-safe once configured, and the configuration is never mutated after `CreateHtmlSanitizer`.
- **`db/seed.sql` deletion + `.gitignore`** — the secrets remain in `db40fb8` and always will; the migration rotates them at the only layer that can be rotated, which is the correct response. Already recorded in `findings/security-review.md`.

## Open questions

1. **Is there ciphertext in the production database encrypted under the current key?** Determines whether #1 is a one-character edit or needs a re-encryption pass. Settled by querying `Setting` for `Encrypted`-format values and `Customer`/`Order` for encrypted fields on the live instance.
2. **Can `HostingConfig__UseProxy` and `StoreSslEnabledMigration` be re-enabled in the same deploy?** Reading `HttpsRequirementAttribute` says yes — migrations run at app start, before the first request. Settled by one staging deploy with both enabled; it decides whether #2 is Small or Medium.
3. **Which path spelling do the team's actual product-import sheets use** — `images/x.jpg` or `~/wwwroot/images/x.jpg`? Decides whether #4 is a missing log line or a wrong comparison base.

---

## Outside scope

Two things outside the audited scope, one line each. The current production state has session and antiforgery cookies issued without the `Secure` flag (consequence of #2), and `ImportManager.IsPublicHttpUrlAsync` resolves DNS and then makes a separate HTTP request, so a rebinding attacker can still reach internal addresses between the two, and `100.64/10` (CGNAT) is not in the blocked ranges. Both are security findings rather than debt — hand them to `security-analyst`, not to a cleanup pass.

No live credentials were found in the working tree; the ones in `db40fb8` are already documented and rotated.
