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
| Dynamic video Tools | Existing upscale/background-removal pricing contexts | Source scenario, estimate, final total and editable minimum; authored multiplier is explicitly separate |
| Finishing | Canonical finishing quote, factual provider budget and release registry | Seven candidates remain explicit unavailable/unreleased where no qualified tool policy exists; price editing is disabled without a current quote |
| Storyboard | Underlying GPT Image 2 facts and `computeCanonicalStoryboardBillingSnapshot` | Generate/edit × HD/4K/Ultra, board unit, effective operation policy and canonical tier impact preview |

Blue denotes supplier reference, purple customer price, and green known positive
gross margin. Missing supplier costs do not produce invented margins. Catalogue
estimates and budgets are distinct from confirmed contracts/invoices. Character
Builder and Angle fixed retail amounts are not reused as supplier costs. Song is
shown per song, MiniMax per 1,000 characters; other /s rates are normalized
comparisons, not assertions about a provider's billing unit.

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
- Dynamic video tool multipliers remain authored. Only their real fixed minimum
  is editable here; a future rate editor must reuse canonical preview and atomic
  event history rather than creating a parallel formula.
- Qualify finishing provider profiles and tool-specific policies before release.
  Candidate budgets are not executable customer prices.
- Supplier contracts and observed invoices remain unconfirmed where evidence is
  missing; published/catalogue estimates are useful references, not verified
  negotiated costs.
- The public Audio table retains its existing pack selection; the complete
  seven-pack inventory is currently an admin surface.
- Verification is bounded reference coverage on local fixtures and a sanitized
  sandbox, not exhaustive production-state validation or a production build.
