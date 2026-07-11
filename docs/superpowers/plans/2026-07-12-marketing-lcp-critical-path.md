# Marketing LCP Critical Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public marketing HTML cacheable again by removing request-specific account and locale-cookie work from the shared marketing path, without changing visible marketing content or client-side account behavior.

**Architecture:** The localized marketing layout currently calls `getMarketingAuthSnapshot()`, which reads the Supabase request session and makes every route below it dynamic. `MarketingNav` already resolves and subscribes to the client Supabase session after hydration, so the layout can render the same static shell without request-specific initial props. The middleware also writes locale cookies on every already-localized marketing response; removing that write makes the static HTML eligible for CDN caching because the client language toggles already persist those preferences. The authenticated core video layout keeps its existing server snapshot because it is outside this cacheable marketing boundary.

**Tech Stack:** Next.js App Router, React Server Components, Supabase client auth, Node test runner, TypeScript.

## Global Constraints

- Preserve public URLs, locale routing, SEO metadata, JSON-LD, and the existing marketing navigation structure.
- Do not change consent or analytics behavior.
- Do not change the authenticated core video layout's server auth snapshot.
- Keep the marketing layout a server component and do not add client JavaScript.
- Prove the behavior with a failing architecture contract test before implementation.

---

### Task 1: Make the marketing shell cache-safe

**Files:**
- Create: `tests/marketing-layout-cache-contract.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/layout.tsx`

**Interfaces:**
- Consumes: `MarketingNav`, which accepts no props and resolves the browser session itself.
- Produces: a request-independent localized marketing layout that does not import `getMarketingAuthSnapshot`.

- [ ] **Step 1: Write the failing test**

```ts
test('marketing layout keeps account lookup out of the cacheable public shell', () => {
  const source = readFileSync(marketingLayoutPath, 'utf8');

  assert.doesNotMatch(source, /getMarketingAuthSnapshot/);
  assert.doesNotMatch(source, /@\/server\/marketing-auth/);
  assert.match(source, /<MarketingNav\s*\/>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/marketing-layout-cache-contract.test.ts`

Expected: FAIL because the layout imports and invokes `getMarketingAuthSnapshot`.

- [ ] **Step 3: Write the minimal implementation**

```tsx
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { DeferredPublicSessionWatchdog } from '@/components/auth/DeferredPublicSessionWatchdog';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <DeferredPublicSessionWatchdog />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
```

- [ ] **Step 4: Run focused verification**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/marketing-layout-cache-contract.test.ts tests/marketing-client-message-performance-contract.test.ts tests/home-default-route-performance-contract.test.ts`

Expected: PASS with no failures.

- [ ] **Step 5: Run public-route verification**

Run: `pnpm --prefix frontend run lint && pnpm --prefix frontend exec tsc --noEmit && pnpm --prefix frontend run build && git diff --check`

Expected: all commands exit 0; production build keeps localized marketing pages valid.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-12-marketing-lcp-critical-path.md \
  tests/marketing-layout-cache-contract.test.ts \
  'frontend/app/(localized)/[locale]/(marketing)/layout.tsx'
git commit -m "perf: cache public marketing shell"
```

### Task 2: Stop setting locale cookies on canonical marketing responses

**Files:**
- Modify: `tests/marketing-layout-cache-contract.test.ts`
- Modify: `frontend/middleware.ts`

**Interfaces:**
- Consumes: `middleware(req)` and a canonical prefixed marketing request.
- Produces: a response for `/fr` with no `Set-Cookie`; language toggles continue to write `mvid_locale` and `NEXT_LOCALE` in the browser.

- [ ] **Step 1: Write the failing test**

```ts
test('canonical localized marketing pages do not set locale cookies in middleware', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/fr'));

  assert.equal(response.headers.get('set-cookie'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/marketing-layout-cache-contract.test.ts`

Expected: FAIL because `setLocaleCookies(response, resolvedLocale)` writes `mvid_locale` and `NEXT_LOCALE`.

- [ ] **Step 3: Write the minimal implementation**

Remove `setLocaleCookies` and the now-unused `extractLocale` import from `frontend/middleware.ts`, remove the `if (isMarketingPath) { ... setLocaleCookies(...) }` block, and set `localeCookie: false` in `frontend/i18n/routing.ts`. Do not change locale redirects, `getPreferredLocale`, or browser language toggles.

- [ ] **Step 4: Run focused verification**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/marketing-layout-cache-contract.test.ts tests/marketing-navigation.test.ts tests/middleware-architecture.test.ts`

Expected: PASS with no failures.

- [ ] **Step 5: Run production response verification**

Run: `pnpm --prefix frontend run build`, start the production build, then request `/fr`, `/fr/tarifs`, and `/fr/modeles/veo-3-1`.

Expected: each canonical localized response has status 200 and no `Set-Cookie` locale header; the build lists localized marketing routes as `●` static pages.

### Task 3: Cache the critical public responses at Vercel's edge

**Files:**
- Create: `tests/marketing-response-cache-contract.test.ts`
- Modify: `frontend/next.config.js`

**Interfaces:**
- Consumes: Vercel's response-header cache controls and the canonical public paths that do not render account data.
- Produces: no browser cache, plus a five-minute Vercel CDN cache for home, pricing, and model pages in English, French, and Spanish.

- [ ] **Step 1: Write the failing test**

```ts
assert.match(source, /const MARKETING_CDN_CACHE_HEADERS = \[/);
assert.match(source, /key: 'Cache-Control',\s*value: 'public, max-age=0, must-revalidate'/s);
assert.match(source, /key: 'Vercel-CDN-Cache-Control',\s*value: 'max-age=300, stale-while-revalidate=60'/s);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/marketing-response-cache-contract.test.ts`

Expected: FAIL because no critical-marketing cache policy exists.

- [ ] **Step 3: Write the minimal implementation**

```js
const MARKETING_CDN_CACHE_HEADERS = [
  { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
  { key: 'Vercel-CDN-Cache-Control', value: 'max-age=300, stale-while-revalidate=60' },
];
```

Apply these headers only to `/`, `/fr`, `/es`, the localized pricing paths, and the localized model path families. Add the rules before the existing robots and preview-indexing rules.

- [ ] **Step 4: Run focused verification**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/marketing-response-cache-contract.test.ts tests/marketing-layout-cache-contract.test.ts tests/marketing-navigation.test.ts`

Expected: PASS with no failures.

- [ ] **Step 5: Run production response verification**

Run: `pnpm --prefix frontend run build`, start the production build, then request `/fr`, `/fr/tarifs`, and `/fr/modeles/veo-3-1`.

Expected: the home and pricing responses return 200 with `Cache-Control: public, max-age=0, must-revalidate`, `Vercel-CDN-Cache-Control: max-age=300, stale-while-revalidate=60`, and no `Set-Cookie` header. The model route requires production database configuration for an HTTP smoke test, but remains covered by build, type, and middleware contracts.
