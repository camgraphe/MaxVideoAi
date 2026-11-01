# Milo Pack Admin Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct pack classification and admin presentation without changing balances or refund behavior.

**Architecture:** Project the existing billing product into the read DTO and share a pure Milo-pack identity helper between review, display and refund eligibility. Keep history's attention predicate equivalent and evaluated before pagination.

**Tech Stack:** TypeScript, React, node:test, real admin-table rendering, disposable PostgreSQL17.

**Spec:** docs/superpowers/specs/2026-11-01-milo-pack-admin-status.md

## Global Constraints

- PR #592 frozen; start isolated from origin/main and incorporate delivered main later.
- Product `studio_assistance_pack` OR prefix `studio-sol-pack:`; label `Milo credit pack`.
- No ledger/credit/cron/provider/refund-command/migration changes; no production/customer access or actual refunds.
- Preserve real media refunds, amounts, canonical entry type and nonpositive-charge review.

## Review Focus

- Product-only receipt with no media reference still has pack identity and no media refund action.
- Historical prefix-only receipt works without stored product identity or a product column.
- Lookalike prefixes/descriptions never hide a real missing media job.
- Nonpositive pack charges remain in Needs review, including SQL before pagination.
- Paid media, earlier charges and already-refunded media retain eligibility and display.

### Task 1: Consistent admin read/display classification

**Files:**
- Modify: frontend/lib/admin/transaction-review.ts
- Modify: frontend/server/admin-transactions/{types,projection,read-model,history}.ts
- Modify: frontend/components/admin/TransactionTable.tsx
- Test: tests/admin-transaction-review.test.ts, tests/admin-transactions-contract.test.ts, tests/admin-transaction-history-postgres.test.ts
- Create: tests/admin-milo-pack-presentation.test.ts

**Interfaces:** Add nullable `billing_product_key` to raw reads and `billingProductKey` to AdminTransactionRecord. Export `isMiloPackTransaction({billingProductKey,jobId})` from transaction-review. It returns true only for the exact existing product or prefix. Existing public reader signatures stay stable.

- [x] Add synthetic classification, mapper and actual table-rendering tests; extend the real disposable history test to assert product projection and attention filtering before pagination. Expected: pack cases fail on current code; media controls pass.
- [x] Implement identity helper, projection, canRefund gate and matching history predicate. Expected: positive pack is Recorded and nonrefundable; missing media and nonpositive charges retain review.
- [x] Render `Milo credit pack` as product with a plain reference, and retain media names/duration/links for real media. Expected: no misleading generation link or Refund tokens action on a pack.
- [x] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-transaction-review.test.ts tests/admin-transactions-contract.test.ts tests/admin-transactions-architecture.test.ts tests/admin-transaction-history-postgres.test.ts tests/admin-milo-pack-presentation.test.ts tests/admin-transaction-history-controls.test.ts`. Expected: all pass on synthetic/local data only.
- [x] Run TypeScript, frontend lint, exposure and diff checks; inspect the bounded diff and commit. Expected: pass, with any environment/pre-existing issues recorded exactly.

### Task 2: Delivery handoff

- [x] Incorporate origin/main containing delivered #592 without editing that PR.
- [ ] Push and open a draft PR with exact validation and no customer data. Parent obtains independent review and owns CI/Preview/merge/deployment.

## Local validation

- Existing baseline: 32/32 pass.
- RED: 5 expected pack failures in the new classification/mapper/actual-table/history checks before production edits. A separate disposable PostgreSQL run demonstrated the attention page incorrectly containing the product-only pack before the real missing-media row.
- GREEN: 40/40 pass with the Task 1 command. The history fixture first reads an older schema without the product column, then verifies product-only and prefix-only receipts, NULL-product real media, nonpositive pack review and filtering before pagination. Table tests render the real component and do not invoke refund actions.
- `pnpm --prefix frontend exec tsc --noEmit`, `pnpm lint:exposure`, `git diff --check`: pass. Frontend lint: 0 errors, 7 pre-existing unrelated warnings.
- No live provider, LLM, production database, customer account or refund request was used. Shared dependencies are reused unchanged. Fresh CI/Preview and independent review belong to the parent.

Delivery preparation: incorporated confirmed main `0bf14013e10b76582ccf986a25e0567db6047bcd` after #592 delivery. The admin source/test patch is identical after rebase (`git range-diff`); independent review reported no P1/P2 on that patch. The post-rebase focused command passes **40/40** again; fresh TypeScript, exposure and diff checks pass. Draft PR, final review confirmation and CI/Preview are the next handoff gates.
