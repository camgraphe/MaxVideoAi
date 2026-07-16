# MCP paid generation controlled-test runbook

This runbook is for a future controlled staging or production validation of the
MaxVideoAI paid generation facade. It is not authorization to enable a public
flag, publish a directory listing, spend a customer wallet, or call a provider.

## Release boundary

Keep `publicMarketing`, `publicIndexing`, `transport`, `oauth`, `discovery`,
`paidGeneration`, `trial`, and `referenceUploads` false until the paid, trial,
and reference plans and their independent reviews are complete. A test uses a
server-side controlled-account gate; never enable a mutation solely because a
host can display it.

Do not change directory, public, SEO, GEO, launch, or compatibility claims until
all blockers below have exact-version host evidence. Local SDK evidence is not
hosted Codex or Claude evidence.

## Prerequisites

- Apply application migrations to the authorized Neon branch only, in strict
  order: 30 (paid quotes and spending), then future 31 (trial), future 32
  (reference media), then 33 (acquisition funnel). Confirm each predecessor
  exists before applying the next migration. Supabase remains Auth-only.
- Configure OAuth 2.1 authorization code with PKCE, protected-resource metadata,
  exact `openid email profile` scopes, redirect allowlists, refresh, revocation,
  and reconnect for the exact client version under test.
- Set a dedicated random `MCP_TOPUP_HANDOFF_SECRET`; do not reuse a Stripe,
  Supabase, session, webhook, or application secret.
- Restrict paid access to named controlled accounts. Configure the paid kill
  switch, per-generation cap, daily cap, and web-approval threshold before the
  first quote.
- Use one disposable test account funded with the smallest authorized wallet
  amount. Do not use a customer or employee production wallet.
- Obtain written provider sandbox/test allowance and an explicit maximum spend.
  Confirm provider idempotency uses the quote ID.
- Enable correlated, redacted logs for quote ID, job ID, surface, model, cents,
  currency, state, and safe error code. Never log prompts, access tokens, raw
  OAuth client IDs, reference URLs, provider bodies, or payment identifiers.
- Record the exact Codex version and one exact Claude-compatible version. Keep
  sanitized screenshots/logs in the approved evidence store, not this file.

## Happy path

1. Call `get_account_status`; verify the controlled account, wallet currency,
   and available balance without exposing email or credentials.
2. Call `list_models` and, when useful, `recommend_models`. Let the host help the
   user draft the prompt, references, settings, model choice, and budget.
3. Call `prepare_generation` once with the complete image or video request.
4. Display the exact canonical summary, quote amount/currency, projected wallet
   balance, and expiry. State clearly that preparation neither spends nor calls
   a provider.
5. Obtain explicit user confirmation for that exact quote. Do not rebuild or
   amend the request inside confirmation.
6. Call `confirm_generation` with only `{ quoteId, confirmed: true }`. Verify one
   charge, one initial job, and one provider submission using `jobId = quoteId`.
7. Poll with `get_generation_status` no faster than the returned retry guidance.
   Recover after disconnect using `list_recent_generations` and then the status
   tool. Accept only bounded public HTTPS `resource_link` outputs.
8. Reconcile the quote, charge, job price, currency, and result before marking
   the controlled test successful.

## Top-up path

1. If confirmation reports insufficient funds, call `create_topup_link` for the
   owned prepared quote.
2. Open only the signed MaxVideoAI web handoff. Payment happens on MaxVideoAI;
   MCP never accepts card data, creates a Stripe session, or receives a client
   secret.
3. The handoff invalidates the old quote. After the authorized top-up completes,
   verify the ledger and call `prepare_generation` again.
4. Confirm only the fresh quote. An old quote succeeding after top-up is a
   release-blocking incident.

## Image, video, and reference checklist

- Text-to-image: exact resolution, quality, aspect ratio, count, price, charge,
  completed image link, and recent-history recovery.
- Image-to-image: public HTTPS source/reference reaches the provider's image
  field exactly once; quote/charge equals the shared web estimator.
- Text-to-video: duration, resolution, aspect ratio, audio choice, quote ID
  idempotency, accepted/running/completed states, and public video link.
- Image-to-video: public HTTPS first/source frame reaches `imageUrl`; price,
  charge, polling, and output remain equivalent to the web path.
- Repeat the known-rejection/refund and ambiguous-timeout checks for one image
  and one video adapter where the provider contract differs.
- Private `kind: 'asset'` transfer is not releasable yet. Do not convert an asset
  ID into a provider URL, claim private-reference support, or enable reference
  publication until the Reference Media plan verifies authorization, retention,
  transfer, deletion, and host behavior.

## Failure matrix

| Condition | Expected safe behavior |
| --- | --- |
| Quote expired | `QUOTE_EXPIRED`; no charge, job, or provider call; prepare again. |
| Insufficient funds | No mutation; offer signed MaxVideoAI top-up handoff and require a fresh quote. |
| Per-generation/daily/web approval denied | `SPENDING_LIMIT_EXCEEDED`; create no charge, job, or provider call. |
| Paid kill switch off | Confirmation denied server-side even if the host attempts it. |
| Account restricted | `ACCOUNT_RESTRICTED`; no mutation and only safe user guidance. |
| Known provider rejection | Existing idempotent wallet refund owner; one charge, one refund, failed quote/job. |
| Provider outcome ambiguous | Keep the claimed job charged and recoverable; never refund prematurely. |
| Polling stalled | Stop aggressive polling, preserve evidence, and surface safe support guidance. |
| Ownership mismatch | Generic not-found/expired response; reveal no private data or existence detail. |

## Accounting reconciliation

Run read-only queries with bound user/quote parameters. Export only operational
IDs, states, counts, cents, and currency codes; do not select `request_json`,
`prompt`, `pricing_snapshot`, `settings_snapshot`, provider IDs, reference URLs,
Stripe IDs, vendor IDs, or OAuth client IDs.

```sql
SELECT
  COALESCE(SUM(amount_cents), 0) AS topups_cents,
  COUNT(*) AS topup_count,
  STRING_AGG(DISTINCT UPPER(currency), ',') AS topup_currencies
FROM app_receipts
WHERE user_id = $1 AND type = 'topup';

SELECT
  COALESCE(SUM(amount_cents), 0) AS charges_cents,
  COUNT(*) AS charge_count,
  STRING_AGG(DISTINCT UPPER(currency), ',') AS charge_currencies
FROM app_receipts
WHERE user_id = $1 AND type = 'charge';

SELECT
  COALESCE(SUM(amount_cents), 0) AS refunds_cents,
  COUNT(*) AS refund_count,
  STRING_AGG(DISTINCT UPPER(currency), ',') AS refund_currencies
FROM app_receipts
WHERE user_id = $1 AND type = 'refund';
```

Run the top-up, charge, and refund totals independently when validating the
account tool; do not derive both sides of the comparison from one aggregate.
Verify `get_account_status.wallet.amountCents = topups + refunds - charges`, its
currency is `USD`, and each component's amount and row count is the expected
one for the scenario.

For one quote, select immutable cents, currency codes, states, and component
counts without projecting private JSON:

```sql
SELECT q.quote_id, q.state, q.job_id,
       q.price_cents AS quote_cents, q.currency AS quote_currency,
       j.status, j.final_price_cents AS job_cents,
       j.currency AS job_currency, j.payment_status,
       COALESCE(SUM(r.amount_cents) FILTER (WHERE r.type = 'charge'), 0)
         AS charges_cents,
       STRING_AGG(DISTINCT UPPER(r.currency), ',')
         FILTER (WHERE r.type = 'charge') AS charge_currencies,
       COUNT(r.id) FILTER (WHERE r.type = 'charge') AS charge_count,
       COALESCE(SUM(r.amount_cents) FILTER (WHERE r.type = 'refund'), 0)
         AS refunds_cents,
       STRING_AGG(DISTINCT UPPER(r.currency), ',')
         FILTER (WHERE r.type = 'refund') AS refund_currencies,
       COUNT(r.id) FILTER (WHERE r.type = 'refund') AS refund_count
FROM mcp_generation_quotes q
LEFT JOIN app_jobs j ON j.job_id = q.job_id AND j.user_id = q.user_id
LEFT JOIN app_receipts r ON r.job_id = q.job_id AND r.user_id = q.user_id
WHERE q.user_id = $1 AND q.quote_id = $2
GROUP BY q.quote_id, q.state, q.job_id, q.price_cents, q.currency,
         j.status, j.final_price_cents, j.currency, j.payment_status;
```

Compare the selected values explicitly. Every confirmed quote has one initial
job and one charge; `quote_cents = job_cents = charges_cents`; `quote_currency =
job_currency = charge_currencies` with exactly one currency code. Successful
and ambiguous jobs have `refunds_cents = 0`, no refund currency, and zero refund
rows. A failed known rejection has one idempotent refund with `refunds_cents =
charges_cents` and `refund_currencies = quote_currency`. Any extra currency,
missing value, count drift, or cent mismatch blocks release.

## Rollback and incident sequence

1. Turn off the server-side paid kill switch first.
2. Keep the checked-in/public paid flag off; if a controlled deployment flag was
   enabled, disable it and verify the registry returns to the three read-only
   tools.
3. Stop new provider submissions without deleting jobs, receipts, quotes, logs,
   or idempotency records.
4. Reconcile all `claimed` and `accepted` quotes, provider outcomes, charges, and
   refunds. Refund only a known rejection through the existing refund owner.
5. Preserve sanitized timestamps, quote/job IDs, safe state transitions, cents,
   currency, exact host versions, and correlation IDs. Never paste secrets or
   private generation data into tickets or chat.
6. Repair and re-run local, controlled-host, accounting, refresh/revocation, and
   failure tests before considering re-enable.

## Sanitized host evidence checklist

For Codex and separately for one Claude-compatible exact version, record:

- host name, exact version, OS, controlled environment, and test account label;
- OAuth discovery, exact scopes, consent denial/approval, refresh, revocation,
  authentication loss, reconnect, and fresh approval;
- exact eight-tool list and annotations behind the controlled paid gate;
- canonical quote rendering and a separate explicit confirmation interaction;
- image and video accepted/running/completed rendering and bounded public links;
- insufficient-funds/top-up/fresh-quote behavior;
- known rejection/refund, ambiguity/no-premature-refund, expiry, kill switch,
  spending controls, concurrency, and ownership results;
- reconciliation counts/cents and redaction review;
- sanitized screenshot/log references stored in the approved evidence location.

Do not mark a host compatible from a local SDK run, and do not promote public or
SEO/GEO claims until paid, trial, private references, hosted OAuth refresh, real
provider/refund, and exact-host rendering are all verified and approved.
