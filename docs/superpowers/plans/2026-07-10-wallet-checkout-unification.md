# Wallet Checkout Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Billing and the authenticated video Workspace one reliable hosted wallet checkout path, with sufficient-amount selection, captcha/rate-limit parity, safe return to `/app`, and unchanged payment/SEO contracts.

**Architecture:** A route-neutral browser client classifies `/api/wallet` responses, while one shared React hook owns hosted-checkout state, Stripe redirect behavior, and interaction events. Billing and Workspace retain their route-specific selection, copy, analytics enrichment, and UI; a one-hour session-storage record carries only the allowlisted `/app` return context.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript 5.4, Supabase Auth, Stripe.js 8, Cloudflare Turnstile, Node `test`, pnpm.

## Global Constraints

- Do not change the public request or response contract of `POST /api/wallet`.
- Do not change Stripe webhook behavior, checkout-session metadata, wallet crediting, database schema, or payment idempotency.
- Preserve Billing's detected/selected settlement currencies; Workspace hosted top-up explicitly submits `USD`.
- Keep Express Checkout separate from the hosted checkout hook.
- Preserve `/billing`, `/app`, `/api/wallet`, auth redirects, localized public slugs, canonical URLs, hreflang, JSON-LD, robots, and sitemap output.
- Add no new runtime or test dependency.
- Add all new user-facing copy to English, French, and Spanish dictionaries and to the typed default copy.
- Never persist access tokens, captcha tokens, prompt text, upload names, or personal data in analytics or browser return context.
- Do not complete a real payment during verification.
- Follow red-green-refactor and commit after every independently testable task.

---

## File Structure

### New shared modules

- `frontend/lib/wallet/hosted-checkout.ts`: authenticated request construction and endpoint response classification only.
- `frontend/lib/wallet/checkout-return.ts`: allowlisted, expiring, one-time Workspace return context.
- `frontend/lib/analytics/checkout-interaction-events.ts`: stable browser recorder for Billing and Workspace interaction events.
- `frontend/lib/analytics/ga-events.ts`: existing retrying `gtag` dispatcher extracted from Billing.
- `frontend/hooks/useHostedWalletCheckout.ts`: hosted checkout state, captcha, rate limit, Stripe redirect, duplicate-submit guard, and interaction-event orchestration.
- `frontend/components/ui/TurnstileChallenge.tsx`: shared Turnstile widget presentation.
- `frontend/app/(core)/billing/_components/BillingCheckoutReturnNotice.tsx`: explicit successful-return action to `/app`.
- `frontend/app/(core)/(workspace)/app/_lib/workspace-topup.ts`: sufficient top-up rounding and Workspace analytics payload construction.

### Compatibility facades

- `frontend/app/(core)/billing/_lib/checkout-interaction-events.ts`: re-export the shared recorder.
- `frontend/app/(core)/billing/_components/TurnstileChallenge.tsx`: re-export the shared widget.

### Existing owners to modify

- `frontend/app/(core)/billing/_components/BillingClient.tsx`: consume the shared hosted checkout and return notice.
- `frontend/app/(core)/billing/_hooks/useBillingCheckoutReturnToast.ts`: consume or clear pending `/app` context on Stripe return.
- `frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics.ts`: consume the shared `gtag` dispatcher without changing Billing payload enrichment.
- `frontend/app/(core)/billing/_lib/billing-copy.ts`: default return-to-Workspace label.
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAppBootstrap.ts`: expose the already-loaded session.
- `frontend/app/(core)/(workspace)/app/AppClient.tsx`: pass locale, access token, and top-up copy into the pricing gate.
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts`: replace direct wallet POST with the shared hook and preselect a sufficient amount.
- `frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx`: render localized shortfall and captcha states.
- `frontend/app/(core)/(workspace)/app/_components/WorkspaceRuntimeModals.tsx`: carry shared checkout state into the top-up modal.
- `frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx`: wire the new pricing-gate result into runtime modals.
- `frontend/app/(core)/(workspace)/app/_lib/workspace-copy.ts`: typed default Workspace checkout copy.
- `frontend/messages/en.json`, `frontend/messages/fr.json`, `frontend/messages/es.json`: localized Workspace checkout and Billing return copy.

### Tests

- `tests/hosted-wallet-checkout.test.ts`: request and response contract.
- `tests/hosted-wallet-checkout-return.test.ts`: allowlist, expiry, consumption, and storage failure.
- `tests/workspace-topup.test.ts`: amount rounding and non-personal analytics payload.
- `tests/hosted-wallet-checkout-architecture.test.ts`: shared ownership and no duplicate route-specific wallet POST.
- `tests/billing-page-architecture.test.ts`: Billing shared-hook and return-notice boundaries.
- `tests/checkout-interaction-events.test.ts`: event ownership moved to the shared hook.
- `tests/workspace-pricing-gate-hook-contract.test.ts`: Workspace shared-hook ownership and modal wiring.

---

### Task 1: Build the hosted wallet request contract

**Files:**
- Create: `frontend/lib/wallet/hosted-checkout.ts`
- Create: `tests/hosted-wallet-checkout.test.ts`

**Interfaces:**
- Consumes: the unchanged `POST /api/wallet` JSON contract.
- Produces: `requestHostedWalletCheckout(input, fetchImpl?)`, `HostedWalletCheckoutInput`, `HostedWalletCheckoutResult`, and `HostedWalletCheckoutFailureReason`.

- [ ] **Step 1: Write the failing request-construction test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHostedCheckoutSubmissionGuard,
  requestHostedWalletCheckout,
  type HostedWalletCheckoutInput,
} from '../frontend/lib/wallet/hosted-checkout';

const validInput: HostedWalletCheckoutInput = {
  amountCents: 2500,
  currency: 'EUR',
  locale: 'fr',
  accessToken: 'access-token',
  captchaToken: 'captcha-token',
};

test('hosted wallet request preserves amount, settlement currency, locale, auth, and captcha', async () => {
  let capturedInput: RequestInfo | URL | null = null;
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedInput = input;
    capturedInit = init;
    return new Response(JSON.stringify({
      id: 'cs_test_123',
      checkoutAttemptId: 42,
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const result = await requestHostedWalletCheckout(validInput, fetchImpl);

  assert.equal(capturedInput, '/api/wallet');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(capturedInit?.credentials, 'include');
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('Authorization'), 'Bearer access-token');
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    amountCents: 2500,
    currency: 'eur',
    locale: 'fr',
    captchaToken: 'captcha-token',
  });
  assert.deepEqual(result, {
    kind: 'ready',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    sessionId: 'cs_test_123',
    checkoutAttemptId: 42,
  });
});
```

- [ ] **Step 2: Write the failing classification tests**

```ts
test('hosted wallet response supports Stripe session fallback', async () => {
  const result = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ id: 'cs_test_fallback', checkoutAttemptId: 7 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  assert.deepEqual(result, {
    kind: 'ready',
    url: null,
    sessionId: 'cs_test_fallback',
    checkoutAttemptId: 7,
  });
});

test('hosted wallet response classifies captcha and rate limiting', async () => {
  const captcha = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ captchaRequired: true }), { status: 403 })
  );
  const rateLimited = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ retryAfterSeconds: 125 }), { status: 429 })
  );
  assert.deepEqual(captcha, { kind: 'captcha_required' });
  assert.deepEqual(rateLimited, { kind: 'rate_limited', retryAfterSeconds: 125 });
});

test('hosted wallet response rejects malformed success and normalizes failures', async () => {
  const malformed = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200 })
  );
  const unauthorized = await requestHostedWalletCheckout(validInput, async () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  );
  const network = await requestHostedWalletCheckout(validInput, async () => {
    throw new TypeError('offline');
  });
  assert.deepEqual(malformed, { kind: 'failed', reason: 'unknown', checkoutAttemptId: null });
  assert.deepEqual(unauthorized, { kind: 'failed', reason: 'authentication', checkoutAttemptId: null });
  assert.deepEqual(network, { kind: 'failed', reason: 'network', checkoutAttemptId: null });
});

test('hosted wallet request rejects invalid local amount and currency without fetching', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response('{}', { status: 200 });
  };
  const invalidAmount = await requestHostedWalletCheckout({ ...validInput, amountCents: 999 }, fetchImpl);
  const invalidCurrency = await requestHostedWalletCheckout({ ...validInput, currency: 'EURO' }, fetchImpl);
  assert.deepEqual(invalidAmount, { kind: 'failed', reason: 'validation', checkoutAttemptId: null });
  assert.deepEqual(invalidCurrency, { kind: 'failed', reason: 'validation', checkoutAttemptId: null });
  assert.equal(calls, 0);
});

test('hosted wallet submission guard rejects a duplicate until the active attempt finishes', () => {
  const guard = createHostedCheckoutSubmissionGuard();
  assert.equal(guard.tryStart(), true);
  assert.equal(guard.tryStart(), false);
  guard.finish();
  assert.equal(guard.tryStart(), true);
});
```

- [ ] **Step 3: Run the focused test and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout.test.ts
```

Expected: FAIL with `Cannot find module '../frontend/lib/wallet/hosted-checkout'`.

- [ ] **Step 4: Implement the browser client**

```ts
export type HostedWalletCheckoutFailureReason =
  | 'authentication'
  | 'validation'
  | 'network'
  | 'stripe'
  | 'unknown';

export type HostedWalletCheckoutInput = {
  amountCents: number;
  currency: string;
  locale: string;
  accessToken: string | null;
  captchaToken?: string;
};

export type HostedWalletCheckoutResult =
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
      reason: HostedWalletCheckoutFailureReason;
      checkoutAttemptId: number | null;
    };

const MIN_TOPUP_CENTS = 1000;

export function createHostedCheckoutSubmissionGuard() {
  let active = false;
  return {
    tryStart(): boolean {
      if (active) return false;
      active = true;
      return true;
    },
    finish(): void {
      active = false;
    },
  };
}

function normalizeAttemptId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRetryAfter(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
}

function failureReasonForStatus(status: number): HostedWalletCheckoutFailureReason {
  if (status === 401) return 'authentication';
  if (status === 400 || status === 422) return 'validation';
  return 'unknown';
}

export async function requestHostedWalletCheckout(
  input: HostedWalletCheckoutInput,
  fetchImpl: typeof fetch = fetch
): Promise<HostedWalletCheckoutResult> {
  const currency = input.currency.trim().toUpperCase();
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < MIN_TOPUP_CENTS) {
    return { kind: 'failed', reason: 'validation', checkoutAttemptId: null };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { kind: 'failed', reason: 'validation', checkoutAttemptId: null };
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (input.accessToken) {
    headers.set('Authorization', `Bearer ${input.accessToken}`);
  }

  try {
    const response = await fetchImpl('/api/wallet', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        amountCents: input.amountCents,
        currency: currency.toLowerCase(),
        locale: input.locale,
        ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (payload?.captchaRequired === true) {
        return { kind: 'captcha_required' };
      }
      if (response.status === 429) {
        return {
          kind: 'rate_limited',
          retryAfterSeconds: normalizeRetryAfter(payload?.retryAfterSeconds),
        };
      }
      return {
        kind: 'failed',
        reason: failureReasonForStatus(response.status),
        checkoutAttemptId: normalizeAttemptId(payload?.checkoutAttemptId),
      };
    }

    const url = typeof payload?.url === 'string' && payload.url.trim() ? payload.url.trim() : null;
    const sessionId = typeof payload?.id === 'string' && payload.id.trim() ? payload.id.trim() : null;
    const checkoutAttemptId = normalizeAttemptId(payload?.checkoutAttemptId);
    if (!url && !sessionId) {
      return { kind: 'failed', reason: 'unknown', checkoutAttemptId };
    }
    return { kind: 'ready', url, sessionId, checkoutAttemptId };
  } catch {
    return { kind: 'failed', reason: 'network', checkoutAttemptId: null };
  }
}
```

- [ ] **Step 5: Run the focused test and confirm green**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 6: Commit the contract**

```bash
git add frontend/lib/wallet/hosted-checkout.ts tests/hosted-wallet-checkout.test.ts
git commit -m "feat: add hosted wallet checkout contract"
```

---

### Task 2: Add the safe one-time Workspace return context

**Files:**
- Create: `frontend/lib/wallet/checkout-return.ts`
- Create: `tests/hosted-wallet-checkout-return.test.ts`

**Interfaces:**
- Consumes: a browser `Storage`-compatible object and the single allowlisted path `/app`.
- Produces: `persistPendingWalletCheckoutReturn`, `consumePendingWalletCheckoutReturn`, `clearPendingWalletCheckoutReturn`, and `WalletCheckoutReturnTarget`.

- [ ] **Step 1: Write the failing return-context tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPendingWalletCheckoutReturn,
  consumePendingWalletCheckoutReturn,
  persistPendingWalletCheckoutReturn,
} from '../frontend/lib/wallet/checkout-return';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

test('pending checkout return accepts /app and consumes it once', () => {
  const storage = createStorage();
  assert.equal(persistPendingWalletCheckoutReturn('/app', { storage, now: 1_000 }), true);
  assert.equal(consumePendingWalletCheckoutReturn({ storage, now: 2_000 }), '/app');
  assert.equal(consumePendingWalletCheckoutReturn({ storage, now: 2_000 }), null);
});

test('pending checkout return rejects non-allowlisted and expired values', () => {
  const storage = createStorage();
  assert.equal(persistPendingWalletCheckoutReturn('/billing', { storage, now: 1_000 }), false);
  assert.equal(persistPendingWalletCheckoutReturn('/app', { storage, now: 1_000 }), true);
  assert.equal(consumePendingWalletCheckoutReturn({ storage, now: 3_601_001 }), null);
});

test('pending checkout return tolerates unavailable storage and can be cleared', () => {
  const throwingStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.equal(persistPendingWalletCheckoutReturn('/app', { storage: throwingStorage, now: 1_000 }), false);
  assert.equal(consumePendingWalletCheckoutReturn({ storage: throwingStorage, now: 1_000 }), null);
  assert.doesNotThrow(() => clearPendingWalletCheckoutReturn({ storage: throwingStorage }));
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout-return.test.ts
```

Expected: FAIL with missing `checkout-return` module.

- [ ] **Step 3: Implement the allowlisted storage helper**

```ts
export type WalletCheckoutReturnTarget = '/app';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StorageOptions = {
  storage?: StorageLike;
  now?: number;
};

const STORAGE_KEY = 'mv-wallet-checkout-return';
const MAX_AGE_MS = 60 * 60 * 1000;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isAllowedTarget(value: unknown): value is WalletCheckoutReturnTarget {
  return value === '/app';
}

export function persistPendingWalletCheckoutReturn(
  target: string,
  options: StorageOptions = {}
): boolean {
  if (!isAllowedTarget(target)) return false;
  const storage = resolveStorage(options.storage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ target, createdAt: options.now ?? Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingWalletCheckoutReturn(options: Pick<StorageOptions, 'storage'> = {}): void {
  const storage = resolveStorage(options.storage);
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Browser storage is an optional conversion aid.
  }
}

export function consumePendingWalletCheckoutReturn(
  options: StorageOptions = {}
): WalletCheckoutReturnTarget | null {
  const storage = resolveStorage(options.storage);
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { target?: unknown; createdAt?: unknown };
    const createdAt = Number(parsed.createdAt);
    const now = options.now ?? Date.now();
    if (!isAllowedTarget(parsed.target)) return null;
    if (!Number.isFinite(createdAt) || createdAt > now || now - createdAt > MAX_AGE_MS) return null;
    return parsed.target;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the focused test and confirm green**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout-return.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the safe return context**

```bash
git add frontend/lib/wallet/checkout-return.ts tests/hosted-wallet-checkout-return.test.ts
git commit -m "feat: add safe wallet checkout return context"
```

---

### Task 3: Create the shared analytics, Turnstile, and hosted-checkout hook

**Files:**
- Create: `frontend/lib/analytics/checkout-interaction-events.ts`
- Create: `frontend/lib/analytics/ga-events.ts`
- Create: `frontend/hooks/useHostedWalletCheckout.ts`
- Create: `frontend/components/ui/TurnstileChallenge.tsx`
- Modify: `frontend/app/(core)/billing/_lib/checkout-interaction-events.ts`
- Modify: `frontend/app/(core)/billing/_components/TurnstileChallenge.tsx`
- Modify: `frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics.ts`
- Create: `tests/hosted-wallet-checkout-architecture.test.ts`
- Modify: `tests/checkout-interaction-events.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2, Stripe publishable key, existing `/api/checkout-events`, and route callbacks.
- Produces: `useHostedWalletCheckout(options)` with `startCheckout`, `resetCheckout`, `requireCaptcha`, `handleCaptchaToken`, `handleCaptchaError`, and checkout state.

- [ ] **Step 1: Write the failing shared-ownership contract**

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sharedHookPath = 'frontend/hooks/useHostedWalletCheckout.ts';
const sharedEventsPath = 'frontend/lib/analytics/checkout-interaction-events.ts';
const sharedTurnstilePath = 'frontend/components/ui/TurnstileChallenge.tsx';
const billingEventFacadePath = 'frontend/app/(core)/billing/_lib/checkout-interaction-events.ts';
const billingTurnstileFacadePath = 'frontend/app/(core)/billing/_components/TurnstileChallenge.tsx';

test('hosted wallet checkout behavior has stable shared owners', () => {
  for (const file of [sharedHookPath, sharedEventsPath, sharedTurnstilePath]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }
  const hookSource = readFileSync(sharedHookPath, 'utf8');
  const eventFacadeSource = readFileSync(billingEventFacadePath, 'utf8');
  const turnstileFacadeSource = readFileSync(billingTurnstileFacadePath, 'utf8');
  assert.match(hookSource, /requestHostedWalletCheckout/);
  assert.match(hookSource, /hosted_checkout_requested/);
  assert.match(hookSource, /hosted_checkout_captcha_required/);
  assert.match(hookSource, /hosted_checkout_rate_limited/);
  assert.match(hookSource, /hosted_checkout_failed/);
  assert.match(hookSource, /hosted_checkout_redirecting/);
  assert.match(hookSource, /submissionGuardRef/);
  assert.match(eventFacadeSource, /export \{ recordCheckoutInteractionEvent \}/);
  assert.match(turnstileFacadeSource, /export \{ TurnstileChallenge \}/);
});
```

Update the Billing assertions in `tests/checkout-interaction-events.test.ts` to point at the shared hook:

```ts
const hostedCheckoutHookSource = readFileSync('frontend/hooks/useHostedWalletCheckout.ts', 'utf8');
assert.match(hostedCheckoutHookSource, /hosted_checkout_requested/);
assert.match(hostedCheckoutHookSource, /hosted_checkout_redirecting/);
assert.match(hostedCheckoutHookSource, /hosted_checkout_failed/);
```

- [ ] **Step 2: Run the contracts and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout-architecture.test.ts tests/checkout-interaction-events.test.ts
```

Expected: FAIL because the shared files do not exist.

- [ ] **Step 3: Move the checkout interaction recorder behind a compatibility facade**

Create `frontend/lib/analytics/checkout-interaction-events.ts` with this complete implementation:

```ts
'use client';

import { authFetch } from '@/lib/authFetch';

export type CheckoutInteractionSource = 'billing' | 'workspace';
export type CheckoutInteractionMode = 'hosted' | 'express_checkout';

export type CheckoutInteractionEvent = {
  amountCents?: number | null;
  checkoutAttemptId?: number | null;
  eventName: string;
  metadata?: Record<string, unknown> | null;
  mode?: CheckoutInteractionMode | null;
  source?: CheckoutInteractionSource;
  stripeCheckoutSessionId?: string | null;
};

export function recordCheckoutInteractionEvent(event: CheckoutInteractionEvent): void {
  if (typeof window === 'undefined') return;
  const metadata = event.source
    ? { ...(event.metadata ?? {}), source: event.source, route_family: event.source }
    : event.metadata;
  const body = JSON.stringify({ ...event, metadata, source: undefined });
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const queued = navigator.sendBeacon(
      '/api/checkout-events',
      new Blob([body], { type: 'application/json' })
    );
    if (queued) return;
  }
  void authFetch('/api/checkout-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body,
  }).catch((error) => {
    console.warn('[checkout] interaction event failed', error);
  });
}
```

Replace the Billing route-local implementation with:

```ts
export { recordCheckoutInteractionEvent } from '@/lib/analytics/checkout-interaction-events';
export type {
  CheckoutInteractionEvent,
  CheckoutInteractionMode,
  CheckoutInteractionSource,
} from '@/lib/analytics/checkout-interaction-events';
```

- [ ] **Step 4: Extract the existing retrying GA dispatcher**

Create `frontend/lib/analytics/ga-events.ts`:

```ts
'use client';

export type DispatchGaEventOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

export function dispatchGaEvent(
  eventName: string,
  payload: Record<string, unknown>,
  options?: DispatchGaEventOptions
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 120);
  const retryDelayMs = Math.max(100, options?.retryDelayMs ?? 500);

  return new Promise<boolean>((resolve) => {
    const send = (attempt: number) => {
      const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag === 'function') {
        gtag('event', eventName, payload);
        resolve(true);
        return;
      }
      if (attempt >= maxAttempts) {
        resolve(false);
        return;
      }
      window.setTimeout(() => send(attempt + 1), retryDelayMs);
    };
    send(0);
  });
}
```

In `useBillingTopupAnalytics.ts`, import the shared function and delete only the local `DispatchGaEventOptions` type and local `dispatchGaEvent` callback:

```ts
import { dispatchGaEvent } from '@/lib/analytics/ga-events';
```

The diff in `useBillingTopupAnalytics.ts` must contain only the new import plus removal of the local dispatcher type and function. Its payload builder, tier and quote fields, Google Ads conversion, cancellation persistence, and event names remain byte-for-byte unchanged.

- [ ] **Step 5: Move Turnstile behind a shared component and compatibility facade**

Create `frontend/components/ui/TurnstileChallenge.tsx` with:

```tsx
'use client';

import { useEffect, useRef } from 'react';

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: 'auto' | 'light' | 'dark';
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove?: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileChallenge({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;
    let cancelled = false;
    let widgetId: string | null = null;
    const container = containerRef.current;
    const renderWidget = () => {
      if (cancelled || widgetId || !window.turnstile || !container.isConnected) return;
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': onError,
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById('cf-turnstile-api') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'cf-turnstile-api';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', onError);
      return () => {
        cancelled = true;
        script?.removeEventListener('load', renderWidget);
        script?.removeEventListener('error', onError);
        if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
      };
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
    };
  }, [onError, onToken, siteKey]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
```

Replace the Billing route-local file with:

```ts
export { TurnstileChallenge } from '@/components/ui/TurnstileChallenge';
```

The shared implementation must retain `sitekey`, `theme: 'auto'`, token, expiry, error, script load, widget removal, and listener cleanup behavior exactly.

- [ ] **Step 6: Implement the shared hosted-checkout hook**

```ts
'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { recordCheckoutInteractionEvent, type CheckoutInteractionSource } from '@/lib/analytics/checkout-interaction-events';
import {
  clearPendingWalletCheckoutReturn,
  persistPendingWalletCheckoutReturn,
  type WalletCheckoutReturnTarget,
} from '@/lib/wallet/checkout-return';
import {
  createHostedCheckoutSubmissionGuard,
  requestHostedWalletCheckout,
  type HostedWalletCheckoutFailureReason,
} from '@/lib/wallet/hosted-checkout';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

type LegacyCheckoutStripe = Stripe & {
  redirectToCheckout?: (params: { sessionId: string }) => Promise<{ error?: { message?: string } }>;
};

type CheckoutEventContext = {
  amountCents: number;
  currency: string;
};

type CheckoutFailureContext = CheckoutEventContext & {
  reason: HostedWalletCheckoutFailureReason;
};

type UseHostedWalletCheckoutOptions = {
  accessToken: string | null;
  amountCents: number;
  currency: string;
  locale: AppLocale;
  source: CheckoutInteractionSource;
  returnTarget?: WalletCheckoutReturnTarget;
  stripePromise?: Promise<Stripe | null> | null;
  onStarted: (context: CheckoutEventContext) => void;
  onFailed: (context: CheckoutFailureContext) => void;
  onRateLimited: (retryAfterSeconds: number | null) => void;
};

export function useHostedWalletCheckout({
  accessToken,
  amountCents,
  currency,
  locale,
  source,
  returnTarget,
  stripePromise: suppliedStripePromise,
  onStarted,
  onFailed,
  onRateLimited,
}: UseHostedWalletCheckoutOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [failureReason, setFailureReason] = useState<HostedWalletCheckoutFailureReason | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const submissionGuardRef = useRef(createHostedCheckoutSubmissionGuard());
  const internalStripePromise = useMemo(
    () => (
      suppliedStripePromise === undefined && PUBLISHABLE_KEY
        ? loadStripe(PUBLISHABLE_KEY, { locale })
        : null
    ),
    [locale, suppliedStripePromise]
  );
  const stripePromise = suppliedStripePromise === undefined ? internalStripePromise : suppliedStripePromise;

  const resetCheckout = useCallback(() => {
    setCaptchaRequired(false);
    setCaptchaToken(null);
    setCaptchaError(false);
    setFailureReason(null);
    setRetryAfterSeconds(null);
  }, []);

  useEffect(() => {
    resetCheckout();
  }, [amountCents, currency, resetCheckout]);

  const requireCaptcha = useCallback(() => {
    setCaptchaRequired(true);
    setCaptchaToken(null);
    setCaptchaError(false);
  }, []);

  const handleCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
    if (token) setCaptchaError(false);
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaError(true);
  }, []);

  const reportFailure = useCallback((reason: HostedWalletCheckoutFailureReason, checkoutAttemptId: number | null) => {
    if (returnTarget) clearPendingWalletCheckoutReturn();
    setFailureReason(reason);
    recordCheckoutInteractionEvent({
      amountCents,
      checkoutAttemptId,
      eventName: 'hosted_checkout_failed',
      mode: 'hosted',
      source,
      metadata: { currency, failureCategory: reason },
    });
    onFailed({ amountCents, currency, reason });
  }, [amountCents, currency, onFailed, returnTarget, source]);

  const startCheckout = useCallback(async () => {
    if (!submissionGuardRef.current.tryStart()) return;
    setIsSubmitting(true);
    setFailureReason(null);
    setRetryAfterSeconds(null);
    recordCheckoutInteractionEvent({
      amountCents,
      eventName: 'hosted_checkout_requested',
      mode: 'hosted',
      source,
      metadata: { currency, locale },
    });

    try {
      const result = await requestHostedWalletCheckout({
        amountCents,
        currency,
        locale,
        accessToken,
        captchaToken: captchaToken ?? undefined,
      });

      if (result.kind === 'captcha_required') {
        requireCaptcha();
        recordCheckoutInteractionEvent({
          amountCents,
          eventName: 'hosted_checkout_captcha_required',
          mode: 'hosted',
          source,
          metadata: { currency },
        });
        return;
      }

      if (result.kind === 'rate_limited') {
        setRetryAfterSeconds(result.retryAfterSeconds);
        recordCheckoutInteractionEvent({
          amountCents,
          eventName: 'hosted_checkout_rate_limited',
          mode: 'hosted',
          source,
          metadata: { currency, retryAfterSeconds: result.retryAfterSeconds },
        });
        onRateLimited(result.retryAfterSeconds);
        return;
      }

      if (result.kind === 'failed') {
        reportFailure(result.reason, result.checkoutAttemptId);
        return;
      }

      setCaptchaRequired(false);
      setCaptchaToken(null);
      setCaptchaError(false);
      onStarted({ amountCents, currency });
      recordCheckoutInteractionEvent({
        amountCents,
        checkoutAttemptId: result.checkoutAttemptId,
        eventName: 'hosted_checkout_redirecting',
        mode: 'hosted',
        source,
        stripeCheckoutSessionId: result.sessionId,
        metadata: {
          currency,
          redirectMethod: result.url ? 'url' : 'stripe_js',
        },
      });

      if (result.url) {
        if (returnTarget) persistPendingWalletCheckoutReturn(returnTarget);
        window.location.href = result.url;
        return;
      }

      if (result.sessionId && stripePromise) {
        if (returnTarget) persistPendingWalletCheckoutReturn(returnTarget);
        const stripe = (await stripePromise) as LegacyCheckoutStripe | null;
        const redirectResult = await stripe?.redirectToCheckout?.({ sessionId: result.sessionId });
        if (redirectResult && !redirectResult.error) return;
      }
      reportFailure('stripe', result.checkoutAttemptId);
    } catch {
      reportFailure('stripe', null);
    } finally {
      submissionGuardRef.current.finish();
      setIsSubmitting(false);
    }
  }, [
    accessToken,
    amountCents,
    captchaToken,
    currency,
    locale,
    onRateLimited,
    onStarted,
    reportFailure,
    requireCaptcha,
    returnTarget,
    source,
    stripePromise,
  ]);

  return {
    captchaError,
    captchaRequired,
    captchaToken,
    failureReason,
    handleCaptchaError,
    handleCaptchaToken,
    isSubmitting,
    requireCaptcha,
    resetCheckout,
    retryAfterSeconds,
    startCheckout,
  };
}
```

- [ ] **Step 7: Run focused contracts, typecheck, and confirm green**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout.test.ts tests/hosted-wallet-checkout-return.test.ts tests/hosted-wallet-checkout-architecture.test.ts tests/checkout-interaction-events.test.ts
pnpm --prefix frontend exec tsc --noEmit
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit the shared checkout owner**

```bash
git add frontend/lib/analytics/checkout-interaction-events.ts frontend/lib/analytics/ga-events.ts frontend/hooks/useHostedWalletCheckout.ts frontend/components/ui/TurnstileChallenge.tsx frontend/app/'(core)'/billing/_lib/checkout-interaction-events.ts frontend/app/'(core)'/billing/_components/TurnstileChallenge.tsx frontend/app/'(core)'/billing/_hooks/useBillingTopupAnalytics.ts tests/hosted-wallet-checkout-architecture.test.ts tests/checkout-interaction-events.test.ts
git commit -m "feat: share hosted wallet checkout orchestration"
```

---

### Task 4: Migrate Billing and add the explicit Workspace return action

**Files:**
- Create: `frontend/app/(core)/billing/_components/BillingCheckoutReturnNotice.tsx`
- Modify: `frontend/app/(core)/billing/_components/BillingClient.tsx:1-338`
- Modify: `frontend/app/(core)/billing/_components/WalletTopupPanel.tsx:1-290`
- Modify: `frontend/app/(core)/billing/_hooks/useBillingCheckoutReturnToast.ts:1-70`
- Modify: `frontend/app/(core)/billing/_lib/billing-copy.ts:86-90`
- Modify: `frontend/messages/en.json:3839-3842`
- Modify: `frontend/messages/fr.json:3762-3765`
- Modify: `frontend/messages/es.json:3754-3757`
- Modify: `tests/billing-page-architecture.test.ts`
- Modify: `tests/hosted-wallet-checkout-architecture.test.ts`

**Interfaces:**
- Consumes: `useHostedWalletCheckout`, Billing's existing analytics callbacks, the existing Express Checkout `stripePromise`, and Task 2 return context.
- Produces: Billing hosted checkout without a direct wallet POST and a one-time `/app` success action.

- [ ] **Step 1: Add failing Billing architecture assertions**

```ts
const hostedCheckoutHookPath = 'frontend/hooks/useHostedWalletCheckout.ts';
const checkoutReturnNoticePath = 'frontend/app/(core)/billing/_components/BillingCheckoutReturnNotice.tsx';

assert.equal(existsSync(hostedCheckoutHookPath), true);
assert.equal(existsSync(checkoutReturnNoticePath), true);
assert.match(clientSource, /useHostedWalletCheckout\(\{/);
assert.match(clientSource, /<BillingCheckoutReturnNotice/);
assert.doesNotMatch(clientSource, /fetch\('\/api\/wallet'/);
assert.doesNotMatch(clientSource, /const \[checkoutCaptchaRequired, setCheckoutCaptchaRequired\]/);
assert.match(expressCheckoutSource, /export function WalletExpressCheckout/);
```

Extend `tests/hosted-wallet-checkout-architecture.test.ts`:

```ts
const billingClientSource = readFileSync('frontend/app/(core)/billing/_components/BillingClient.tsx', 'utf8');
assert.match(billingClientSource, /useHostedWalletCheckout/);
assert.doesNotMatch(billingClientSource, /fetch\('\/api\/wallet'/);
```

- [ ] **Step 2: Run Billing contracts and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-page-architecture.test.ts tests/hosted-wallet-checkout-architecture.test.ts
```

Expected: FAIL because Billing still owns the hosted request and the return notice does not exist.

- [ ] **Step 3: Make Stripe return handling expose or clear the pending target**

Add the imports and callback option to `useBillingCheckoutReturnToast.ts`:

```ts
import {
  clearPendingWalletCheckoutReturn,
  consumePendingWalletCheckoutReturn,
  type WalletCheckoutReturnTarget,
} from '@/lib/wallet/checkout-return';

type CheckoutReturnToastOptions = {
  cancelledMessage: string;
  onCancelled: (amountCents: number | null, currency: string) => void;
  onGoogleAdsConversion: (value?: number, currency?: string) => void;
  onReturnTarget: (target: WalletCheckoutReturnTarget | null) => void;
  onToast: (message: string | null) => void;
  successMessage: string;
};
```

Inside the existing success and cancellation branches, add exactly:

```ts
if (status === 'success') {
  onReturnTarget(consumePendingWalletCheckoutReturn());
}
if (status === 'cancelled') {
  clearPendingWalletCheckoutReturn();
  onReturnTarget(null);
}
```

Include `onReturnTarget` in the effect dependency array. Keep status parsing, Google Ads conversion, interaction events, query cleanup, and toast timeout unchanged.

- [ ] **Step 4: Add the localized return notice**

Create `BillingCheckoutReturnNotice.tsx`:

```tsx
import { ButtonLink } from '@/components/ui/Button';
import type { WalletCheckoutReturnTarget } from '@/lib/wallet/checkout-return';

export function BillingCheckoutReturnNotice({
  href,
  label,
}: {
  href: WalletCheckoutReturnTarget;
  label: string;
}) {
  return (
    <div
      role="status"
      className="mb-5 flex justify-end rounded-input border border-brand bg-surface-2 p-3"
    >
      <ButtonLink href={href} size="sm">
        {label}
      </ButtonLink>
    </div>
  );
}
```

Add `returnToWorkspace` to the default and three dictionaries:

```ts
toasts: {
  success: 'Payment successful. Funds added to your wallet.',
  cancelled: 'Checkout closed. No charge made.',
  returnToWorkspace: 'Return to the video workspace',
},
```

```json
"returnToWorkspace": "Return to the video workspace"
```

```json
"returnToWorkspace": "Retourner à l’espace vidéo"
```

```json
"returnToWorkspace": "Volver al espacio de vídeo"
```

- [ ] **Step 5: Replace Billing's hosted request with the shared hook**

In `BillingClient.tsx`:

1. Import `BillingCheckoutReturnNotice`, `useHostedWalletCheckout`, and `WalletCheckoutReturnTarget`.
2. Remove `LegacyCheckoutStripe`, `isTopupStarting`, the three local checkout captcha states, and the complete local `fetch('/api/wallet')` implementation.
3. Keep Billing's existing `stripePromise` because Express Checkout still consumes it.
4. Add state and route callbacks:

```tsx
const [checkoutReturnTarget, setCheckoutReturnTarget] = useState<WalletCheckoutReturnTarget | null>(null);

const handleHostedTopupStarted = useCallback(({ amountCents, currency }: { amountCents: number; currency: string }) => {
  triggerTopupStarted(amountCents, currency);
}, [triggerTopupStarted]);

const handleHostedTopupFailed = useCallback(({
  amountCents,
  currency,
  reason,
}: {
  amountCents: number;
  currency: string;
  reason: string;
}) => {
  triggerTopupFailed(amountCents, currency, reason);
  setToast(copy.errors.topupStart);
}, [copy.errors.topupStart, triggerTopupFailed]);

const handleHostedRateLimited = useCallback((seconds: number | null) => {
  setToast(formatRateLimitMessage(copy.wallet.rateLimited, seconds ?? 900));
}, [copy.wallet.rateLimited]);

const hostedCheckout = useHostedWalletCheckout({
  accessToken: session?.access_token ?? null,
  amountCents: selectedTopupCents,
  currency: normalizedChargeCurrency,
  locale,
  source: 'billing',
  stripePromise,
  onStarted: handleHostedTopupStarted,
  onFailed: handleHostedTopupFailed,
  onRateLimited: handleHostedRateLimited,
});

function handleTopUp() {
  if (!session) {
    setAuthModalOpen(true);
    return;
  }
  void hostedCheckout.startCheckout();
}
```

Call the return hook with:

```ts
useBillingCheckoutReturnToast({
  cancelledMessage: copy.toasts.cancelled,
  onCancelled: triggerTopupCancelled,
  onGoogleAdsConversion: triggerGoogleAdsConversion,
  onReturnTarget: setCheckoutReturnTarget,
  onToast: setToast,
  successMessage: copy.toasts.success,
});
```

Map the existing `WalletTopupPanel` props to shared state:

```tsx
checkoutCaptchaError={hostedCheckout.captchaError ? copy.wallet.captchaError : null}
checkoutCaptchaRequired={hostedCheckout.captchaRequired}
checkoutCaptchaToken={hostedCheckout.captchaToken}
handleCheckoutCaptchaError={hostedCheckout.handleCaptchaError}
handleCheckoutCaptchaRequired={hostedCheckout.requireCaptcha}
handleCheckoutCaptchaToken={hostedCheckout.handleCaptchaToken}
handleTopUp={handleTopUp}
isTopupStarting={hostedCheckout.isSubmitting}
```

Update the `WalletTopupPanel` `handleTopUp` prop type to `() => void` and its button to `onClick={handleTopUp}`.

Render the notice immediately after `BillingHero`:

```tsx
{checkoutReturnTarget ? (
  <BillingCheckoutReturnNotice
    href={checkoutReturnTarget}
    label={copy.toasts.returnToWorkspace}
  />
) : null}
```

- [ ] **Step 6: Run Billing, checkout, localization, and type checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-page-architecture.test.ts tests/billing-intent-integration.test.ts tests/checkout-interaction-events.test.ts tests/hosted-wallet-checkout-architecture.test.ts
pnpm --prefix frontend exec tsc --noEmit
pnpm --prefix frontend run i18n:check
```

Expected: all focused tests PASS, TypeScript exits 0, and localization keys validate.

- [ ] **Step 7: Commit the Billing migration**

```bash
git add frontend/app/'(core)'/billing/_components/BillingCheckoutReturnNotice.tsx frontend/app/'(core)'/billing/_components/BillingClient.tsx frontend/app/'(core)'/billing/_components/WalletTopupPanel.tsx frontend/app/'(core)'/billing/_hooks/useBillingCheckoutReturnToast.ts frontend/app/'(core)'/billing/_lib/billing-copy.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/billing-page-architecture.test.ts tests/hosted-wallet-checkout-architecture.test.ts
git commit -m "feat: migrate billing to shared hosted checkout"
```

---

### Task 5: Define sufficient Workspace top-up amounts and localized states

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/_lib/workspace-topup.ts`
- Create: `tests/workspace-topup.test.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-copy.ts:1-36`
- Modify: `frontend/messages/en.json:3126-3137`
- Modify: `frontend/messages/fr.json:3161-3172`
- Modify: `frontend/messages/es.json:3153-3164`

**Interfaces:**
- Consumes: shortfall cents from `useWorkspaceWalletPreflight`.
- Produces: `getSufficientTopUpAmountCents` and `buildWorkspaceTopupAnalyticsPayload`.

- [ ] **Step 1: Write failing amount and payload tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkspaceTopupAnalyticsPayload,
  getSufficientTopUpAmountCents,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-topup';

test('Workspace top-up rounds shortfall up and enforces the ten-dollar minimum', () => {
  assert.equal(getSufficientTopUpAmountCents(undefined), 1000);
  assert.equal(getSufficientTopUpAmountCents(1), 1000);
  assert.equal(getSufficientTopUpAmountCents(744), 1000);
  assert.equal(getSufficientTopUpAmountCents(1234), 1300);
  assert.equal(getSufficientTopUpAmountCents(2500), 2500);
});

test('Workspace top-up analytics contains conversion fields and no personal content', () => {
  assert.deepEqual(buildWorkspaceTopupAnalyticsPayload(1300), {
    source: 'workspace',
    route_family: 'workspace',
    payment_provider: 'stripe',
    payment_flow: 'checkout',
    charge_currency: 'USD',
    wallet_amount_usd: 13,
    wallet_amount_cents: 1300,
    credits_amount: 13,
    topup_amount_usd: 13,
    topup_amount_cents: 1300,
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-topup.test.ts
```

Expected: FAIL with missing `workspace-topup` module.

- [ ] **Step 3: Implement the pure Workspace helper**

```ts
const MIN_TOPUP_CENTS = 1000;

export function getSufficientTopUpAmountCents(shortfallCents: number | undefined): number {
  if (typeof shortfallCents !== 'number' || !Number.isFinite(shortfallCents)) {
    return MIN_TOPUP_CENTS;
  }
  const normalizedShortfall = Math.max(0, Math.ceil(shortfallCents));
  return Math.max(MIN_TOPUP_CENTS, Math.ceil(normalizedShortfall / 100) * 100);
}

export function buildWorkspaceTopupAnalyticsPayload(amountCents: number): Record<string, unknown> {
  const normalizedAmount = Number.isFinite(amountCents)
    ? Math.max(MIN_TOPUP_CENTS, Math.round(amountCents))
    : MIN_TOPUP_CENTS;
  return {
    source: 'workspace',
    route_family: 'workspace',
    payment_provider: 'stripe',
    payment_flow: 'checkout',
    charge_currency: 'USD',
    wallet_amount_usd: normalizedAmount / 100,
    wallet_amount_cents: normalizedAmount,
    credits_amount: normalizedAmount / 100,
    topup_amount_usd: normalizedAmount / 100,
    topup_amount_cents: normalizedAmount,
  };
}
```

- [ ] **Step 4: Add exact localized Workspace states**

Extend `DEFAULT_WORKSPACE_COPY.topUp` and each dictionary's `workspace.generate.topUp` with these keys:

```ts
balanceLowTitle: 'Wallet balance too low',
suggestedTopUp: 'Suggested top-up: {amount}',
captchaPrompt: 'Security check required before Checkout.',
captchaComplete: 'Security check complete. Continue to payment.',
captchaError: 'Security check unavailable. Try again.',
rateLimited: 'Too many payment attempts. Try again in {time}.',
startError: 'Unable to start payment. Try again.',
```

```json
"balanceLowTitle": "Wallet balance too low",
"suggestedTopUp": "Suggested top-up: {amount}",
"captchaPrompt": "Security check required before Checkout.",
"captchaComplete": "Security check complete. Continue to payment.",
"captchaError": "Security check unavailable. Try again.",
"rateLimited": "Too many payment attempts. Try again in {time}.",
"startError": "Unable to start payment. Try again."
```

```json
"balanceLowTitle": "Solde du portefeuille insuffisant",
"suggestedTopUp": "Recharge suggérée : {amount}",
"captchaPrompt": "Vérification de sécurité requise avant le Checkout.",
"captchaComplete": "Vérification terminée. Continuez vers le paiement.",
"captchaError": "Vérification de sécurité indisponible. Réessayez.",
"rateLimited": "Trop de tentatives de paiement. Réessayez dans {time}.",
"startError": "Impossible de démarrer le paiement. Réessayez."
```

```json
"balanceLowTitle": "Saldo de la billetera insuficiente",
"suggestedTopUp": "Recarga sugerida: {amount}",
"captchaPrompt": "Verificación de seguridad requerida antes del Checkout.",
"captchaComplete": "Verificación completada. Continúa al pago.",
"captchaError": "Verificación de seguridad no disponible. Inténtalo de nuevo.",
"rateLimited": "Demasiados intentos de pago. Inténtalo de nuevo en {time}.",
"startError": "No se pudo iniciar el pago. Inténtalo de nuevo."
```

- [ ] **Step 5: Run pure and localization tests and confirm green**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-topup.test.ts
pnpm --prefix frontend run i18n:check
```

Expected: 2 tests PASS and localization validation exits 0.

- [ ] **Step 6: Commit Workspace amount and copy**

```bash
git add frontend/app/'(core)'/'(workspace)'/app/_lib/workspace-topup.ts frontend/app/'(core)'/'(workspace)'/app/_lib/workspace-copy.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/workspace-topup.test.ts
git commit -m "feat: preselect sufficient workspace topups"
```

---

### Task 6: Migrate the Workspace top-up modal to the shared checkout

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAppBootstrap.ts:18-92`
- Modify: `frontend/app/(core)/(workspace)/app/AppClient.tsx:189-201`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts:1-270`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx:1-160`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceRuntimeModals.tsx:28-125`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx:150-330`
- Modify: `tests/workspace-pricing-gate-hook-contract.test.ts`
- Modify: `tests/hosted-wallet-checkout-architecture.test.ts`

**Interfaces:**
- Consumes: Tasks 3 and 5, `app.session?.access_token`, `app.uiLocale`, `workspaceCopy.topUp`, and `TopUpModalState.shortfallCents`.
- Produces: one-click Workspace hosted checkout with sufficient selection, USD, locale, captcha, normalized errors, analytics, and `/app` return context.

- [ ] **Step 1: Replace the old Workspace contract assertions with failing shared-path assertions**

In `tests/workspace-pricing-gate-hook-contract.test.ts`, replace the direct-wallet expectations with:

```ts
assert.match(hookSource, /useHostedWalletCheckout\(\{/);
assert.match(hookSource, /getSufficientTopUpAmountCents/);
assert.match(hookSource, /returnTarget: '\/app'/);
assert.match(hookSource, /currency: 'USD'/);
assert.match(hookSource, /dispatchGaEvent\('topup_started'/);
assert.match(hookSource, /dispatchGaEvent\('topup_failed'/);
assert.doesNotMatch(hookSource, /authFetch\('\/api\/wallet',\s*\{/);
assert.doesNotMatch(hookSource, /window\.location\.href/);
assert.match(topUpModalSource, /TurnstileChallenge/);
assert.doesNotMatch(topUpModalSource, />Wallet balance too low</);
```

Extend `tests/hosted-wallet-checkout-architecture.test.ts`:

```ts
const workspacePricingSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts',
  'utf8'
);
assert.match(workspacePricingSource, /useHostedWalletCheckout/);
assert.doesNotMatch(workspacePricingSource, /authFetch\('\/api\/wallet',\s*\{/);
```

- [ ] **Step 2: Run Workspace contracts and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-pricing-gate-hook-contract.test.ts tests/hosted-wallet-checkout-architecture.test.ts tests/workspace-composer-generation-split-contract.test.ts
```

Expected: FAIL because Workspace still owns its direct wallet POST and hardcoded modal copy.

- [ ] **Step 3: Expose the existing auth session and pass checkout inputs to the pricing gate**

In `useWorkspaceAppBootstrap.ts`, include the session already returned by `useRequireAuth`:

```ts
const { user, session, loading: authLoading, authStatus } = useRequireAuth({ redirectIfLoggedOut: false });
```

Return the complete bootstrap result as:

```ts
return {
  authLoading,
  authStatus,
  engineIdByLabel,
  engineMap,
  engineScores,
  engines,
  enginesError,
  formatTakeLabel,
  isLoading,
  mutateLatestJobs,
  provider,
  recentJobs,
  session,
  showCenterGallery,
  uiLocale,
  user,
  workflowCopy,
  workspaceCopy,
};
```

In `AppClient.tsx`, extend the existing pricing-gate call:

```ts
const pricing = useWorkspacePricingGate({
  accessToken: app.session?.access_token ?? null,
  locale: app.uiLocale,
  topUpCopy: app.workspaceCopy.topUp,
  form: routeForm.form,
  selectedEngine: composer.selectedEngine,
  authChecked: draft.authChecked,
  memberTier: routeForm.memberTier,
  setMemberTier: routeForm.setMemberTier,
  supportsAudioToggle: composer.supportsAudioToggle,
  effectiveDurationSec: composer.effectiveDurationSec,
  voiceControlEnabled: composer.voiceControlEnabled,
  submissionMode: composer.submissionMode,
});
```

Remove `showNotice` from `UseWorkspacePricingGateOptions`, the hook parameter destructuring, and this `AppClient` call because the shared checkout navigates instead of showing the old local “initiated” notice.

- [ ] **Step 4: Replace Workspace's direct POST with the shared checkout hook**

In `useWorkspacePricingGate.ts`:

- keep `authFetch('/api/member-status')`;
- remove only the direct POST to `/api/wallet`, `isTopUpLoading` state, and its manual redirect;
- import `AppLocale`, `dispatchGaEvent`, `useHostedWalletCheckout`, `formatRateLimitMessage`, `WorkspaceCopy`, and the Task 5 helpers;
- add `accessToken`, `locale`, and `topUpCopy` to `UseWorkspacePricingGateOptions`.

Add the route callbacks and shared hook:

```ts
const handleHostedTopupStarted = useCallback(({ amountCents }: { amountCents: number; currency: string }) => {
  const payload = buildWorkspaceTopupAnalyticsPayload(amountCents);
  void dispatchGaEvent('topup_started', payload);
  void dispatchGaEvent('topup_checkout_opened', payload);
}, []);

const handleHostedTopupFailed = useCallback(({
  amountCents,
  reason,
}: {
  amountCents: number;
  currency: string;
  reason: string;
}) => {
  void dispatchGaEvent('topup_failed', {
    ...buildWorkspaceTopupAnalyticsPayload(amountCents),
    error_message: reason,
  });
  setTopUpError(topUpCopy.startError);
}, [topUpCopy.startError]);

const handleHostedRateLimited = useCallback((seconds: number | null) => {
  setTopUpError(formatRateLimitMessage(topUpCopy.rateLimited, seconds ?? 900));
}, [topUpCopy.rateLimited]);

const hostedCheckout = useHostedWalletCheckout({
  accessToken,
  amountCents: topUpAmount,
  currency: 'USD',
  locale,
  source: 'workspace',
  returnTarget: '/app',
  onStarted: handleHostedTopupStarted,
  onFailed: handleHostedTopupFailed,
  onRateLimited: handleHostedRateLimited,
});
```

Preselect from the modal shortfall:

```ts
useEffect(() => {
  if (!topUpModal) return;
  setTopUpAmount(getSufficientTopUpAmountCents(topUpModal.shortfallCents));
  setTopUpError(null);
  hostedCheckout.resetCheckout();
}, [hostedCheckout.resetCheckout, topUpModal]);
```

Replace confirmation with:

```ts
const handleConfirmTopUp = useCallback(() => {
  if (!topUpModal) return;
  void hostedCheckout.startCheckout();
}, [hostedCheckout.startCheckout, topUpModal]);
```

Make close and amount changes clear transient checkout state:

```ts
const closeTopUpModal = useCallback(() => {
  setTopUpModal(null);
  setTopUpAmount(1000);
  setTopUpError(null);
  hostedCheckout.resetCheckout();
}, [hostedCheckout.resetCheckout]);

const handleSelectPresetAmount = useCallback((value: number) => {
  setTopUpAmount(value);
  setTopUpError(null);
}, []);

const handleCustomAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
  const value = Number(event.target.value);
  setTopUpError(null);
  if (Number.isNaN(value)) {
    setTopUpAmount(1000);
    return;
  }
  setTopUpAmount(Math.max(1000, Math.round(value * 100)));
}, []);
```

Return these exact additional values:

```ts
checkoutCaptchaError: hostedCheckout.captchaError,
checkoutCaptchaRequired: hostedCheckout.captchaRequired,
checkoutCaptchaToken: hostedCheckout.captchaToken,
handleCheckoutCaptchaError: hostedCheckout.handleCaptchaError,
handleCheckoutCaptchaToken: hostedCheckout.handleCaptchaToken,
isTopUpLoading: hostedCheckout.isSubmitting,
```

- [ ] **Step 5: Render localized captcha and sufficient-amount state in the modal**

Extend `WorkspaceTopUpModal` props with:

```ts
checkoutCaptchaError: boolean;
checkoutCaptchaRequired: boolean;
checkoutCaptchaToken: string | null;
onCheckoutCaptchaError: () => void;
onCheckoutCaptchaToken: (token: string | null) => void;
```

Extend `WorkspaceTopUpCopy` with the exact keys added in Task 5:

```ts
type WorkspaceTopUpCopy = {
  title: string;
  otherAmountLabel: string;
  minLabel: string;
  close: string;
  maybeLater: string;
  submit: string;
  submitting: string;
  balanceLowTitle: string;
  suggestedTopUp: string;
  captchaPrompt: string;
  captchaComplete: string;
  captchaError: string;
  rateLimited: string;
  startError: string;
};
```

Import the shared component and define the site key:

```ts
import { TurnstileChallenge } from '@/components/ui/TurnstileChallenge';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
```

Replace the two hardcoded labels with localized copy:

```tsx
<h2 id="workspace-topup-title" className="text-base font-semibold text-text-primary">
  {copy.balanceLowTitle}
</h2>
```

```tsx
{modal.amountLabel ? (
  <p className="mt-2 text-sm font-medium text-text-primary">
    {copy.suggestedTopUp.replace('{amount}', modal.amountLabel)}
  </p>
) : null}
```

Render the shared challenge before `topUpError`:

```tsx
{checkoutCaptchaRequired ? (
  <div className="mt-3 rounded-input border border-border bg-bg p-3">
    <p className="text-sm font-semibold text-text-primary">{copy.captchaPrompt}</p>
    {TURNSTILE_SITE_KEY ? (
      <div className="mt-3">
        <TurnstileChallenge
          siteKey={TURNSTILE_SITE_KEY}
          onToken={onCheckoutCaptchaToken}
          onError={onCheckoutCaptchaError}
        />
      </div>
    ) : null}
    <p className={`mt-2 text-xs ${checkoutCaptchaError ? 'text-state-warning' : checkoutCaptchaToken ? 'text-success' : 'text-text-secondary'}`}>
      {checkoutCaptchaError
        ? copy.captchaError
        : checkoutCaptchaToken
          ? copy.captchaComplete
          : copy.captchaPrompt}
    </p>
  </div>
) : null}
```

- [ ] **Step 6: Wire the new modal props through the existing route-local surfaces**

In `WorkspaceAppReadyView.tsx`, destructure the five new captcha values from `pricing`, pass them to `WorkspaceRuntimeModals`, and pass `currency="USD"` for wallet top-up display while leaving the composer price currency unchanged. Add these exact props adjacent to the existing top-up props:

```tsx
checkoutCaptchaError={checkoutCaptchaError}
checkoutCaptchaRequired={checkoutCaptchaRequired}
checkoutCaptchaToken={checkoutCaptchaToken}
onCheckoutCaptchaError={handleCheckoutCaptchaError}
onCheckoutCaptchaToken={handleCheckoutCaptchaToken}
currency="USD"
```

In `WorkspaceRuntimeModals.tsx`, add the same five captcha props to its type and forward them:

```ts
checkoutCaptchaError: boolean;
checkoutCaptchaRequired: boolean;
checkoutCaptchaToken: string | null;
onCheckoutCaptchaError: () => void;
onCheckoutCaptchaToken: (token: string | null) => void;
```

```tsx
<WorkspaceTopUpModal
  modal={topUpModal}
  copy={topUpCopy}
  currency={currency}
  topUpAmount={topUpAmount}
  isTopUpLoading={isTopUpLoading}
  topUpError={topUpError}
  checkoutCaptchaError={checkoutCaptchaError}
  checkoutCaptchaRequired={checkoutCaptchaRequired}
  checkoutCaptchaToken={checkoutCaptchaToken}
  onCheckoutCaptchaError={onCheckoutCaptchaError}
  onCheckoutCaptchaToken={onCheckoutCaptchaToken}
  onClose={onCloseTopUp}
  onSubmit={onTopUpSubmit}
  onSelectPresetAmount={onSelectPresetAmount}
  onCustomAmountChange={onCustomAmountChange}
/>
```

- [ ] **Step 7: Run Workspace, architecture, localization, and type checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-topup.test.ts tests/workspace-pricing-gate-hook-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts tests/workspace-generation-runner-hook-contract.test.ts tests/hosted-wallet-checkout-architecture.test.ts
pnpm --prefix frontend exec tsc --noEmit
pnpm --prefix frontend run i18n:check
```

Expected: all focused tests PASS, TypeScript exits 0, and localization validation exits 0.

- [ ] **Step 8: Commit the Workspace migration**

```bash
git add frontend/app/'(core)'/'(workspace)'/app/_hooks/useWorkspaceAppBootstrap.ts frontend/app/'(core)'/'(workspace)'/app/AppClient.tsx frontend/app/'(core)'/'(workspace)'/app/_hooks/useWorkspacePricingGate.ts frontend/app/'(core)'/'(workspace)'/app/_components/WorkspaceTopUpModal.tsx frontend/app/'(core)'/'(workspace)'/app/_components/WorkspaceRuntimeModals.tsx frontend/app/'(core)'/'(workspace)'/app/_components/WorkspaceAppReadyView.tsx tests/workspace-pricing-gate-hook-contract.test.ts tests/hosted-wallet-checkout-architecture.test.ts
git commit -m "feat: unify workspace wallet checkout"
```

---

### Task 7: Lock conversion, payment, routing, and SEO invariants

**Files:**
- Modify only if a check exposes a real regression in files already listed above.
- Do not modify `frontend/app/api/wallet/route.ts`, Stripe webhook handlers, middleware routing, SEO builders, sitemap builders, or database migrations.

**Interfaces:**
- Consumes: the complete implementation from Tasks 1-6.
- Produces: a verified Lot 2 branch ready for review without a real charge.

- [ ] **Step 1: Run all focused checkout and architecture tests together**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout.test.ts tests/hosted-wallet-checkout-return.test.ts tests/workspace-topup.test.ts tests/hosted-wallet-checkout-architecture.test.ts tests/billing-page-architecture.test.ts tests/billing-intent.test.ts tests/billing-intent-integration.test.ts tests/billing-rate-limit-message.test.ts tests/billing-topup-selection.test.ts tests/checkout-interaction-events.test.ts tests/wallet-checkout-session.test.ts tests/wallet-checkout-session-reuse.test.ts tests/workspace-pricing-gate-hook-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts tests/workspace-generation-runner-hook-contract.test.ts
```

Expected: every listed test PASS.

- [ ] **Step 2: Run static quality, exposure, localization, and SEO guards**

Run:

```bash
pnpm --prefix frontend exec tsc --noEmit
npm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
git diff --check
```

Expected: every command exits 0 and `git diff --check` prints nothing.

- [ ] **Step 3: Run the complete repository test suite**

Run:

```bash
pnpm test:validate
```

Expected: the full suite passes with zero failures.

- [ ] **Step 4: Run a clean production build**

Run:

```bash
rm -rf frontend/.next
npm --prefix frontend run build
```

Expected: Next.js production build and sitemap generation complete successfully; `/billing`, `/app`, and all generated public routes remain present.

- [ ] **Step 5: Perform browser smoke tests without completing payment**

Verify in a local production server:

1. Signed-out Billing still opens the accessible auth gate and preserves the selected amount in the login target.
2. Signed-in Billing starts hosted checkout with the selected settlement currency; stop before payment.
3. Express Checkout still reveals independently and does not use the hosted hook.
4. A Workspace shortfall of USD 12.34 opens the modal with USD 13 selected.
5. Workspace modal supports keyboard focus containment, Escape when idle, and disabled close while submitting.
6. Simulated captcha-required state renders the shared challenge and keeps the modal open.
7. Simulated 429 state renders localized retry copy and permits a later retry.
8. A locally simulated successful Billing return with a valid pending record shows the `/app` action once and does not auto-redirect.
9. A simulated cancellation clears the pending return record.
10. Sufficient wallet balance still proceeds into the unchanged generation runner.

Expected: all ten observations pass and no payment is completed.

- [ ] **Step 6: Confirm protected files and public contracts were not changed**

Run:

```bash
git diff --name-only main...HEAD
git diff -- frontend/app/api/wallet/route.ts frontend/app/api/stripe/webhook/route.ts frontend/middleware.ts frontend/lib/seo frontend/lib/sitemap
```

Expected: the first command lists only planned client, copy, test, and documentation files; the second command prints nothing.

- [ ] **Step 7: Commit verification-only fixes if checks required them**

If and only if Tasks 1-6 files required a correction, stage those exact files and commit:

```bash
git add frontend tests
git commit -m "fix: close wallet checkout verification gaps"
```

If no correction was required, do not create an empty commit.

---

## Coverage Map

- Shared request, response, auth, locale, currency, captcha: Tasks 1 and 3.
- Duplicate-submit prevention and Stripe URL/session fallback: Task 3.
- Shared Turnstile and interaction vocabulary: Task 3.
- Billing multi-currency and Express preservation: Task 4.
- One-hour allowlisted `/app` return action and cancellation cleanup: Tasks 2 and 4.
- Sufficient Workspace amount and custom selection: Tasks 5 and 6.
- Workspace USD, analytics, rate limit, captcha, and recoverable errors: Task 6.
- Route-local workspace and Billing architecture boundaries: Tasks 4 and 6.
- Payment, auth, localization, routing, SEO, and production regression safety: Task 7.
