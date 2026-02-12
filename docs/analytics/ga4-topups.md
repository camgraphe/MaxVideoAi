# GA4 Top-Up Configuration (Production)

This project emits the following wallet top-up events:

- `topup_started` (client, billing page)
- `topup_checkout_opened` (client, billing page)
- `topup_failed` (client, billing page)
- `topup_cancelled` (client, billing page)
- `topup_completed` (server, Stripe webhook)
- `purchase` (server, Stripe webhook)
- `topup_refunded` (server, Stripe webhook on `charge.refunded`)

Server-side events require:

- `GA4_MEASUREMENT_ID`
- `GA4_API_SECRET`

## 1) Mark Conversions in GA4

In **Admin > Events**, mark these as key events:

- `topup_completed`
- `purchase`

Recommended optional key events:

- `topup_checkout_opened`

## 2) Create Custom Dimensions / Metrics

In **Admin > Custom definitions**, register event-scoped dimensions:

- `topup_tier_id`
- `topup_tier_label`
- `payment_provider`
- `payment_flow`
- `charge_currency`
- `settlement_currency`
- `source_event`
- `stripe_payment_intent_id`
- `stripe_charge_id`
- `fx_source`

Recommended event-scoped metrics:

- `topup_amount_cents`
- `settlement_amount_minor`
- `refund_amount_cents`
- `refunded_total_cents`

## 3) Exclude Stripe Referrals

In **Admin > Data streams > Web stream > Configure tag settings > List unwanted referrals**, add:

- `stripe.com`
- `checkout.stripe.com`
- `js.stripe.com`

## 4) Validation (DebugView)

Use GA4 DebugView and verify:

- A top-up attempt sends `topup_started` then `topup_checkout_opened`.
- Cancel flow sends `topup_cancelled`.
- Success flow sends `topup_completed` and `purchase` from webhook.
- Refund sends `topup_refunded`.
