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
card action remains available. Loading errors provide the same card fallback.

`WalletAmountPicker` keeps four preset amounts plus a custom amount. USD is
explicit in the section hint; compact currency symbols keep the four presets
readable on small screens. Payment confirmation locks the amount, currency, and
alternative checkout action until it succeeds or fails.

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

The first-top-up Amex brand restriction applies to hosted Checkout. Stripe's
custom Checkout mode does not support that restriction; the route records
`checkout_elements_unsupported` explicitly. Do not describe the native wallets
as enforcing identical brand restrictions or silently weaken the hosted policy.
The shared rate limits, progressive CAPTCHA, and Stripe fraud controls remain.

Dashboard fraud settings are independent of this code. A disabled legacy Radar
rule can have been replaced by newer risk controls: inspect the current controls
before concluding that protection is disabled or changing a rule.

Hosted Checkout with automatic tax has additional Google Pay conditions around
shipping address availability. Do not add a shipping form to digital credits
solely to force a wallet button. Validate the actual native flow on supported
iPhone and Android devices; desktop emulation cannot certify their payment sheet.

New local methods require account eligibility, a supported charge currency,
confirmation and return-flow testing, and webhook fulfillment verification.
Checkout's dynamic methods should handle presentation. A Dashboard toggle alone
does not establish support (for example, BLIK requires PLN, outside the current
EUR/USD/GBP/CHF billing currencies).

## Measurement and verification

`checkout-report.ts` treats a canonical receipt as paid regardless of missing
browser events. No eligible wallet is a passive view, not a technical error.
The Amex metric counts sessions with the restriction applied, not card declines.
Automatic wallet preparation creates passive sessions: measure confirmation and
paid receipts separately from session creation when comparing conversion.

Run billing, wallet, checkout, and Stripe tests with the frontend tsconfig,
then lint, TypeScript, localization parity, and the production build. The
runtime native-checkout test covers rapid selections, session reuse, duplicate
confirmation, retry, stale responses, and no-wallet availability. Component
fixtures are useful for layout checks but do not prove actual payment success.
