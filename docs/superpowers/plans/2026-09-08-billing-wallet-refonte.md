# Billing and Wallet Refonte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an integrated wallet-first Billing flow that clearly separates available balance, USD credits received, quoted payment amount, payment choice, checkout return reconciliation, and historical ledger documents.

**Architecture:** Keep `BillingClient` as the route orchestrator and the existing hosted/express checkout code as payment owners. Strengthen route-local account-scoped read hooks, split the funding presentation into focused components, and apply one route-local CSS module to the wallet, funding, protection, return, and ledger surfaces.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules with existing design tokens, Stripe Checkout/Checkout Elements, Node test runner via `tsx`, Playwright/browser inspection.

**Spec:** `docs/superpowers/specs/2026-09-08-billing-wallet-refonte.md`

## Global Constraints

- Do not change pricing formulas, policy files, live Stripe configuration, webhooks, secrets, or database schema.
- Preserve hosted Checkout, eligible express methods, custom amounts, currencies, minimum USD 10, captcha, rate limiting, receipts, invoices, pagination, CSV export, cancellation, and existing analytics events.
- Never show a stale quote as the current payment amount or imply that a checkout return proves webhook settlement.
- Keep wallet and receipt state account-scoped and reject late responses after account changes, sign-out, refresh supersession, or unmount.
- Do not reintroduce live membership discounts, rates, bonuses, fees, or generation-count estimates.
- Keep all Billing interactions keyboard accessible, mobile usable, light/dark compatible, and reduced-motion safe.
- Use only explicit local fixtures or a verified disposable environment for browser validation; never make a real payment or production write.

---

### Task 1: Account-scoped Billing data state

**Files:**
- Create: `frontend/app/(core)/billing/_lib/billing-request-scope.ts`
- Modify: `frontend/app/(core)/billing/_hooks/useBillingSessionState.ts`
- Modify: `frontend/app/(core)/billing/_hooks/useBillingReceipts.ts`
- Modify: `frontend/app/(core)/billing/_hooks/useBillingTopupQuotes.ts`
- Test: `tests/billing-request-scope.test.ts`
- Test: `tests/billing-page-architecture.test.ts`

**Interfaces:**
- Produces: `createBillingRequestScope()` with `begin(accountId)`, `isCurrent(token)`, and `invalidate()`; `useBillingSessionState` with `walletStatus`, `walletError`, and `refreshWallet`; `useBillingReceipts` with `refreshReceipts`; quote maps that belong only to the active amount/currency request.

- [ ] **Step 1: Write failing request-scope and architecture tests**

Add tests proving that a newer request invalidates an older token, an account change invalidates the previous account, explicit invalidation rejects all earlier tokens, wallet refresh remains in the session hook, and direct fetches stay out of `BillingClient`.

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-request-scope.test.ts tests/billing-page-architecture.test.ts`

Expected: FAIL because `billing-request-scope.ts` and the new hook interfaces do not exist.

- [ ] **Step 3: Implement the scoped data lifecycle**

Implement an opaque `{ accountId, requestId }` token owner. Capture the user ID and access token at request start, clear account data synchronously on identity removal/change, retain usable wallet/receipt data on refresh failure, reject non-OK responses, clear stale quote maps on scope changes, and expose explicit first-load/refresh/error statuses.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-request-scope.test.ts tests/billing-page-architecture.test.ts tests/billing-topup-selection.test.ts tests/wallet-express-checkout-cache.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(core\)/billing/_lib/billing-request-scope.ts frontend/app/\(core\)/billing/_hooks/useBillingSessionState.ts frontend/app/\(core\)/billing/_hooks/useBillingReceipts.ts frontend/app/\(core\)/billing/_hooks/useBillingTopupQuotes.ts tests/billing-request-scope.test.ts tests/billing-page-architecture.test.ts
git commit -m "fix(billing): scope wallet reads and quote freshness"
```

### Task 2: Wallet-first funding composition

**Files:**
- Create: `frontend/app/(core)/billing/_components/BillingWalletOverview.tsx`
- Create: `frontend/app/(core)/billing/_components/WalletAmountPicker.tsx`
- Create: `frontend/app/(core)/billing/_components/WalletCheckoutSummary.tsx`
- Create: `frontend/app/(core)/billing/_components/billing-page.module.css`
- Modify: `frontend/app/(core)/billing/_components/BillingClient.tsx`
- Modify: `frontend/app/(core)/billing/_components/WalletTopupPanel.tsx`
- Modify: `frontend/app/(core)/billing/_components/BillingInfoAside.tsx`
- Modify: `frontend/app/(core)/billing/_lib/billing-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Test: `tests/billing-page-architecture.test.ts`
- Test: `tests/billing-wallet-presentation.test.ts`

**Interfaces:**
- Consumes: wallet status and refresh from Task 1; existing top-up selection, quote, hosted checkout, express checkout, and captcha contracts.
- Produces: `BillingWalletOverview`, `WalletAmountPicker`, and `WalletCheckoutSummary`; one visual hierarchy that labels credits received and quoted payment amount separately.

- [ ] **Step 1: Write failing presentation and localization tests**

Assert the new component files, CSS module, explicit `creditsReceived`/`paymentAmount`/loading labels in all three locale dictionaries, route composition, 44 px controls, reduced-motion rule, and absence of live membership copy in rendered Billing components.

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-wallet-presentation.test.ts tests/billing-page-architecture.test.ts tests/localization-parity.test.ts`

Expected: FAIL because the new components, style contract, and copy keys do not exist.

- [ ] **Step 3: Implement the new composition**

Replace the passive hero badges with the wallet overview. Refactor `WalletTopupPanel` into an ordered funding surface that delegates preset/custom controls to `WalletAmountPicker` and quoted paid/received rows plus primary Checkout action to `WalletCheckoutSummary`. Keep express checkout lazy and existing captcha behavior. Convert the information aside into concise factual protection rows. Add localized copy without adding commercial claims.

- [ ] **Step 4: Run focused tests and TypeScript**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-wallet-presentation.test.ts tests/billing-page-architecture.test.ts tests/localization-parity.test.ts tests/hosted-wallet-checkout-architecture.test.ts tests/wallet-express-checkout-consent.test.ts tests/wallet-express-checkout-timeout.test.ts && pnpm --prefix frontend exec tsc --noEmit --pretty false`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(core\)/billing/_components frontend/app/\(core\)/billing/_lib/billing-copy.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/billing-page-architecture.test.ts tests/billing-wallet-presentation.test.ts
git commit -m "feat(billing): build wallet-first top-up flow"
```

### Task 3: Checkout return reconciliation and ledger presentation

**Files:**
- Create: `frontend/app/(core)/billing/_hooks/useBillingCheckoutReconciliation.ts`
- Modify: `frontend/app/(core)/billing/_hooks/useBillingCheckoutReturnToast.ts`
- Modify: `frontend/app/(core)/billing/_components/BillingCheckoutReturnNotice.tsx`
- Modify: `frontend/app/(core)/billing/_components/BillingClient.tsx`
- Modify: `frontend/app/(core)/billing/_components/ReceiptsPanel.tsx`
- Modify: `frontend/app/(core)/billing/_components/billing-page.module.css`
- Modify: `frontend/app/(core)/billing/_lib/billing-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Test: `tests/billing-checkout-reconciliation.test.ts`
- Test: `tests/billing-wallet-presentation.test.ts`

**Interfaces:**
- Consumes: `refreshWallet()` and `refreshReceipts()` from Task 1 plus the existing sanitized checkout return target.
- Produces: `useBillingCheckoutReconciliation({ accountId, refreshWallet, refreshReceipts })` returning a status and `reconcile()`; a return notice that distinguishes cancelled, refreshing, refreshed, and delayed account-data states; a compact ledger with expandable itemization and document links.

- [ ] **Step 1: Write failing reconciliation and ledger contract tests**

Test the bounded refresh schedule as a pure exported constant/helper, require checkout-success wiring to both data owners, ensure cancellation does not reconcile, and assert native expandable ledger rows retain job, document, pagination, and CSV actions.

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-checkout-reconciliation.test.ts tests/billing-wallet-presentation.test.ts`

Expected: FAIL because reconciliation and ledger contracts are missing.

- [ ] **Step 3: Implement reconciliation and ledger UI**

On success, run an immediate refresh and one bounded follow-up while invalidating work on account change or unmount. Surface honest progress without claiming settlement. Replace nested receipt cards with divider-separated summaries and native details; preserve signed wallet movement, historical discount/tax rows, job identity, available Stripe documents, support fallback, pagination, and CSV export.

- [ ] **Step 4: Run Billing and Stripe-facing tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-checkout-reconciliation.test.ts tests/billing-wallet-presentation.test.ts tests/billing-page-architecture.test.ts tests/hosted-wallet-checkout-return.test.ts tests/stripe-receipt-documents.test.ts tests/wallet-checkout-session.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(core\)/billing tests/billing-checkout-reconciliation.test.ts tests/billing-wallet-presentation.test.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json
git commit -m "feat(billing): reconcile checkout returns and compact history"
```

### Task 4: Browser qualification and final validation

**Files:**
- Create: `docs/superpowers/reviews/2026-09-08-billing-wallet-refonte.md`
- Modify only if validation finds a defect: files owned by Tasks 1–3 and their focused tests.

**Interfaces:**
- Consumes: the complete Billing flow from Tasks 1–3.
- Produces: screenshots and an evidence-backed review with explicit environment and limits.

- [ ] **Step 1: Start the isolated preview on port 3026**

Use the repository's verified disposable/local preview setup without reading or printing secrets. Confirm no other process owns port 3026, then start the frontend with the local Billing fixture or verified expiring database. Do not follow the payment CTA into a real payment.

- [ ] **Step 2: Inspect desktop and mobile, light and dark**

Capture at least 1440×1000 and 390×844 in both themes. Verify initial wallet state, presets, custom USD 10 minimum, currency/loading/error states, paid/received distinction, express reveal/unavailable behavior, cancellation/success-return messages, ledger details, document link presentation, and the absence of horizontal overflow.

- [ ] **Step 3: Inspect keyboard and reduced motion**

Traverse all controls with Tab/Shift+Tab, activate amount and details controls with keyboard, check visible focus, and emulate reduced motion. Record any unverified device/provider behavior as a limit.

- [ ] **Step 4: Run full relevant gates**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/billing-*.test.ts tests/wallet-*.test.ts tests/hosted-wallet-checkout*.test.ts tests/stripe-receipt-documents.test.ts
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
git diff --check
npm run architecture:audit -- --min-lines 500
pnpm --prefix frontend run build
```

Expected: every command exits 0. Architecture audit may list existing large files but must show no newly introduced Billing owner above the threshold.

- [ ] **Step 5: Record evidence and commit**

Document viewport/theme coverage, local fixture or disposable-environment identity, functional checks, automated command counts, screenshots, warnings, and forbidden actions not performed.

```bash
git add docs/superpowers/reviews/2026-09-08-billing-wallet-refonte.md
git commit -m "docs(billing): record wallet refonte qualification"
```
