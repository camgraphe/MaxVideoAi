# Billing checkout ownership

## Customer flow

`BillingClient.tsx` orchestrates authentication, the selected USD credit amount,
the charge currency, quotes, and the existing hosted-checkout hook.
`WalletTopupPanel` composes the amount picker and one payment summary. The summary
shows the amount before tax separately from wallet credits. Stripe calculates
the final tax and total before payment confirmation.

Eligible signed-in customers see Stripe's native Express Checkout Element below
the quote. Stripe owns wallet availability, branding, button labels, and order.
Do not add static wallet logos or a reveal button: an advertised wallet must be
usable on that customer's device. No eligible wallet is a normal state; the
hosted action remains available. Loading errors provide the same fallback for
cards and eligible local payment methods.

The hosted action keeps its card/other-method label, followed immediately by a
localized secure-payment line and the official Stripe wordmark. The small local
SVG comes from [Stripe's logo kit](https://stripe.com/newsroom/information); its
mask preserves the artwork and uses the approved slate/white colors for light
and dark themes. It adds no external script or competing checkout action.

`WalletAmountPicker` keeps four preset amounts plus a custom amount. USD is
explicit in the section hint; compact currency symbols keep the four presets
readable on small screens. Payment confirmation locks the amount, currency, and
alternative checkout action until it succeeds or fails.

New payments offer EUR and USD through the existing `resolveEnabledCurrencies`
policy (`ENABLED_CURRENCIES` can override it for a deliberate environment policy).
Keep GBP and CHF recognized for historical records; do not rewrite balances,
receipts, refunds, or saved preferences to remove them from the checkout menu.
`GET /api/me/currency` uses the same resolution as the wallet: a supported saved
preference wins, otherwise US customers default to USD and all other countries
default to EUR. Missing geolocation also falls back to EUR. Customers can always
choose either enabled currency manually. Old GBP/CHF preferences are ignored
for new payments without changing the saved historical values.
Quote and payment creation both reject an explicitly disabled currency. This
keeps old clients from obtaining a quote that the payment endpoint cannot use.

## Existing payment boundaries

Both interfaces create Checkout Sessions through `POST /api/wallet` and the
existing `buildWalletTopUpCheckoutSessionParams` owner. The hosted action uses
`useHostedWalletCheckout`; the native wallets use `WalletExpressCheckout` and
Stripe Checkout actions. Do not add a third PaymentIntent payment path here or
replace the legacy generation payment path as part of a billing UI change.

The shared route owns authorization, allowed currencies, FX, top-up amount,
rate limits, CAPTCHA decisions, customer identity, invoice creation, and tax.
Fulfillment remains in the [Stripe webhook owners](stripe-webhook.md). A browser
return or successful UI callback never credits the wallet itself.

## Session lifecycle

The native element waits for currency and quote loading to finish, then waits
300 ms for the amount selection to settle before requesting a session.

The component's memory-only cache contains at most eight sessions. Its key
includes user, amount, currency, locale, CAPTCHA state, consent, and attribution.
Concurrent requests with the same key share a promise. The API returns the
actual Stripe `expiresAt` value; cached entries expire 30 seconds before that
deadline. Missing expiration disables client caching. The existing server reuse
helper still verifies ownership, attribution, and open/unpaid session state.

Changing account remounts the native component and drops the cache. Late API or
Stripe callbacks from a replaced selection must not change the current UI or
request a stale CAPTCHA. Duplicate confirmation events are ignored. Failed
confirmation allows a deliberate retry on the same session, preserving existing
per-session card-failure limits.

## Fraud and payment-method constraints

Hosted and native Checkout accept the account's supported card brands, including
Amex, from the first purchase. Do not reinstate a blanket brand ban as a proxy
for card testing. First-purchase metadata still drives the existing shared rate
limits, progressive CAPTCHA, and failed-payment cooldown. Stripe owns card
testing mitigations and required 3DS; no global manual 3DS override is sent.

Dashboard fraud settings are independent of this code. A disabled legacy Radar
rule can have been replaced by newer risk controls: inspect the current controls
before concluding that protection is disabled or changing a rule.
Vercel sensitive environment variables are unreadable in local exports. An empty
export does not prove an absent CAPTCHA secret: check variable metadata and
recent `checkout_attempts` configuration/challenge outcomes before changing it.

Hosted Checkout with automatic tax has additional Google Pay conditions around
shipping address availability. Do not add a shipping form to digital credits
solely to force a wallet button. Validate the actual native flow on supported
iPhone and Android devices; desktop emulation cannot certify their payment sheet.

New local methods require account eligibility, a supported charge currency,
confirmation and return-flow testing, and webhook fulfillment verification.
Checkout's dynamic methods should handle presentation. A Dashboard toggle alone
does not establish support (for example, BLIK requires PLN, outside the current
EUR/USD billing currencies).

As checked on 2026-09-15, Cartes Bancaires and Bancontact are active on the live
account. Bizum is also active after the owner completed Stripe identity
verification. It uses EUR and hosted Checkout; it is not an Express Checkout
Element button. Payment-method availability remains owned
by Stripe, using currency, location, device, amount, and account eligibility.
The account currently disables custom availability editing; do not claim that
strict country-only rules have been configured. No country-to-method table is
authored in the application. Alma/Klarna remain off; no paid Radar plan was added.

The existing live webhook subscription now also includes
`checkout.session.async_payment_succeeded` and `invoice.paid`. These use the
existing fulfillment/document handlers. Preserve subscription events when
updating the endpoint, and never credit a pending payment on browser return.

## Measurement and verification

`checkout-report.ts` treats a canonical receipt as paid regardless of missing
browser events. No eligible wallet is a passive view, not a technical error.
The historical Amex metric counts sessions with the old restriction applied,
not card declines. Preserve its reader for older records; new sessions no longer
write the deprecated restriction metadata.
Automatic wallet preparation creates passive sessions: measure confirmation and
paid receipts separately from session creation when comparing conversion.

Run billing, wallet, checkout, and Stripe tests with the frontend tsconfig,
then lint, TypeScript, localization parity, and the production build. The
runtime native-checkout test covers rapid selections, session reuse, duplicate
confirmation, retry, stale responses, and no-wallet availability. Component
fixtures are useful for layout checks but do not prove actual payment success.
