# Stripe Connect Rollout Guide

This playbook captures the required steps to migrate existing data, configure vendors, and validate the split-payments flow before enabling it in production.

---

## 1. Run the new migration

```bash
psql "$DATABASE_URL" -f db/migrations/002_split_stripe_connect.sql
```

This adds:

- `vendor_account_id` to `pricing_rules`, `jobs`, `receipts`
- `payment_status`, `stripe_payment_intent_id`, `stripe_charge_id` on `jobs`
- `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_refund_id` on `receipts`

> :warning: Make sure replicas (if any) are caught up before proceeding.

---

## 2. Seed Stripe Connect vendor IDs

1. For each engine/vendor, retrieve the connected account ID (e.g. `acct_123`).
2. Update the pricing rules so future jobs pick up the correct vendor:

```sql
UPDATE pricing_rules
SET vendor_account_id = 'acct_vendor_123'
WHERE engine_id = 'your-engine-id' -- adjust per engine
  AND (resolution = '1080p' OR resolution IS NULL);
```

3. If you have engines without pricing rules yet, either insert the rules now or update `pricing.json` fixtures (for local testing).

---

## 3. Backfill existing jobs & receipts

Only run once after step 2 so historical rows have the vendor and payment metadata.

### 3.1 Jobs table

```sql
-- Assign vendor account to historical jobs by matching their rule
UPDATE jobs j
SET vendor_account_id = pr.vendor_account_id
FROM pricing_rules pr
WHERE j.vendor_account_id IS NULL
  AND pr.engine_id = j.engine_id
  AND (pr.resolution = j.aspect_ratio OR pr.resolution IS NULL)
  AND pr.vendor_account_id IS NOT NULL;

-- Default payment statuses for past runs that had a final price recorded
UPDATE jobs
SET payment_status = COALESCE(payment_status, CASE WHEN final_price_cents IS NOT NULL THEN 'paid_wallet' ELSE 'platform' END);
```

### 3.2 Receipts table

```sql
-- Copy vendor info from jobs into receipts
UPDATE receipts r
SET vendor_account_id = j.vendor_account_id,
    pricing_snapshot = COALESCE(r.pricing_snapshot, j.pricing_snapshot),
    application_fee_cents = COALESCE(r.application_fee_cents, (r.pricing_snapshot ->> 'platformFeeCents')::INTEGER)
FROM jobs j
WHERE r.job_id = j.job_id
  AND (r.vendor_account_id IS NULL OR r.pricing_snapshot IS NULL);

-- Ensure type constraint is respected
UPDATE receipts SET type = 'charge' WHERE type NOT IN ('topup', 'charge', 'refund');
```

Double-check the results:

```sql
SELECT type, COUNT(*) AS count,
       SUM(amount_cents) AS amount_cents,
       SUM(application_fee_cents) AS platform_fee_cents
FROM receipts
GROUP BY 1;
```

---

## 4. Configure environment variables

| Variable | Example | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Platform API key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From Connect webhook endpoint |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | For client-side confirmation |
| `STRIPE_CONNECT_TEST_ACCOUNTS` | optional | Document mapping engine → connected account |

Ensure the webhook endpoint is subscribed to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `checkout.session.completed`

---

## 5. QA checklist (Stripe test mode)

1. **Wallet top-up**: run `/api/wallet` POST with `{ amountCents: 500 }`, pay, confirm top-up receipt and new balance.
2. **Wallet-funded run**: with existing balance, trigger `/api/generate` (default wallet mode). Validate `receipts` inserts a charge, wallet balance decreases, and UI shows paid status.
3. **Direct payment run**:
   - Call `/api/wallet` with `mode: 'direct'` to create a PaymentIntent.
   - Confirm payment via Stripe test card.
   - Trigger `/api/generate` with `payment: { mode: 'direct', paymentIntentId }`.
   - Ensure the job row gets `payment_status = 'paid_direct'`, receipts capture application_fee + vendor share.
4. **Failure → refund**: Force a failing run (e.g. abort job or simulate failure) and confirm a `refund` receipt plus restored wallet balance.
5. **Webhook resilience**: Replay webhook events via Stripe CLI and confirm idempotency (no duplicate receipts).

Record screenshots/logs for each step and attach to the release ticket.

---

## 6. Production enablement

1. Promote the migration through staging → production.
2. Load real connected account IDs into `pricing_rules`.
3. Re-run the backfill queries with production data.
4. Deploy the updated frontend/backend.
5. Run smoke tests (wallet & direct flows) in live mode with Stripe test cards (platform account in test mode).
6. Monitor:
   - Stripe dashboard (Connect payouts, application fees).
   - `/app/billing` and `/app/jobs` for pricing consistency.
   - Application logs for webhook failures.

Rollback plan: if issues are detected, disable direct payments (feature flag or revert pricing rules vendor IDs) and revert the deployment (DB schema retains new columns—they are backward-compatible).

---

## Appendix: Helpful Stripe CLI commands

```bash
# Listen to webhooks locally
stripe listen --events payment_intent.succeeded,payment_intent.payment_failed,charge.refunded,checkout.session.completed \
  --forward-to http://localhost:3000/api/stripe-webhook

# Trigger a test PaymentIntent for a connected account
stripe payment_intents create \\
  --amount 1200 \\
  --currency usd \\
  --automatic-payment-methods \"enabled=true\" \\
  --transfer-data \"destination=acct_testvendor123\" \\
  --application-fee-amount 200
```

Keep this document updated as the rollout progresses or new edge cases emerge.
