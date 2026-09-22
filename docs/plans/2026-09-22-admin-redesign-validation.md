# Admin redesign — first implementation lot

This record supersedes the paused status in the historical handoff document. Adrien requested resumption. The isolated branch `codex/admin-redesign` includes reconciled main `6e3f7fd57d2d515ed8acae809f781f303a6d5d53` through a merge, preserving the saved checkpoint.

## Delivered scope

- Five admin work areas, contextual navigation, Settings, View site and external Search Console. Compact light English shell, flat sections and tables; keyboard-accessible mobile navigation.
- Overview with Madrid calendar Today / rolling 24 hours, registrations and wallet activity. Independent source deadlines, explicit unavailable states and no invented metrics.
- Transactions with review filters, loaded-sample search and receipt inspector. Direct receipt links open the intended receipt, including PostgreSQL bigint identifiers returned as strings. Existing wallet refund confirmation is retained.
- Site placements with destination search, ordered rows, drag handlers, keyboard movement, Cancel and explicit Save. Failed destination loads retain the current selection and draft. Pending operations block concurrent actions. Dirty orders disable maintenance. A confirmed PUT establishes the saved snapshot even if the following refresh fails. Order replacement is atomic in PostgreSQL.
- Pricing editor redirect, read-only model activity, obsolete menu entries removed. No pricing migration or production DB operation.

## Pricing preservation evidence

`admin-redesign-handoff/pricing-reference-reconciled.json` records SHA-256 references for 130 pricing, provider and engine-settings owner files from reconciled main. Every file matches that base; this refactor changes none of them. DB rules, fallback ordering, caches, schema/bootstrap and commercial mutation services remain intact. UI retirement only removes access to the editors.

Read-only pricing checks pass: immutable billing baseline (178 rows), current public baseline (588 rows). Pricing policy and pricing admin service tests cover DB specificity, fallback, routing preservation and transaction-local reads. **This is code/fixture evidence, not an export of current production overrides.** No live pricing data was exported or mutated. Any future DB-to-code consolidation requires its own read-only inventory and before/after effective quote comparison; it is not part of this lot.

## Validation

- Focused admin/price contracts and behavior tests: 172 passed at the last focused run.
- New browser-DOM regression test exercises drag/drop handlers, Cancel, keyboard ordering, failed destination selection, pending lock, maintenance lock, failed PUT and successful PUT followed by failed refresh.
- Real disposable PostgreSQL test verifies complete rollback of a failed reorder and isolation from another playlist.
- TypeScript and frontend lint passed after corrections; public exposure and whitespace checks passed.
- Local browser on a disposable fixture: Today/24h, desktop navigation, mobile 390px width without overflow, focus trap + Escape/focus restoration, command palette, pricing redirect, receipt detail and playlist Save/reload persistence checked. Unauthenticated HTTP request to /admin/pricing returns 401.
- Native pointer drag through the local browser automation did not produce a reorder; no native-browser pass is claimed from those attempts. The first CI drag/cancel test skipped on an empty collection. It now intercepts the selected destination's read with two browser-only media and blocks every item mutation, so the native drag and Cancel interaction must run regardless of collection contents. Component DOM event coverage passes; keyboard reorder and actual DB persistence were verified in the browser.
- Screenshots under `output/admin-redesign-2026-09-22` contain local fictitious records; V2 concept images remain separate reference files.

Full production build passed, including offline prebuild gates, TypeScript and generation of 897 pages. It emitted the existing Supabase Edge Runtime warning about process.version. The broader local run covered 5,919 tests: 5,904 passed, 13 PostgreSQL-version assertions failed and 2 were skipped. All 13 failures passed when rerun with the required PostgreSQL 17 (5,917 successful tests across the runs). Four connected-Studio integration files were excluded from this local run; CI owns their browser qualification. Quality CI passed on `46f66d8f0` (run `35769368790`), as did Vercel preview. The earlier implementation run also passed: 5,919 unit/integration tests and 7 Studio browser tests, with 4 unit/integration skips; admin smoke passed 17 tests with 2 skips, including the original drag test. The subsequent deterministic drag-test refinement awaits its own CI result; see PR checks for the latest status. Draft PR: https://github.com/camgraphe/MaxVideoAi/pull/332. The preview fixture has no real Supabase Auth accounts; its registration panel correctly shows unavailable. No claim of real registration totals from the fixture is made.

## Review fixes

Independent review identified and then rechecked source timeouts and cross-destination state. Its two further findings (maintenance discarding a draft, stale Cancel after successful PUT/failed refresh) were reproduced and corrected. An unused server health lookup and 30-second shell poll were removed with the retired navigation badges. Health API and operational consumers remain intact.

## Remaining larger redesign stages

This lot does not introduce automatic galleries, per-destination exclusions, public-feed migration or optimistic multi-admin version checks. Existing public readers remain unchanged. Broader editorial workflow, complete English copy cleanup across legacy pages and server-wide transaction search/pagination remain later stages. Preserve manual ordering and private-media boundaries when implementing automatic placements.

Production delivery requires the repository GitHub PR / passing Quality CI / main / Vercel Git flow, with production alignment checks immediately before merge and both domains after deployment. No production merge or deployment is authorized by this validation record.
