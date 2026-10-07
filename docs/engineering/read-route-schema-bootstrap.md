# Read routes and schema bootstrap

Latency-sensitive read routes operate against an initialized, migrated Neon
schema. They must not run the global application schema bootstrap or seed global
configuration as part of a customer request.

## Current read boundaries

- Homepage `listHomepageSections` and `getHomepageSlots` read existing sections
  and public-video rows without global billing bootstrap. The 60-second public
  slot cache, ordering, hydration and admin cache invalidation remain unchanged.
  Public homepage loading keeps its existing empty-slot fallback on read failure;
  direct admin reads propagate failures. An uninitialized database, including
  admin DELETE's metadata pre-read, requires the explicit baseline before use.
  Create, update, delete and reorder helpers retain their mutation bootstrap.

- `GET /api/jobs` reads `app_jobs` and optionally enriches from `job_outputs`.
- `GET /api/videos/[videoId]` reads an existing shared video without global billing
  bootstrap. Public sharing remains readable independently of search indexability;
  private videos still require their owner and responses stay `private, no-store`.
  Its indexing PATCH retains authentication and mutation-side initialization.
- `GET /api/jobs/[jobId]` reads the owned generation and existing `job_outputs`
  projection without global billing or media schema bootstrap. Its bounded legacy
  output repair remains a mutation owner only when the migrated projection is
  actually missing.
- `GET /api/wallet` authenticates, reads the user's preferred currency, and
  aggregates the account-scoped receipt ledger. Its POST mutation retains the
  historical billing bootstrap and checkout behavior.
- `GET /api/me/currency` reads the confirmed account's currency and ledger
  balances with strict error propagation. Its POST retains schema initialization
  and currency-change validation. Other callers of the shared currency/balance
  helpers retain their existing fallback behavior unless they explicitly opt in
  to `throwOnError`.
- `GET /api/receipts` authenticates before reading the account's paginated ledger
  and resolves its stored Stripe document metadata. A configured database failure
  returns 503, never a successful empty mock ledger. The intentional unconfigured
  local response remains explicitly marked `mock: true`.
- `GET /api/user/exports/summary` counts the account's visible jobs and retains
  the idempotent per-user `user_preferences` initialization. It does not run the
  unrelated global billing bootstrap.
- `listBillingProducts` reads migrated `app_billing_products` without billing
  schema initialization or default-product seeds. `/api/billing-products`,
  commercial admin inventory and current Pricing projections share this reader.
  Missing schema is an explicit unavailable state. Fixed-product mutation helpers
  retain their initialization owner. The disposable product-pricing PostgreSQL
  test runs the application reader with default read-only transactions and checks
  that confirmed fixture-side price changes reach admin and public projections.
- `POST /api/preflight` resolves public/private engine configuration through the
  shared read-only engine catalog. It reads `engine_settings` and
  `engine_overrides` without global schema DDL or default-engine seed writes,
  including unknown/disabled-engine error resolution.

Catalog reads and preflight must match generation's effective system configuration even when the
stored system row predates the deployed catalog. `engine-settings-defaults.ts`
owns the pure payload transformation shared by the generation seed writer and
the app catalog, MCP catalog, transactional readers, and preflight: for the `getBaseEngines()` seed population only, missing/system-owned
rows (`updated_by IS NULL`) receive current catalog options and pricing in
memory, with the same JSON normalization and legacy pricing fallback as the
persisted seed. Explicit administrator rows remain authoritative, and active /
disabled overrides are applied afterward as before. The private-capable lookup
uses this policy for public models too; hidden/image/private models outside the
seed population keep their stored settings. Canary authorization and mode
executability remain prerequisites for private resolution. Every app/MCP list,
exact-model lookup, and transactional lookup applies the same in-memory system
projection. This prevents old seeded resolutions and input limits from reappearing
after a capability deployment without requiring a read request to seed the database.

These responses remain account/private scoped where applicable. Do not add a
cross-account server cache or return stale wallet, export, engine, or job data to
hide database latency.

## Mutation and initialization ownership

Removing schema work from a GET does not remove it from mutation or operational
owners that need it. Wallet top-up POST, engine administration, generation
submission, completion/repair paths, and per-user preference initialization keep
their existing guarantees unless a separately qualified migration changes them.

A genuinely empty application database must use the explicit baseline command
and then the ordered Neon migrations described in `neon/migrations/README.md`.
The bootstrap requires `APPLICATION_DATABASE_URL`, ignores inherited
`DATABASE_URL`, validates a direct Neon target, and is not called from a route,
build, or deploy hook.

## Homepage data loading

`home/_lib/home-page-data.ts` starts examples, programmed hero slots and benchmark
scores together. The unused successful-generation proof count is no longer read
by the homepage; shared count/proof helpers remain available. Example selection,
programmed hero metadata, curated media, localized content and loader fallbacks
keep their existing owners.

`loadHomepageExamples` creates one explicit curation read scope per invocation.
Its branches share only `resolveCuratedPlaylist(slug)` promises, including `null`
(legacy) and `[]` (managed empty/private); rejected promises are evicted so later
reads can retry. No result survives into the next homepage invocation. Curation
configuration reads gather only currently requested slugs in a microtask wave,
with at most four slugs per SELECT. The small bound limits response payloads when
curations contain long ordered/excluded ID arrays. Scope creation alone performs no read. A managed
family (including empty/private `[]`) does not request its inherited configuration;
only legacy `null` opens that branch. Later requests may form additional waves:
there is no fixed two-query guarantee or barrier waiting for all candidates. Each
batch and each destination's candidate query progress independently. A failed
configuration SELECT rejects every member of that batch and evicts their resolution
promises, allowing a later retry; this deliberately shares transient failure across
that batch. Missing-table errors on configuration retain the legacy `null` fallback;
other errors are not converted to empty success. Standalone readers keep their
independent configuration SELECT. Configuration/candidate IDs are a snapshot within
that invocation; alias filters, limits, ordering, pagination, family merging and
final video reads stay with each
consumer. Managed hydration in this scope rechecks both media eligibility and
`playlists.is_public` in the same SELECT, so a playlist revoked after resolution
cannot reuse an earlier public result. Legacy membership already checks its public
playlist. This is statement-level freshness, not an atomic snapshot across the
whole response. Other callers keep their independent reads. Missing curation
schema retains the existing legacy fallback without initialization on the read.

The existing `withPublicPageTiming` logger emits one bounded record with route
`home` and fixed `examples`, `hero-slots`, `scores`, `hero-pricing` and
`demo-pricing` phases. The home orchestrator passes the same measurement callback
into `loadHomepageExamples` to separate `example-latest`, `example-playlist`,
`example-families`, `example-promotions` and the subsequent `example-pricing`.
These five extra phases stay in that one page record; they introduce no SQL,
query result cache or per-family log. Standalone callers default to no measurement.
The disposable PostgreSQL contract verifies unchanged cards and SQL count.
These are loader
promise durations, not final-HTML wait, TTFB, browser LCP, or all root layout work
(the theme-token read is outside this owner). Phases overlap and must not be
summed. A resolved fallback is `ok`; a rejected sibling can leave pending phases
in the error snapshot. Existing production-only gating, build exclusion and
`CWV_SERVER_TIMING=0` kill switch apply; no IDs, URLs, SQL or error text are added.

## Gallery data loading

`listExamplesPage` and `listExampleFamilyPage` create the same curation read scope
for each invocation when the caller has not supplied one. This avoids resolving
the same legacy destination again in the playlist fallback and batches only the
inherited configurations actually requested by a legacy family. A caller-supplied
homepage scope retains its existing lifetime. Managed families still skip inherited
sources, and managed hub/family reads retain their configuration, candidate and
final hydration SELECTs. No result survives into a later invocation; metadata and
page loaders remain independent. Sorting, aliases, limits, offsets, total-count
semantics, merging and public media URLs are unchanged.

The shared-scope freshness and failure rules above also apply to these gallery
reads. In particular, managed hydration rechecks playlist visibility and media
eligibility in the final SELECT. Missing curation schema remains a legacy fallback
without initialization. A failed bounded configuration batch rejects its members;
the existing inherited-source catches still own fallback behavior.

## Verification

- `tests/home-data-loading.test.ts` holds real homepage read boundaries open to
  verify concurrency, removal of unused proof work, locale/schema data, one
  bounded timing record, fallback handling and original error propagation.
- `tests/home-examples-read-postgres.test.ts` counts actual SELECTs on disposable
  PostgreSQL through a read-only application connection, compares complete cards
  and video results with independent reads, and covers legacy/managed/empty/private
  and failed reads, bounded requested-only waves, large configuration payloads,
  blocked batch/candidate independence, whole-batch rejection/retry, alias/limit/sort
  boundaries, fresh invocations and playlist/media revocation before hydration.
  SQL reductions in this fixture are not browser LCP or production latency gains.
- `tests/gallery-read-postgres.test.ts` executes the real gallery readers through
  a read-only disposable PostgreSQL connection, compares complete results with
  independent resolution, and counts configuration/candidate/hydration SELECTs.
  It covers managed/legacy/mixed/empty/private destinations, all six sorts, aliases,
  pagination, fresh invocations after curation changes, revocation before hydration,
  failed reads and missing curation schema. Its reductions qualify the legacy
  fallback path only; managed destinations keep their existing operation count.
- `tests/homepage-read-postgres.test.ts` explicitly initializes disposable
  PostgreSQL, then runs the actual reader through a read-only connection. It
  checks ordering, public-only hydration, empty slots and missing-schema behavior.
  `tests/read-route-schema-latency-contract.test.ts` also preserves mutation-side
  bootstrap ownership.

- `tests/read-route-schema-latency-contract.test.ts` locks the exports and
  preflight boundaries.
- `tests/wallet-route-architecture.test.ts` keeps GET read-only from global
  bootstrap while preserving POST initialization.
- `tests/billing-read-routes-postgres.test.ts` executes both Billing GET handlers
  against initialized disposable PostgreSQL with read-only transactions. It checks
  zero unauthenticated database work, SELECT-only reads, account isolation,
  pagination, original amounts, stored invoice precedence and honest failures.
- `tests/preflight-media-pricing.test.ts` and pricing authority tests preserve
  exact canonical price/error behavior.
- `tests/preflight-system-settings-postgres.test.ts` compares read-only preflight
  against the actual generation seed on disposable PostgreSQL, including stale
  system prices/capabilities, administrator rows, missing rows and disabled /
  unknown engines. `tests/engine-settings-defaults.test.ts` covers the pure
  transformation, seed population, and private-canary boundaries.
- `tests/current-seeded-engine-capabilities.test.ts` covers stale H3/H3 Max
  system rows across app/MCP list, exact, and transactional reads, preservation of
  administrator settings and disabled overrides, and SELECT/LOCK-only access.
- `tests/mcp-read-only-engine-resolution.test.ts` protects the shared read-only
  catalog from schema and seed dependencies.
- `tests/application-schema-bootstrap-postgres.test.ts` qualifies new-database
  initialization outside requests.

For performance comparisons, use the same database snapshot, account/input,
runtime freshness, and compute warmth. Record database wake separately and do not
present server data-path measurements as browser Core Web Vitals.
