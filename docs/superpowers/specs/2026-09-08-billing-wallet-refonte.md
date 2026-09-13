# Billing and Wallet Refonte

## Intent

Billing should read as one operational wallet flow rather than a collection of unrelated cards. The user must be able to see the available balance, choose how many USD wallet credits to add, understand the current payment quote in the selected charge currency, continue through an existing payment route, return safely, refresh the wallet, and inspect the ledger or open an available Stripe document.

This design applies only to `frontend/app/(core)/billing`, its route-local components, hooks, copy, styles, and architecture tests. The global app shell, Studio, Activity, pricing policy, Stripe configuration, webhook processing, secrets, and remote data are outside this change.

## Existing action inventory

The implementation must retain these real actions and states:

- authenticated wallet balance from `GET /api/wallet`, including its USD display contract and first-top-up flag;
- the four authored USD credit amounts and any custom amount of at least USD 10;
- enabled charge-currency selection and its automatic or overridden state;
- live quote lookup through `POST /api/topup/quote`;
- hosted Stripe Checkout as the primary payment path;
- existing Apple Pay, Google Pay, PayPal, and Link express eligibility detection, with no promise that a method will appear;
- captcha, submission, rate-limit, failure, unavailable, closed, cancelled, test-mode, and unauthenticated states;
- safe checkout return cleanup, analytics events, and the optional return-to-workspace target;
- wallet top-ups, generation charges, refunds, pagination, CSV export, historical itemization, job IDs, and available invoice or receipt links;
- automatic failed-generation refunds and the no-subscription/no-expiry explanations already supported by product policy.

## Problems to solve

1. The current balance looks like secondary metadata and does not expose loading, refresh, or failure state.
2. Credit selection, charge-currency quote, and payment action compete in one dense panel. A local-currency quote can remain visible while a new quote is loading.
3. The page labels the selected USD credit amount as the checkout amount even when a different settlement currency is selected. The amount paid and credits received are not visually distinct.
4. A successful checkout return shows a transient toast but does not explicitly coordinate wallet and receipt refresh. Webhook settlement can therefore be visually ambiguous.
5. Receipt entries are nested cards inside a history card, increasing vertical weight and obscuring the ledger relationship.
6. Billing wallet and receipt reads rely on mount flags, but pagination and explicit refresh need a stronger account/request scope so late results cannot cross account changes.

## Chosen structure

The page has four horizontal responsibilities:

1. **Wallet overview.** A compact heading and balance readout provide initial loading, usable refresh, unavailable, low-balance, test-mode, and manual refresh states. Test mode is visible; normal live mode is not promoted as product content.
2. **Add credits.** A single open work surface presents numbered steps: choose credits, review the current quote, then select the existing hosted or eligible express payment path. Preset and custom amounts remain real controls. The quote always labels `Credits received` in USD and `Payment amount` in the selected charge currency. A quote that belongs to an earlier currency or amount is never presented as current.
3. **Protections.** Short factual rows sit beside or below the funding surface without nested cards or decorative paragraphs.
4. **Activity and documents.** A ledger-style list uses dividers and compact summaries. Native details reveal itemization, job identity, and document actions. Pagination and CSV export remain explicit.

At desktop width the funding surface and protections use a broad/narrow grid. At mobile width all content becomes one column; the balance, amount choices, summary rows, payment action, and receipt actions keep at least 44 px interaction targets. The route uses the existing app shell and a local CSS module for responsive layout, focus, light/dark tokens, and reduced-motion behavior.

## State and data flow

`BillingClient` remains the route-level orchestrator. It composes route-local presentation and existing checkout owners, but does not fetch wallet, receipts, currencies, or quotes directly.

`useBillingSessionState` owns account-scoped wallet and Stripe-mode reads. It exposes the wallet value, initial/refresh status, an unavailable error state, and `refreshWallet`. Every request captures the current user ID and a monotonically increasing request ID. Account change, sign-out, or unmount invalidates all earlier responses. Refresh retains a usable wallet while loading.

`useBillingReceipts` uses the same account/request discipline for initial reads, manual refresh, and pagination. It checks HTTP status and response shape before applying data. A refresh may retain current rows while reporting a non-destructive error; an account change clears rows immediately.

`useBillingCheckoutReturnToast` reports whether the URL carried a successful or cancelled return. On success, `BillingClient` starts a bounded reconciliation that refreshes wallet and receipts immediately and once more after a short delay. It does not assert that a webhook has settled; the visible state says the payment returned and the account data is refreshing. The URL remains cleaned once and analytics behavior remains unchanged.

`useBillingTopupQuotes` clears incompatible quotes as soon as amount or currency scope changes. Only the response for the current request scope can replace the map. The hosted and express checkout components continue to receive the same USD credit amount and selected charge currency.

## Copy and commercial truth

- `Credits received` is the authored USD wallet amount. It is not a generation estimate.
- `Payment amount` comes only from the current quote for the selected amount and currency. During refresh or failure it is replaced by an explicit state, never a stale value.
- Taxes and the final Stripe receipt remain finalized by Stripe before payment.
- No rate, bonus, membership saving, fee, or generation count is added.
- Existing historical discount fields may render when present; no live membership benefit is introduced.
- Demo and fixture values must be visibly local preview data and must never be presented as the signed-in account.

## Accessibility and visual behavior

- Semantic headings, fieldsets, labels, status regions, tables/list structure, and native details describe the workflow without color alone.
- Focus-visible treatment uses the app ring token. Amount controls expose `aria-pressed`; async regions use non-interruptive status text.
- Motion is limited to 120–180 ms focus/expansion feedback and is disabled with `prefers-reduced-motion`.
- No emoji, decorative badges, hover-only controls, nested card stacks, autoplaying media, or remote visual dependencies are introduced.

## Verification and limits

Automated checks cover request-scope invalidation, quote freshness, checkout-return reconciliation ownership, component boundaries, copy parity, and existing checkout/receipt contracts. Browser inspection covers desktop and mobile in light and dark themes, keyboard traversal, custom amount validation, quote/error/loading variants, receipt expansion, and checkout return states using an explicitly local fixture or verified disposable environment.

No real payment, top-up, production write, remote migration, push, deployment, Stripe-mode change, or webhook mutation is part of validation. A local checkout button may be inspected but must not be followed into a charge.
