# Funnel Attribution Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the consented visitor-to-signup-to-first-generation-to-first-top-up funnel with stable first-touch and last-touch attribution that survives authentication and reaches the Stripe completion webhook.

**Architecture:** Add a pure browser-safe journey domain plus a thin consent/storage adapter, then enrich all GA4 send boundaries from that shared owner. Carry a compact untrusted projection through hosted and Express checkout, validate it in a focused server module, bind checkout-session reuse to the same attribution fingerprint, and project the accepted metadata into the existing webhook GA4 events.

**Tech Stack:** Next.js App Router, React, TypeScript, browser `localStorage`, GA4 `gtag`, GA4 Measurement Protocol, Stripe Checkout, Node test runner through `tsx`, existing MaxVideoAI consent and checkout contracts.

## Global Constraints

- Create journey state only when the existing analytics consent source says `granted`.
- Use storage key `mvai.analytics-journey.v1` and a fixed 90-day lifetime from creation.
- Keep first touch immutable; update last touch only for a different valid UTM campaign or external referrer.
- Accept only `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content`; exclude `utm_term`.
- Cap attribution values at 80 characters and never store raw URLs, query strings, hashes, referrers, prompts, filenames, tokens, OAuth codes, or Stripe customer data.
- Use an opaque cryptographic UUID only for analytics correlation; never use it for authentication, authorization, pricing, entitlement, fraud, or wallet identity.
- Do not queue, retry, persist, or replay events created before analytics consent.
- Analytics failures must never block navigation, signup, generation, checkout, wallet credit, receipt creation, or webhook completion.
- Preserve current event names, GA client ID behavior, authenticated `user_id`, amount/currency/tier fields, checkout protections, route behavior, localization, and SEO output.
- Add no database migration, anonymous-visitor table, admin dashboard, global state library, or dependency.
- Do not register `journey_id`, Stripe IDs, job IDs, or local generation keys as GA4 custom dimensions.

## File Structure

### New owners

- `frontend/lib/analytics/journey-contract.ts`: bounded shared types, sanitization, wallet projection parsing, and stable cache keys.
- `frontend/lib/analytics/journey.ts`: pure touch classification, journey lifecycle, milestone counters, and event preparation.
- `frontend/lib/analytics/consent-client.ts`: browser reader for the existing analytics consent flag.
- `frontend/lib/analytics/journey-browser.ts`: storage, current route/referrer capture, event preparation, and wallet projection.
- `frontend/server/wallet-attribution.ts`: server validation, Stripe metadata, fingerprinting, reuse matching, and webhook GA4 projection.

### Existing owners kept stable

- `GA4EventBridge` remains the custom-event and generation-terminal bridge.
- `GA4RouteTracker` remains the route-view owner.
- Login hooks remain auth-intent owners.
- `useHostedWalletCheckout` remains hosted checkout orchestration.
- `POST /api/wallet` remains Stripe session creation and untrusted-input validation.
- The Stripe webhook remains wallet completion and server GA4 ownership.

---

### Task 1: Build the pure journey and wallet contracts

**Files:**
- Create: `frontend/lib/analytics/journey-contract.ts`
- Create: `frontend/lib/analytics/journey.ts`
- Create: `tests/analytics-journey-contract.test.ts`
- Create: `tests/analytics-journey.test.ts`

**Interfaces:**
- Consumes: stable route family and landing surface strings supplied by callers.
- Produces: `AnalyticsTouch`, `AnalyticsJourneyRecordV1`, `WalletAnalyticsJourney`, `PreparedAnalyticsEvent`, `sanitizeAttributionValue()`, `parseWalletAnalyticsJourney()`, `walletAnalyticsJourneyCacheKey()`, `resolveAnalyticsTouch()`, `createAnalyticsJourneyRecord()`, `applyAnalyticsTouch()`, and `prepareJourneyEvents()`.

- [ ] **Step 1: Write failing contract tests**

Create `tests/analytics-journey-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWalletAnalyticsJourney, sanitizeAttributionValue, walletAnalyticsJourneyCacheKey } from '../frontend/lib/analytics/journey-contract';

const valid = {
  version: 1,
  journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9',
  cohortWeek: '2026-W28',
  firstSource: 'google',
  firstMedium: 'cpc',
  firstCampaign: 'summer_launch',
  firstContent: 'video_a',
  lastSource: 'partner.example',
  lastMedium: 'referral',
  lastCampaign: 'creator_wave',
  lastContent: 'cta_2',
} as const;

test('attribution sanitization is bounded', () => {
  assert.equal(sanitizeAttributionValue('  Google Ads  ', { lowercase: true }), 'google ads');
  assert.equal(sanitizeAttributionValue('<script>alert(1)</script>'), 'scriptalert1/script');
  assert.equal(sanitizeAttributionValue('x'.repeat(120))?.length, 80);
  assert.equal(sanitizeAttributionValue('   '), null);
});

test('wallet parser accepts only the versioned bounded contract', () => {
  assert.deepEqual(parseWalletAnalyticsJourney(valid), valid);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, version: 2 }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, journeyId: 'invalid' }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, cohortWeek: '2026-28' }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, firstSource: '' }), null);
});

test('wallet cache keys change with attribution', () => {
  assert.equal(walletAnalyticsJourneyCacheKey(valid), walletAnalyticsJourneyCacheKey({ ...valid }));
  assert.notEqual(walletAnalyticsJourneyCacheKey(valid), walletAnalyticsJourneyCacheKey({ ...valid, lastCampaign: 'other' }));
  assert.equal(walletAnalyticsJourneyCacheKey(null), 'no-attribution');
});
```

- [ ] **Step 2: Write failing lifecycle tests**

Create `tests/analytics-journey.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAnalyticsTouch, createAnalyticsJourneyRecord, prepareJourneyEvents, resolveAnalyticsTouch } from '../frontend/lib/analytics/journey';

const route = { landingRouteFamily: 'marketing', landingSurface: '/pricing', locale: 'en' };
const uuid = '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9';

test('resolution prioritizes campaign, organic, referral, then direct', () => {
  const campaign = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/pricing?utm_source=Google&utm_medium=CPC&utm_campaign=Launch&utm_content=Hero&utm_term=private', referrer: 'https://partner.example/post', siteOrigin: 'https://maxvideoai.com', ...route });
  assert.deepEqual(campaign, { source: 'google', medium: 'cpc', campaign: 'Launch', content: 'Hero', ...route });
  assert.equal(resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: 'https://www.google.com/search?q=x', siteOrigin: 'https://maxvideoai.com', ...route }).medium, 'organic');
  assert.equal(resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: 'https://partner.example/post', siteOrigin: 'https://maxvideoai.com', ...route }).medium, 'referral');
  assert.equal(resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route }).source, 'direct');
});

test('first touch is immutable and identical touches do not refresh time', () => {
  const first = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/?utm_source=google&utm_medium=cpc', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const record = createAnalyticsJourneyRecord({ journeyId: uuid, now: 1_000, touch: first });
  const same = applyAnalyticsTouch(record, first, 2_000);
  assert.deepEqual(same.firstTouch, first);
  assert.equal(same.lastTouchAt, 1_000);
  const next = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/?utm_source=newsletter&utm_medium=email', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const updated = applyAnalyticsTouch(same, next, 3_000);
  assert.deepEqual(updated.firstTouch, first);
  assert.deepEqual(updated.lastTouch, next);
  assert.equal(updated.lastTouchAt, 3_000);
});

test('event preparation emits one entry and first-generation sequence', () => {
  const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const record = createAnalyticsJourneyRecord({ journeyId: uuid, now: Date.UTC(2026, 6, 6), touch });
  const first = prepareJourneyEvents(record, 'generation_started', { local_key: 'local-1' }, Date.UTC(2026, 6, 7));
  assert.deepEqual(first.events.map((entry) => entry.event), ['funnel_entry', 'generation_started']);
  assert.equal(first.events[1]?.payload.is_first_generation, true);
  assert.equal(first.events[1]?.payload.generation_sequence, 1);
  assert.equal(first.events[1]?.payload.acquisition_cohort, '2026-W28');
  const second = prepareJourneyEvents(first.record, 'generation_started', { local_key: 'local-2' }, Date.UTC(2026, 6, 8));
  assert.deepEqual(second.events.map((entry) => entry.event), ['generation_started']);
  assert.equal(second.events[0]?.payload.is_first_generation, false);
  assert.equal(second.events[0]?.payload.generation_sequence, 2);
});

test('topup preparation increments attempts without confusing checkout-opened', () => {
  const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const record = createAnalyticsJourneyRecord({ journeyId: uuid, now: Date.UTC(2026, 6, 6), touch });
  const started = prepareJourneyEvents(record, 'topup_started', {}, Date.UTC(2026, 6, 7));
  assert.equal(started.events.at(-1)?.payload.topup_sequence, 1);
  assert.equal(started.events.at(-1)?.payload.is_first_topup_attempt, true);
  const opened = prepareJourneyEvents(started.record, 'topup_checkout_opened', {}, Date.UTC(2026, 6, 7));
  assert.equal(opened.record.topupStartedCount, 1);
});
```

- [ ] **Step 3: Verify red tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/analytics-journey-contract.test.ts tests/analytics-journey.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Implement both pure modules**

In `journey-contract.ts`, export version `1`, TTL `90 * 24 * 60 * 60 * 1000`, storage key `mvai.analytics-journey.v1`, the types above, UUID pattern, ISO cohort pattern, and this sanitizer:

```ts
export type AnalyticsTouch = {
  source: string; medium: string; campaign?: string; content?: string; referrerHost?: string;
  landingRouteFamily: string; landingSurface?: string; locale?: string;
};
export type AnalyticsJourneyRecordV1 = {
  version: 1; journeyId: string; createdAt: number; expiresAt: number; cohortWeek: string;
  firstTouch: AnalyticsTouch; lastTouch: AnalyticsTouch; lastTouchAt: number;
  funnelEntrySent: boolean; generationStartedCount: number; topupStartedCount: number;
};
export type WalletAnalyticsJourney = {
  version: 1; journeyId: string; cohortWeek: string;
  firstSource: string; firstMedium: string; firstCampaign?: string; firstContent?: string;
  lastSource: string; lastMedium: string; lastCampaign?: string; lastContent?: string;
};
export type PreparedAnalyticsEvent = { event: string; payload: Record<string, unknown> };

export function sanitizeAttributionValue(value: unknown, options: { lowercase?: boolean } = {}): string | null {
  if (typeof value !== 'string') return null;
  const result = value.normalize('NFKC').trim().replace(/[^a-zA-Z0-9._~+\-/: ]/g, '').slice(0, 80).trim();
  if (!result) return null;
  return options.lowercase ? result.toLowerCase() : result;
}
```

`parseWalletAnalyticsJourney()` must require UUID, `YYYY-Www`, and non-empty first/last source and medium. Optional campaign/content values are sanitized and omitted when empty. `walletAnalyticsJourneyCacheKey()` joins every normalized field in fixed order and returns `no-attribution` for null.

In `journey.ts`, implement Google/Bing/Yahoo/DuckDuckGo/Ecosia/Baidu/Yandex organic hostname classification, external-host referral classification, direct fallback, ISO week generation, touch fingerprints, immutable first touch, and this stage map:

```ts
const FUNNEL_STAGES: Record<string, string> = {
  sign_up_started: 'signup_started', sign_up_completed: 'signup_completed',
  generation_started: 'generation_started', generation_completed: 'generation_completed', generation_failed: 'generation_failed',
  topup_started: 'topup_started', topup_checkout_opened: 'topup_checkout_opened',
  topup_completed: 'topup_completed', topup_cancelled: 'topup_cancelled', topup_failed: 'topup_failed',
};
```

`applyAnalyticsTouch()` compares only source, medium, campaign, content, and referrer host. It ignores a direct or same-origin touch for an existing record, and it does not use landing route changes as a new attribution signal. `prepareJourneyEvents()` increments only start counters, merges journey-owned fields after caller fields, marks entry sent before return, and prepends `funnel_entry` once.

Every prepared funnel payload includes `journey_id`, `acquisition_cohort`, first/last source and medium, optional first/last campaign and content, `journey_age_days`, `landing_route_family`, optional `landing_surface`, and optional `journey_locale`. Funnel events receive the mapped `funnel_stage`. `funnel_entry` receives `funnel_stage: 'entry'`.

- [ ] **Step 5: Verify green tests and commit**

Run the Step 3 command. Expected: all tests pass.

```bash
git add frontend/lib/analytics/journey-contract.ts frontend/lib/analytics/journey.ts tests/analytics-journey-contract.test.ts tests/analytics-journey.test.ts
git commit -m "feat: add consented analytics journey domain"
```

---

### Task 2: Add consent-aware browser storage

**Files:**
- Create: `frontend/lib/analytics/consent-client.ts`
- Create: `frontend/lib/analytics/journey-browser.ts`
- Create: `tests/analytics-consent.test.ts`
- Modify: `frontend/lib/analytics-client.ts`
- Modify: `frontend/components/analytics/ConsentModeBootstrap.tsx`
- Modify: `frontend/components/legal/cookie-banner-client.ts`

**Interfaces:**
- Consumes: Task 1 types and preparation functions plus the existing `mv-consent-analytics` flag.
- Produces: `hasAnalyticsConsentInBrowser()`, `readAnalyticsJourney()`, `clearAnalyticsJourney()`, `prepareBrowserAnalyticsEvents()`, `readWalletAnalyticsJourney()`, and `clearBrowserAnalyticsState()`.

- [ ] **Step 1: Write failing browser consent tests**

Create `tests/analytics-consent.test.ts` with an in-memory `Storage` and a `withBrowser()` helper that installs and restores deterministic `window`, `document`, and `crypto` globals. Test these assertions:

```ts
function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

function withBrowser(
  options: { consent: string | null; storedJourney?: string },
  run: (value: { localStorage: Storage; sessionStorage: Storage }) => void
) {
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
  };
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  if (options.consent) localStorage.setItem('mv-consent-analytics', options.consent);
  if (options.storedJourney) localStorage.setItem('mvai.analytics-journey.v1', options.storedJourney);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, sessionStorage, location: { href: 'https://maxvideoai.com/pricing?utm_source=google&utm_medium=cpc', origin: 'https://maxvideoai.com', pathname: '/pricing' }, dispatchEvent() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { referrer: '', documentElement: { lang: 'en' } } });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9' } });
  try { run({ localStorage, sessionStorage }); }
  finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
```

```ts
test('denied consent prepares no event and stores no journey', () => {
  withBrowser({ consent: null }, () => {
    assert.deepEqual(prepareBrowserAnalyticsEvents('sign_up_started', { method: 'password' }), []);
    assert.equal(readAnalyticsJourney(), null);
  });
});

test('granted consent creates one entry and one durable journey', () => {
  withBrowser({ consent: 'granted' }, () => {
    assert.deepEqual(prepareBrowserAnalyticsEvents('sign_up_started', { method: 'password' }).map((entry) => entry.event), ['funnel_entry', 'sign_up_started']);
    assert.equal(readAnalyticsJourney()?.journeyId, '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9');
    assert.deepEqual(prepareBrowserAnalyticsEvents('sign_up_completed', {}).map((entry) => entry.event), ['sign_up_completed']);
  });
});

test('pending auth events are never stored without consent', () => {
  withBrowser({ consent: null }, ({ sessionStorage }) => {
    persistPendingAnalyticsEvent('sign_up_completed', { method: 'google' });
    assert.equal(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY), null);
    assert.equal(readPendingAnalyticsEvent(), null);
  });
});
```

The helper must supply `location.href`, `origin`, `pathname`, `document.referrer`, `document.documentElement.lang`, both storage objects, and `crypto.randomUUID()`.

- [ ] **Step 2: Verify red test**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/analytics-consent.test.ts
```

Expected: FAIL because the browser modules do not exist.

- [ ] **Step 3: Implement consent and browser adapters**

Create `consent-client.ts`:

```ts
export const ANALYTICS_CONSENT_STORAGE_KEY = 'mv-consent-analytics';
export const ANALYTICS_CONSENT_GRANTED_VALUE = 'granted';
export function hasAnalyticsConsentInBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === ANALYTICS_CONSENT_GRANTED_VALUE; }
  catch { return false; }
}
```

Create `journey-browser.ts` with safe JSON parsing, expiry rejection, `crypto.randomUUID()`, `getAnalyticsRouteContext()`, document language, and all storage access inside `try/catch`. Use these signatures:

```ts
export function readAnalyticsJourney(now = Date.now()): AnalyticsJourneyRecordV1 | null;
export function clearAnalyticsJourney(): void;
export function prepareBrowserAnalyticsEvents(event: string, payload?: Record<string, unknown>): PreparedAnalyticsEvent[];
export function readWalletAnalyticsJourney(): WalletAnalyticsJourney | null;
export function clearBrowserAnalyticsState(): void;
```

Return `[]` immediately without consent. With consent, create/read the record, apply a different qualifying touch, prepare events, persist the returned record, and return events. `readWalletAnalyticsJourney()` projects a valid existing record without creating one.

- [ ] **Step 4: Gate dispatch and pending auth storage at event time**

In `analytics-client.ts`, make `dispatchAnalyticsEvent()`, `persistPendingAnalyticsEvent()`, and `readPendingAnalyticsEvent()` call `hasAnalyticsConsentInBrowser()`. Without consent, clear the pending key and return. Reuse the new constants in `ConsentModeBootstrap.tsx` and `cookie-banner-client.ts`; do not change consent payloads, cookies, banner copy, or Google Consent Mode fields.

- [ ] **Step 5: Verify and commit**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/analytics-journey-contract.test.ts tests/analytics-journey.test.ts tests/analytics-consent.test.ts tests/login-google-auth-intent.test.ts
git add frontend/lib/analytics/consent-client.ts frontend/lib/analytics/journey-browser.ts frontend/lib/analytics-client.ts frontend/components/analytics/ConsentModeBootstrap.tsx frontend/components/legal/cookie-banner-client.ts tests/analytics-consent.test.ts
git commit -m "feat: gate journey analytics on consent"
```

Expected: all tests pass and the commit succeeds.

---

### Task 3: Sanitize route analytics and enrich all browser transports

**Files:**
- Modify: `frontend/lib/analytics-route.ts`
- Modify: `frontend/components/analytics/GA4RouteTracker.tsx`
- Modify: `frontend/components/analytics/GA4EventBridge.tsx`
- Modify: `frontend/lib/analytics/ga-events.ts`
- Modify: `tests/analytics-route.test.ts`
- Create: `tests/analytics-transport-contract.test.ts`

**Interfaces:**
- Consumes: Task 2 browser preparation and consent helpers.
- Produces: `getSafeAnalyticsPath()`, `buildSafeAnalyticsLocation()`, `getAnalyticsLandingSurface()`, and one consent-aware enrichment path for every browser GA4 transport.

- [ ] **Step 1: Write failing route and transport tests**

Extend `tests/analytics-route.test.ts`:

```ts
test('safe locations remove query, hash, locale prefix, and dynamic ids', () => {
  assert.equal(buildSafeAnalyticsLocation('https://maxvideoai.com', '/login?code=secret#token'), 'https://maxvideoai.com/login');
  assert.equal(buildSafeAnalyticsLocation('https://maxvideoai.com', '/billing?checkoutSessionId=cs_secret'), 'https://maxvideoai.com/billing');
  assert.equal(getSafeAnalyticsPath('/video/job_123/private-slug'), '/video/:video');
  assert.equal(getSafeAnalyticsPath('/fr/pricing?utm_source=google'), '/pricing');
  assert.equal(buildSafeAnalyticsLocation('https://maxvideoai.com', '/tools/angle?next=/private#secret'), 'https://maxvideoai.com/tools/angle');
});
```

Create `tests/analytics-transport-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('all transports use consented journey preparation', () => {
  for (const file of ['frontend/components/analytics/GA4EventBridge.tsx', 'frontend/components/analytics/GA4RouteTracker.tsx', 'frontend/lib/analytics/ga-events.ts']) {
    assert.match(readFileSync(file, 'utf8'), /prepareBrowserAnalyticsEvents/);
  }
  const routeTracker = readFileSync('frontend/components/analytics/GA4RouteTracker.tsx', 'utf8');
  assert.doesNotMatch(routeTracker, /searchParams\?\.toString\(\)/);
  assert.match(routeTracker, /buildSafeAnalyticsLocation/);
});

test('consent withdrawal clears queued analytics', () => {
  const bridge = readFileSync('frontend/components/analytics/GA4EventBridge.tsx', 'utf8');
  assert.match(bridge, /consent:updated/);
  assert.match(bridge, /clearBrowserAnalyticsState/);
  assert.match(bridge, /queuedEventsRef\.current = \[\]/);
});
```

- [ ] **Step 2: Verify red tests**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/analytics-route.test.ts tests/analytics-transport-contract.test.ts
```

Expected: FAIL because safe location and shared preparation calls are absent.

- [ ] **Step 3: Implement safe analytics paths**

Add to `analytics-route.ts`:

```ts
export function getSafeAnalyticsPath(pathname: string | null | undefined): string {
  const context = getAnalyticsRouteContext(pathname);
  if (context.family === 'auth') return '/login';
  if (context.family === 'billing') return '/billing';
  if (context.family === 'workspace') return context.workspaceSection === 'video' ? '/video/:video' : context.workspaceSection === 'home' ? '/app' : `/app/${context.workspaceSection ?? 'home'}`;
  if (context.family === 'app_tools') return `/app/tools/${context.toolName ?? 'tools_hub'}`;
  if (context.family === 'public_tools') return context.toolName === 'tools_hub' ? '/tools' : `/tools/${context.toolName}`;
  return context.normalizedPath;
}
export function buildSafeAnalyticsLocation(origin: string, pathname: string | null | undefined): string {
  return `${origin.replace(/\/$/, '')}${getSafeAnalyticsPath(pathname)}`;
}
export function getAnalyticsLandingSurface(context: AnalyticsRouteContext): string {
  return context.toolName ?? context.workspaceSection ?? context.normalizedPath;
}
```

- [ ] **Step 4: Route every send boundary through prepared events**

Remove `useSearchParams` from `GA4RouteTracker`. Build query-free `page_location`, call `prepareBrowserAnalyticsEvents('page_view', payload)`, and send returned events in order.

In `GA4EventBridge`, prepare before enqueueing and return the enriched primary payload so `generation_started` stores it in the existing local-key map. On consent withdrawal, clear queue, generation maps, pending auth, and journey state.

In `ga-events.ts`, prepare once before retrying, return `false` for an empty event list, recheck consent on every retry, and send the prepared entry before the primary event.

- [ ] **Step 5: Verify and commit**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/analytics-route.test.ts tests/analytics-transport-contract.test.ts tests/analytics-consent.test.ts tests/analytics-journey.test.ts
git add frontend/lib/analytics-route.ts frontend/components/analytics/GA4RouteTracker.tsx frontend/components/analytics/GA4EventBridge.tsx frontend/lib/analytics/ga-events.ts tests/analytics-route.test.ts tests/analytics-transport-contract.test.ts
git commit -m "feat: enrich consented browser analytics"
```

Expected: all tests pass and the commit succeeds.

---

### Task 4: Correct Google signup start and generation failure analytics

**Files:**
- Modify: `frontend/app/(core)/login/_lib/login-helpers.ts`
- Modify: `frontend/app/(core)/login/_hooks/useLoginPageController.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/workspace-generation-iteration-runner.ts`
- Modify: `frontend/components/analytics/GA4EventBridge.tsx`
- Modify: `tests/login-google-auth-intent.test.ts`
- Create: `tests/analytics-generation-contract.test.ts`

**Interfaces:**
- Consumes: Task 3 consent-aware dispatch and enriched generation bridge.
- Produces: `shouldTrackGoogleSignupStart(mode)` plus classified generation failure fields with no free-form error message.

- [ ] **Step 1: Write failing tests**

Extend `tests/login-google-auth-intent.test.ts`:

```ts
import { shouldTrackGoogleSignupStart } from '../frontend/app/(core)/login/_lib/login-helpers';

test('Google signup start follows visible auth mode', () => {
  assert.equal(shouldTrackGoogleSignupStart('signup'), true);
  assert.equal(shouldTrackGoogleSignupStart('signin'), false);
  assert.equal(shouldTrackGoogleSignupStart('reset'), false);
});
```

Create `tests/analytics-generation-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Google signup emits a start event before OAuth', () => {
  const source = readFileSync('frontend/app/(core)/login/_hooks/useLoginPageController.ts', 'utf8');
  assert.match(source, /shouldTrackGoogleSignupStart\(mode\)/);
  assert.match(source, /dispatchAnalyticsEvent\('sign_up_started'/);
  assert.match(source, /method: 'google'/);
});

test('generation analytics use classifications instead of free-form errors', () => {
  const runner = readFileSync('frontend/app/(core)/(workspace)/app/_hooks/workspace-generation-iteration-runner.ts', 'utf8');
  const bridge = readFileSync('frontend/components/analytics/GA4EventBridge.tsx', 'utf8');
  assert.doesNotMatch(runner, /error_message: error instanceof Error \? error\.message/);
  assert.doesNotMatch(bridge, /error_message: typeof detail\.message/);
  assert.match(runner, /failure_category: 'generation_request_failed'/);
  assert.match(bridge, /failure_category: 'job_failed'/);
});
```

- [ ] **Step 2: Verify red tests**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/login-google-auth-intent.test.ts tests/analytics-generation-contract.test.ts
```

Expected: FAIL because the helper and bounded failure fields are absent.

- [ ] **Step 3: Implement Google signup start**

Add to `login-helpers.ts`:

```ts
// Extend the existing login-copy import with `type AuthMode`.
export function shouldTrackGoogleSignupStart(mode: AuthMode): boolean {
  return mode === 'signup';
}
```

After the Google redirect URL is validated and before `signInWithOAuth()`, add:

```ts
if (shouldTrackGoogleSignupStart(mode)) {
  dispatchAnalyticsEvent('sign_up_started', {
    route_family: 'auth', auth_surface: 'login', method: 'google', marketing_opt_in: marketingOptIn,
  });
}
```

Do not await analytics or change the pending Google mode and completion contracts.

- [ ] **Step 4: Replace free-form generation errors only in analytics**

In the request failure event, keep `error_code` and replace `error_message` with:

```ts
failure_category: 'generation_request_failed',
```

In the terminal failed-job bridge event, replace the message with:

```ts
failure_category: 'job_failed',
```

Keep visible composer error messages unchanged.

- [ ] **Step 5: Verify and commit**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/login-google-auth-intent.test.ts tests/login-signup-redirect-contract.test.ts tests/auth-hash-session-contract.test.ts tests/analytics-generation-contract.test.ts tests/workspace-generation-runner-hook-contract.test.ts
git add 'frontend/app/(core)/login/_lib/login-helpers.ts' 'frontend/app/(core)/login/_hooks/useLoginPageController.ts' 'frontend/app/(core)/(workspace)/app/_hooks/workspace-generation-iteration-runner.ts' frontend/components/analytics/GA4EventBridge.tsx tests/login-google-auth-intent.test.ts tests/analytics-generation-contract.test.ts
git commit -m "fix: complete signup and generation funnel events"
```

Expected: all tests pass and the commit succeeds.

---

### Task 5: Propagate attribution through hosted and Express checkout clients

**Files:**
- Modify: `frontend/lib/wallet/hosted-checkout.ts`
- Modify: `frontend/hooks/useHostedWalletCheckout.ts`
- Modify: `frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx`
- Modify: `frontend/app/(core)/billing/_lib/express-checkout-session-cache.ts`
- Modify: `tests/hosted-wallet-checkout.test.ts`
- Modify: `tests/hosted-wallet-checkout-architecture.test.ts`
- Modify: `tests/wallet-express-checkout-cache.test.ts`

**Interfaces:**
- Consumes: `WalletAnalyticsJourney`, `walletAnalyticsJourneyCacheKey()`, and `readWalletAnalyticsJourney()`.
- Produces: both checkout modes send the same optional `analyticsJourney`, and client caching is isolated by attribution.

- [ ] **Step 1: Write failing request and cache tests**

Add this fixture to `validInput` in `tests/hosted-wallet-checkout.test.ts` and require the same object in the parsed request body:

```ts
analyticsJourney: {
  version: 1,
  journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9',
  cohortWeek: '2026-W28',
  firstSource: 'google', firstMedium: 'cpc', lastSource: 'google', lastMedium: 'cpc',
},
```

Add a request without attribution and assert the body has no `analyticsJourney` property. Extend `wallet-express-checkout-cache.test.ts` so distinct `attributionKey` values produce distinct keys. Extend the architecture test to require `readWalletAnalyticsJourney` in the hosted hook and Express component.

- [ ] **Step 2: Verify red tests**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout.test.ts tests/hosted-wallet-checkout-architecture.test.ts tests/wallet-express-checkout-cache.test.ts
```

Expected: FAIL because checkout inputs and cache keys lack attribution.

- [ ] **Step 3: Extend hosted checkout**

Add to `HostedWalletCheckoutInput`:

```ts
analyticsJourney?: WalletAnalyticsJourney | null;
```

Serialize it only when present:

```ts
...(input.analyticsJourney ? { analyticsJourney: input.analyticsJourney } : {}),
```

In `useHostedWalletCheckout.startCheckout()`, call `readWalletAnalyticsJourney()` immediately before `requestHostedWalletCheckout()` and pass the result. This ensures the request uses current consent and attribution rather than a stale render-time snapshot.

- [ ] **Step 4: Extend Express Checkout and its cache key**

Add `attributionKey: string` to `WalletExpressCheckoutRequestKeyParams` and append it to the fixed-order key. In the Express mount effect:

```ts
const analyticsJourney = readWalletAnalyticsJourney();
const attributionKey = walletAnalyticsJourneyCacheKey(analyticsJourney);
```

Pass the key to `buildWalletExpressCheckoutRequestKey()` and include `analyticsJourney` in the `/api/wallet` body. Read once for each mount attempt; do not poll storage.

- [ ] **Step 5: Verify and commit**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/hosted-wallet-checkout.test.ts tests/hosted-wallet-checkout-architecture.test.ts tests/wallet-express-checkout-cache.test.ts tests/wallet-express-checkout-stable-effect.test.ts tests/wallet-express-checkout-timeout.test.ts
git add frontend/lib/wallet/hosted-checkout.ts frontend/hooks/useHostedWalletCheckout.ts 'frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx' 'frontend/app/(core)/billing/_lib/express-checkout-session-cache.ts' tests/hosted-wallet-checkout.test.ts tests/hosted-wallet-checkout-architecture.test.ts tests/wallet-express-checkout-cache.test.ts
git commit -m "feat: carry journey attribution into checkout"
```

Expected: all tests pass and the commit succeeds.

---

### Task 6: Validate attribution and build bounded server metadata

**Files:**
- Create: `frontend/server/wallet-attribution.ts`
- Create: `tests/wallet-attribution.test.ts`

**Interfaces:**
- Consumes: `WalletAnalyticsJourney` and `parseWalletAnalyticsJourney()`.
- Produces: `NormalizedWalletAttribution`, `normalizeWalletAttribution()`, `buildWalletAttributionMetadata()`, `buildCheckoutAttemptAttributionMetadata()`, `matchesWalletAttribution()`, and `buildTopupAttributionGa4Params()`.

- [ ] **Step 1: Write failing server tests**

Create `tests/wallet-attribution.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCheckoutAttemptAttributionMetadata, buildTopupAttributionGa4Params, buildWalletAttributionMetadata, matchesWalletAttribution, normalizeWalletAttribution } from '../frontend/server/wallet-attribution';

const input = {
  version: 1, journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9', cohortWeek: '2026-W28',
  firstSource: 'google', firstMedium: 'cpc', firstCampaign: 'launch', lastSource: 'newsletter', lastMedium: 'email',
} as const;

test('server accepts attribution only with consent', () => {
  assert.equal(normalizeWalletAttribution(input, false), null);
  assert.equal(normalizeWalletAttribution({ ...input, journeyId: 'invalid' }, true), null);
  assert.equal(normalizeWalletAttribution(input, true)?.fingerprint.length, 32);
});

test('metadata projections are bounded and purpose-specific', () => {
  const normalized = normalizeWalletAttribution(input, true)!;
  const stripe = buildWalletAttributionMetadata(normalized);
  assert.equal(stripe.journey_id, input.journeyId);
  assert.equal(stripe.attribution_fingerprint, normalized.fingerprint);
  assert.deepEqual(buildCheckoutAttemptAttributionMetadata(normalized), {
    journeyId: input.journeyId, acquisitionCohort: '2026-W28', firstSource: 'google', firstMedium: 'cpc', lastSource: 'newsletter', lastMedium: 'email', attributionFingerprint: normalized.fingerprint,
  });
  for (const [key, value] of Object.entries(stripe)) { assert.ok(key.length <= 40); assert.ok(value.length <= 80); }
  assert.ok(Object.keys(stripe).length <= 11);
});

test('reuse matching is symmetric', () => {
  const normalized = normalizeWalletAttribution(input, true)!;
  const stripe = buildWalletAttributionMetadata(normalized);
  assert.equal(matchesWalletAttribution({}, null), true);
  assert.equal(matchesWalletAttribution(stripe, normalized), true);
  assert.equal(matchesWalletAttribution({}, normalized), false);
  assert.equal(matchesWalletAttribution(stripe, null), false);
});

test('webhook projection excludes fingerprints', () => {
  const normalized = normalizeWalletAttribution(input, true)!;
  const params = buildTopupAttributionGa4Params(buildWalletAttributionMetadata(normalized));
  assert.equal(params.journey_id, input.journeyId);
  assert.equal(params.first_touch_source, 'google');
  assert.equal('attribution_fingerprint' in params, false);
});
```

- [ ] **Step 2: Verify red test**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/wallet-attribution.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement server normalization and fingerprinting**

Use:

```ts
export type NormalizedWalletAttribution = { journey: WalletAnalyticsJourney; fingerprint: string };
```

`normalizeWalletAttribution(value, consentGranted)` returns null before parsing when consent is false. For valid input, hash the fixed-order normalized projection with SHA-256 and keep the first 32 hex characters.

`buildWalletAttributionMetadata(attribution: NormalizedWalletAttribution | null)` emits `{}` for null; otherwise it emits snake_case journey, cohort, first/last source/medium/campaign/content, plus `attribution_fingerprint`. `buildCheckoutAttemptAttributionMetadata(attribution: NormalizedWalletAttribution | null)` follows the same null rule and otherwise emits journey, cohort, first/last source/medium, and fingerprint. `matchesWalletAttribution()` requires symmetric absence or an exact journey plus fingerprint match. `buildTopupAttributionGa4Params()` allowlists the journey/cohort/touch fields and omits the fingerprint.

- [ ] **Step 4: Re-run with the shared contract suite**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/analytics-journey-contract.test.ts tests/wallet-attribution.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/server/wallet-attribution.ts tests/wallet-attribution.test.ts
git commit -m "feat: validate wallet attribution metadata"
```

---

### Task 7: Bind Express Checkout reuse to attribution

**Files:**
- Modify: `frontend/server/checkout-session-reuse.ts`
- Modify: `tests/wallet-checkout-session-reuse.test.ts`

**Interfaces:**
- Consumes: `NormalizedWalletAttribution` and `matchesWalletAttribution()`.
- Produces: `findReusableExpressCheckoutSession()` accepts `attribution` and returns only a session with matching journey metadata.

- [ ] **Step 1: Write failing reuse assertions**

Extend `tests/wallet-checkout-session-reuse.test.ts` with this fixture and assertions:

```ts
const attribution = {
  journey: { version: 1 as const, journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9', cohortWeek: '2026-W28', firstSource: 'google', firstMedium: 'cpc', lastSource: 'google', lastMedium: 'cpc' },
  fingerprint: 'a'.repeat(32),
};
const openSession = { clientSecret: 'cs_secret_123', created: 1_799_000, expiresAt: 1_801_000, now, paymentStatus: 'unpaid', status: 'open' };

assert.equal(isReusableStripeCheckoutSession({ ...openSession, metadata: {}, attribution }), false);
assert.equal(isReusableStripeCheckoutSession({ ...openSession, metadata: { journey_id: attribution.journey.journeyId, attribution_fingerprint: attribution.fingerprint }, attribution }), true);
assert.equal(isReusableStripeCheckoutSession({ ...openSession, metadata: { journey_id: attribution.journey.journeyId, attribution_fingerprint: 'b'.repeat(32) }, attribution }), false);
assert.equal(isReusableStripeCheckoutSession({ ...openSession, metadata: {}, attribution: null }), true);
assert.equal(isReusableStripeCheckoutSession({ ...openSession, metadata: { journey_id: attribution.journey.journeyId, attribution_fingerprint: attribution.fingerprint }, attribution: null }), false);
```

- [ ] **Step 2: Verify red test**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/wallet-checkout-session-reuse.test.ts
```

Expected: FAIL because reuse inputs lack attribution and metadata.

- [ ] **Step 3: Extend the predicate and finder**

Add to `ReusableStripeCheckoutSessionInput`:

```ts
metadata?: Record<string, string> | null;
attribution?: NormalizedWalletAttribution | null;
```

Require `matchesWalletAttribution(metadata ?? {}, attribution ?? null)` in the existing predicate. Add `attribution?: NormalizedWalletAttribution | null` to the finder arguments and pass `session.metadata` plus the current attribution.

- [ ] **Step 4: Preserve the existing reuse boundary**

Keep the 30-minute window, SQL user/amount/currency/mode filters, row ordering, Stripe retrieval, warning behavior, and returned `{ checkoutAttemptId, clientSecret, id }` shape unchanged. Attribution is one additional gate after Stripe retrieval.

- [ ] **Step 5: Verify and commit**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/wallet-checkout-session-reuse.test.ts tests/wallet-express-checkout-cache.test.ts
git add frontend/server/checkout-session-reuse.ts tests/wallet-checkout-session-reuse.test.ts
git commit -m "fix: isolate checkout reuse by attribution"
```

Expected: all tests pass and the commit succeeds.

---

### Task 8: Integrate validated attribution into wallet checkout and webhook completion

**Files:**
- Modify: `frontend/app/api/wallet/route.ts`
- Modify: `frontend/app/api/stripe/webhook/route.ts`
- Modify: `tests/wallet-checkout-session.test.ts`
- Create: `tests/stripe-topup-analytics-contract.test.ts`

**Interfaces:**
- Consumes: Task 6 validation helpers and Task 7 attribution-aware reuse.
- Produces: consented attribution reaches checkout guard metadata, Stripe Session, PaymentIntent, `topup_completed`, and `purchase`; lifetime first-wallet-top-up state comes from server metadata.

- [ ] **Step 1: Write failing route and webhook contracts**

Extend `tests/wallet-checkout-session.test.ts`:

```ts
assert.match(routeSource, /normalizeWalletAttribution\(body\.analyticsJourney, analyticsConsentGranted\)/);
assert.match(routeSource, /buildWalletAttributionMetadata/);
assert.match(routeSource, /buildCheckoutAttemptAttributionMetadata/);
assert.match(routeSource, /attribution: walletAttribution/);
```

Create `tests/stripe-topup-analytics-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('wallet validates once and copies attribution to Stripe metadata', () => {
  const source = readFileSync('frontend/app/api/wallet/route.ts', 'utf8');
  assert.match(source, /const analyticsConsentGranted = hasAnalyticsConsent\(req\)/);
  assert.match(source, /const walletAttribution = normalizeWalletAttribution/);
  assert.match(source, /Object\.assign\(sessionMetadata, walletAttributionMetadata\)/);
  assert.match(source, /findReusableExpressCheckoutSession\([\s\S]*attribution: walletAttribution/);
});

test('Stripe completion emits accepted attribution and first-topup state', () => {
  const source = readFileSync('frontend/app/api/stripe/webhook/route.ts', 'utf8');
  assert.match(source, /buildTopupAttributionGa4Params/);
  assert.match(source, /\.\.\.attributionParams/);
  assert.match(source, /is_first_wallet_topup/);
  assert.match(source, /name: 'topup_completed'/);
  assert.match(source, /name: 'purchase'/);
});
```

- [ ] **Step 2: Verify red tests**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/wallet-checkout-session.test.ts tests/stripe-topup-analytics-contract.test.ts tests/wallet-attribution.test.ts
```

Expected: FAIL because the route and webhook do not use the attribution helpers.

- [ ] **Step 3: Validate once at the wallet boundary**

Immediately after request-body parsing add:

```ts
const analyticsConsentGranted = hasAnalyticsConsent(req);
const walletAttribution = normalizeWalletAttribution(body.analyticsJourney, analyticsConsentGranted);
const walletAttributionMetadata = buildWalletAttributionMetadata(walletAttribution);
```

Make `buildWalletAttributionMetadata(null)` return `{}`. Merge `buildCheckoutAttemptAttributionMetadata(walletAttribution)` into checkout guard metadata, pass `attribution: walletAttribution` to reuse, then run:

```ts
Object.assign(sessionMetadata, walletAttributionMetadata);
```

Keep every existing `analytics_consent`, `ga_client_id`, wallet, tier, FX, currency, tax, customer, captcha, Amex, fraud, and guard field. Reuse `analyticsConsentGranted` later rather than reading consent twice.

- [ ] **Step 4: Project accepted fields from the webhook**

Inside the existing consent-granted block:

```ts
const attributionParams = buildTopupAttributionGa4Params(metadataRecord);
const isFirstWalletTopup = String(metadataRecord.first_wallet_topup ?? '').toLowerCase() === 'true';
```

Add to `commonParams`:

```ts
...attributionParams,
funnel_stage: 'topup_completed',
is_first_wallet_topup: isFirstWalletTopup,
```

Do not include the fingerprint. Preserve `Promise.allSettled()` and keep receipt/wallet accounting independent from GA4.

- [ ] **Step 5: Verify and commit**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/wallet-attribution.test.ts tests/wallet-checkout-session-reuse.test.ts tests/wallet-checkout-session.test.ts tests/stripe-topup-analytics-contract.test.ts tests/checkout-guard.test.ts tests/checkout-interaction-events.test.ts tests/hosted-wallet-checkout.test.ts
git add frontend/app/api/wallet/route.ts frontend/app/api/stripe/webhook/route.ts tests/wallet-checkout-session.test.ts tests/stripe-topup-analytics-contract.test.ts
git commit -m "feat: complete attributed topup measurement"
```

Expected: all tests pass and the commit succeeds.

---

### Task 9: Document GA4 reporting and run full regression verification

**Files:**
- Modify: `docs/analytics/ga4-topups.md`
- Modify: `docs/superpowers/specs/2026-07-11-funnel-attribution-measurement-design.md`
- Modify: focused implementation files only when a verification command exposes a defect.

**Interfaces:**
- Consumes: completed event and metadata contracts from Tasks 1-8.
- Produces: an operator-ready GA4 guide and a clean fully verified branch.

- [ ] **Step 1: Document low-cardinality definitions**

Register as event-scoped dimensions:

```text
acquisition_cohort
first_touch_source
first_touch_medium
first_touch_campaign
first_touch_content
last_touch_source
last_touch_medium
last_touch_campaign
last_touch_content
funnel_stage
route_family
landing_route_family
landing_surface
journey_locale
is_first_generation
is_first_wallet_topup
topup_tier_id
topup_tier_label
payment_provider
payment_flow
charge_currency
settlement_currency
source_event
fx_source
```

Register metrics `journey_age_days`, `generation_sequence`, `topup_sequence`, `topup_amount_cents`, `settlement_amount_minor`, `refund_amount_cents`, and `refunded_total_cents`. Explicitly exclude `journey_id`, Stripe IDs, job IDs, and local generation keys from custom dimensions.

- [ ] **Step 2: Document funnel and failure explorations**

Add these ordered steps:

```text
1. funnel_entry
2. sign_up_started
3. sign_up_completed
4. generation_started with is_first_generation = true
5. generation_completed with is_first_generation = true
6. topup_started
7. topup_completed with is_first_wallet_topup = true
```

Document breakdowns for first-touch source/medium, first campaign, cohort, landing surface, journey locale, device category, auth method, and engine. Add separate failure views for `generation_failed`, `topup_cancelled`, and `topup_failed`, plus consent denial/grant/withdrawal validation.

- [ ] **Step 3: Run the focused funnel suite**

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/analytics-journey-contract.test.ts tests/analytics-journey.test.ts tests/analytics-consent.test.ts \
  tests/analytics-route.test.ts tests/analytics-transport-contract.test.ts tests/analytics-generation-contract.test.ts \
  tests/login-google-auth-intent.test.ts tests/login-signup-redirect-contract.test.ts tests/auth-hash-session-contract.test.ts \
  tests/hosted-wallet-checkout.test.ts tests/hosted-wallet-checkout-architecture.test.ts \
  tests/wallet-express-checkout-cache.test.ts tests/wallet-express-checkout-stable-effect.test.ts \
  tests/wallet-checkout-session-reuse.test.ts tests/wallet-attribution.test.ts tests/wallet-checkout-session.test.ts \
  tests/stripe-topup-analytics-contract.test.ts tests/checkout-guard.test.ts tests/checkout-interaction-events.test.ts \
  tests/workspace-generation-runner-hook-contract.test.ts
```

Expected: every listed test passes with 0 failures.

- [ ] **Step 4: Run full validation**

```bash
pnpm run test:validate
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: full tests pass, both lint commands exit 0, and `git diff --check` prints nothing. If lint leaves a TypeScript ambiguity, run `cd frontend && ./node_modules/.bin/tsc --noEmit`; expected exit 0.

- [ ] **Step 5: Audit final invariants**

Confirm from code and tests:

```text
No journey exists without analytics consent.
No pre-consent event is retained for later delivery.
No query string or hash reaches page_location.
First touch is immutable for 90 days.
Hosted and Express checkout send the same projection.
The wallet route validates the projection and fails open.
Stripe Session and PaymentIntent carry identical accepted attribution.
Express session reuse requires matching attribution.
The webhook emits attribution only with recorded consent.
Receipt and wallet accounting do not depend on GA4 success.
No public route, SEO metadata, pricing, copy, or visual layout changed.
```

- [ ] **Step 6: Mark the spec implemented and commit documentation**

Change the design spec status from `Approved for implementation` to `Implemented and verified` only after Step 4 succeeds.

```bash
git add docs/analytics/ga4-topups.md docs/superpowers/specs/2026-07-11-funnel-attribution-measurement-design.md
git commit -m "docs: document attributed funnel reporting"
```

Record the final test count and commit hashes in the handoff, not in the evergreen GA4 guide.
