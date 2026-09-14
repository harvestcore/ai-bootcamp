# Issue triage — rws-nopcommerce-team-paca

Repository: `makersacademy/rws-nopcommerce-team-paca`
Date: 2026-09-14
Scope: all 5 open issues (label `maintenance-batch`), triaged with the `triage` skill.
Nothing was edited, built, run or deployed. Every conclusion below is static reading of the source.

## Summary

| # | Title | Category | Risk | Verdict |
|---|---|---|---|---|
| 1 | Blog comment timestamps show server time, not the visitor's local time | ambiguous scope | High | HUMAN-REQUIRED |
| 2 | Footer copyright year is hardcoded | ambiguous scope | Medium | HUMAN-REQUIRED |
| 3 | Compare-list button doesn't flip to "Remove" after adding a product | ambiguous scope | Medium | HUMAN-REQUIRED |
| 4 | Cart and email receipt totals sometimes differ by a cent or two | needs-human (money) | High | HUMAN-REQUIRED |
| 5 | Admin product CSV export ignores the grid's Published filter | ambiguous scope | High | HUMAN-REQUIRED |

**Nothing in this backlog is safe to queue for an autonomous loop as written.** That is not caution for its own sake — it is one recurring pattern:

- **Four of five issues state a premise the code contradicts.** #2 says the year is hardcoded (it is `DateTime.Now.Year`). #3 says "the wishlist button already does this" (no such behaviour exists anywhere in the repo). #4 says the two totals round differently (they call the same helper). #5 says the export ignores the filter (it reads, maps and applies it) — and the CSV format named does not exist at all.
- **The test suite cannot referee.** Several of the "covering" tests are tautological or shadow reimplementations: `BlogModelFactoryTests.cs:277` re-runs the production conversion on both sides of the assertion; `ProductModelFactoryTests.cs` asserts the factory against a hand-copied duplicate of itself. An agent's fastest route to green is to edit the oracle.
- **`main` auto-deploys to Render.** A confidently-wrong green PR reaches a live store.

The common unblocker is small: a maintainer answering one question per issue. Most of these are then either a configuration change with no code, or a bounded SEMI-AUTOMATE with a regression test written first.

Cross-cutting unknown: no test-running CI workflow was found in the repo — `render.yaml` is build-and-deploy only. Whether `src/Tests/Nop.Tests` runs on push is unverified, and it matters for every issue below.

---

## #1 — Blog comment timestamps show server time, not the visitor's local time

**Verdict: HUMAN-REQUIRED** · ambiguous scope · risk High
<https://github.com/makersacademy/rws-nopcommerce-team-paca/issues/1>

**The blog code is not buggy.** `BlogModelFactory.cs:288` already calls `ConvertToUserTimeAsync(blogComment.CreatedOnUtc, DateTimeKind.Utc)`, rendered at `Views/Blog/BlogPost.cshtml:135`. The symptom comes from the platform-wide definition of "user time": `DateTimeHelper.GetCustomerTimeZoneAsync` (`DateTimeHelper.cs:152-173`) returns the store default unless `AllowCustomersToSetTimeZone` is on, and `DefaultStoreTimeZone` (`:191-207`) falls back to `TimeZoneInfo.Local` — the server's zone. Install defaults are `DefaultStoreTimeZoneId = string.Empty, AllowCustomersToSetTimeZone = false` (`InstallRequiredData.cs:1885-1886`).

nopCommerce has **no visitor-local-time concept at all**. So "the fix" is a choice between three different things: flip an admin setting (zero code), render client-side from a UTC `datetime` attribute (new, site-wide), or just label the zone.

- **Blast radius.** The real cause is a shared helper behind 29 `ConvertToUserTimeAsync` call sites — news (`NewsModelFactory.cs:225`), product reviews (`ProductModelFactory.cs:1770,1901`), forums (`ForumModelFactory.cs:397,873`), profiles, JSON-LD, plus the whole admin area. A wrong offset is silent: nothing crashes, dates are just wrong everywhere. Scoping a fix to blog comments alone would make one page disagree with the rest of the store.
- **Test surface.** `BlogModelFactoryTests.cs:266 CanPrepareBlogPostComment` would **not** catch a wrong fix — line 277 asserts against a re-run of the production conversion, so expected and actual move together. `DateTimeHelperTests.cs:87,102,117` pin the current store-zone semantics and are the only real assertions in the area. No test renders the view.
- **Needed test.** Hardcoded expected value, not a re-run: `CreatedOnUtc = 2026-01-01T12:00:00Z` with a known customer zone must produce a literal expected local `DateTime`; plus a case pinning the `DefaultStoreTimeZoneId = string.Empty` fallback.
- **What would change the verdict.** One line from a maintainer. If the answer is "set the store time zone in admin", this is a configuration change and not a code issue. If it is "render all public timestamps browser-side, site-wide", it becomes a specifiable small feature — SEMI-AUTOMATE once the hardcoded-offset test exists.
- **Unknowns.** The deployed store's actual `DefaultStoreTimeZoneId` / `AllowCustomersToSetTimeZone` live in the database, not the repo — if they are still install defaults, configuration explains the entire symptom. Reporter's own zone and login state unknown; no repro steps, no comments.

---

## #2 — Footer copyright year is hardcoded

**Verdict: HUMAN-REQUIRED** · ambiguous scope · risk Medium
<https://github.com/makersacademy/rws-nopcommerce-team-paca/issues/2>

**It is not hardcoded.** `Views/Shared/Components/Footer/Default.cshtml:24`:

```razor
<span class="footer-disclaimer">@T("Content.CopyrightNotice", DateTime.Now.Year, Model.StoreName)</span>
```

and `defaultResources.nopres.xml:17918-17920` defines `Copyright &copy; {0} {1}. All rights reserved.` — `{0}` is the year, passed at render time. `grep -rln "CopyrightNotice"` over `src` returns exactly those two files; no theme override exists (`Themes/DefaultClean/Views/` has only `_ViewImports.cshtml` and `Shared/Head.cshtml`). `git log` on the view shows a single `Initial commit` — unmodified upstream nopCommerce, no planted defect.

So the real fix is one of: (a) nothing; (b) an **admin-side edit** to a database-stored locale resource whose value has a literal year baked in; (c) a timezone refinement — `DateTime.Now` uses the *server's* zone, so on a UTC Render instance the year rolls at UTC midnight regardless of store locale. (c) is a behaviour decision, not a task.

- **Risk.** The likely agent failure is editing `defaultResources.nopres.xml`, which is **installation seed data only** and has no effect on an already-installed store — a plausible, useless, green PR. The alternative failure is hardcoding a year into the view, making the alleged bug permanent. The footer renders on every page, though a bad edit is trivially revertable.
- **Test surface.** `CommonModelFactoryTests.cs:148 CanPrepareFooterModel` asserts only `StoreName` and `HidePoweredByNopCommerce`. The year is not in `FooterModel` at all — it is computed in Razor, and no test renders a view. Any regression ships unnoticed.
- **Needed test (only if code changes).** Render the footer component, or assert `Content.CopyrightNotice` formatting against a clock the test controls, so a literal year fails. This requires introducing Razor view-rendering or an injectable clock into a suite that has neither — not a small ask.
- **What would change the verdict.** The reporter saying what the live footer actually shows. Literal past year → admin locale-resource edit, no code, no PR. Correct year → close as not reproducible. Either answer resolves this in minutes.
- **Unknowns.** Whether the deployed store's `Content.CopyrightNotice` was overridden in the database; whether the instance was installed fresh or restored from a seeded dump.

---

## #3 — Compare-list button doesn't flip to "Remove" after adding a product

**Verdict: HUMAN-REQUIRED** · ambiguous scope · risk Medium
<https://github.com/makersacademy/rws-nopcommerce-team-paca/issues/3>

**The stated precedent does not exist.** The issue says "the wishlist button already does exactly this". A repo-wide grep for `RemoveFromWishlist`, `IsInWishlist`, `InWishlist` across `*.cs`, `*.cshtml`, `*.js`, `*.xml` returns **zero hits**. The only conditional text on the wishlist button is an edit-mode label (`_AddToWishlist.cshtml:7`); `_ProductBox.cshtml:136` is unconditional. An agent told to copy the wishlist will invent the reference implementation.

This is therefore a **new feature across four layers**, not a label change: a membership flag on `ProductDetailsModel`/`ProductPriceModel`, populated in `ProductModelFactory` from `ICompareProductsService.GetComparedProductsAsync()`; a new localization resource; an AJAX remove endpoint (today's remove is a GET + redirect); and JS in `public.ajaxcart.js` to mutate the clicked button.

- **Blast radius.** `_CompareProductsButton.cshtml:8`; `_ProductBox.cshtml:128-131`, a partial rendered from ≥9 call sites (category, manufacturer, homepage, best-sellers, related, cross-sell, also-purchased, recently-viewed); `ProductModelFactory.cs:440,1538`; `ProductController.cs:502-531` plus `RemoveProductFromCompareList`; `public.ajaxcart.js:111-121` and `success_process` at `:135-174`, which today never touches the clicked button; `CompareProductsService.cs` (cookie store, `HttpOnly = true` at `:76`); a new `Products.Compare.RemoveFromCompareList` resource, which in nopCommerce means a **data migration against the live Render database**; and CSS — no active/added state class exists for `.add-to-compare-list-button`.
- **Test surface — and a trap.** `ProductModelFactoryTests.cs` (`:54`, `:88`, `:97`) keeps a hand-copied shadow reimplementation of the factory (e.g. `priceModel.DisableAddToCompareListButton = !_catalogSettings.CompareProductsEnabled;` at `:189` and `:402`) and asserts property-for-property equality. Adding a field fails the test until the shadow copy is edited — so an unattended loop's fastest route to green is to **edit the oracle**, producing a passing suite that verifies nothing. There is no `CompareProductsServiceTests` at all; nothing covers cookie round-tripping or the `CompareProductsNumber` truncation at `CompareProductsService.cs:157`.
- **Needed test.** After `AddProductToCompareListAsync(id)` the prepared model reports the product as in the list; a non-added product does not; a product evicted by the `CompareProductsNumber` cap flips back.
- **What would change the verdict.** One line of intended UX, e.g. *"server-render the button as Remove when the product id is in the `NopCompare` cookie, label `Products.Compare.RemoveFromCompareList`, no JS flip"*, plus a ruling that a locale-resource migration is acceptable. Then SEMI-AUTOMATE — with a human checking the migration, the `_ProductBox` call sites, and that the shadow factory was updated honestly rather than to silence a failure.
- **Unknowns.** Whether the reporter was describing a different deployment or a mock. Zero comments, no screenshots, no repro steps.

---

## #4 — Cart and email receipt totals sometimes differ by a cent or two

**Verdict: HUMAN-REQUIRED** · needs-human (money) · risk High
<https://github.com/makersacademy/rws-nopcommerce-team-paca/issues/4>

**The prescribed fix is wrong and dangerous.** The issue asks to round "plain 2 decimal places" on both sides. Both paths already call the *same* helper — cart via `ShoppingCartModelFactory.cs:1268` → `PriceFormatter.cs:292-293`, email via `MessageTokenProvider.cs:814-815` → the same line:

```csharp
//we should round it no matter of "ShoppingCartSettings.RoundPricesDuringCalculation" setting
price = await _priceCalculationService.RoundPriceAsync(price, targetCurrency);
```

The difference is **which currency** each path rounds against, which the issue does not diagnose. Two candidate mechanisms, neither confirmed:

1. **Unresolvable currency code.** `PriceFormatter.cs:190-193` falls back to `new Currency { CurrencyCode = currencyCode }` when `GetCurrencyByCodeAsync` returns null. A synthesised currency has `RoundingTypeId = 0` = `Rounding001` (plain 2 dp), while the cart cash-rounds against the real working currency. Triggered if the order's `CustomerCurrencyCode` names a deleted or deactivated currency.
2. **Double rounding across a conversion.** The cart rounds the converted amount; the email rounds `ConvertCurrency(order.OrderTotal, order.CurrencyRate)` of a base amount already rounded at `OrderTotalCalculationService.cs:1360-1361` (when `RoundPricesDuringCalculation` is on).

**The reported 14.98 → 15.00 is exactly `Rounding005Up`** (`PriceCalculationService.cs:535-549`). That is consistent with cash rounding applying on one side only — meaning the "cosmetic display mismatch" framing may be wrong and **the charged amount may genuinely differ from the displayed one**.

- **Risk.** "Plain 2 decimals" at `PriceCalculationService.cs:521` deletes `Rounding005Up`/`Rounding05`/`Rounding1` — changing what is **charged** on currencies like CHF or HUF. The code says so explicitly at `:506-507`: *"some currencies (e.g. Hungarian Forint or Swiss Franc) use non-standard rules for rounding"*. And `main` auto-deploys to Render with no pipeline gate.
- **Blast radius.** `RoundPriceAsync`/`Round` (`PriceCalculationService.cs:504`, `:521`) has ~25 callers in `OrderTotalCalculationService.cs` alone, plus `PriceFormatter.cs:293`, `PaymentService.cs:154-157`, `ShippingService.cs:606`. It feeds `OrderProcessingService.cs:388-396`, which persists `Order.OrderTotal` — the amount actually charged.
- **Test surface.** The one real guardrail is `PriceCalculationServiceTests.cs:171-211 CanRound` — ~40 `[TestCase]`s across every `RoundingType`; a naive `Math.Round(x, 2)` fails most of them immediately. `WorkflowMessageServiceTests.cs:256,276` assert only that a message was **queued**, never the rendered total. There is no `PriceFormatterTests.cs` and no `MessageTokenProviderTests.cs`. Nothing tests cart-total-equals-email-total.
- **The likely agent failure:** do what the issue says, watch `CanRound` go red, and "fix" the failing test cases.
- **Needed test.** For a `Rounding005Up` currency and a 14.98 base order: the cart string, the email-rendered total **and** the persisted `Order.OrderTotal` must all agree. The third assertion is the one that matters — agreement must not be bought by changing what the customer pays.
- **What would change the verdict.** The affected order's currency configuration: does `CustomerCurrencyCode` resolve to a live currency, and what is its `RoundingTypeId`? If the store runs a single `Rounding001` currency and it is mechanism (2), this becomes a bounded SEMI-AUTOMATE — round once, at `MessageTokenProvider.cs:814`, test first.
- **Unknowns.** No order id, currency, or `RoundPricesDuringCalculation` value in the issue; no running instance checked; which mechanism fires is unconfirmed; whether cart or email total is the one actually charged was not traced through payment capture.

---

## #5 — Admin product CSV export ignores the grid's Published filter

**Verdict: HUMAN-REQUIRED** · ambiguous scope · risk High
<https://github.com/makersacademy/rws-nopcommerce-team-paca/issues/5>

**The filter is applied, and there is no CSV export.** `ExportExcelAll` maps the grid filter and passes it to the query — `ProductController.cs:2835-2853`:

```csharp
//0 - all (according to "ShowHidden" parameter)
//1 - published only
//2 - unpublished only
bool? overridePublished = null;
if (model.SearchPublishedId == 1) overridePublished = true;
else if (model.SearchPublishedId == 2) overridePublished = false;

var products = await _productService.SearchProductsAsync(0, ..., showHidden: true, overridePublished: overridePublished);
```

The identical block exists in `ExportXmlAll` (`:2753-2771`) and `DownloadCatalogAsPdf` (`:2698-2716`); the service applies it at `ProductService.cs:842-843`. The dropdown posts 0/1/2 (`ProductModelFactory.cs:732-747`), is bound to `SearchPublishedId` (`Views/Product/List.cshtml:178`), and the export button (`:63`) is a plain submit inside the same form as the filter panel (`:19`–`:329`) — so the value *is* posted. And there is no CSV: `IExportManager` exposes only `ExportProductsToXmlAsync` (`:56`) and `ExportProductsToXlsxAsync` (`:63`).

Two things could be behind the report, with different fixes:

- The reporter used **Export selected**, not Export all. `ExportExcelSelected` (`:2871`) and `ExportXmlSelected` (`:2788`) resolve rows via `GetProductsByIdsAsync(ids)` and never consult the filter — correct by design, but it looks like the symptom if "select all" picked up rows beyond the filter.
- A genuine but **different** inconsistency: the list grid maps *any* non-zero `SearchPublishedId` to `false` (`ProductModelFactory.cs:768`) while the export maps only `2`. Same result for the three real UI values, divergent for out-of-range input. Worth its own issue; **not** what #5 describes and should not be folded in.

- **Risk.** The only way an agent "fixes" this is by changing product-selection logic on speculation. A wrong change silently ships either an under-inclusive export (missing products, invisible) or an over-inclusive one (**unpublished/draft catalogue data leaving the system**), and no test would notice either.
- **Blast radius.** Three near-identical blocks in `ProductController.cs` (`:2698`, `:2753`, `:2835`) plus the two "selected" variants (`:2788`, `:2871`); the list mapping at `ProductModelFactory.cs:768`; and if the fix goes into the service instead, `ProductService.cs:842-843, 948-949, 984-985` — that is the shared `SearchProductsAsync` used across the whole storefront and admin, so a fix pushed down there is unbounded.
- **Test surface.** `ExportManagerTests.cs:419 CanExportProductsToXlsx` would **not** catch a wrong fix: it hands the exporter a product list it constructed itself and asserts column mapping — it never exercises product *selection*, which is where the alleged bug lives. `src/Tests/Nop.Tests/Nop.Web.Tests/Admin/Controllers/` is an **empty directory**; nothing in the test tree references `ProductController`. Vendor scoping, subcategory expansion and the `SearchPublishedId` mapping are entirely unverified.
- **Needed test (after the repro is confirmed).** Drive the export **action**, not `ExportManager`, with a catalogue of both published and unpublished products: `SearchPublishedId = 1` → exactly the published set, `= 2` → exactly the unpublished, `= 0` → all. Writing it first would pin down behaviour that is already correct.
- **What would change the verdict.** Which button, and which file. **Export all → xlsx** with the dropdown on "Published only" means a real bug invisible from the code, needing a human repro first. **Export selected** turns this into a well-specified small feature ("make select-all respect the filter") and, once a maintainer rules it is wanted, SEMI-AUTOMATE with the test written first.
- **Unknowns.** The app was not run. Whether DataTables' "select all" selects across pages / beyond the active filter was not traced. The repo is a seeded exercise fork (single `Initial commit`), so no upstream diff was available to spot a deliberately injected defect.
