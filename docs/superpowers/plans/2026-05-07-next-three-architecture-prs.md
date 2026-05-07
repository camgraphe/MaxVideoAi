# Next Three Architecture PRs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the next three maintainability PRs after the compare/admin/billing cleanup wave.

**Architecture:** Keep each PR independently reviewable and mergeable. First add objective guardrails for future cleanup, then split two route-heavy client/admin surfaces without changing behavior.

**Tech Stack:** Next.js App Router, TypeScript, Node test runner, ESLint, existing route-local `_components`, `_hooks`, and `_lib` conventions.

---

## File Structure

### PR 1: Architecture Audit Tooling

- Create `scripts/audit-large-files.mjs`: lists large TS/TSX/JS/JSX files with configurable threshold and JSON output.
- Create `tests/architecture-audit.test.ts`: verifies the audit script reports known large files and supports `--json`.
- Modify `package.json`: add `architecture:audit`.
- Modify `docs/engineering/refactor-roadmap.md`: refresh completed work and next candidates.
- Modify `docs/engineering/llm-working-guide.md`: document the audit command.

### PR 2: Login Page Split

- Modify `frontend/app/(core)/login/page.tsx`: keep page-level auth flow, state, and rendering orchestration.
- Create `frontend/app/(core)/login/_lib/login-copy.ts`: locale copy, locale type, and locale options.
- Create `frontend/app/(core)/login/_lib/login-helpers.ts`: next-path sanitization, redirect origin/callback helpers, locale detection, pending Google login storage helpers.
- Create `tests/login-page-architecture.test.ts`: guard the route-local split and page size.

### PR 3: Admin Pricing Page Split

- Modify `frontend/app/(core)/admin/pricing/page.tsx`: keep SWR loading, mutation handlers, and route orchestration.
- Create `frontend/app/(core)/admin/pricing/_lib/pricing-admin-types.ts`: pricing rule, membership, product, and form types.
- Create `frontend/app/(core)/admin/pricing/_lib/pricing-admin-helpers.ts`: formatters, legacy product helper, subtitle helper, overview builder, form conversion helpers.
- Create `frontend/app/(core)/admin/pricing/_components/PricingRuleCard.tsx`: existing rule card and field rendering.
- Create `frontend/app/(core)/admin/pricing/_components/BillingProductCard.tsx`: billing product card.
- Create `frontend/app/(core)/admin/pricing/_components/NewPricingRuleCard.tsx`: create-rule form.
- Create `tests/admin-pricing-architecture.test.ts`: guard the route-local split and page size.

---

## Task 1: Architecture Audit Tooling PR

**Branch:** `codex/architecture-audit-tooling`

- [ ] **Step 1: Add static audit test**

Create `tests/architecture-audit.test.ts` with assertions that `scripts/audit-large-files.mjs --json --min-lines 900` outputs JSON rows containing `frontend/src/config/falEngines.ts` and that `--help` documents `--min-lines`.

- [ ] **Step 2: Add audit script**

Create `scripts/audit-large-files.mjs`. It should:

```txt
node scripts/audit-large-files.mjs --min-lines 900
node scripts/audit-large-files.mjs --json --min-lines 900
```

Expected behavior: scan `frontend`, ignore generated/build folders, count lines, sort descending, and print either a table or JSON.

- [ ] **Step 3: Wire npm script and docs**

Add `"architecture:audit": "node scripts/audit-large-files.mjs"` to `package.json`. Update `docs/engineering/refactor-roadmap.md` and `docs/engineering/llm-working-guide.md` so future Codex work starts from the audit command.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/architecture-audit.test.ts
npm run architecture:audit -- --min-lines 900
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

- [ ] **Step 5: Commit, push, PR, wait for checks, merge**

Commit message: `Add architecture audit tooling`.

---

## Task 2: Login Page Split PR

**Branch:** `codex/login-page-split`

- [ ] **Step 1: Add architecture contract**

Create `tests/login-page-architecture.test.ts` requiring:

- `_lib/login-copy.ts` exists and exports `AUTH_COPY`.
- `_lib/login-helpers.ts` exists and exports `sanitizeNextPath`, `buildAuthCallbackRedirect`, and pending Google helpers.
- `page.tsx` imports both route-local modules.
- `page.tsx` does not define `AUTH_COPY` or `sanitizeNextPath`.

- [ ] **Step 2: Move copy and helpers**

Move locale copy and pure/browser helper functions from `frontend/app/(core)/login/page.tsx` into route-local `_lib` files. Preserve all names or update imports mechanically.

- [ ] **Step 3: Verify auth tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/login-page-architecture.test.ts tests/login-hydration-contract.test.ts tests/login-metadata.test.ts tests/login-oauth-cookie-fallback.test.ts tests/auth-callback-redirect.test.ts tests/auth-hash-session-contract.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

- [ ] **Step 4: Build and smoke**

Run `pnpm --prefix frontend run build`. If feasible, start `next start` on a temporary port and verify `/login` returns 200.

- [ ] **Step 5: Commit, push, PR, wait for checks, merge**

Commit message: `Split login page helpers`.

---

## Task 3: Admin Pricing Page Split PR

**Branch:** `codex/admin-pricing-page-split`

- [ ] **Step 1: Add architecture contract**

Create `tests/admin-pricing-architecture.test.ts` requiring route-local `_components` and `_lib` files, ensuring `page.tsx` imports them and no longer defines `BillingProductCard`, `PricingRuleCard`, `NewPricingRuleCard`, or formatter helpers.

- [ ] **Step 2: Move types and helpers**

Move pricing types and helper functions from `frontend/app/(core)/admin/pricing/page.tsx` into `_lib/pricing-admin-types.ts` and `_lib/pricing-admin-helpers.ts`.

- [ ] **Step 3: Move cards**

Move `BillingProductCard`, `PricingRuleCard`, `Field`, and `NewPricingRuleCard` into route-local `_components`. Preserve props and behavior.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-pricing-architecture.test.ts tests/pricing-definition.test.ts tests/checkout-report.test.ts tests/wallet-checkout-session.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
pnpm --prefix frontend run build
```

- [ ] **Step 5: Commit, push, PR, wait for checks, merge**

Commit message: `Split admin pricing page modules`.

---

## Self-Review

- Spec coverage: three PRs are defined, each with branch, files, verification, and merge gates.
- Placeholder scan: no `TBD`, `TODO`, or unspecified tests are required.
- Type consistency: route-local names match the planned import paths.
