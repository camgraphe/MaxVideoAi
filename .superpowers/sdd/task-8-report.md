# Task 8 report: Admin MCP acquisition and operations dashboard

## Status

IMPLEMENTATION COMPLETE — LIVE FUNNEL DATA REMAINS UNAVAILABLE UNTIL PREREQUISITE MIGRATIONS EXIST AND ARE APPLIED.

No database migration, Neon/Supabase/Stripe state, external alert, deployment, publication flag,
push, pull request, or merge was performed. All eight MCP publication flags remain `false`.

## TDD evidence

The Task 8 metric and architecture contracts were created before production files. The first focused
run failed 6 of 6 tests because the server metric owner, admin route, route-local view/helpers, and
navigation entry did not exist. After the initial implementation, 11 of 11 tests passed.

A second RED/GREEN cycle addressed issues found during self-review:

- revocation was incorrectly representable as a measured zero even though Task 7 has no verified
  once-only revocation producer;
- polling, upload, and restoration metrics could look like genuine zeroes when their prerequisite
  plans/tables were absent;
- recommendation-to-quote was an unrelated event-count ratio instead of a causal user cohort.

The new tests failed for those reasons, then passed after explicit capability availability and the
dedicated aggregate cohort query were added. Final focused result: 12 of 12 passed.

## Implemented dashboard

- Added the authenticated server-rendered `/admin/mcp` route under the existing admin layout and
  `requireAdmin` convention.
- Added `MCP acquisition` to the existing Analytics navigation group with the existing `insights`
  icon mapping.
- Added UTC `24h`, `7d`, `30d`, and `90d` reporting windows using `[from, to)` semantics.
- Added server-rendered decision sections for overview KPIs, funnel, cohort conversion, client
  split, error codes, cost guardrails, operations alerts, and publication flags.
- Kept `page.tsx` at 27 lines. Route-local formatting/range/view-model helpers and the server-only
  view own their respective responsibilities.
- Used the existing admin design-system surfaces and tokens. There is no client state dependency,
  second theme provider, or light/dark-specific value outside existing theme classes.

## Metric authority and definitions

All application queries are parameterized, aggregate-only, and bounded to the requested UTC range.
No query returns a user identity or private payload column.

- Funnel stage counts come from distinct users in `mcp_funnel_events`.
- Trial-to-wallet uses the Task 7 definition: distinct completed-trial users with a later
  `wallet_funded` event inside the configured conversion window, divided by distinct completed-trial
  users. Wallet events may be read beyond `to` only for that immutable trial cohort.
- Quote confirmation uses confirmed quote identifiers that belong to the prepared-quote cohort in
  the selected range.
- Recommendation-to-quote uses distinct users with a successful `recommend_models` audit event and
  a later prepared quote in the same reporting range.
- First and repeat paid users come from the authoritative funnel stages.
- Revenue and refunds come only from `app_receipts` charge/refund rows linked to MCP job identifiers.
  Mixed/non-USD receipt data is reported unavailable rather than summed as if currencies matched.
- Provider and trial costs come only from recorded `provider_attempts.provider_cost_usd` rows linked
  through authoritative `app_jobs` and MCP job identifiers. The UI labels this as recorded
  provider-attempt cost; it does not manufacture missing image/provider cost data.
- Error, authentication, polling, upload, and restoration counts use coarse allowlisted
  `mcp_audit_events` dimensions only.
- Zero denominators return `null`/`Unavailable`, never `0%`, `Infinity`, or `NaN`.

## Availability and current blockers

The loader first checks relations with `to_regclass` and keeps availability separate for funnel,
audit, receipts, provider costs, polling, uploads, restorations, authentication errors, and revocation. A successfully run
aggregate may return a genuine zero. A missing relation, failed query, unsupported producer, or
non-normalized currency returns an explicit unavailable state and `null` values instead.

Current branch blockers are unchanged:

- migrations 30 (`mcp_generation_quotes`), 31 (`mcp_trial_entitlements`), and 32
  (`mcp_reference_upload_sessions`) do not exist;
- migration 33 remains reserved and unapplied;
- therefore authoritative funnel, receipt-scoped revenue, provider-cost, polling, upload, and
  restoration sections will remain explicitly unavailable in a real environment;
- Task 7 has no verified once-only revocation event producer, so revocation rate is explicitly
  unavailable even if a historical event-shaped row could exist;
- the current HTTP boundary returns authentication failures before a principal-scoped audit event
  can be written, so authentication-error volume remains unavailable until a privacy-safe producer
  exists;
- the existing read-only audit section can still report genuine coarse tool/error activity if
  migration 29 exists.

No placeholder table, migration, or fabricated zero was added.

## Operations alerts

Added configurable evaluation for:

- abnormal trial volume;
- provider cost;
- quote confirmation rate;
- authentication errors;
- polling rate;
- upload failures;
- refund/restoration failures.

Thresholds are opt-in server environment values and remain disabled when absent or invalid. Alert
routing accepts only injected `admin_audit`, `email`, or `slack` channel adapters. Tests use injected
fakes. The admin page evaluates and displays alerts but does not call a channel, network endpoint,
mailer, Slack webhook, or external system.

## Privacy boundary

The dashboard and its queries exclude prompts, access tokens, raw/private reference locations,
private media, provider request/response snapshots, payment methods, Stripe object identifiers,
email addresses, and exported user identities. Error output contains coarse codes and counts only.

## Verification

Fresh verification before commit:

- Task 8 metric/architecture contracts: 12/12 passed;
- focused admin navigation/architecture, infra operations, Task 7 funnel/PostgreSQL, audit, and
  top-up attribution selection: 58/58 passed;
- `./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`: passed;
- `npm --prefix frontend run lint`: passed;
- `npm run lint:exposure`: passed;
- `git diff --check`: passed;
- `npm run architecture:audit -- --min-lines 500`: passed; new server owners are 457 and 130 lines,
  and the route is 27 lines;
- `npm --prefix frontend run build`: passed, generated 729 static pages, and included dynamic route
  `/admin/mcp`.

A local production-server smoke was attempted on port 62454. The request was stopped by the
repository's middleware before route rendering because this worktree has no runtime
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the server returned the existing
`Missing Supabase env vars` error. This is recorded as an environment blocker, not a route pass.
