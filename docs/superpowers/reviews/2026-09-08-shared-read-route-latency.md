# Wallet, preflight, and exports read latency — 8 September 2026

## Scope and environment

This is a separate follow-up to the accepted Activity correction. The baseline
was commit `9e0458132` on isolated branch
`codex/activity-first-load-latency`; the candidate changes have their own commit.
No source/app worktree, production data, provider, payment, storage, deployment,
push, or merge was modified.

Measurements used the same guarded disposable Neon branch and copied account as
the Activity work. Each sample ran in a fresh Node process on local Node 23.9
(repository target Node 22). The branch launcher reverified its non-default,
non-primary identity and expiry, loaded its connection string only in memory,
and omitted provider/payment/storage credentials. No account/job identifier,
prompt, media URL, wallet amount, or pricing payload was printed.

## Root cause and correction

`GET /api/wallet` and `GET /api/user/exports/summary` directly awaited the
89-statement sequential billing schema bootstrap. Pricing preflight reached the
same bootstrap through `getConfiguredEngine`, then ran a global default-engine
seed before two configuration SELECTs. These phases, not the account-scoped
ledger/export reads or canonical pricing calculation, explain the reported
12–16 second cold-runtime responses.

The correction removes the global bootstrap only from the two GET paths. Wallet
POST keeps its existing bootstrap and all checkout/payment behavior. Exports
retains its idempotent per-user preferences insert/read. Preflight now reuses the
existing read-only engine catalog and passes `bootstrap:false` through canonical
unknown/disabled-engine resolution; pricing formulas, media verification,
private-canary authorization, and error payloads remain unchanged.

## Comparable measurements

All totals include first database connection setup. Three fresh-process runs per
route used the same branch/input and process order.

### Wallet

| Run | Account/connection | Billing schema | Currency | Ledger summary | Baseline total | Candidate total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1,833.0 / 2,273.3 ms | 11,913.4 ms | 133.5 / 148.0 ms | 266.8 / 257.3 ms | 14,146.8 ms | 2,678.7 ms |
| 2 | 880.4 / 987.4 ms | 11,768.6 ms | 169.8 / 160.7 ms | 123.5 / 119.4 ms | 12,942.5 ms | 1,267.5 ms |
| 3 | 988.5 / 884.2 ms | 11,393.2 ms | 114.0 / 120.6 ms | 177.2 / 117.9 ms | 12,673.2 ms | 1,122.7 ms |

Median total: **12,942.5 → 1,267.5 ms**, 11,675.0 ms faster, a **90.2% reduction
(10.2×)**. Candidate runs were forced PostgreSQL read-only.

### Exports summary

| Run | Account/connection | Billing schema | Count + user preferences | Baseline total | Candidate total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 1,135.0 / 930.5 ms | 12,213.0 ms | 1,047.6 / 1,054.5 ms | 14,395.7 ms | 1,985.1 ms |
| 2 | 970.0 / 856.4 ms | 11,389.0 ms | 1,045.9 / 1,057.8 ms | 13,405.0 ms | 1,914.3 ms |
| 3 | 946.9 / 932.4 ms | 11,409.6 ms | 1,050.1 / 1,037.6 ms | 13,406.7 ms | 1,970.1 ms |

Median total: **13,406.7 → 1,970.1 ms**, 11,436.6 ms faster, an **85.3%
reduction (6.8×)**. This candidate was intentionally not forced read-only because
the existing per-user preference UPSERT is preserved.

### Pricing preflight

| Run | Billing schema | Engine seed | Configuration reads | Baseline total | Candidate service total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 12,756.6 ms | 407.7 ms | 901.3 ms | 14,065.6 ms | 1,318.9 ms |
| 2 | 12,245.5 ms | 422.8 ms | 923.5 ms | 13,592.1 ms | 1,309.4 ms |
| 3 | 12,428.1 ms | 538.7 ms | 918.4 ms | 13,885.3 ms | 1,354.0 ms |

Median total: **13,885.3 → 1,318.9 ms**, 12,566.4 ms faster, a **90.5%
reduction (10.5×)**. Candidate service runs executed the real normalized
Seedance preflight under forced PostgreSQL read-only mode.

## Limits

These are server data-path measurements, not authenticated browser timings or
Core Web Vitals. The harness account-selection query is not part of production
wallet/exports handlers but is included in both sides so connection/wake cost is
not hidden. The first run in a set can therefore be slower as Neon wakes.

The change does not remove database cold-start or network latency; candidate
medians remain about 1.3–2.0 seconds. It also does not optimize the retained
per-user preference initialization. All three read paths now require the
explicitly bootstrapped and migrated schema qualified in the Activity lot.

## Verification

- Focused wallet, exports, preflight, engine-catalog, pricing, and dashboard
  contracts: 107 passed, 0 failed.
- Full repository validation: 4,480 passed, 0 failed in 110.0 seconds.
- Frontend TypeScript, frontend lint, public-exposure lint, and
  `git diff --check`: passed.
- Sanitized production build: passed, including model/media prebuild gates and
  861 generated static pages.

The local Node 23.9 runtime remains different from the repository's Node 22
target and emits the existing non-blocking engine warning.

## Integration-review correction: stale system engine settings

Independent integration review identified that the removed generation seed also
refreshes existing system-owned engine rows (`updated_by IS NULL`). Reading such
rows directly could retain an old rate or capability limit until generation
performed its refresh. The benchmark's prior baseline runs had already refreshed
these rows, so the timing samples did not cover this divergent starting state.

The regression was reproduced before the fix on isolated disposable PostgreSQL:
a synthetic Sora 2 system row retaining a one-cent-per-second rate quoted 6 cents
for five seconds before the persisted seed and 60 cents after it. These are local
fixture totals, not customer prices. The fixture also includes H3 with a stale
one-second limit and only 768P, plus a deliberately administrator-owned Sora 2 Pro
row that must not be refreshed.

`engine-settings-defaults.ts` now owns the pure transformation used by both the
existing seed writer and read-only preflight. It reproduces persisted JSON
normalization, default options, and pricing fallback only for the original
`getBaseEngines()` seed population. Both public and private-capable preflight
lookup, including the calculator's bootstrap-free fallback, use that effective
projection. Administrator rows, disabled overrides, private-canary access and
mode-executability checks remain intact. Hidden/image/private models outside the
seed population and existing MCP catalog/transaction readers retain their prior
settings behavior.

The PostgreSQL regression compares all public engine projections, including
missing rows, with the actual generation resolver after its persisted seed. It
compares the complete normalized Sora, H3 and administrator preflight responses
and fallback calculator results, verifies disabled/unknown errors, and checks
stored rows remain identical during the read phase. That entire phase runs with
`default_transaction_read_only=on`. Unit coverage separately checks no input
mutation, legacy pricing conversion/fallback, database-free resolution, private
lookup population, and denied/allowed/non-executable canary cases. A contract
locks shared pure ownership; the existing transitive MCP contract still excludes
schema and seed-writer dependencies.

This correction adds no database statements or cache. The earlier latency table
was not remeasured after this pure in-memory change; it remains evidence for the
removed schema/seed I/O, not an exact timing of the corrected candidate.

Fresh verification of the correction:

- All five new behavioral tests passed, including actual disposable PostgreSQL
  read-only enforcement and post-seed parity; the shared-owner contract passed.
- Full sanitized repository suite: **4,486 passed, 0 failed, 0 skipped** in
  166.7 seconds, including preflight request/media, P1 launch-canary, canonical
  pricing, wallet/exports and MCP read-only contracts.
- Frontend TypeScript, frontend lint, public-exposure lint and
  `git diff --check`: passed.
- Fresh sanitized production build: passed, including the model/media prebuild
  gates and 861 generated static pages. The same Node 23.9 versus target Node 22
  verification limitation remains.
