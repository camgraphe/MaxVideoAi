# Fal rejected render refunds

> **For agentic workers:** Use superpowers:executing-plans to execute this targeted bug fix.

**Goal:** Recredit the two authorized MiniMax H3 charges (156 USD cents total) and restore atomic failure/refund settlement for provider refusals.

**Architecture:** Keep the existing shared wallet settlement, row locks and unique refund constraint. Correct SQL parameter typing for the production receipt schema; do not change provider rejection classification or retry policy.

**Tech stack:** TypeScript, node:test, PostgreSQL 17, GitHub Quality CI, Vercel Git deployment.

**Spec:** User request in this chat on 2026-11-01. Recredit exactly 156 cents and automatically mark refused renders failed and refunded.

## Constraints and review focus

- Preserve wallet/card separation and the exact canonical charge amount.
- Preserve atomic status/refund commits, rollback on errors and duplicate prevention.
- Exercise production's integer application fee and bigint platform revenue together.
- Cover nullable application fees, replay and concurrent settlement.
- Keep successful renders and transient provider read failures outside new refunds.

## Task 1: Customer recovery and SQL regression

- [x] Confirm both provider results are terminal content refusals and both charges remain unrefunded.
- [x] Atomically credit each original 78-cent charge and mark its job failed/refunded; record receipt IDs.
- [x] Run existing focused refund/poll/webhook tests as baseline (21 passing).
- [x] Update the wallet refund fixture to match production's bigint platform revenue and add a refused-render settlement test for nullable and non-null application fees.
- [x] Run the regression before the fix; expect PostgreSQL 42P08 (integer versus bigint).
- [x] Explicitly type the shared SQL zero parameter without changing settlement policy.
- [x] Run focused PostgreSQL/refusal tests, TypeScript, frontend lint, exposure lint and diff checks.
- [ ] Review, commit, push and open a PR; wait for its required Quality CI.
- [ ] Use the documented GitHub/Vercel delivery path and verify domain alignment before reporting a live fix.

## Evidence

- Production logs: `42P08`, inconsistent types for `$9`, integer versus bigint.
- Production receipt columns: `application_fee_cents integer`, `platform_revenue_cents bigint`.
- Customer recovery committed in one transaction: refund receipts 14658 and 14659, 78 USD cents each. Both jobs are failed/refunded and no longer provisional.
- Baseline: 21/21 focused tests passed against the old all-integer fixture, exposing the schema mismatch in test coverage.
- Red: both new refusal cases reproduced `42P08` against the production-shaped fixture.
- Green: 37/37 focused PostgreSQL, poll, webhook, refusal and architecture tests passed. TypeScript, exposure lint, targeted server lint and diff checks passed. Frontend lint passed with seven existing warnings in untouched files.
