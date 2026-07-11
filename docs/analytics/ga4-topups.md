# GA4 Funnel and Top-Up Configuration (Production)

MaxVideoAI measures the consented acquisition journey from entry through signup, first generation, and first wallet top-up. Client events use the browser GA4 transport; completed top-ups and purchases are emitted server-side by the Stripe webhook.

Server-side events require:

- `GA4_MEASUREMENT_ID`
- `GA4_API_SECRET`

## 1. Events and key events

The primary funnel uses:

- `funnel_entry`
- `sign_up_started`
- `sign_up_completed`
- `generation_started`
- `generation_completed`
- `topup_started`
- `topup_completed`

Related diagnostic and commerce events include:

- `generation_failed`
- `topup_checkout_opened`
- `topup_cancelled`
- `topup_failed`
- `purchase`
- `topup_refunded`

In **Admin > Events**, mark `topup_completed` and `purchase` as key events. `sign_up_completed` and `generation_completed` are useful additional key events when acquisition reporting should optimize for milestones before payment. `topup_checkout_opened` can remain an optional operational key event.

## 2. Custom definitions

In **Admin > Custom definitions**, register the following as event-scoped custom dimensions. Use the event parameter name exactly as shown.

### Journey and acquisition dimensions

- `acquisition_cohort`
- `first_touch_source`
- `first_touch_medium`
- `first_touch_campaign`
- `first_touch_content`
- `last_touch_source`
- `last_touch_medium`
- `last_touch_campaign`
- `last_touch_content`
- `funnel_stage`
- `route_family`
- `landing_route_family`
- `landing_surface`
- `journey_locale`
- `is_first_generation`
- `is_first_wallet_topup`

### Top-up and payment dimensions

- `topup_tier_id`
- `topup_tier_label`
- `payment_provider`
- `payment_flow`
- `charge_currency`
- `settlement_currency`
- `source_event`
- `fx_source`

Register the following numeric event parameters as event-scoped custom metrics:

- `journey_age_days`
- `generation_sequence`
- `topup_sequence`
- `topup_amount_cents`
- `settlement_amount_minor`
- `refund_amount_cents`
- `refunded_total_cents`

Do **not** register high-cardinality correlation or resource identifiers as custom dimensions. This includes `journey_id`, Stripe Checkout Session IDs, Stripe PaymentIntent IDs, Stripe Charge IDs, job IDs, and local generation keys. Keep those values for event-level validation or BigQuery diagnostics only.

## 3. Seven-step Funnel Exploration

Create a GA4 **Funnel exploration** with the following steps in this exact order:

1. Event name exactly matches `funnel_entry`.
2. Event name exactly matches `sign_up_started`.
3. Event name exactly matches `sign_up_completed`.
4. Event name exactly matches `generation_started`, with `is_first_generation` exactly matching `true`.
5. Event name exactly matches `generation_completed`, with `is_first_generation` exactly matching `true`.
6. Event name exactly matches `topup_started`.
7. Event name exactly matches `topup_completed`, with `is_first_wallet_topup` exactly matching `true`.

Use an open funnel only when the question intentionally includes users who entered before measurement was deployed or whose earlier consented step falls outside the report window. Use a closed funnel for the canonical visitor-to-first-revenue conversion rate.

Create separate explorations or report tabs with these breakdowns:

- first-touch source and medium: `first_touch_source`, then `first_touch_medium`;
- first campaign: `first_touch_campaign`;
- acquisition cohort: `acquisition_cohort`;
- landing surface: `landing_surface`;
- journey locale: `journey_locale`;
- GA4 device category;
- auth method from the signup events;
- engine from the generation events.

Compare one breakdown at a time before combining filters. Campaign, auth-method, and engine parameters are absent on events where they do not apply; interpret them on the relevant funnel step rather than as universal journey properties.

## 4. Failure explorations

Keep failures outside the primary success funnel so they do not alter its ordered-step conversion rate.

### Generation failure

Create a free-form or path exploration filtered to `generation_failed`. Break down by `first_touch_source`, `first_touch_medium`, `first_touch_campaign`, `acquisition_cohort`, `landing_surface`, `journey_locale`, device category, and engine. Compare `generation_sequence` and the bounded failure category to distinguish first-attempt friction from later operational failures.

### Top-up cancellation

Create a view filtered to `topup_cancelled`. Break down by acquisition fields, `topup_tier_id`, `payment_provider`, `payment_flow`, and `charge_currency`. Compare it with `topup_started` and `topup_checkout_opened` to locate abandonment before or after checkout opens.

### Top-up failure

Create a view filtered to `topup_failed`. Use the same payment breakdowns and the emitted failure field. To separate first-attempt friction from repeat attempts, use a path or segment that starts from `topup_started` and filters that start event by `topup_sequence`; terminal top-up events do not repeat the browser attempt sequence.

Signup confirmation is not a separate failure event. Inspect `sign_up_completed` using its confirmation-required field when diagnosing password-signup confirmation friction.

## 5. Consent validation

Analytics attribution is valid only after analytics consent has been granted. Validate each consent transition in a non-production or test property:

1. Start with analytics consent denied. Navigate, start signup, and interact with generation or top-up controls. Confirm that no journey parameters, queued milestone events, or replayed pre-consent events appear in DebugView.
2. Grant analytics consent. Confirm that a new `funnel_entry` is emitted for the current page and that subsequent events carry the same `journey_id` and bounded attribution fields.
3. Withdraw analytics consent. Confirm that later funnel events and Stripe checkout metadata contain no journey projection and that previously queued or retrying events are not sent.
4. Grant consent again. Confirm that a new journey begins rather than restoring the withdrawn journey or replaying earlier events.
5. Complete a Stripe test-mode top-up with consent granted, then repeat with consent denied. The granted checkout should produce attributed `topup_completed` and `purchase` events; the denied checkout should not expose journey attribution.

Consent validation should use event-level inspection. Do not register `journey_id` as a custom dimension merely to perform this check.

## 6. Stripe referral exclusion

In **Admin > Data streams > Web stream > Configure tag settings > List unwanted referrals**, add:

- `stripe.com`
- `checkout.stripe.com`
- `js.stripe.com`

## 7. DebugView release checklist

Use a test campaign URL and verify:

- `funnel_entry` is emitted once after consent and contains the sanitized first- and last-touch fields;
- signup start and completion preserve the journey context and auth method;
- generation start and terminal events share `generation_sequence` and `is_first_generation`;
- `page_location` contains no query string, hash, OAuth value, Stripe identifier, or private dynamic identifier;
- `topup_started` increments `topup_sequence`, followed by `topup_checkout_opened` when checkout opens;
- cancellation sends `topup_cancelled`, and a client-side failure sends `topup_failed`;
- a successful Stripe test-mode top-up sends attributed `topup_completed` and `purchase` events from the webhook with authoritative `is_first_wallet_topup`;
- a refund sends `topup_refunded` with the refund metrics;
- attribution and GA4 delivery failures never block receipt creation or wallet crediting.

Custom definitions affect reporting after they are registered and are not retroactive. Register them before using production funnel conversion rates for decisions.
