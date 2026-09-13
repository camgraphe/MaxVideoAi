# Billing integration corrections

Complete the archived Billing delivery in the principal app branch. The original requirements remain in `docs/superpowers/specs/2026-09-08-billing-wallet-refonte.md`; the open review is `.superpowers/artifacts/2026-09-08-billing-integration-review.md`. Source checkpoints are preserved in Git, including intentionally red regressions at `4e62dd9b3`.

## Global Constraints

- Do not change pricing formulas, policy files, live Stripe configuration, webhooks, secrets, or database schema.
- Preserve hosted Checkout, eligible express methods, custom amounts, currencies, minimum USD 10, captcha, rate limiting, receipts, invoices, pagination, CSV export, cancellation, and existing analytics events.
- Never show a stale quote as the current payment amount or imply that a checkout return proves webhook settlement.
- Keep wallet and receipt state account-scoped and reject late responses after account changes, sign-out, refresh supersession, or unmount.
- Do not reintroduce live membership discounts, rates, bonuses, fees, or generation-count estimates.
- Keep all Billing interactions keyboard accessible, mobile usable, light/dark compatible, and reduced-motion safe.
- Use only explicit local fixtures or a verified disposable environment for browser validation; never make a real payment or production write.

### Task 1: Finish the reviewed account, quote and return lifecycle

Files: route-local hooks `useBillingSessionState.ts`, `useBillingReceipts.ts`, `useBillingTopupQuotes.ts`, `useBillingCheckoutReturnToast.ts`, `useBillingCheckoutReconciliation.ts`; only necessary wiring in `BillingClient.tsx`; `billing-request-scope.ts` if shared lifecycle ownership needs it. Covering tests are `tests/billing-account-ownership-render.test.ts`, `tests/billing-auth-and-quote-render.test.ts`, `tests/billing-request-scope.test.ts`, `tests/billing-checkout-reconciliation.test.ts` and directly affected Billing contracts. `billing-receipts.module.css` may correct the documented 32px receipt actions to 44px. No global CSS rewrite.

- [ ] Read the original independent findings and checkpoint tests. Reproduce failures with actual React hooks and every-render observations; repair the unfinished test harness/API only in service of real behavior.
- [ ] Mask wallet, receipt rows, loading/error statuses and all derived private values synchronously when their account does not match the currently confirmed auth. Cleanup effects alone are insufficient. Keep usable same-account data during a refresh where auth remains confirmed; retire all old callbacks on pending auth, logout, account changes and unmount, including A→B→A races.
- [ ] Scope quotes by the complete input identity (confirmed account, currency, amount collection and current custom amount validity). The first EUR/new-amount render must never expose the USD/old-amount quote as current. Preserve duplicate-request handling and stale-response invalidation; do not recalculate quotes in the UI.
- [ ] Defer successful Checkout return consumption and account reconciliation until auth is resolved with a confirmed account. Null/pending auth must not drop the URL. Resolve cancellation safely without requiring payment confirmation. Preserve exactly-once analytics and returned amount/destination behavior, cleanup and existing bounded reconciliation; do not claim webhook settlement from a return flag.
- [ ] Add meaningful regressions for first-render masking, pending auth and same-owner refresh, account/currency ABA, late requests and retained stale event callbacks. Verify the actual return→reconciliation composition from auth loading to account availability, not only the isolated callback hook.
- [ ] Make receipt document/support hit areas at least 44px without hiding actions or adding oversized rows.
- [ ] Run focused hook/contract tests through the sanitized launcher, targeted lint and typecheck. No full suite/build while other implementation or the main preview is active. Self-review, commit exact files and report evidence plus remaining limits.
- [ ] Independent re-review closes the listed findings and checks new breakage only. Root qualifies actual `/billing` layout on desktop/mobile and light/dark without initiating checkout, then runs combined validation when integrations are complete.
