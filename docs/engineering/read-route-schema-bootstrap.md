# Read routes and schema bootstrap

Latency-sensitive read routes operate against an initialized, migrated Neon
schema. They must not run the global application schema bootstrap or seed global
configuration as part of a customer request.

## Current read boundaries

- `GET /api/jobs` reads `app_jobs` and optionally enriches from `job_outputs`.
- `GET /api/wallet` authenticates, reads the user's preferred currency, and
  aggregates the account-scoped receipt ledger. Its POST mutation retains the
  historical billing bootstrap and checkout behavior.
- `GET /api/user/exports/summary` counts the account's visible jobs and retains
  the idempotent per-user `user_preferences` initialization. It does not run the
  unrelated global billing bootstrap.
- `POST /api/preflight` resolves public/private engine configuration through the
  shared read-only engine catalog. It reads `engine_settings` and
  `engine_overrides` without global schema DDL or default-engine seed writes,
  including unknown/disabled-engine error resolution.

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

## Verification

- `tests/read-route-schema-latency-contract.test.ts` locks the exports and
  preflight boundaries.
- `tests/wallet-route-architecture.test.ts` keeps GET read-only from global
  bootstrap while preserving POST initialization.
- `tests/preflight-media-pricing.test.ts` and pricing authority tests preserve
  exact canonical price/error behavior.
- `tests/mcp-read-only-engine-resolution.test.ts` protects the shared read-only
  catalog from schema and seed dependencies.
- `tests/application-schema-bootstrap-postgres.test.ts` qualifies new-database
  initialization outside requests.

For performance comparisons, use the same database snapshot, account/input,
runtime freshness, and compute warmth. Record database wake separately and do not
present server data-path measurements as browser Core Web Vitals.
