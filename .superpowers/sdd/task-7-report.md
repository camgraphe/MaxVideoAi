# Task 7 report: Authoritative MCP funnel ledger

## Status

PARTIAL — IMPLEMENTATION AND TESTS COMPLETE — DEPLOYMENT BLOCKED ON PREREQUISITE MIGRATIONS 30–32.

Migration 33 is reserved and unapplied. No Neon, Supabase, Stripe, deployment, publication flag,
branch, or other external state was changed.

## Migration prerequisite decision

The immediate migration audit found application migrations 00–29, including the existing duplicate
18 variants. The approved MCP sequence remains:

1. `30_mcp_paid_generation.sql`
2. `31_mcp_trial_entitlements.sql`
3. `32_mcp_reference_uploads.sql`
4. `33_mcp_acquisition_funnel.sql`

Files 30–32 and their tables do not exist in this branch. Migration 33 is therefore an unapplied
reservation. It begins with `to_regclass` checks for `mcp_generation_quotes`,
`mcp_trial_entitlements`, and `mcp_reference_upload_sessions` and raises before creating anything
if one is absent. It has no foreign key or runtime dependency on those tables after the guard.

The migration runner now prefers `DATABASE_URL_UNPOOLED` and rejects a Neon `-pooler` URL. This
matches current Neon guidance: serverless/pooled application connections are appropriate for short
runtime work, while migrations should use a direct connection; transaction-mode PgBouncer cannot
provide session-level state or session advisory locks. Task 7 uses constraints, unique indexes, and
`INSERT ... ON CONFLICT`, not session locks.

## TDD evidence

The Task 7 contracts were written before production changes. The initial focused run was:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-funnel.test.ts \
  tests/mcp-topup-attribution.test.ts \
  tests/mcp-transport-contract.test.ts \
  tests/mcp-audit-events.test.ts \
  tests/mcp-acquisition-attribution.test.ts
```

RED result: exit 1; 42 tests, 27 passed and 15 failed. Every failure was caused by absent Task 7
behavior: migration/repository owners, consent start binding, protocol completion binding, confirmed
receipt attribution, tool audit projection, and the still-partial Task 5 report.

After implementation, the focused schema/auth/protocol/Stripe suite passed 41 of 41 tests. Final
full verification is recorded below.

## Schema and privacy threat model

`mcp_funnel_events` is a dedicated event ledger with explicit columns only. It stores occurrence
time, event/stage, user and OAuth client IDs, opaque acquisition/quote/job IDs, coarse
source/medium/campaign/client, optional applicable amount/currency, an idempotency key, and an
irreversible confirmed-receipt hash.

The schema and typed writer reject or omit prompts, email, tokens, raw URLs, provider bodies or
responses, payment methods, client secrets, fraud signals, Stripe object IDs, and permissive JSON.
Currency is uppercase three-letter text. Amounts are nonnegative integers and are allowed only on
quote-prepared or wallet-funded events; wallet funding must be positive and carry a 64-character
lowercase receipt hash.

Database checks enforce the exact event/stage and Task 5 attribution tuples. Time, user, OAuth
client, acquisition, quote, job, and event indexes support bounded reporting. Unique partial indexes
deduplicate idempotency keys and confirmed receipts. A `BEFORE UPDATE` trigger rejects raw-event
mutation. It intentionally does not reject deletion, so an authorized operational retention job can
delete expired rows without rewriting history.

`landing_cta_clicked` can exist in the server ledger only with a verified opaque acquisition ID.
The current landing remains GA-only and endpoint copy is never treated as connection success.

## OAuth binding sequence

1. The real nonlocalized `/oauth/consent` Server Component obtains Supabase claims, fetches a fresh
   Auth user, requires exact subject equality, and loads authoritative authorization details.
2. Only then does it read the path-scoped HttpOnly cookie, resolve the dedicated signing secret,
   verify the signed coarse payload, and record `oauth_connection_started` using the authoritative
   authorization-details client ID.
3. The row is idempotent by opaque acquisition ID. The signed cookie, authorization ID, user
   metadata, token, and access-token hash are never persisted.
4. MCP bearer authentication independently retains `getClaims(accessToken)`, fresh
   `getUser(accessToken)`, and exact subject equality.
5. After a successful `initialize` or `tools/list` response, one CTE statement selects the latest
   same-user/same-client start in the 15-minute binding window. It inserts an attributed
   `oauth_connection_completed`, or a once-only `direct_mcp` completion when no eligible start
   exists. Unique idempotency makes initialize/list retries safe.

Ordinary tool calls do not run the binding query. Revocation remains an allowed ledger event but is
not emitted: no verified existing revoke route safely exposes a once-only post-revocation hook, so
claiming revocation would be false.

## Tool audit decision

Operational tool calls remain in `mcp_audit_events`; the funnel ledger does not duplicate them.
The protocol boundary now records only the allowlisted tool name, user/client IDs, and
success/failure outcome after SDK handling. Tool arguments, prompts, tokens, provider data, and
error bodies are not projected. The funnel schema supports `tool_called` and `tool_failed` for a
future explicit domain projection, but Task 7 does not double-count the current audit ledger.

## Stripe attribution semantics

The focused helper is invoked only after the canonical Stripe persistence transaction returns a
newly inserted positive wallet receipt. Duplicate receipts return before the hook. Checkout
creation, payment failure, unrelated wallet requests, and mock funding do not invoke it.

The helper hashes `mcp-funnel-wallet-v1:<internal receipt id>` with SHA-256, then performs one
`INSERT ... SELECT`. It inserts `wallet_funded` only when the same user has a prior
`trial_generation_completed` event within the configured query window and copies only that event's
coarse cohort plus server-owned amount/currency. A duplicate hash, unrelated user, no trial,
pre-trial funding, or funding outside the window is a no-op. The helper catches database
unavailability and cannot credit a wallet or change confirmed payment behavior.

Because migration 31 and live trial event production are absent, the production hook cannot claim a
current conversion: it safely records nothing until prerequisite migrations and real
`trial_generation_completed` events exist.

## KPI semantics

The primary KPI is implemented exactly as:

```text
distinct users with wallet_funded after trial_completed inside the configured window
-------------------------------------------------------------------------------
distinct users with trial_completed in the UTC reporting cohort
```

The reporting interval is explicit UTC `[from, to)`. The conversion window is positive query
configuration and may extend the wallet read boundary beyond `to`; it never mutates events. The
earliest trial completion per user determines the user's cohort. Duplicate trial/funding events,
funding before trial, unrelated users, multiple acquisitions/clients, direct cohorts, and
out-of-window funding are covered. A zero denominator returns `null`, never zero percent, NaN, or
infinity.

## Deployment blockers and remaining concerns

- Do not apply or promote migration 33 until reviewed migrations 30–32 and all three prerequisite
  tables exist. Do not create placeholders.
- Apply schema migrations with a direct Neon URL in a disposable/non-production branch first.
- Keep authoritative dashboards and public funnel claims disabled until migration 33 is applied and
  genuine trial completion events exist.
- Configure `MCP_ACQUISITION_SIGNING_SECRET`; optionally set
  `MCP_FUNNEL_TRIAL_TO_WALLET_WINDOW_SECONDS` (default 30 days, maximum 365 days).
- A future verified revoke route must add once-only `oauth_connection_revoked`; Task 7 intentionally
  emits no false revocation.

## Schema-absent runtime behavior

Migration 33 absence is fail-open only for existing product behavior and fail-closed for
measurement. Consent still renders, authenticated MCP initialize/list replies are unchanged, and a
confirmed Stripe receipt keeps its canonical wallet behavior when the funnel table is missing. The
focused event writer, connection binder, and confirmed-funding hook catch schema/database
unavailability and return `unavailable` or no-op without creating schema, retrying through another
database, or synthesizing a success event. The KPI reader remains an explicit reporting operation
and reports database failure to its caller rather than manufacturing metrics.

## Verification

Fresh pre-commit verification produced:

- required focused Task 7 funnel/top-up/audit contracts: 18/18 passed;
- full MCP test selection: 188/188 passed;
- full Stripe/wallet/checkout filename selection: 62/62 passed;
- `./frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`: passed;
- `npm --prefix frontend run lint`: passed;
- `npm run lint:exposure`: passed;
- `npm --prefix frontend run build`: passed, including generation of 729 static pages;
- `git diff --check`: passed.

The read-only `npm run neon:branches:check` diagnostic could not verify hosted branch state because
the configured Neon API credential returned HTTP 401 (`supplied credentials do not pass
authentication`). This did not change external state and is not treated as a pass. It does not
alter the deployment blocker:
migration 33 remains unapplied and must not be promoted before migrations 30–32 exist and are
reviewed.
