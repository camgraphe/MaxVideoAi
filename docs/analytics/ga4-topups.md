# GA4 acquisition milestones and wallet payments

Reviewed locally on 2026-10-05. Measure milestones independently: payment may happen before media generation; a Studio visit or an MCP setup-guide click does not prove a completed generation or an effective connection. Do not use a prescribed signup → generation → wallet top-up order as the visitor-to-revenue denominator.

## Evidence and scope

| Question | Evidence | Limit |
| --- | --- | --- |
| Consented visit | `funnel_entry`, `page_view` | Browser journey, not an admin-clean commercial denominator or unique person. |
| Primary action | `cta_click` with bounded `cta_name`, `cta_location`, `target_family` | Observed action, not installation, activation or payment. |
| Account creation | `sign_up_completed` | Google uses account `created_at` within the pending auth intent; existing Google accounts count as `login_completed` even from the signup UI. Password completion follows successful consent persistence; confirmation-required responses are not proof of an authenticated active user. |
| Studio entered | `studio_entered` | Consented authenticated `/app/studio` family after commercial role resolution; public `/studio` is a landing visit. |
| Effective MCP connection | Server `oauth_connection_completed` | Existing authenticated idempotent binding, independent of landing/setup clicks; not a GA4 browser event. |
| First completed media in a journey | `first_media_completed_in_journey` | Once in the 90-day consented browser journey, not account lifetime. Covers correlated video completion, emitting tools and Studio generations confirmed in the current visit. Separate image/audio workspaces and MCP do not universally emit this browser milestone. |
| Confirmed wallet funding | Server `topup_completed`, `purchase` | Inserted canonical Stripe live-mode wallet receipt; test/unknown mode and admins excluded. Direct card-funded generation payments are not covered. |
| First recorded external payment | `is_first_recorded_external_payment` on wallet purchase | Known positive external receipt history under the wallet transaction lock; manual/test credit excluded, legacy unknown external mode conservatively existing. Not proof of lifetime first payer while direct-card coverage is incomplete. |
| First wallet credit | `is_first_wallet_topup` | Existing ledger definition includes earlier positive wallet top-ups, including manual/test credits. Keep separate from external-payer classification. |

`is_first_generation` is first generation **attempt** in the journey. A failed first attempt does not make a later successful media result cease to be the first observed success. No event establishes contribution margin or profitability.

## Transport and consent

Server transport needs `GA4_MEASUREMENT_ID` and `GA4_API_SECRET`. Browser checkout captures GA4 client/session IDs from its configured tag only with analytics consent; the wallet API independently checks the consent cookie before copying IDs and bounded first/last touch attribution into Stripe metadata. Denied or withdrawn consent clears journey and pending browser events. No pre-consent replay is allowed.

Both browser and Measurement Protocol senders cap emitted parameters at 25. Session, transaction/value/currency, acquisition source/campaign/content and milestone evidence take priority over optional diagnostics. Do not expect every diagnostic field on a fully attributed purchase. Optional history lookup uses a savepoint: an SQL measurement error returns unknown, suppresses commercial emission, and permits the wallet receipt transaction to continue.

Stripe object `livemode`, not client metadata, controls commercial payment eligibility. A strict server read of current and legacy admin tables excludes administrators; missing/error role data suppresses analytics without blocking fulfillment. Browser authenticated milestones defer until the existing `/api/admin/access` endpoint returns its strict eligibility projection. Requests dedupe for 30 seconds, use the bearer session when available, and fail closed for measurement. Confirmed administrator evidence persists as a boolean session marker across public-page reloads and same-user revalidation; ordinary metadata cannot override it. Account changes/logout or confirmed ordinary eligibility clear it. Anonymous public traffic can still include unidentified administrators; raw GA4 sessions/pageviews are not a clean commercial denominator.

The measurement-only role request runs only when analytics or Ads consent is granted. A later consent update resolves eligibility from the current session without making authentication, wallet/header reads or legal-consent UI wait on measurement.

Canonical receipt identity and the per-user transaction lock prevent duplicate wallet fulfillment and duplicate GA4 emission attempts across Checkout/PaymentIntent deliveries. GA4 delivery remains **best effort, at most one attempt per inserted wallet receipt**. Collector/role failures are not retried by the duplicate receipt or processed webhook path; there is no GA4 outbox. HTTP 2xx confirms transport receipt, not event acceptance. Reconcile stored payment receipts with Stripe separately from GA4.

The legacy Google Ads browser success-return conversion now requires resolved eligible role state. While the role is pending, one in-memory payload uses the existing bounded 20 × 200ms retry budget and sends at most once. Consent withdrawal, administrator resolution, account reset or expiry permanently cancel it. The return URL does not establish a live captured payment or a unique canonical receipt. It remains unsuitable for first-payer reporting or purchase optimization. No advertising channel or external conversion configuration is activated by this preparation.

Session linkage is conditional: Google documents a 24-hour limit for joining Measurement Protocol events to the originating online session. Preserving IDs does not guarantee session/channel attribution for delayed payments. [GA4 reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference), [session attribution use cases](https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases).

## Report setup

Create independent milestone cohorts or free-form reports, preserving the observation window and consent coverage. Break down source/medium, campaign/content, landing surface, locale and device separately. Use intersections and elapsed time only when both events were observed; never infer an omitted step or forced order. Count repeat top-ups separately from first recorded payments, and retain unknown history as unknown.

Useful event-scoped custom dimensions are `acquisition_cohort`, first/last-touch source/medium/campaign/content, `route_family`, `workspace_section`, `completion_source`, `is_first_generation`, `is_first_wallet_topup`, `is_first_recorded_external_payment`, `payment_provider`, `payment_flow`, `topup_tier_id` and `settlement_currency`. Metrics may include `generation_sequence`, `topup_sequence`, `output_count`, `topup_amount_cents`, `settlement_amount_minor`, `refund_amount_cents` and `refunded_total_cents`. Some optional values are omitted by the 25-param budget.

Do not register high-cardinality journey, job, local generation or Stripe IDs as custom dimensions. Custom definitions are not retroactive. Configure key events and ad-platform conversions only after authenticated acceptance checks and explicit channel selection; this local change does not alter GA4 or advertising configuration.

## Local verification and release acceptance

1. Deny analytics, then navigate/authenticate/use controls: no journey storage, pending milestones or replay of those actions.
2. Grant consent on the campaign landing: new `funnel_entry`, safe query-free location and exact approved first/last touch fields. Withdraw and regrant: new journey, no old completion replay.
3. Confirm ordinary account role resolution permits private entry, while DB-only admins, metadata admins and failed role lookups emit no commercial app milestones. Product rendering/authentication continue.
4. Test old vs new Google accounts from either UI mode, delayed cookie fallback followed by verified destination user, and one completion after repeated session callbacks. Verify password legal-consent persistence and email confirmation separately.
5. Confirm current-visit Studio generation with a mocked accepted/completed response: exactly one journey success with actual positive outputs. Historical media, failed confirmations, changed account/project and withdrawn consent must not invent success. No paid generation is necessary for this local check.
6. Stripe **test-mode** payments/refunds must send **no commercial GA4 events**, even with granted consent and a configured test property. Validate transport payloads with local fixtures/fake collector; validate fulfillment in a separately authorized Stripe sandbox. Do not fake live mode in production or perform a real payment as part of this preparation.
7. Before paid launch, validate an authorized live canonical wallet payment and refund against collector/event acceptance, actual source/session linkage, receipt uniqueness and role exclusion. Check delayed methods and concurrent/replayed webhook delivery. No such authenticated live validation was performed in this local work.
8. Complete direct-card payment tracking and cross-flow first-payer authority, or explicitly constrain the release readout to wallet funding and keep lifetime first-payer acquisition unavailable. See the dated measurement dossier for exact follow-up.

If configuring unwanted referrals later, inspect Stripe Checkout and Google Accounts return domains (`stripe.com`, `checkout.stripe.com`, `js.stripe.com`, `accounts.google.com`). Do not change referral settings from this local preparation.
