# Funnel Attribution Measurement Design

**Date:** 2026-07-11
**Status:** Approved for implementation
**Branch:** `codex/funnel-attribution-measurement`

## Goal

Make the visitor-to-revenue funnel measurable from the first consented acquisition touch through signup, first generation, and first wallet top-up, while preserving the current GA4, authentication, workspace, Stripe, localization, routing, and consent behavior.

The implementation must answer two product questions:

1. At which step do visitors abandon the path from arrival to paid usage?
2. Which acquisition sources and campaigns produce completed signups, successful first generations, and completed first top-ups?

## Current State

MaxVideoAI already emits most of the required events:

- route-level `page_view`, `tool_view`, and `app_open` events;
- `sign_up_started`, `sign_up_completed`, and `login_completed` events;
- `generation_started`, `generation_completed`, and `generation_failed` events;
- `topup_started`, `topup_checkout_opened`, `topup_failed`, `topup_cancelled`, `topup_completed`, and `purchase` events;
- a consent-gated GA4 loader and a server-side GA4 Measurement Protocol path for completed Stripe top-ups;
- a GA client identifier copied into consented Stripe metadata;
- checkout-interaction events stored for authenticated billing diagnostics.

The missing capability is a shared, durable, non-personal journey context. Today, acquisition data is not consistently attached to signup, generation, and top-up events. The browser and Stripe webhook cannot reliably describe the same acquisition journey, Google signup does not emit a start event, first conversions are not distinguished from later activity, and route analytics may include sensitive or high-cardinality query values in `page_location`.

The current admin metrics already calculate authenticated revenue and render behavior from application tables. This lot complements those metrics with acquisition and pre-auth funnel measurement. It does not replace the operational admin metrics.

## Scope

This lot includes:

- a consent-aware browser journey record with first-touch and last-touch attribution;
- automatic enrichment of the existing analytics events;
- a one-time `funnel_entry` event for each consented journey;
- explicit first-generation and first-top-up fields;
- Google signup-start tracking;
- safe propagation of attribution through hosted and Express wallet checkout;
- server-side propagation from Stripe metadata to `topup_completed` and `purchase`;
- safe checkout-session reuse rules for attributed sessions;
- analytics URL sanitization;
- GA4 configuration and funnel-analysis documentation;
- focused unit, contract, route, and webhook tests.

## Non-Goals

This lot does not include:

- a new application database table for anonymous visitors or attribution events;
- a new admin analytics dashboard;
- cross-device identity resolution;
- retroactive attribution for historical events;
- storing email addresses, prompts, filenames, uploaded media, access tokens, captcha tokens, OAuth codes, Stripe customer data, or raw query strings in analytics;
- changing public URLs, route behavior, SEO metadata, canonicals, hreflang, or sitemap behavior;
- changing the visual design of marketing, login, workspace, or billing pages;
- replacing GA4, the existing consent system, or the current Stripe webhook accounting path;
- delaying signup, generation, or checkout while analytics is unavailable.

## Chosen Approach

Use a consented anonymous journey record in the browser and carry a compact, server-validated projection of that record into Stripe metadata.

This approach is preferred over client-only attribution because the completed payment is emitted by the webhook and must retain the same acquisition context. It is preferred over a new server-side anonymous-cohort database because that would add schema, retention, deletion, and operational responsibilities before the product has validated the reporting model.

## Journey Record

### Storage and lifetime

The browser stores one versioned record under a dedicated key such as `mvai.analytics-journey.v1` only when analytics consent is granted.

The record expires 90 days after creation. The first-touch record and cohort remain fixed for that lifetime. A qualifying new campaign or external referral may update last touch and its timestamp without extending the original 90-day attribution window.

If analytics consent is absent, denied, or withdrawn:

- no journey record is created;
- an existing journey record is deleted;
- journey enrichment returns an empty object;
- product behavior continues unchanged.

The implementation listens to the existing `consent:updated` event and reads the existing `mv-consent-analytics` value. It must not introduce a parallel consent source of truth.

### Shape

The browser record contains only bounded primitives:

```ts
type AnalyticsJourneyRecordV1 = {
  version: 1;
  journeyId: string;
  createdAt: number;
  expiresAt: number;
  cohortWeek: string;
  firstTouch: AnalyticsTouch;
  lastTouch: AnalyticsTouch;
  lastTouchAt: number;
  funnelEntrySent: boolean;
  generationStartedCount: number;
  topupStartedCount: number;
};

type AnalyticsTouch = {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  referrerHost?: string;
  landingRouteFamily: string;
  landingSurface?: string;
  locale?: string;
};
```

`journeyId` is an opaque random UUID generated with browser cryptography. It is an analytics correlation value only. It must never authorize access, select a user, or act as a session identifier.

`cohortWeek` is a stable ISO week such as `2026-W28`, derived from `createdAt`. It is low-cardinality and suitable for GA4 cohort comparison.

### Attribution resolution

Attribution is resolved in this order:

1. Valid allowlisted UTM parameters identify a campaign touch.
2. A known search-engine referrer identifies an organic touch.
3. Any other external HTTP(S) referrer identifies a referral touch using only the normalized hostname.
4. Missing attribution becomes `source: "direct"` and `medium: "none"`.

Only these query parameters are read for attribution:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`

`utm_term` is intentionally excluded because it is not required for the first reporting version and can contain free-form or sensitive search content.

Each value is trimmed, Unicode-normalized, stripped to a conservative character set, and capped at 80 characters. Empty or invalid values are omitted. Raw referrer URLs and raw query strings are never stored.

Internal navigation never overwrites last touch. A direct revisit does not erase a previous campaign. Last touch changes only for an explicit valid UTM touch or a new external referrer.

An identical touch fingerprint is a no-op: repeatedly observing the same external referrer or campaign during a client-side session does not refresh `lastTouchAt`. The browser bootstrap evaluates `document.referrer` for the current document; route-change enrichment must not reinterpret that unchanged referrer as a new touch.

### Landing surface

The journey stores a stable product surface, not an arbitrary URL. It reuses `getAnalyticsRouteContext()`:

- marketing routes use a safe page key;
- public tools use `toolName`;
- workspace routes use `workspaceSection`;
- billing and auth use their route family;
- dynamic identifiers are replaced with a stable route template.

This avoids recording job IDs, checkout session IDs, OAuth values, user-entered query values, or other high-cardinality paths.

## Consent-Aware Event Enrichment

### Shared enrichment boundary

Create a browser-safe analytics journey module under `frontend/lib/analytics/`. It owns:

- record parsing and migration rejection;
- consent-aware reading, creation, updating, and deletion;
- attribution sanitization and classification;
- safe landing-surface resolution;
- event-to-funnel-stage mapping;
- milestone counters;
- projection to GA4 event parameters;
- projection to the wallet request contract.

The send boundaries enrich events instead of changing every CTA:

- `GA4EventBridge` enriches custom client events and preserves the enriched generation-start context for terminal generation events;
- `GA4RouteTracker` emits a sanitized page location and journey context;
- `dispatchGaEvent` enriches direct billing and workspace top-up events;
- the wallet checkout request reads the same projected context.

Explicit event payload values win only for established product fields such as `route_family`, `tool_name`, and engine data. Journey-owned fields cannot be overwritten by arbitrary component payloads.

### Common parameters

Consented funnel events receive a bounded set of fields:

- `journey_id`
- `acquisition_cohort`
- `first_touch_source`
- `first_touch_medium`
- `first_touch_campaign`
- `first_touch_content`
- `last_touch_source`
- `last_touch_medium`
- `last_touch_campaign`
- `last_touch_content`
- `journey_age_days`
- `funnel_stage`
- `landing_route_family`
- `landing_surface`
- `journey_locale`

Optional empty values are omitted. `journey_id` is available for validation and BigQuery-level debugging but must not be registered as a GA4 custom dimension because of its cardinality.

### Funnel events and stages

The primary ordered funnel is:

| Event | `funnel_stage` | Additional fields |
| --- | --- | --- |
| `funnel_entry` | `entry` | route family and landing surface |
| `sign_up_started` | `signup_started` | auth method and surface |
| `sign_up_completed` | `signup_completed` | auth method and confirmation state |
| `generation_started` | `generation_started` | `generation_sequence`, `is_first_generation` |
| `generation_completed` | `generation_completed` | inherited generation sequence and price fields |
| `generation_failed` | `generation_failed` | inherited generation sequence and bounded error classification |
| `topup_started` | `topup_started` | `topup_sequence`, `is_first_topup_attempt` |
| `topup_checkout_opened` | `topup_checkout_opened` | inherited top-up context where available |
| `topup_completed` | `topup_completed` | `is_first_wallet_topup` from the server |
| `topup_cancelled` | `topup_cancelled` | top-up amount and source |
| `topup_failed` | `topup_failed` | bounded failure category |

`funnel_entry` is emitted exactly once when a valid consented journey is created. Consent granted after navigation attributes the journey to the page on which consent is granted; the implementation must not persist a pre-consent shadow record.

The current in-memory event queue, retrying direct GA sender, and pending-auth event storage must become consent-aware at event time. An event created before analytics consent is granted is dropped rather than queued, retried, persisted, or replayed after a later grant. Consent withdrawal clears the journey record, queued analytics events, and pending auth analytics records. This prevents delayed transport from turning a pre-consent action into a post-consent event.

`generationStartedCount` increments on `generation_started`. The enriched start payload is retained by the existing local-key/job-id bridge, so completion and failure inherit the same `generation_sequence` and `is_first_generation` values. Multiple iterations remain separate generation events, preserving current batch analytics.

`topupStartedCount` increments only on `topup_started`, not on the immediately following `topup_checkout_opened`. Browser counts describe attempts in the current journey. The webhook's existing `first_wallet_topup` value remains the authoritative lifetime first-payment field.

### Signup behavior

Password signup keeps the current start and completion events.

Google auth emits `sign_up_started` when the user selects Google while the form is in signup mode. Signin mode does not emit signup events. The event uses the normal consent-gated GA4 transport and must not delay the OAuth redirect.

The current signup-completion meanings remain backward compatible:

- immediate password sessions report `email_confirmation_required: false`;
- password account creation requiring confirmation reports `email_confirmation_required: true`;
- completed Google signup reports `email_confirmation_required: false`.

The lot does not rename existing events or reinterpret historical signup reports.

## Analytics URL Safety

`GA4RouteTracker` must stop sending `window.location` plus the complete query string as `page_location`.

The safe page location is built from:

- the current origin;
- a route-family-aware, normalized or templated path;
- no query string;
- no hash.

UTM values are sent only through the sanitized attribution fields. The following values must never appear in GA page locations or journey records:

- OAuth `code`, `state`, tokens, or error descriptions;
- Stripe checkout session IDs or PaymentIntent IDs;
- billing amount and return-state parameters;
- `next` or redirect targets;
- arbitrary search parameters;
- dynamic private resource identifiers.

The browser address bar, application routing, authentication cleanup, checkout return handling, canonical URLs, and SEO output remain unchanged. This is an analytics projection only.

## Wallet Checkout Contract

### Client request

Extend the shared hosted wallet request with an optional `analyticsJourney` object. The client sends it only when a valid consented record exists.

The request object includes a compact projection rather than the full stored record:

```ts
type WalletAnalyticsJourney = {
  version: 1;
  journeyId: string;
  cohortWeek: string;
  firstSource: string;
  firstMedium: string;
  firstCampaign?: string;
  firstContent?: string;
  lastSource: string;
  lastMedium: string;
  lastCampaign?: string;
  lastContent?: string;
};
```

Billing and Workspace continue to use the same hosted-checkout hook. No route gains an independent attribution implementation.

### Server validation

`POST /api/wallet` treats the browser projection as untrusted input.

The route accepts attribution only when the existing consent cookie says analytics is granted. It then:

- requires version `1`;
- validates `journeyId` as a UUID;
- validates the cohort format;
- applies the same length and character constraints to every attribution value;
- drops the entire attribution projection when required fields are invalid;
- never returns a validation error to the customer for analytics data.

Malformed, missing, expired, storage-blocked, or consent-denied attribution produces the current checkout behavior with no journey metadata.

### Stripe metadata

The accepted projection is copied to both Checkout Session metadata and PaymentIntent metadata using bounded keys:

- `journey_id`
- `acquisition_cohort`
- `first_touch_source`
- `first_touch_medium`
- `first_touch_campaign`
- `first_touch_content`
- `last_touch_source`
- `last_touch_medium`
- `last_touch_campaign`
- `last_touch_content`

The route also computes a server-side attribution fingerprint from these normalized fields. The fingerprint is used only to guard checkout-session reuse and is not sent to GA4.

The implementation must remain below Stripe metadata key and value limits and preserve every existing payment, tax, customer, wallet, currency, fraud, captcha, and checkout-attempt field.

### Checkout-session reuse

An existing Express Checkout session may be reused when the amount, currency, user, journey ID, and attribution fingerprint match the current request.

Rules:

- when neither the existing session nor the current request has attribution, current reuse behavior remains unchanged;
- when the current request has attribution but the existing session does not, do not reuse it;
- when journey IDs or fingerprints differ, do not reuse it;
- do not mutate an existing session to impersonate a new attribution touch; create a new session instead.

This prevents a later campaign from completing against stale Stripe metadata while preserving current deduplication for identical checkout attempts.

### Checkout-interaction diagnostics

The current checkout-attempt metadata may include the journey ID, cohort, source, and medium after server validation. It must not include raw URLs, referrers, or arbitrary campaign objects. Existing admin checkout diagnostics and cleanup behavior remain compatible.

## Stripe Webhook and Server GA4

The webhook reads the accepted journey fields from the combined Checkout Session and PaymentIntent metadata already used for wallet top-ups.

When analytics consent was granted at checkout, both `topup_completed` and `purchase` receive:

- the journey and attribution projection;
- `is_first_wallet_topup` from `first_wallet_topup`;
- the existing GA client ID and authenticated user ID;
- all current amount, currency, tier, FX, provider, and transaction fields.

The current `ga_client_id` remains the primary GA browser-to-server identity bridge. `journey_id` provides explicit funnel validation and debugging but is not a replacement for GA client ID or authenticated `user_id`.

No server-side GA4 event is sent when checkout metadata records denied analytics consent. Receipt creation, wallet crediting, idempotency, refund handling, and payment completion must not depend on attribution parsing or GA4 success.

## Failure and Privacy Model

Analytics always fails open for the product journey:

- storage exceptions return no context;
- unavailable browser cryptography returns no journey rather than using a predictable ID;
- invalid attribution is omitted;
- GA4 transport failures do not surface in the UI;
- Stripe attribution parsing failures do not fail checkout or webhook accounting;
- no analytics request delays navigation, signup, generation, or payment;
- consent withdrawal deletes the local record and prevents future projection;
- analytics logs must not print the complete browser record or raw query values.

Journey storage is not authentication storage. Server behavior never trusts it for user identity, entitlement, pricing, fraud decisions, wallet credit, or authorization.

## GA4 Reporting Contract

Update the analytics documentation with the following event-scoped custom dimensions:

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

Recommended metrics:

- `journey_age_days`
- `generation_sequence`
- `topup_sequence`

Do not recommend high-cardinality custom dimensions for:

- `journey_id`
- Stripe Checkout Session IDs;
- Stripe PaymentIntent IDs;
- Stripe Charge IDs;
- job IDs;
- local generation keys.

The documentation must define a GA4 Funnel Exploration with these ordered steps:

1. `funnel_entry`
2. `sign_up_started`
3. `sign_up_completed`
4. `generation_started` where `is_first_generation = true`
5. `generation_completed` where `is_first_generation = true`
6. `topup_started`
7. `topup_completed` where `is_first_wallet_topup = true`

Suggested breakdowns are first-touch source/medium, first-touch campaign, cohort week, landing surface, locale, device category, auth method, and selected engine.

The same document explains how to inspect failure branches for signup confirmation, generation failure, top-up cancellation, and top-up failure.

## Architecture Boundaries

- Journey parsing, attribution, storage, event projection, and wallet projection belong in focused browser-safe analytics modules under `frontend/lib/analytics/`.
- `GA4EventBridge` remains the owner of custom-event transport and generation terminal correlation.
- `GA4RouteTracker` remains the owner of route views and safe analytics locations.
- Login hooks remain the owners of password and Google auth intent.
- `useHostedWalletCheckout` remains the shared route-agnostic checkout orchestrator.
- `frontend/lib/wallet/hosted-checkout.ts` remains the browser request contract owner.
- `POST /api/wallet` remains the server validation and Stripe-session owner.
- the Stripe webhook remains the completed-payment and server-GA4 owner.
- no server-only dependency enters a client module.
- no route file takes ownership of journey logic.

Relevant architecture and contract tests must be updated rather than bypassed.

## Test Strategy

### Journey helpers

Unit tests cover:

- consent-granted creation and consent-denied omission;
- UUID and cohort creation;
- 90-day expiry;
- first touch immutability;
- qualifying last-touch updates;
- direct and internal navigation not overwriting attribution;
- UTM normalization, length limits, and invalid character removal;
- search, referral, and direct classification;
- malformed storage records;
- consent-withdrawal cleanup;
- pre-consent events are not queued, retried, persisted, or replayed after consent;
- cryptography and storage failure fallback;
- low-cardinality landing-surface projection.

### Event enrichment

Tests cover:

- `funnel_entry` emitted once;
- common fields added only with consent;
- component payloads cannot override journey-owned fields;
- Google signup emits `sign_up_started` and Google signin does not;
- first and later generation sequence fields;
- terminal generation events inherit the start context;
- first and later top-up attempt fields;
- existing event names and payload fields remain present.

### URL safety

Tests cover auth, billing return, workspace, tool, watch-page, localized marketing, and arbitrary-query URLs. Assertions verify that sensitive parameters, hashes, and dynamic private identifiers are absent while route family, tool name, workspace section, and sanitized attribution remain available.

### Wallet and Stripe

Tests cover:

- optional client projection serialization;
- consent-denied server omission;
- valid server normalization;
- malformed analytics ignored without a checkout error;
- metadata copied to Session and PaymentIntent;
- Stripe metadata bounds;
- checkout-session reuse for identical attribution;
- no reuse for missing, changed, or mismatched attribution;
- webhook propagation to `topup_completed` and `purchase`;
- `is_first_wallet_topup` correctness;
- no server GA4 event without consent;
- receipt and wallet idempotency unchanged.

### Regression validation

Run the focused analytics, auth, workspace generation, billing, hosted checkout, checkout reuse, wallet route, Stripe checkout, and Stripe webhook suites. Then run:

```bash
pnpm run test:validate
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

No real payment, OAuth account, or production GA4 property is required for automated validation.

## Acceptance Criteria

1. A consented visitor receives one opaque 90-day journey record and one `funnel_entry` event.
2. First touch is stable; only a valid campaign or external referral can update last touch.
3. Denied or withdrawn analytics consent leaves no journey record and no journey projection.
4. Signup, generation, and top-up funnel events share the same journey and acquisition fields.
5. Google signup emits a start event without changing Google signin classification or delaying redirect.
6. The first generation and first wallet top-up can be filtered separately from later usage.
7. GA page locations contain no query string, hash, OAuth values, Stripe IDs, redirect targets, or dynamic private identifiers.
8. A valid consented journey reaches Stripe Session and PaymentIntent metadata through server validation.
9. Completed webhook events preserve the same attribution and authoritative first-wallet-top-up state.
10. Checkout-session reuse cannot attach a new attribution journey to stale metadata.
11. Missing or invalid analytics never blocks signup, generation, checkout, wallet credit, receipt creation, or webhook completion.
12. GA4 setup documentation defines the dimensions, metrics, funnel steps, breakdowns, and high-cardinality exclusions.
13. Existing routes, localized paths, SEO behavior, pricing, checkout protection, and product UI remain unchanged.
14. Focused tests, the full validation suite, lint exposure, and diff checks pass.

## Rollout

The implementation can ship without a feature flag because it is consent-gated, additive to existing events, and fails open. Before production interpretation:

1. deploy the code;
2. register the documented low-cardinality GA4 dimensions and metrics;
3. verify the event chain in DebugView with a test campaign URL;
4. verify that consent denial produces no journey parameters;
5. complete a Stripe test-mode top-up and confirm server event attribution;
6. build the documented Funnel Exploration;
7. allow at least one full acquisition cycle before making conversion decisions.

If production diagnostics reveal unexpected cardinality or malformed campaign values, disable interpretation of the affected field in GA4 while keeping checkout and product behavior unchanged.
