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

The existing `withPublicPageTiming` logger emits one bounded record with route
`home` and fixed `examples`, `hero-slots` and `scores` phases. These are loader
promise durations, not final-HTML wait, TTFB, browser LCP, or all root layout work
(the theme-token read is outside this owner). Phases overlap and must not be
summed. A resolved fallback is `ok`; a rejected sibling can leave pending phases
in the error snapshot. Existing production-only gating, build exclusion and
`CWV_SERVER_TIMING=0` kill switch apply; no IDs, URLs, SQL or error text are added.

## Verification

- `tests/home-data-loading.test.ts` holds real homepage read boundaries open to
  verify concurrency, removal of unused proof work, locale/schema data, one
  bounded timing record, fallback handling and original error propagation.
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
