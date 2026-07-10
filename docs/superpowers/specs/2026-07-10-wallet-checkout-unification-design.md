# Wallet Checkout Unification Design

## Objective

Unify the hosted wallet top-up path used by Billing and the authenticated Workspace so that a user who lacks funds can start a correctly configured checkout in one action, without weakening the existing Stripe, captcha, rate-limit, authentication, analytics, or routing contracts.

The primary success scenario is:

1. An authenticated user attempts a generation that costs USD 12.34 more than the wallet balance.
2. The Workspace opens its existing top-up dialog with USD 13 selected, the smallest whole-dollar amount that covers the shortfall and respects the USD 10 minimum.
3. The user confirms once.
4. The same hosted-checkout orchestration used by Billing sends amount, currency, locale, authentication, and captcha data to `/api/wallet`.
5. Stripe Checkout opens, including the existing session-ID fallback when a direct URL is unavailable.
6. After a successful return to Billing, the page offers a safe, explicit return to `/app` so the user can resume generation.

## Scope

This conversion-repair lot includes:

- a shared browser-side hosted wallet checkout contract;
- one shared stateful checkout hook for request state, captcha, rate limiting, error classification, redirect, and Stripe fallback;
- migration of Billing's hosted checkout path to that shared hook;
- migration of the Workspace top-up path to that shared hook;
- automatic Workspace top-up selection from the computed wallet shortfall;
- a shared Turnstile presentation component usable by both routes;
- consistent checkout-interaction and top-up analytics across Billing and Workspace;
- a same-origin, allowlisted post-checkout return affordance for Workspace-originated top-ups;
- focused behavior, architecture, and regression tests.

The existing Express Checkout flow remains a separate Billing-owned path.

## Out of Scope

- Changes to wallet pricing, model costs, taxes, foreign-exchange rules, or the USD 10 minimum.
- Changes to Stripe webhooks, wallet crediting, database schema, or payment-session metadata.
- A redesign of Billing or Workspace visual language.
- Automatic generation after checkout or automatic redirection away from the Billing success state.
- Persisting the complete composer prompt, uploaded assets, or generation request across checkout.
- Changes to public marketing URLs, localized slugs, canonical URLs, hreflang, JSON-LD, sitemaps, or redirects.
- Replacing the existing Express Checkout implementation.
- The later guest-workspace, Status, signup-density, funnel-dashboard, commercial-consistency, or performance lots.

## Chosen Approach

Use one shared hosted-checkout hook backed by a route-neutral browser client. Route components continue to own their copy, layout, selections, quote enrichment, and route-specific callbacks.

This approach preserves the Workspace's one-click recovery path while eliminating its reduced direct implementation of `/api/wallet`. Redirecting every Workspace user to Billing before checkout would be simpler technically, but it adds an avoidable decision and click at the most fragile point in the funnel. A large rewrite of Billing and Workspace into a single payment surface would create unnecessary regression risk.

The shared boundary is intentionally limited to the behavior that must be identical:

- authenticated request construction;
- response classification;
- captcha challenge state and retry;
- rate-limit state;
- duplicate-submit prevention;
- direct redirect and Stripe.js fallback;
- common interaction-event vocabulary.

Billing-specific quotes, consent-aware advertising conversion events, Express Checkout, and Workspace generation preflight remain outside the shared boundary.

## Architecture

### Shared browser client

Add `frontend/lib/wallet/hosted-checkout.ts` as a browser-safe module. It owns the request and response contract without importing React, route components, server-only modules, billing copy, or workspace copy.

Its input is explicit:

```ts
type HostedWalletCheckoutInput = {
  amountCents: number;
  currency: string;
  locale: string;
  accessToken: string | null;
  captchaToken?: string;
};
```

The request continues to target `POST /api/wallet` and sends the existing authenticated headers and JSON fields. Currency is a normalized three-letter settlement-currency code: Billing preserves its detected or selected currency, while Workspace explicitly supplies `USD`. A missing access token omits the bearer header and retains same-origin credentials so the endpoint can use its existing cookie authentication fallback. Amount and enabled-currency validation remain authoritative on the server. The client validates only enough to prevent malformed local requests.

The client returns a discriminated result instead of throwing for expected endpoint outcomes:

```ts
type HostedWalletCheckoutResult =
  | {
      kind: 'ready';
      url: string | null;
      sessionId: string | null;
      checkoutAttemptId: number | null;
    }
  | { kind: 'captcha_required' }
  | { kind: 'rate_limited'; retryAfterSeconds: number | null }
  | {
      kind: 'failed';
      reason: 'authentication' | 'validation' | 'network' | 'stripe' | 'unknown';
      checkoutAttemptId: number | null;
    };
```

A response is `ready` only when it supplies a non-empty checkout URL or session ID. Malformed success payloads become `failed`. The client does not navigate, load Stripe.js, display copy, or emit Google Analytics events.

### Shared hosted-checkout hook

Add `frontend/hooks/useHostedWalletCheckout.ts`. It owns:

- `isSubmitting`;
- `captchaRequired`;
- the current captcha token;
- the normalized error kind and rate-limit delay;
- checkout execution and guarded retry;
- direct navigation to the returned Stripe URL;
- the existing Stripe.js redirect fallback for a returned session ID;
- reset behavior when the selected amount or currency changes.

The hook receives the current amount, normalized settlement currency, locale, optional access token, and callbacks for interaction analytics, route-specific top-up analytics, and normalized failures. Route components map those failures to their localized copy. The hook does not import route-local translation files or quote models.

Submitting while `isSubmitting` is true is a no-op. A `captcha_required` result exposes the challenge without closing the current surface. Solving the challenge stores the token; the user then confirms the same checkout action again. Changing amount or closing the surface clears transient captcha and error state.

The hook records a pending safe return target before Workspace navigation only when its caller supplies `/app`. Billing calls it without a return target.

### Shared Turnstile component

Move the reusable Turnstile presentation into `frontend/components/ui/TurnstileChallenge.tsx`. Preserve its current script loading, token callback, error callback, theme, and cleanup behavior.

Keep a compatibility re-export at Billing's current route-local import path for existing imports and architecture contracts. Workspace imports only the shared component and must not import a Billing route component.

### Shared checkout interaction events

Move the browser event recorder implementation to `frontend/lib/analytics/checkout-interaction-events.ts` and leave a compatibility re-export in Billing's current route-local module.

Both hosted-checkout consumers use the same event names:

- `hosted_checkout_requested`;
- `hosted_checkout_captcha_required`;
- `hosted_checkout_rate_limited`;
- `hosted_checkout_failed`;
- `hosted_checkout_redirecting`.

Every event includes non-personal metadata:

```ts
type CheckoutInteractionSource = 'billing' | 'workspace';
```

The payload may include source, route family, amount in cents, normalized currency, checkout attempt ID, and failure category. It must not include email, prompt text, uploaded filenames, access tokens, captcha tokens, Stripe customer data, or other personal content.

## Billing Migration

`BillingClient` replaces only its hosted `/api/wallet` request, response interpretation, captcha state, rate-limit state, and Stripe redirect block with `useHostedWalletCheckout`.

It preserves:

- the current top-up tiers and custom selection;
- currency detection and displayed quotes;
- locale selection;
- Supabase session retrieval and authenticated headers;
- the first-top-up card restrictions enforced by the endpoint;
- existing success, failure, and return analytics;
- consent-aware Google Analytics and Google Ads behavior;
- the current hosted-checkout copy and toast behavior;
- Express Checkout as an independent path;
- checkout cancellation and success query cleanup.

`useBillingTopupAnalytics` remains the owner of Billing quote enrichment and advertising-conversion behavior. It supplies callbacks to the shared hook instead of being moved into it.

The migration must reduce or preserve the size of `BillingClient`; it must not push the route owner beyond the existing architecture threshold.

## Workspace Migration

`useWorkspacePricingGate` and the existing wallet-preflight boundary remain responsible for deciding whether generation can proceed. They no longer implement their own reduced `fetch('/api/wallet')` path.

When preflight detects a shortfall, the selected top-up amount is:

```ts
Math.max(1000, Math.ceil(shortfallCents / 100) * 100)
```

Examples:

- a USD 0.01 shortfall selects USD 10;
- a USD 7.44 shortfall selects USD 10;
- a USD 12.34 shortfall selects USD 13;
- a USD 25.00 shortfall selects USD 25.

If the result matches a preset, that preset is selected. Otherwise the existing custom-amount control displays the computed whole-dollar amount. The user may still increase or change it, subject to the current minimum.

The Workspace submits:

- the selected amount in cents;
- `USD`, matching the current wallet presentation;
- the resolved application locale;
- the current access token;
- a Turnstile token when required.

The top-up dialog stays open for captcha, rate-limit, and recoverable failure states. It remains keyboard accessible through the shared modal behavior added in the preceding lot. Generation does not start until a subsequent wallet preflight confirms sufficient funds.

Workspace analytics emit the common checkout-interaction events plus `topup_started` and `topup_failed` with source `workspace`. Workspace must not emit the Billing success conversion or advertising-conversion event when checkout merely starts.

The workspace route boundaries remain intact:

- `AppClient.tsx` stays an orchestrator;
- wallet preflight remains in `useWorkspaceWalletPreflight.ts`;
- pricing and checkout gating remain in route-local hooks;
- runtime modal composition remains in `WorkspaceRuntimeModals.tsx`;
- generation submission, accepted results, and polling are unchanged.

## Safe Return to Workspace

Add a small route-neutral session-storage helper that stores only an allowlisted relative destination. For this lot, the only accepted pending checkout return target is `/app`.

Before a Workspace-originated Stripe redirect, store `/app`. Do not encode the target in Stripe URLs, success URLs, public query parameters, or payment metadata.

On a successful Billing return:

- consume the valid pending target once;
- keep the user on the Billing success state;
- render an explicit localized action to return to the Workspace;
- do not auto-redirect, because wallet crediting may still be finalizing through the webhook.

On checkout cancellation, consume and discard the pending target so a later unrelated top-up cannot display stale Workspace context. Missing, expired, malformed, cross-origin, or storage-blocked state is ignored without changing current Billing behavior. The stored record expires after one hour.

## Endpoint and Payment Invariants

The existing `/api/wallet` endpoint remains the server authority. This lot must not change its public request or response shape.

The following behavior remains unchanged:

- authentication and wallet ownership checks;
- minimum amount validation;
- supported currency resolution;
- checkout guard and rate limiting;
- Turnstile verification;
- first-top-up American Express restriction;
- Stripe customer reuse;
- success and cancellation destinations under `/billing`;
- session metadata consumed by webhooks;
- wallet-credit idempotency;
- checkout-attempt recording.

No database migration is required. No access token or captcha token is persisted outside the active request.

## Error Handling

- Missing authentication keeps the existing auth-gate behavior; the shared hook does not invent a guest checkout.
- `captcha_required` reveals the inline challenge and keeps the top-up surface open.
- A captcha script or verification error uses the current localized recoverable error behavior.
- HTTP 429 produces the localized rate-limit state and respects a valid retry delay returned by the endpoint.
- A malformed success response produces the generic localized top-up error and does not navigate.
- A direct Stripe URL is used first; a session ID uses the current Stripe.js fallback.
- Failure to load Stripe.js produces a recoverable localized error.
- Browser storage failures never block checkout.
- Duplicate confirmation is prevented while a request or redirect setup is active.
- Closing the modal or changing amount clears stale captcha and checkout errors.

## SEO, Localization, and Routing Safety

This lot changes authenticated client behavior, not public route architecture.

It must preserve:

- `/billing`, `/app`, and `/api/wallet` paths;
- localized public route slugs and route groups;
- canonical, hreflang, JSON-LD, robots, and sitemap output;
- current authentication redirects and sanitized `next` behavior;
- existing Stripe success and cancellation URLs;
- locale-aware UI copy without introducing English-only strings into translated surfaces.

The `/app` return target is a hard allowlist entry, not arbitrary user input. No new public indexable URL or query contract is introduced.

## Testing Strategy

Implementation follows red-green-refactor. Each behavior change starts with a focused failing test.

Required automated coverage:

1. Hosted checkout request construction includes amount, USD currency, locale, captcha token when present, JSON headers, and the bearer token.
2. Response classification covers direct URL, session-ID fallback, captcha required, rate limiting, explicit endpoint error, network failure, and malformed success.
3. The shared hook prevents duplicate submission, exposes captcha state, resets transient state, and calls redirect and analytics callbacks once.
4. Workspace shortfall selection rounds up to the next whole dollar and enforces the USD 10 minimum.
5. Preset and custom Workspace selections reflect the computed sufficient amount.
6. Workspace checkout supplies locale, USD currency, authentication, and captcha through the shared path.
7. Billing hosted checkout uses the shared path while Express Checkout remains separate.
8. Billing and Workspace no longer contain duplicate direct hosted `fetch('/api/wallet')` implementations.
9. Checkout-interaction events include the correct Billing or Workspace source and exclude sensitive values.
10. The pending return helper accepts only `/app`, expires after one hour, consumes once, handles unavailable storage, and clears on cancellation.
11. A successful Workspace-originated checkout return renders a visible return-to-Workspace action without automatic navigation.
12. Billing, Workspace pricing-gate, wallet-preflight, modal, analytics, and route architecture contracts remain green.

Focused checks run before the full suite. The implementation plan must list the exact existing test files discovered at execution time rather than relying on stale filenames in this design.

Final verification:

```bash
npm --prefix frontend run lint
npm run lint:exposure
pnpm test:validate
npm --prefix frontend run build
git diff --check
```

Manual browser smoke coverage includes:

- Billing hosted checkout start with a valid tier;
- Workspace shortfall opening the top-up dialog with the sufficient amount selected;
- keyboard-only modal behavior;
- captcha-required rendering and retry without completing a payment;
- rate-limit and malformed-response recovery;
- successful-return UI with a pending `/app` target simulated locally;
- cancellation cleanup;
- no regression in guest auth gates or normal generation when the wallet is sufficient.

No real payment is completed as part of verification.

## Acceptance Criteria

- Billing and Workspace use one shared hosted wallet checkout hook and response contract.
- Workspace no longer calls `/api/wallet` through a reduced route-specific implementation.
- A Workspace shortfall preselects the smallest whole-dollar top-up that covers the shortfall while respecting the USD 10 minimum.
- Workspace checkout sends amount, USD currency, locale, authentication, and captcha data consistently.
- Captcha, 429, malformed response, Stripe URL, and Stripe session-ID fallback states behave consistently across both hosted-checkout consumers.
- Billing selection, quotes, Express Checkout, consent-aware analytics, and current localized copy remain unchanged.
- A successful Workspace-originated checkout return can show a safe, one-time action back to `/app` without automatic redirection.
- No public route, SEO output, authentication contract, payment endpoint contract, webhook behavior, or database schema changes.
- Focused tests, the full validation suite, lint, exposure lint, production build, and `git diff --check` pass.
