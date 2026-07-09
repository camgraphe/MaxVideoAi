# Signup-to-Top-up Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve a visitor's selected wallet amount through password or Google authentication, classify Google signup/signin analytics correctly, and make the billing/workspace conversion modals keyboard-accessible.

**Architecture:** A route-local pure billing-intent module owns URL parsing and serialization, while the existing login `next` contract carries that canonical URL through authentication. Billing hydrates its existing selection hook from the parsed intent. A shared client hook supplies focus containment, Escape handling, focus restoration, and scroll locking without moving route-local modal markup out of billing or workspace.

**Tech Stack:** Next.js 15.5 App Router, React 18.3, TypeScript 5.4, Node test runner through `tsx`, existing Tailwind design tokens, Supabase Auth, Stripe Checkout.

## Global Constraints

- Follow red-green-refactor: no production behavior is written before its focused test fails for the expected reason.
- Preserve existing Stripe, captcha, wallet, consent, locale, rate-limit, and checkout behavior.
- Do not add a dependency, database migration, API contract, or global state library.
- Keep `BillingClient` below its existing 450-line architecture limit.
- Keep login behavior in route-local hooks and helpers; keep workspace modal ownership under `_components` and pricing orchestration under `_hooks`.
- The billing URL contains only `amount` in integer USD cents and `currency=USD`; invalid input falls back to 1000 cents.
- Do not introduce a client-only maximum that disagrees with the wallet endpoint; require a finite safe integer of at least 1000 cents.
- Preserve dynamic imports and Server/Client boundaries already documented by the closest `AGENTS.md`.
- Do not redesign visual styling in this lot.

---

## File Map

- Create `frontend/app/(core)/billing/_lib/billing-intent.ts`: pure validated URL contract.
- Create `frontend/app/(core)/billing/_lib/billing-selection.ts`: pure preset/custom hydration state.
- Modify `frontend/app/(core)/billing/_hooks/useBillingTopupSelection.ts`: hydrate preset or custom selection from an initial amount.
- Modify `frontend/app/(core)/billing/_components/BillingClient.tsx`: parse intent and build the auth return target.
- Modify `frontend/app/(core)/login/_lib/login-helpers.ts`: persist Google auth mode and resolve its completion event.
- Modify `frontend/app/(core)/login/_hooks/useLoginPageController.ts`: preserve `safeNextPath` and mark Google mode.
- Modify `frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts`: emit signup or login completion from the consumed mode.
- Create `frontend/components/ui/useAccessibleModal.ts`: shared modal behavior only.
- Modify the three billing/workspace auth and top-up modal components to consume that behavior.
- Modify `frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts`: remove the duplicate global Escape listener.
- Add focused tests under `tests/` and extend existing architecture contracts.

---

### Task 1: Add the pure billing-intent URL contract

**Files:**
- Create: `frontend/app/(core)/billing/_lib/billing-intent.ts`
- Create: `tests/billing-intent.test.ts`

**Interfaces:**
- Produces: `BillingIntent`, `DEFAULT_BILLING_INTENT`, `parseBillingIntent(searchParams)`, and `buildBillingIntentTarget(intent)`.
- Consumed later by: `BillingClient` and billing integration tests.

- [ ] **Step 1: Write the failing billing-intent behavior test**

Create `tests/billing-intent.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BILLING_INTENT,
  buildBillingIntentTarget,
  parseBillingIntent,
} from '../frontend/app/(core)/billing/_lib/billing-intent';

test('billing intent accepts a valid USD amount in integer cents', () => {
  const parsed = parseBillingIntent(new URLSearchParams('amount=2500&currency=usd'));
  assert.deepEqual(parsed, { amountCents: 2500, currency: 'USD', isExplicit: true });
});

test('billing intent falls back for missing or invalid values', () => {
  const invalidQueries = [
    '',
    'amount=999&currency=USD',
    'amount=10.5&currency=USD',
    'amount=-2500&currency=USD',
    `amount=${Number.MAX_SAFE_INTEGER + 1}&currency=USD`,
    'amount=2500&currency=EUR',
  ];

  for (const query of invalidQueries) {
    assert.deepEqual(parseBillingIntent(new URLSearchParams(query)), DEFAULT_BILLING_INTENT, query);
  }
});

test('billing target serialization is deterministic and allowlisted', () => {
  assert.equal(
    buildBillingIntentTarget({ amountCents: 2500, currency: 'USD' }),
    '/billing?amount=2500&currency=USD'
  );
  assert.equal(
    buildBillingIntentTarget({ amountCents: 2500, currency: 'EUR' }),
    '/billing?amount=1000&currency=USD'
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/billing-intent.test.ts
```

Expected: FAIL with `Cannot find module .../billing-intent`.

- [ ] **Step 3: Implement the minimal pure contract**

Create `frontend/app/(core)/billing/_lib/billing-intent.ts`:

```ts
import { USD_TOPUP_TIERS } from '@/config/topupTiers';

const DEFAULT_AMOUNT_CENTS = USD_TOPUP_TIERS[0]?.amountCents ?? 1000;

export type BillingIntent = {
  amountCents: number;
  currency: 'USD';
  isExplicit: boolean;
};

export const DEFAULT_BILLING_INTENT: BillingIntent = {
  amountCents: DEFAULT_AMOUNT_CENTS,
  currency: 'USD',
  isExplicit: false,
};

type SearchParamsReader = Pick<URLSearchParams, 'get'>;

function normalizeAmountCents(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < DEFAULT_AMOUNT_CENTS) return null;
  return parsed;
}

export function parseBillingIntent(searchParams: SearchParamsReader): BillingIntent {
  const rawAmount = searchParams.get('amount');
  const rawCurrency = searchParams.get('currency');
  const amountCents = rawAmount == null || rawAmount.trim() === '' ? null : normalizeAmountCents(rawAmount);
  const currency = rawCurrency?.trim().toUpperCase();

  if (amountCents == null || currency !== 'USD') {
    return DEFAULT_BILLING_INTENT;
  }

  return { amountCents, currency: 'USD', isExplicit: true };
}

export function buildBillingIntentTarget(intent: { amountCents: number; currency: string }): string {
  const currency = intent.currency.trim().toUpperCase();
  const amountCents = currency === 'USD'
    ? normalizeAmountCents(intent.amountCents) ?? DEFAULT_AMOUNT_CENTS
    : DEFAULT_AMOUNT_CENTS;
  return `/billing?amount=${amountCents}&currency=USD`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2.

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the pure contract**

```bash
git add 'frontend/app/(core)/billing/_lib/billing-intent.ts' tests/billing-intent.test.ts
git commit -m "feat: add billing intent URL contract"
```

---

### Task 2: Hydrate billing selection and carry it into authentication

**Files:**
- Create: `frontend/app/(core)/billing/_lib/billing-selection.ts`
- Create: `tests/billing-topup-selection.test.ts`
- Create: `tests/billing-intent-integration.test.ts`
- Modify: `frontend/app/(core)/billing/_hooks/useBillingTopupSelection.ts`
- Modify: `frontend/app/(core)/billing/_components/BillingClient.tsx`
- Modify: `tests/billing-page-architecture.test.ts`

**Interfaces:**
- Consumes: `parseBillingIntent()` and `buildBillingIntentTarget()` from Task 1.
- Produces: `createInitialTopupSelection(amountCents)`, an `initialTopupCents?: number` option on `useBillingTopupSelection`, and a canonical `loginRedirectTarget` based on the current selection.

- [ ] **Step 1: Write the failing billing integration contract**

Create `tests/billing-topup-selection.test.ts` first so hydration behavior, including custom amounts, is tested independently of React:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialTopupSelection } from '../frontend/app/(core)/billing/_lib/billing-selection';

test('preset billing hydration selects the tier without opening custom state', () => {
  assert.deepEqual(createInitialTopupSelection(2500), {
    selectedTopupCents: 2500,
    customAmountInput: '',
  });
});

test('custom billing hydration preserves the exact dollar input', () => {
  assert.deepEqual(createInitialTopupSelection(1234), {
    selectedTopupCents: 1234,
    customAmountInput: '12.34',
  });
});

test('invalid billing hydration falls back to the first tier', () => {
  for (const value of [undefined, Number.NaN, 999, 10.5]) {
    assert.deepEqual(createInitialTopupSelection(value), {
      selectedTopupCents: 1000,
      customAmountInput: '',
    });
  }
});
```

Create `tests/billing-intent-integration.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientSource = readFileSync('frontend/app/(core)/billing/_components/BillingClient.tsx', 'utf8');
const selectionSource = readFileSync(
  'frontend/app/(core)/billing/_hooks/useBillingTopupSelection.ts',
  'utf8'
);

test('billing hydrates selection from the validated URL intent', () => {
  assert.match(clientSource, /useSearchParams\(\)/);
  assert.match(clientSource, /parseBillingIntent\(searchParams\)/);
  assert.match(clientSource, /initialTopupCents:\s*billingIntent\.amountCents/);
  assert.match(selectionSource, /initialTopupCents\?: number/);
  assert.match(selectionSource, /setSelectedTopupCents\(initialSelection\.selectedTopupCents\)/);
});

test('billing auth gate carries the current amount in a canonical return target', () => {
  assert.match(clientSource, /buildBillingIntentTarget\(\{/);
  assert.match(clientSource, /amountCents:\s*selectedTopupCents/);
  assert.match(clientSource, /currency:\s*'USD'/);
  assert.doesNotMatch(clientSource, /const loginRedirectTarget = pathname \|\| '\/billing'/);
});
```

Extend `tests/billing-page-architecture.test.ts`:

```ts
const intentPath = 'frontend/app/(core)/billing/_lib/billing-intent.ts';
```

Add `intentPath` to the first test's file list. At the beginning of the feature-module test, read both modules:

```ts
const intentSource = readFileSync(intentPath, 'utf8');
const clientSource = readFileSync(clientPath, 'utf8');
```

Then add these assertions to that test:

```ts
assert.match(intentSource, /export function parseBillingIntent/);
assert.match(intentSource, /export function buildBillingIntentTarget/);
assert.match(clientSource, /from '\.\.\/_lib\/billing-intent';/);
```

- [ ] **Step 2: Run integration tests and verify RED**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/billing-topup-selection.test.ts tests/billing-intent-integration.test.ts tests/billing-page-architecture.test.ts
```

Expected: FAIL because `billing-selection.ts` does not exist, `BillingClient` does not use the new intent, and the selection hook has no initial option.

- [ ] **Step 3: Implement the pure initial-selection behavior**

Create `frontend/app/(core)/billing/_lib/billing-selection.ts`:

```ts
import { USD_TOPUP_TIERS } from '@/config/topupTiers';

export type InitialTopupSelection = {
  selectedTopupCents: number;
  customAmountInput: string;
};

const DEFAULT_TOPUP_CENTS = USD_TOPUP_TIERS[0]?.amountCents ?? 1000;

function formatCustomAmountInput(amountCents: number): string {
  return Number.isInteger(amountCents / 100)
    ? String(amountCents / 100)
    : (amountCents / 100).toFixed(2);
}

export function createInitialTopupSelection(
  amountCents: number | undefined
): InitialTopupSelection {
  const selectedTopupCents =
    Number.isSafeInteger(amountCents) && Number(amountCents) >= DEFAULT_TOPUP_CENTS
      ? Number(amountCents)
      : DEFAULT_TOPUP_CENTS;
  const isPreset = USD_TOPUP_TIERS.some(
    (entry) => entry.amountCents === selectedTopupCents
  );
  return {
    selectedTopupCents,
    customAmountInput: isPreset ? '' : formatCustomAmountInput(selectedTopupCents),
  };
}
```

Run only the new behavior test. Expected: 3 tests pass.

- [ ] **Step 4: Consume the tested hydration behavior in the selection hook**

Update imports in `useBillingTopupSelection.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInitialTopupSelection } from '../_lib/billing-selection';
```

Extend the option type:

```ts
type UseBillingTopupSelectionOptions = {
  copy: BillingCopy;
  formatUsdAmount: (amountCents: number) => string;
  initialTopupCents?: number;
};
```

Change the hook signature and initial state:

```ts
export function useBillingTopupSelection({
  copy,
  formatUsdAmount,
  initialTopupCents,
}: UseBillingTopupSelectionOptions) {
  const initialSelection = useMemo(
    () => createInitialTopupSelection(initialTopupCents),
    [initialTopupCents]
  );
  const [customAmountInput, setCustomAmountInput] = useState(initialSelection.customAmountInput);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [selectedTopupCents, setSelectedTopupCents] = useState(initialSelection.selectedTopupCents);
```

Add this effect after the refs/state declarations:

```ts
  useEffect(() => {
    setSelectedTopupCents(initialSelection.selectedTopupCents);
    setCustomAmountInput(initialSelection.customAmountInput);
    setCustomEditorOpen(false);
  }, [initialSelection]);
```

- [ ] **Step 5: Wire URL intent and the current selection into BillingClient**

Replace the navigation import:

```ts
import { useSearchParams } from 'next/navigation';
```

Add the helper import:

```ts
import { buildBillingIntentTarget, parseBillingIntent } from '../_lib/billing-intent';
```

Replace `const pathname = usePathname();` and the old redirect target with:

```ts
  const searchParams = useSearchParams();
  const billingIntent = useMemo(() => parseBillingIntent(searchParams), [searchParams]);
```

Pass the initial amount into the existing hook:

```ts
  } = useBillingTopupSelection({
    copy,
    formatUsdAmount,
    initialTopupCents: billingIntent.amountCents,
  });
```

After the selection hook call, create the current return target:

```ts
  const loginRedirectTarget = useMemo(
    () =>
      buildBillingIntentTarget({
        amountCents: selectedTopupCents,
        currency: 'USD',
      }),
    [selectedTopupCents]
  );
```

- [ ] **Step 6: Run focused tests and type-check**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/billing-intent.test.ts tests/billing-topup-selection.test.ts tests/billing-intent-integration.test.ts tests/billing-page-architecture.test.ts
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: focused tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit billing hydration**

```bash
git add tests/billing-topup-selection.test.ts tests/billing-intent-integration.test.ts tests/billing-page-architecture.test.ts 'frontend/app/(core)/billing/_lib/billing-selection.ts' 'frontend/app/(core)/billing/_hooks/useBillingTopupSelection.ts' 'frontend/app/(core)/billing/_components/BillingClient.tsx'
git commit -m "fix: preserve billing amount through auth gate"
```

---

### Task 3: Preserve the return target after immediate password signup

**Files:**
- Create: `tests/login-signup-redirect-contract.test.ts`
- Modify: `frontend/app/(core)/login/_hooks/useLoginPageController.ts`

**Interfaces:**
- Consumes: existing `safeNextPath` from `useLoginNextTarget`.
- Produces: immediate password signup redirect through the selected safe target.

- [ ] **Step 1: Write the failing redirect regression test**

Create `tests/login-signup-redirect-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controllerSource = readFileSync(
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
  'utf8'
);

test('immediate password signup preserves the resolved return target', () => {
  assert.doesNotMatch(controllerSource, /const target = sanitizeNextPath\('\/generate'\)/);
  assert.match(
    controllerSource,
    /persistPendingAnalyticsEvent\('sign_up_completed',[\s\S]*completeAuthenticatedRedirect\(safeNextPath,\s*data\.session\.user\?\.id/
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/login-signup-redirect-contract.test.ts
```

Expected: FAIL because the controller still contains `sanitizeNextPath('/generate')`.

- [ ] **Step 3: Apply the minimal redirect fix**

Replace:

```ts
      const target = sanitizeNextPath('/generate');
      completeAuthenticatedRedirect(target, data.session.user?.id ?? data.user?.id ?? null);
```

with:

```ts
      completeAuthenticatedRedirect(
        safeNextPath,
        data.session.user?.id ?? data.user?.id ?? null
      );
```

- [ ] **Step 4: Run login tests and verify GREEN**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/login-signup-redirect-contract.test.ts tests/login-page-architecture.test.ts tests/auth-callback-redirect.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the password redirect fix**

```bash
git add tests/login-signup-redirect-contract.test.ts 'frontend/app/(core)/login/_hooks/useLoginPageController.ts'
git commit -m "fix: retain signup return target"
```

---

### Task 4: Preserve Google auth mode and classify completion correctly

**Files:**
- Create: `tests/login-google-auth-intent.test.ts`
- Modify: `frontend/app/(core)/login/_lib/login-helpers.ts`
- Modify: `frontend/app/(core)/login/_hooks/useLoginPageController.ts`
- Modify: `frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts`
- Modify: `tests/login-page-architecture.test.ts`

**Interfaces:**
- Produces: `PendingGoogleAuthMode`, `markPendingGoogleLogin(mode, now?)`, `consumePendingGoogleLogin(now?)`, and `resolveGoogleAuthCompletionEvent(mode)`.
- Consumes: the login controller's current auth mode and the OAuth exchange hook's completion path.

- [ ] **Step 1: Write the failing storage and event behavior tests**

Create `tests/login-google-auth-intent.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PENDING_GOOGLE_LOGIN_STORAGE_KEY,
  consumePendingGoogleLogin,
  markPendingGoogleLogin,
  resolveGoogleAuthCompletionEvent,
} from '../frontend/app/(core)/login/_lib/login-helpers';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function withSessionStorage(run: (storage: Storage) => void) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const sessionStorage = createStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage },
  });
  try {
    run(sessionStorage);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

test('Google auth marker preserves signup mode and consumes once', () => {
  withSessionStorage(() => {
    markPendingGoogleLogin('signup', 1_000);
    assert.equal(consumePendingGoogleLogin(2_000), 'signup');
    assert.equal(consumePendingGoogleLogin(2_000), null);
  });
});

test('Google auth marker treats a valid legacy marker as signin', () => {
  withSessionStorage((storage) => {
    storage.setItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY, JSON.stringify({ createdAt: 1_000 }));
    assert.equal(consumePendingGoogleLogin(2_000), 'signin');
  });
});

test('Google auth marker rejects expired or invalid state', () => {
  withSessionStorage((storage) => {
    markPendingGoogleLogin('signup', 1_000);
    assert.equal(consumePendingGoogleLogin(1_000 + 10 * 60 * 1000 + 1), null);
    storage.setItem(
      PENDING_GOOGLE_LOGIN_STORAGE_KEY,
      JSON.stringify({ createdAt: 2_000, mode: 'reset' })
    );
    assert.equal(consumePendingGoogleLogin(3_000), null);
  });
});

test('Google auth completion event follows the pending mode', () => {
  assert.equal(resolveGoogleAuthCompletionEvent('signup'), 'sign_up_completed');
  assert.equal(resolveGoogleAuthCompletionEvent('signin'), 'login_completed');
});
```

Extend `tests/login-page-architecture.test.ts` with these assertions in the helper contract test:

```ts
assert.match(helpersSource, /export function resolveGoogleAuthCompletionEvent\(/);
assert.match(controllerSource, /markPendingGoogleLogin\(mode === 'signup' \? 'signup' : 'signin'\)/);
assert.match(oauthCodeExchangeHookSource, /resolveGoogleAuthCompletionEvent\(pendingMode\)/);
```

- [ ] **Step 2: Run tests and verify RED**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/login-google-auth-intent.test.ts tests/login-page-architecture.test.ts
```

Expected: FAIL because the helper has no mode-aware API or event resolver.

- [ ] **Step 3: Implement the mode-aware storage contract**

In `login-helpers.ts`, add:

```ts
export type PendingGoogleAuthMode = 'signup' | 'signin';
export type GoogleAuthCompletionEvent = 'sign_up_completed' | 'login_completed';
```

Replace `markPendingGoogleLogin` and `consumePendingGoogleLogin` with:

```ts
export function markPendingGoogleLogin(
  mode: PendingGoogleAuthMode,
  now = Date.now()
) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      PENDING_GOOGLE_LOGIN_STORAGE_KEY,
      JSON.stringify({ createdAt: now, mode })
    );
  } catch {
    // ignore storage failures
  }
}

export function consumePendingGoogleLogin(
  now = Date.now()
): PendingGoogleAuthMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
    window.sessionStorage.removeItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      createdAt?: number;
      mode?: PendingGoogleAuthMode;
    } | null;
    if (!parsed || typeof parsed.createdAt !== 'number') return null;
    if (now - parsed.createdAt > PENDING_GOOGLE_LOGIN_TTL_MS) return null;
    if (parsed.mode == null) return 'signin';
    return parsed.mode === 'signup' || parsed.mode === 'signin' ? parsed.mode : null;
  } catch {
    return null;
  }
}

export function resolveGoogleAuthCompletionEvent(
  mode: PendingGoogleAuthMode
): GoogleAuthCompletionEvent {
  return mode === 'signup' ? 'sign_up_completed' : 'login_completed';
}
```

- [ ] **Step 4: Mark the current mode when Google OAuth starts**

In `useLoginPageController.ts`, replace:

```ts
        markPendingGoogleLogin();
```

with:

```ts
        markPendingGoogleLogin(mode === 'signup' ? 'signup' : 'signin');
```

- [ ] **Step 5: Emit the event selected by the consumed mode**

Add `resolveGoogleAuthCompletionEvent` to the helper imports in `useLoginOAuthCodeExchange.ts`, then replace `persistGoogleLoginCompleted` with:

```ts
function persistGoogleAuthCompleted() {
  const pendingMode = consumePendingGoogleLogin();
  if (!pendingMode) return;
  const eventName = resolveGoogleAuthCompletionEvent(pendingMode);
  persistPendingAnalyticsEvent(eventName, {
    route_family: 'auth',
    auth_surface: 'login',
    method: 'google',
    ...(eventName === 'sign_up_completed'
      ? { email_confirmation_required: false }
      : {}),
  });
}
```

Replace both calls to `persistGoogleLoginCompleted()` with `persistGoogleAuthCompleted()`.

- [ ] **Step 6: Run focused auth tests and type-check**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/login-google-auth-intent.test.ts tests/login-page-architecture.test.ts tests/login-oauth-cookie-fallback.test.ts tests/auth-callback-redirect.test.ts
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit Google auth intent**

```bash
git add tests/login-google-auth-intent.test.ts tests/login-page-architecture.test.ts 'frontend/app/(core)/login/_lib/login-helpers.ts' 'frontend/app/(core)/login/_hooks/useLoginPageController.ts' 'frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts'
git commit -m "fix: classify Google auth completion intent"
```

---

### Task 5: Add shared accessible modal behavior and migrate conversion gates

**Files:**
- Create: `frontend/components/ui/useAccessibleModal.ts`
- Create: `tests/modal-focus-cycle.test.ts`
- Create: `tests/modal-accessibility-contract.test.ts`
- Modify: `frontend/app/(core)/billing/_components/BillingAuthGateModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceAuthGateModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts`
- Modify: `tests/billing-page-architecture.test.ts`
- Modify: `tests/workspace-pricing-gate-hook-contract.test.ts`

**Interfaces:**
- Produces: `resolveModalTabTarget(input)` for tested wrap decisions and `useAccessibleModal<T extends HTMLElement>({ onClose, closeDisabled? })` returning `dialogRef` and `onDialogKeyDown`.
- Consumed by: three route-local modal components.

- [ ] **Step 1: Write the failing modal accessibility contract**

Create `tests/modal-focus-cycle.test.ts` so the keyboard wrap rules are behavior-tested without adding a DOM-test dependency:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveModalTabTarget } from '../frontend/components/ui/useAccessibleModal';

test('modal tab cycle wraps forward and backward at the edges', () => {
  assert.equal(
    resolveModalTabTarget({ activeIndex: 2, focusableCount: 3, shiftKey: false, activeInside: true }),
    0
  );
  assert.equal(
    resolveModalTabTarget({ activeIndex: 0, focusableCount: 3, shiftKey: true, activeInside: true }),
    2
  );
});

test('modal tab cycle enters from outside in the requested direction', () => {
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 3, shiftKey: false, activeInside: false }),
    0
  );
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 3, shiftKey: true, activeInside: false }),
    2
  );
});

test('modal tab cycle stays native in the middle and targets the dialog when empty', () => {
  assert.equal(
    resolveModalTabTarget({ activeIndex: 1, focusableCount: 3, shiftKey: false, activeInside: true }),
    null
  );
  assert.equal(
    resolveModalTabTarget({ activeIndex: -1, focusableCount: 0, shiftKey: false, activeInside: false }),
    -1
  );
});
```

Create `tests/modal-accessibility-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const hookPath = 'frontend/components/ui/useAccessibleModal.ts';
const modalPaths = [
  'frontend/app/(core)/billing/_components/BillingAuthGateModal.tsx',
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceAuthGateModal.tsx',
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx',
];

test('shared modal behavior owns focus, Escape, and scroll cleanup', () => {
  assert.equal(existsSync(hookPath), true);
  const source = readFileSync(hookPath, 'utf8');
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /opener\.focus\(\)/);
  assert.match(source, /data-modal-initial-focus/);
});

test('conversion modals expose named modal semantics and shared keyboard behavior', () => {
  for (const path of modalPaths) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /useAccessibleModal/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby=/);
    assert.match(source, /onKeyDown=\{onDialogKeyDown\}/);
    assert.match(source, /tabIndex=\{-1\}/);
  }
});
```

Extend `tests/workspace-pricing-gate-hook-contract.test.ts`:

```ts
assert.doesNotMatch(
  hookSource,
  /window\.addEventListener\('keydown'/,
  'modal keyboard behavior should live in the modal accessibility hook'
);
```

Extend the billing architecture test constants and first test's file list with:

```ts
const authGatePath = 'frontend/app/(core)/billing/_components/BillingAuthGateModal.tsx';
const accessibleModalHookPath = 'frontend/components/ui/useAccessibleModal.ts';
```

At the beginning of the feature-module test, read the files and assert the ownership boundary:

```ts
const authGateSource = readFileSync(authGatePath, 'utf8');
const accessibleModalHookSource = readFileSync(accessibleModalHookPath, 'utf8');
assert.match(accessibleModalHookSource, /export function useAccessibleModal/);
assert.match(authGateSource, /from '@\/components\/ui\/useAccessibleModal';/);
```

- [ ] **Step 2: Run modal tests and verify RED**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/modal-focus-cycle.test.ts tests/modal-accessibility-contract.test.ts tests/billing-page-architecture.test.ts tests/workspace-pricing-gate-hook-contract.test.ts
```

Expected: FAIL because `useAccessibleModal.ts` does not exist and the modals lack the shared behavior.

- [ ] **Step 3: Implement the shared modal behavior hook**

Create `frontend/components/ui/useAccessibleModal.ts`:

```ts
'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type UseAccessibleModalOptions = {
  onClose: () => void;
  closeDisabled?: boolean;
};

type ResolveModalTabTargetInput = {
  activeIndex: number;
  focusableCount: number;
  shiftKey: boolean;
  activeInside: boolean;
};

export function resolveModalTabTarget({
  activeIndex,
  focusableCount,
  shiftKey,
  activeInside,
}: ResolveModalTabTargetInput): number | null {
  if (focusableCount <= 0) return -1;
  if (!activeInside) return shiftKey ? focusableCount - 1 : 0;
  if (shiftKey && activeIndex === 0) return focusableCount - 1;
  if (!shiftKey && activeIndex === focusableCount - 1) return 0;
  return null;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true' && element.tabIndex >= 0
  );
}

export function useAccessibleModal<T extends HTMLElement = HTMLDivElement>({
  onClose,
  closeDisabled = false,
}: UseAccessibleModalOptions) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const preferred = dialog.querySelector<HTMLElement>('[data-modal-initial-focus="true"]');
      const target = preferred ?? getFocusableElements(dialog)[0] ?? dialog;
      target.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);

  const onDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<T>) => {
      if (event.key === 'Escape') {
        if (!closeDisabled) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusableElements(dialog);
      const active = document.activeElement;
      const activeIndex = focusable.findIndex((element) => element === active);
      const targetIndex = resolveModalTabTarget({
        activeIndex,
        focusableCount: focusable.length,
        shiftKey: event.shiftKey,
        activeInside: dialog.contains(active),
      });
      if (targetIndex === null) return;
      event.preventDefault();
      if (targetIndex === -1) {
        dialog.focus();
        return;
      }
      focusable[targetIndex]?.focus();
    },
    [closeDisabled]
  );

  return { dialogRef, onDialogKeyDown };
}
```

- [ ] **Step 4: Migrate BillingAuthGateModal**

Add `'use client';`, import `useAccessibleModal`, and initialize:

```ts
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLDivElement>({ onClose });
```

Keep the overlay as the positioning container. Change the backdrop to:

```tsx
<div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
```

Change the dialog content opening tag to:

```tsx
<div
  ref={dialogRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="billing-auth-gate-title"
  aria-describedby="billing-auth-gate-description"
  tabIndex={-1}
  onKeyDown={onDialogKeyDown}
  className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float"
>
```

Add IDs to the visible title and description:

```tsx
<h2 id="billing-auth-gate-title" className="text-base font-semibold text-text-primary">
  {copy.authGate.title}
</h2>
<p id="billing-auth-gate-description" className="mt-2 text-sm text-text-secondary">
  {copy.authGate.body}
</p>
```

Add `data-modal-initial-focus="true"` to the primary `ButtonLink`.

- [ ] **Step 5: Migrate WorkspaceAuthGateModal**

Apply the same structure with IDs `workspace-auth-gate-title` and `workspace-auth-gate-description`. Use:

```ts
const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLDivElement>({ onClose });
```

Add `data-modal-initial-focus="true"` to the primary account action.

- [ ] **Step 6: Migrate WorkspaceTopUpModal and disable closure while submitting**

Add `'use client';`, import the hook, and initialize:

```ts
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLFormElement>({
    onClose,
    closeDisabled: isTopUpLoading,
  });
```

Change the backdrop handler to:

```tsx
<div
  className="absolute inset-0"
  aria-hidden="true"
  onClick={isTopUpLoading ? undefined : onClose}
/>
```

Add these props to the existing `<form>`:

```tsx
ref={dialogRef}
role="dialog"
aria-modal="true"
aria-labelledby="workspace-topup-title"
aria-describedby="workspace-topup-description"
tabIndex={-1}
onKeyDown={onDialogKeyDown}
```

Give the visible heading and message the matching IDs:

```tsx
<h2 id="workspace-topup-title" className="text-base font-semibold text-text-primary">
  Wallet balance too low
</h2>
<p id="workspace-topup-description" className="mt-2 text-sm text-text-secondary">
  {modal.message}
</p>
```

Disable both close controls while submitting and add `data-modal-initial-focus="true"` to the submit button:

```tsx
disabled={isTopUpLoading}
```

- [ ] **Step 7: Remove duplicate workspace Escape ownership**

Delete this effect from `useWorkspacePricingGate.ts`:

```ts
  useEffect(() => {
    if (!topUpModal) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTopUpModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [topUpModal, closeTopUpModal]);
```

- [ ] **Step 8: Run modal contracts, workspace contracts, and type-check**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/modal-focus-cycle.test.ts tests/modal-accessibility-contract.test.ts tests/billing-page-architecture.test.ts tests/workspace-pricing-gate-hook-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts
cd frontend && ./node_modules/.bin/tsc --noEmit
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 9: Commit accessible conversion modals**

```bash
git add frontend/components/ui/useAccessibleModal.ts tests/modal-focus-cycle.test.ts tests/modal-accessibility-contract.test.ts tests/billing-page-architecture.test.ts tests/workspace-pricing-gate-hook-contract.test.ts 'frontend/app/(core)/billing/_components/BillingAuthGateModal.tsx' 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAuthGateModal.tsx' 'frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx' 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts'
git commit -m "fix: make conversion modals accessible"
```

---

### Task 6: Verify the complete conversion-repair lot

**Files:**
- Verify only: all files changed in Tasks 1-5.
- Update only if a verification command exposes a regression, using a new failing regression test before the production fix.

**Interfaces:**
- Consumes: all behavior delivered by Tasks 1-5.
- Produces: a validated, buildable first conversion-repair lot.

- [ ] **Step 1: Run all repository tests**

```bash
pnpm test:validate
```

Expected: all tests pass with 0 failures.

- [ ] **Step 2: Run lint, exposure guard, and whitespace validation**

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all commands exit 0 with no new warnings attributable to this lot.

- [ ] **Step 3: Build the production application**

```bash
npm --prefix frontend run build
```

Expected: Next.js production build, type validation, static generation, and sitemap generation complete successfully.

- [ ] **Step 4: Smoke-test billing intent manually without a real payment**

Start the app:

```bash
npm --prefix frontend run dev -- --port 3000
```

Verify in the browser:

1. Open `/billing?amount=2500&currency=USD` while signed out.
2. Confirm USD 25 is selected.
3. Click the hosted checkout action.
4. Confirm the auth gate opens, focus moves inside, Tab/Shift+Tab remain inside, Escape closes it, body does not scroll, and focus returns to the checkout action.
5. Reopen it and confirm the Create account link contains an encoded `next=/billing?amount=2500&currency=USD` target.
6. Open `/billing?amount=10.5&currency=EUR` and confirm the USD 10 fallback.
7. Open the workspace auth gate and low-balance top-up modal; repeat keyboard containment and focus-restoration checks.
8. While the workspace top-up submit state is loading, confirm Escape, backdrop, and close controls do not dismiss the modal.

Do not complete a Stripe payment.

- [ ] **Step 5: Confirm the worktree contains only intended changes**

```bash
git status --short
git diff --stat d00d6fda..HEAD
```

Expected: only the planned auth, billing, workspace modal, test, and documentation files are present.

- [ ] **Step 6: Record the verified commit set without creating an empty commit**

```bash
git log --oneline d00d6fda..HEAD
git status --short
```

Expected: the log contains the planned implementation commits and `git status --short` prints nothing. If any verification command failed, stop this task and begin a new red-green cycle that names the observed regression before changing production code.
