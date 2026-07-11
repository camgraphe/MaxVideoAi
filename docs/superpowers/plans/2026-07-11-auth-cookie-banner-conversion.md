# Auth Cookie Banner Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the first-choice cookie banner from covering `/login` conversion actions while preserving all consent behavior and every non-login layout.

**Architecture:** Keep route detection and presentation inside `CookieBanner`. Add a strict `/login` presentation branch that uses a compact bottom bar plus flow spacer below `1200px`, and a stacked `22rem` bottom-right card at `1200px` and above. The consent client, copy, preference controls, persistence, and analytics effects remain untouched.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Tailwind CSS, `clsx`, Node test runner via `tsx`.

## Global Constraints

- Apply the new layout only when `pathname === '/login'`.
- Use `1200px` as the exact corner-card threshold.
- Use a `4.5rem` decorative flow spacer only below `1200px` while the first-choice login banner is visible.
- Preserve consent defaults, copy, locales, cookies, APIs, analytics effects, accessible names, focus restoration, and preference behavior.
- Preserve the existing layout on every non-login route.
- Add no route, state store, cookie, API, localization key, design token, or dependency.

---

### Task 1: Lock the unobstructed login-banner contract

**Files:**
- Modify: `tests/cookie-banner-architecture.test.ts`

**Interfaces:**
- Consumes: the source contract of `frontend/components/legal/CookieBanner.tsx`.
- Produces: regression assertions for the strict login route, `4.5rem` spacer, `1200px` corner placement, and stacked auth layout.

- [ ] **Step 1: Write the failing contract test**

Add this test after the existing delegation test:

```ts
test('login cookie banner preserves access to auth conversion actions', () => {
  const bannerSource = readSource(bannerPath);

  assert.match(bannerSource, /const isLoginRoute = pathname === '\/login';/);
  assert.match(
    bannerSource,
    /aria-hidden="true"[\s\S]*h-\[4\.5rem\][\s\S]*min-\[1200px\]:hidden/,
    'the first-choice login banner should reserve mobile and tablet scroll space'
  );
  assert.match(
    bannerSource,
    /min-\[1200px\]:left-auto[\s\S]*min-\[1200px\]:right-4[\s\S]*min-\[1200px\]:w-\[22rem\]/,
    'wide login screens should move consent away from the centered auth card'
  );
  assert.match(
    bannerSource,
    /isLoginRoute[\s\S]*min-\[1200px\]:flex-col/,
    'login copy, actions, and preferences should stack inside the corner card'
  );
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
pnpm exec tsx --test tests/cookie-banner-architecture.test.ts
```

Expected: FAIL because `CookieBanner` does not define `isLoginRoute` or the auth-specific spacer/corner classes.

- [ ] **Step 3: Commit the failing contract only after the production fix is ready**

Do not commit the red state separately. Continue directly to Task 2 and commit the test with the minimal implementation.

---

### Task 2: Add the route-scoped adaptive layout

**Files:**
- Modify: `frontend/components/legal/CookieBanner.tsx`
- Test: `tests/cookie-banner-architecture.test.ts`

**Interfaces:**
- Consumes: `usePathname`, existing `CookiePreferencesPanel`, copy, consent state, and button actions.
- Produces: `isLoginRoute: boolean` and auth-specific responsive classes; no exported API changes.

- [ ] **Step 1: Add the route flag and conditional class support**

Import `clsx` and derive the exact route flag:

```tsx
import clsx from 'clsx';

const pathname = usePathname();
const isLoginRoute = pathname === '/login';
```

- [ ] **Step 2: Render the login flow spacer and adaptive fixed wrapper**

Wrap the first-choice return in a fragment. Render the spacer before the fixed banner and use the existing wrapper classes for every non-login route:

```tsx
<>
  {isLoginRoute ? (
    <div aria-hidden="true" className="h-[4.5rem] min-[1200px]:hidden" />
  ) : null}
  <div
    className={clsx(
      'pointer-events-auto fixed z-[1100] flex justify-center',
      isLoginRoute
        ? 'bottom-1 left-0 right-0 px-3 min-[1200px]:bottom-4 min-[1200px]:left-auto min-[1200px]:right-4 min-[1200px]:w-[22rem] min-[1200px]:px-0'
        : 'bottom-1 left-0 right-0 px-3 sm:bottom-4 sm:px-6'
    )}
  >
```

- [ ] **Step 3: Keep the auth card compact and vertically stacked**

Use conditional card, content-row, title, and body classes:

```tsx
className={clsx(
  'max-h-[24svh] w-full overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-xl sm:max-h-[42svh] sm:p-5',
  isLoginRoute ? 'max-w-3xl min-[1200px]:max-w-none min-[1200px]:p-4' : 'max-w-3xl'
)}
```

```tsx
className={clsx(
  'flex flex-col gap-3',
  isLoginRoute ? 'min-[1200px]:flex-col' : 'md:flex-row md:items-start md:justify-between'
)}
```

```tsx
className={clsx(
  'hidden text-sm font-semibold text-text-primary sm:text-base',
  isLoginRoute ? 'min-[1200px]:block' : 'sm:block'
)}
```

```tsx
className={clsx(
  'hidden text-xs text-text-secondary sm:text-sm',
  isLoginRoute ? 'min-[1200px]:block' : 'sm:block'
)}
```

Close the fragment after the fixed wrapper. Do not change handlers, state, copy, or the `hasMadeChoice` branch.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run:

```bash
pnpm exec tsx --test tests/cookie-banner-architecture.test.ts tests/login-hydration-contract.test.ts
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 5: Run static verification**

Run:

```bash
pnpm --prefix frontend exec tsc --noEmit
pnpm --prefix frontend run lint
pnpm run lint:exposure
git diff --check
```

Expected: every command exits `0` with no new warning or formatting error.

- [ ] **Step 6: Commit the implementation**

```bash
git add frontend/components/legal/CookieBanner.tsx tests/cookie-banner-architecture.test.ts
git commit -m "fix: keep cookie consent clear of auth actions"
```

---

### Task 3: Verify responsive behavior and unchanged consent interactions

**Files:**
- Verify only: `frontend/components/legal/CookieBanner.tsx`

**Interfaces:**
- Consumes: the local `/login` and `/` routes in the user-selected in-app browser.
- Produces: accepted before/after screenshots and interaction evidence; no production-code interface.

- [ ] **Step 1: Start the local app**

Run:

```bash
pnpm --prefix frontend dev --port 3106
```

Expected: Next.js reports ready on `http://localhost:3106`.

- [ ] **Step 2: Compare desktop at the same state**

Open the signup continuation URL at the default desktop viewport:

```text
http://cookie-after.localhost:3106/login?mode=signup&next=%2Fbilling%3Famount%3D2500%26currency%3DUSD
```

Expected: the cookie card is approximately `22rem` wide in the bottom-right corner, the centered login card remains unobstructed, and the top-up continuation message is unchanged.

- [ ] **Step 3: Compare mobile at `390 × 844`**

Use the in-app browser viewport capability, navigate to the same URL, scroll to the end of the form, and capture the viewport.

Expected: the primary Create account button and secondary Sign in link can both scroll above the compact cookie action bar.

- [ ] **Step 4: Verify consent interactions**

From a fresh local subdomain with no prior consent choice:

1. Open `Manage choices` and confirm the two labeled switches and Save preferences action remain visible.
2. Press Escape and confirm preferences close and focus returns to Manage choices.
3. Confirm Accept all and Reject all remain uniquely accessible buttons.

Expected: behavior and accessible names are unchanged.

- [ ] **Step 5: Verify a non-login route**

Open `http://cookie-public.localhost:3106/`.

Expected: the original centered public-page banner remains unchanged.

- [ ] **Step 6: Run final verification**

Run:

```bash
pnpm test:validate
pnpm --prefix frontend build
git status --short
```

Expected: 0 test failures, production build exits `0`, and the worktree contains no unintended generated SEO matrix changes.

- [ ] **Step 7: Push the dedicated branch**

```bash
git push -u origin codex/auth-cookie-banner-conversion
```

Expected: the remote branch is created and matches local HEAD.
