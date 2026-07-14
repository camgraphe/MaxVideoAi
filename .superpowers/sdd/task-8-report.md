# Task 8 report: Admin MCP acquisition and operations dashboard

## Status

IMPLEMENTATION COMPLETE — LIVE FUNNEL DATA REMAINS UNAVAILABLE UNTIL PREREQUISITE MIGRATIONS ARE APPLIED AND THE RELEVANT SERVER-SIDE PRODUCER CAPABILITIES ARE ENABLED.

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
dedicated aggregate cohort query were added.

An independent review then found four important boundary defects. A third RED/GREEN cycle added a
real temporary-PostgreSQL fixture plus loader contracts before changing production code. The RED
run failed 13 of 21 tests, including all five executable SQL subtests: reversed confirmation,
earlier-plus-later recommendation conversion, non-tool audit noise, range-coupled accounting
provenance, and hidden missing provider costs. The GREEN run passed 21 of 21 tests.

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

All application queries are parameterized and aggregate-only. Canonical accounting timestamps are
bounded to the requested UTC range; provenance lookups are intentionally range-independent, and the
trial-to-wallet cohort may inspect its configured follow-up window beyond `to`. No query returns a
user identity or private payload column.

- Funnel stage counts come from distinct users in `mcp_funnel_events`.
- Trial-to-wallet uses the Task 7 definition: distinct completed-trial users with a later
  `wallet_funded` event inside the configured conversion window, divided by distinct completed-trial
  users. Wallet events may be read beyond `to` only for that immutable trial cohort.
- Quote confirmation uses confirmed quote identifiers that belong to the prepared-quote cohort in
  the selected range and have a strictly later acceptance timestamp. Trial release likewise
  requires a release strictly later than a causally valid trial acceptance.
- Recommendation-to-quote uses distinct users with a successful `recommend_models` audit event and
  any later prepared quote in the same reporting range. An earlier quote does not suppress a later
  valid conversion.
- First and repeat paid users come from the authoritative funnel stages.
- Revenue and refunds come only from `app_receipts` charge/refund rows linked to MCP job identifiers.
  The canonical receipt timestamp owns `[from,to)` while MCP job provenance is range-independent.
  Refund rate is the distinct refunded-job receipt count divided by the distinct charged-job
  receipt count in that same canonical receipt window. Null, mixed, lowercase, or otherwise
  non-normalized currencies are reported unavailable rather than summed as USD.
- Provider and trial costs come only from recorded `provider_attempts.provider_cost_usd` rows linked
  through authoritative `app_jobs` and range-independent MCP job provenance. The canonical attempt
  timestamp owns `[from,to)`. Any included attempt without a recorded cost makes the whole cost
  section explicitly partial/unavailable; missing costs are never coerced to zero. The UI labels
  this as recorded provider-attempt cost.
- Error, authentication, polling, upload, and restoration counts use coarse allowlisted
  `mcp_audit_events` dimensions only. Tool metrics and error groups are restricted to
  `event_type = 'tool_call'`, matching the existing `(event_type, created_at)` index.
- Zero denominators return `null`/`Unavailable`, never `0%`, `Infinity`, or `NaN`.

## Availability and current blockers

The loader first checks relations with `to_regclass`, then separately checks an explicit
server-controlled producer-capability map. Table existence alone never makes a metric available.
Availability is separate for funnel, audit, recommendation-to-quote, receipts, provider costs,
polling, uploads, restorations, authentication errors, and revocation. A successfully run aggregate
may return a genuine zero. A missing relation, failed query, unsupported producer, partial cost
recording, or non-normalized currency returns an explicit unavailable state and `null` values.

The current server capability map marks only the coarse existing audit producer ready. The complete
trial/paid funnel, recommendation-to-quote, paid receipt attribution, provider cost attribution,
polling, upload, and restoration producers remain false until their real tool/runtime producers are
implemented and verified. This is independent from the eight publication flags, which remain false.

Current branch blockers are unchanged:

- migrations 30 (`mcp_generation_quotes`), 31 (`mcp_trial_entitlements`), and 32
  (`mcp_reference_upload_sessions`) do not exist;
- migration 33 remains reserved and unapplied;
- therefore authoritative funnel, receipt-scoped revenue, provider-cost, recommendation-to-quote,
  polling, upload, and restoration sections remain explicitly unavailable until both their tables
  and verified producer capabilities are ready;
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

Fresh verification for the review fix before commit:

- Task 8 metric/architecture contracts, including executable PostgreSQL fixtures: 21/21 passed;
- focused admin navigation/architecture, infra operations, Task 7 funnel/PostgreSQL, audit, and
  top-up attribution selection: 76/76 passed;
- `./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`: passed;
- `npm --prefix frontend run lint`: passed;
- `npm run lint:exposure`: passed;
- `git diff --check`: passed;
- `npm run architecture:audit -- --min-lines 500`: passed; new server owners are 498, 155, and 21
  lines, and the route is 27 lines;
- `npm --prefix frontend run build`: passed, generated 729 static pages, and included dynamic route
  `/admin/mcp`.

A local production-server smoke was attempted on port 62454. The request was stopped by the
repository's middleware before route rendering because this worktree has no runtime
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the server returned the existing
`Missing Supabase env vars` error. This is recorded as an environment blocker, not a route pass.
