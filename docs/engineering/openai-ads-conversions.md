# OpenAI Ads conversions

Implemented 2026-11-12. This is click-attributed CAPI measurement, independent of GA4
delivery and campaign bidding. It does not install the Pixel SDK or automatic
advanced matching. No email, phone, IP, user agent, external user ID, prompt or
media is sent to OpenAI. `opt_out=true` is set on each event.

## Event owners

- `OpenAIAttribution` stores the original `oppref` only after both current-policy
  analytics and advertising consent. The first-party Secure/SameSite=Lax cookie
  expires after 30 days and is removed on withdrawal or confirmed admin status.
  Unavailable/anonymous role resolution suppresses capture and emission without
  deleting the consented click, so email confirmation can recover attribution.
  Admin/password-reset routes and non-production hostnames do not capture it. An ordinary logout does
  not erase a browser click; account identity is never stored in this cookie.
- `/api/analytics/openai-registration` authenticates the request, checks current
  policy/consent/admin eligibility, then reads the actual Supabase account. Only
  confirmed accounts created after the captured click, less than 167 hours ago,
  queue `registration_completed`. Existing-account logins cannot convert. The
  stable event ID derives from the account ID but is sent only as an event ID.
- `/api/wallet` snapshots consented click attribution into the new Stripe Checkout
  metadata. Session reuse requires matching click and consent; a withdrawal or
  new click cannot reuse an old measurement snapshot. Stripe's verified paid
  translators preserve only those explicit fields in the canonical receipt.
- Repair reads only newly marked live `topup` receipts, with a real payment
  identity and settlement amount/currency. `order_created` uses actual minor
  units (including taxes), not wallet USD credits. No generation debit, refund,
  test payment, manual credit or historical payment is promoted to a purchase.
  The legacy direct card-funded generation API remains outside wallet-top-up
  measurement, as with the existing GA4 wallet outbox.

## Delivery, consent and limits

`openai_conversion_outbox` provides stable dedupe keys, SKIP LOCKED claims,
two-minute fenced leases, eight attempts, exponential backoff and a 167-hour
expiry, before OpenAI's seven-day limit. Each five-minute production cron repairs
at most 20 receipts and delivers at most 20 events, four concurrent, with a
five-second HTTP timeout and no redirects. A failed measurement never changes
wallet fulfillment. Terminal records erase queued payload/user linkage and retain
non-identifying dedupe tombstones. Malformed receipts cannot starve repair.

Before each send the worker checks the current policy, authoritative admin tables
and both stored cookie-consent categories. Unavailable role/consent reads retry
without emission. A later stored consent decision suppresses the old snapshot;
a regrant cannot revive it. Anonymous cookie choices have no account history:
the original granted snapshot is required. A withdrawal that never reaches the
server cannot be observed there. Stripe/receipt metadata follows the existing
payment-record retention; queue payload erasure is not deletion of those records.

Only events with a retained `oppref` are sent. Missing/rejected consent, blockers,
closed browsers before capture/authentication, confirmation after the age window,
or missing click IDs can reduce measured conversions. This is not exhaustive
customer attribution or view-through measurement. Native Ads conversions, GA4
sessions/key events and the financial ledger remain separate measurements.

## Release

Apply only `neon/migrations/99_openai_conversion_outbox.sql` on the verified Neon
target before this runtime; it is additive and replayable. Configure production
server-only `OPENAI_ADS_PIXEL_ID`, Secret `OPENAI_ADS_CONVERSIONS_KEY`, and the
existing `CRON_SECRET`. No production secret is provided to previews. Setting
`OPENAI_ADS_CONVERSIONS_DISABLED=1` pauses capture on the server and the cron.
Follow normal Quality CI, production alignment and Git-backed Vercel delivery.

Validate request shape with `validate_only:true`; it does not save conversions.
OpenAI Pixel UI test events do count in analytics and are not used as synthetic
production acceptance. Monitor only aggregate queue status/name/outcome/HTTP
counts. HTTP acceptance proves receipt, not campaign attribution.

Official sources checked 2026-11-12:
- https://developers.openai.com/ads/conversions-api
- https://developers.openai.com/ads/supported-events
- https://developers.openai.com/ads/measurement-pixel

Focused tests: `openai-ads-{conversions,browser,outbox-postgres}`, wallet checkout
reuse, Stripe top-up translators and existing analytics consent/transport suites.
