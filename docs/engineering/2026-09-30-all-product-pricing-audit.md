# All-product pricing: implementation and acceptance

Date: 2026-09-30. Branch: `codex/bytedance-pricing-grid`.

## Approved scope

The user approved one admin Pricing workspace with Video, Image, Audio, Tools and
Storyboard categories. Rows compare supplier evidence, current customer prices,
units and gross margin. Editing follows each product's actual billing model and
uses server preview and explicit confirmation. This implementation and its
verification remain local: no production deployment, remote database mutation,
provider generation, payment or support communication occurred.

## Meaning of one source

`frontend/config/model-registry.json` owns identity and publication, not amounts.
Effective policy, model tariff cells and fixed billing products retain their
persistence owners. Display and execution share their effective server quote
owners; the admin workspace does not introduce commercial arithmetic.

Paid history retains its original charges. Public examples display a current
recreation/reference quote with its actual known scenario. A label claiming a
current price requires a successful effective-policy read; a database outage
hides that number rather than presenting an offline/default amount as current.
Offline historical adapters remain available for fixtures and audits.

## Implemented coverage

Read-only local inventory: 48 model comparison rows, 12 Audio reference variants
across seven packs, 20 Tools rows (13 referenced billing products and seven
finishing candidates), and six Storyboard generate/edit tier scenarios. This is
sandbox evidence, not a production inventory or a count of executable products.

| Category | Quote owner | Admin behavior |
| --- | --- | --- |
| Video / Image | Canonical model billing, effective policy and manual tariff selector | Existing exact variants, unit editing, preview, history and rollback; manual activation remains gated |
| Audio | `computeCanonicalAudioBillingSnapshot` and shared factual Audio presentation | Seven packs, Seed voice/clone and MiniMax variants, Lyria Clip/Pro, Song, SFX and Ambience; pack-scoped rule editing |
| Fixed Tools | `computeBillingProductSnapshot` and normalized quantities | Inline unit-price editor reuses billing-products preview/confirm/history service |
| Dynamic video Tools | Existing upscale/background-removal pricing contexts and billing-product coefficient | Source scenario, estimate, final total; minimum and coefficient editable with processing examples, confirmation and rollback |
| Finishing | Canonical finishing quote, factual provider budget and release registry | Seven candidates remain explicit unavailable/unreleased where no qualified tool policy exists; price editing is disabled without a current quote |
| Storyboard | Underlying GPT Image 2 facts and `computeCanonicalStoryboardBillingSnapshot` | Generate/edit × HD/4K/Ultra, board unit, effective operation policy and canonical tier impact preview |

Blue denotes supplier reference, purple customer price, and green known positive
gross margin. Missing supplier costs do not produce invented margins. Catalogue
estimates and budgets are distinct from confirmed contracts/invoices. Character
Builder and Angle fixed retail amounts are not reused as supplier costs. Song is
shown per song, MiniMax per 1,000 characters; other /s rates are normalized
comparisons, not assertions about a provider's billing unit.

The supplier follow-up connects the six previously missing Character Builder and
Angle estimates to their existing app configuration. Character uses standard
Draft 1K / Final 2K model facts, while Angle uses a labeled 1 MP source and one or
four provider calls per run. Storyboard retains its six existing supplier amounts
and now identifies Fal, GPT Image 2, dimensions, quality and source count. Supplier
facts remain readable during a commercial-policy outage; incompatible currencies
never imply conversion. Contracts and invoices remain unconfirmed.

Local acceptance: all 26 Tools/Storyboard rows have catalogue or budget estimates,
and every customer total matches the pre-change API response. Character standard
format shows zero estimated gross margin before fees at the sandbox's existing
8/15-cent prices. The focused 89-test run, TypeScript, frontend lint, exposure lint
and diff check pass. Regression coverage checks multi-call cost, independent retail
edits, currency separation, policy outage and read-only schema ownership. No tariff
mutation, provider job or production write was performed.

Audio/Storyboard policy editing stays inline under the selected product, with
commercial fields visible and scope/extras collapsed. Audio editing creates a scoped rule for the selected pack and resolution
`audio` when the current row inherits a global rule; it cannot silently edit or
delete that global row. Variants within the same pack share this rule. Active
policy previews replace historical Audio audit inputs with real request facts,
including voice models, cloning, Clip/Pro duration behavior and source duration
limits. Rule validation uses these same live selector references, so the billed
`audio` resolution and all pack modes can be previewed and confirmed. Storyboard previews cover all six operation/tier scenarios. Historical
audit reproduction retains its original fixtures.

## Consumer verification

| Surface | Effective source and change |
| --- | --- |
| Pricing video/image and featured cards | Existing exact public scenario quote remains canonical |
| Model pages, catalogue/recommendation cards and compare pages | Strict server current-policy adapter; removed fixed catalogue numeric fallback |
| Examples, home and watch cards | Strict current recreation quote; original paid amount untouched |
| Pricing Audio | Effective database-aware canonical Audio quotes; source-backed packs beyond ten seconds omit numeric amounts |
| Pricing Tools | Effective fixed-product snapshots; actual Character Builder 4K quantities; dynamic video entries state minimum plus live quote |
| Studio Audio | Debounced server `/api/audio/quote` using the same normalized request as submission; expected quote key, amount, currency and expiry accompany execution |
| Studio models/Storyboard | Existing canonical server estimate owners retained |
| MCP preparation/confirmation | Existing canonical server owners retained; prepared-price confirmation remains bound to its persisted quote |
| MCP marketing budget helper | No live caller found; synchronous helper remains an offline utility, not a shipped pricing surface |

Confirmed mutations invalidate Pricing, localized model indexes, model details,
examples/home/watch and public tool routes. Browser inventory errors hide cached
commercial numbers. Studio Audio discards superseded responses and refreshes its
quote after the existing pricing refresh event.

Billing-product reads no longer run global schema initialization or seed writes.
They require migrated tables; explicit mutation/bootstrap owners retain their
initialization responsibilities.

## Verification evidence

- Final consolidated pricing/admin/public/Studio check: 150 tests passed. Earlier
  focused runs also passed; the final check includes scoped Audio rule validation,
  inline editor locks and localized sandbox routing.
- `npm run qa:editor` passed: 540 tests, frontend TypeScript, frontend lint and
  `git diff --check`, using the existing local PostgreSQL 17 binaries for fixtures.
- A disposable PostgreSQL test uses read-only application connections and only
  pricing policy/product tables. Fixture-side edits propagate to both admin and
  public Pricing (Character Builder and a scoped VoiceOver rule); no schema work
  occurs on the read path.
- Audio/Storyboard policy-preview quotes are compared with actual canonical
  billing snapshots. Studio DOM coverage checks remote estimate, submitted
  expected quote and refresh invalidation.
- Browser flow: five category buttons; fixed Tools preview 8 → 9 cents then
  cancel; scoped Audio editor with a 10-cent flat-fee preview across its voice
  variants then cancel; Storyboard preview across three generate tiers
  then cancel. No preview was confirmed in the review sandbox.
- Desktop and 390 × 844 mobile views render with no framework overlay or
  horizontal overflow. The sanitized sandbox lacks cookie-policy data; its
  cookie-policy warning is unrelated to commercial reads.
- Admin inventory API returns 401 without authentication, 400 for invalid
  duration, and 200 with `no-store` for a valid local session.
- English Pricing, model index and Seedance Mini model page return 200 with
  canonical/hreflang/JSON-LD. French `/fr/tarifs` and Spanish `/es/precios` return
  200 with their canonical and alternate URLs and five JSON-LD scripts.
  The sandbox listener now matches its advertised `localhost` origin, avoiding
  rewrite proxy loops; production routing rules were not changed.

## Remaining gates

- Complete the previously documented manual model tariff coverage, quote/revision
  binding and settlement provenance gates before activation and removal of the
  legacy global markup. This change does not activate staged model cells.
- Qualify finishing provider profiles and tool-specific policies before release.
  Candidate budgets are not executable customer prices.
- Supplier contracts and observed invoices remain unconfirmed where evidence is
  missing; published/catalogue estimates are useful references, not verified
  negotiated costs.
- The public Audio table retains its existing pack selection; the complete
  seven-pack inventory is currently an admin surface.
- Verification is bounded reference coverage on local fixtures and a sanitized
  sandbox; the optimized build is compiled locally without production credentials.
  It is not exhaustive production-state validation or a deployment.

## Dynamic video Tools continuation

The three video upscalers and Bria background removal now read an optional
`dynamicPriceMultiplier` from the same persisted billing product as their minimum.
Missing overrides preserve the reviewed defaults (upscale ×4, background removal
×2); malformed values fail. The admin accepts finite coefficients from 1 to 1000
and cannot write arbitrary product metadata or change a supplier rate.

The shared billing-products preview/confirmation service projects reference clips
at 1/10/30/60 seconds and an additional 2160p example where supported. Its locked
fingerprint includes full current product state, effective coefficients and those
actual calculated totals. Confirmation and rollback preserve operational metadata
and invalidate the product cache. New events record the effective default as well
as any override; rollback does not silently take a changed operational value from
an old event.

The compact Tools editor exposes both minimum and coefficient. The compatibility
billing-products view uses the same field and controller. Processing estimates,
actual charging, the server Tool/Studio quote and admin comparison all consume the
same product coefficient. Public Pricing continues to show the product minimum
plus a live-quote label for source-dependent video processing.

Three new tests first failed on ignored coefficient edits, then passed. The focused
product/server/rounding suite passes25 tests, admin and tool architecture40 tests,
and Tool quote consumers6 tests. A disposable Unix-only PostgreSQL integration
checks persistence, supplier independence, stale preview, old client acceptance,
rollback, unchanged paid job snapshot and unavailable current database. TypeScript,
frontend lint, exposure lint and unchanged178-row billing baseline pass. The
committed Tools candidate `168d6c679` passed 6,412 standard tests (3 skips) and
11 isolated Studio tests, followed by an optimized local build (916 static pages).
The sanitized local environment was restored.

Actual browser acceptance then exposed a missing transport field: the minimum
reached the server, but both HTTP proposal allowlists dropped the coefficient.
The two adapters now forward only the additional `dynamicPriceMultiplier` field;
arbitrary metadata and client actor IDs remain excluded. Executing the real POST
adapters first reproduced both omissions, then passed. The focused HTTP, service,
real PostgreSQL, rounding and route-architecture group passes 42 tests; TypeScript,
frontend lint and exposure checks pass. Independent review finds no actionable
issue and passes seven focused tests including HTTP and PostgreSQL.

Browser acceptance on `/admin/pricing`: Tools → Topaz → video → Edit pricing.
Minimum 80 → 60 cents and coefficient 4 → 3 preview 1/10-second 1080p clips
80 → 60 cents, 30 seconds 240 → 180, 60 seconds 480 → 360, and 10-second 2160p
320 → 240. The editor updates its indicative gross margin 75.0% → 66.7%.
The preview was cancelled and fields restored to stored defaults, with no
confirmation. The visible tab is retained as the actual local deliverable.
Screenshots: `/tmp/maxvideoai-pricing-tools-editor.jpg` and
`/tmp/maxvideoai-pricing-tools-preview.jpg`.

Final read-only sandbox verification: manual tariffs inactive, revision 3,
66,549 staged cells, 13 billing products, zero coefficient overrides and Topaz
minimum 80 cents. Three unbounded model domains and 24 reference-settlement
refusals still prevent a complete manual-price activation certificate and removal
of the legacy model markup. Production parity, activation and release are not
claimed; no provider, payment, storage, email, support or deployment action occurred.

## Compact confirmation and approved reference floors

The confirmation dialog now shows the readable product name and a four-column
Scenario / Current / Proposed / Delta table. Duration and resolution labels come
from the server reference quote. The changed-price count excludes zero deltas;
stable IDs, surfaces and full before/after provenance remain collapsed under
Sources and audit details. Actual browser acceptance showed the six Topaz
reference scenarios with only two changed prices for a minimum 80 → 60 cents
draft at coefficient 4. It was cancelled; reopening restored stored 80/4. Actual
screenshot: `/tmp/maxvideoai-pricing-compact-preview.jpg`.

Real PostgreSQL acceptance now checks the first versioned-only override and its
rollback with actual manual quotes immediately before and at each effective
instant. The quoted amounts are 26 → 31 → 26 cents; the earlier versioned quote
and intervening database version remain readable at their original instants.
The focused admin/HTTP/temporal group passes 64 tests.

The user approved upward rounding for the 24 GPT Image 2.5 Flare/Sunburst
reference cases. A separate read-only candidate changes only these totals by one
cent to the supplier-reference ceiling. Captured database identity, date,
registry/rules hashes and explicit old/new cents must match; a broader price
change or stale evidence is rejected. All 20,113 sampled quotes now pass the
actual manual settlement guard: 24 approved increases, 20,089 unchanged. The
original capture and sandbox staged data remain intact and inactive. This is not
a zero-change cutover claim or production approval. Supplier references remain
estimates, not confirmed account costs. Three unbounded domains, the complete
versioned seed/certificate and fresh production parity still remain.

The complete bounded list of proposed old/new amounts is saved in
[`2026-09-30-gpt-image-25-reference-floor-proposal.json`](2026-09-30-gpt-image-25-reference-floor-proposal.json).
It is a review artifact, not a runtime configuration or an activation command.

At checkpoint `a0f41e49b`, investigation found an existing FlashVSR mismatch:
the provider request used a factor (default 2×), while customer estimation used
a 1080p target even in factor mode. That checkpoint named 2× in the preview and
added a warning without changing the quote. The next section records its
subsequent correction and exact cent impact.

## Factor-mode normalization correction

The following local continuation resolves the preceding mismatch. The shared
upscale estimator now uses the same supported mode, target resolution and
factor normalization as provider submission. Explicit factor mode also works
for SeedVR2: the preceding mode normalizer accepted only an explicit target,
silently falling back to SeedVR2's default target for a requested factor. The
server pricing context carries that requested mode, so Tool/Studio preparation,
actual execution and admin reference previews agree. FlashVSR preview IDs now
name 2× or 4×, with an extra 4× reference; the obsolete warning is removed.

These are disclosed source-processing corrections, separate from the 24 model
tariff proposals. For 10s/1280×720/30fps, minimum80c and coefficient4:

| Processing | Catalogue estimate | Previous customer quote | Corrected local quote |
| --- | --- | --- | --- |
| FlashVSR 2× | $0.5530 | $1.25 | $2.22 |
| FlashVSR 4× | $2.2118 | $1.25 | $8.85 |
| SeedVR2 2× | $1.1059 | $2.49 (target was used) | $4.43 |
| SeedVR2 1080p target | $0.6221 | $2.49 | $2.49 |
| Topaz 1080p target | $0.2000 | $0.80 | $0.80 |

The actual supplier contract remains unconfirmed. Fixed minima, customer
coefficients and product persistence were not rewritten. Old paid snapshots
remain unchanged; old accepted125c quotes no longer match the corrected222c
FlashVSR quote and must refresh before execution. RED reproduced125≠222 for
real and pure quotes, and498≠222 for an unsupported factor/unused2160p target.
An additional SeedVR2 failure249≠443 exposed its separate mode normalizer issue.
After both source fixes, the focused actual PostgreSQL/preview/provider-input/
minimum/stale-price/architecture group passes18 tests. TypeScript/lint pass.

Before this correction, candidate`a0f41e49b` passed6,421 standard tests/3 skips and
11 isolated Studio tests (6,432 total passes), followed by a successful optimized
local build. Fresh final verification of the factor correction follows.
