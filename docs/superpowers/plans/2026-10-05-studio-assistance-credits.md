# Studio Assistance Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved assistance dialog backed by monthly free credits and cumulative prepaid Sol packs.

**Architecture:** Retain the assistance call/checkpoint owner and its legacy tariff. Add a transaction-scoped credit-lot owner for purchases, reservations, settlement and support releases. The account lock serializes credit mutations; wallet debits occur only at purchase. Status reads project current-month grants without writing.

**Tech Stack:** Next.js, React, TypeScript, Zod, canonical pricing, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-05-studio-assistance-credits.md`

## Global Constraints

- 500 free credits each UTC calendar month; 1,000 credits = $1.
- $2/$5/$10 packs; free before paid; purchased lots oldest first.
- Supplier basis plus 100%; old settlements retain old pricing.
- Luna has no monthly quota, one active message, 128,000 input-token bound.
- No live provider calls, production migration, deployment or activation.

## Review Focus

- Lost purchase acknowledgement must not cause a second wallet debit.
- Concurrent requests must not spend the same credits.
- Month rollover must not replenish or lose a prior call's hold.
- Unknown usage and support waiver must retain supplier exposure without charging twice.
- Stale status or account switching must not authorize a different pack or replay a message.

### Task 1: Versioned credit accounting

**Files:** `assistance-contract.ts`, `assistance-policy.ts`, `quote-studio-assistance.ts`, new `assistance-credits.ts`, new `assistance-credit-ledger.ts`, `assistance-ledger.ts`, `assistance-resolution.ts`, migration 63; tests `studio-assistance-credits-postgres.test.ts` and pricing tests.

**Interfaces:** Keep existing ledger exports. Add `readStudioCreditBalance`, `purchaseStudioCreditPack`, `reserveStudioCredits`, `settleStudioCredits`, and `releaseStudioCredits`, all using the locked account transaction. Status gains optional `credits`; purchase choices include amount, tariff, revision and UUID purchase identity.

- [ ] Write and observe failing local PostgreSQL tests for cumulative purchases, duplicate purchases, free-first settlement, insufficient funds, concurrency, monthly rollover and waiver.
- [ ] Implement migration and credit owner; integrate versioned policy, quote and settlement into existing call owner.
- [ ] Run focused pricing, ledger, route and recovery tests; commit.

### Task 2: Product dialog and Luna rules

**Files:** new route-local `StudioAssistanceCredits.client.tsx` and CSS, existing assistance wrapper/client schema/hook, director instructions and context guard; dialog/hook/director tests; local preview fixture.

**Interfaces:** Render server quantities; post a `purchase_pack` choice only after an explicit review click; retain the account-safe `choose` hook and `onChoice` recovery boundary. Consume MCP registry paths without modifying publication.

- [ ] Add failing UI tests for quantities, cumulative review, disabled/stale purchase, explicit model choice and focus restoration.
- [ ] Implement approved UI and EN/FR copy; preserve loading, errors, support and paused-paid behavior.
- [ ] Enforce generous Luna context size and single-message guard; verify no monthly depletion.
- [ ] Run focused UI/director tests and inspect the real component in local preview; commit.

### Task 3: Verification and operational documentation

**Files:** economics/architecture guides and migration README.

- [ ] Document purchase funding, month boundaries, support credits and activation requirements.
- [ ] Run `npm run qa:editor`, `npm run lint:exposure` and `git diff --check`.
- [ ] Review the financial diff independently and fix material findings with regression tests.
- [ ] Commit, preserve the local review URLs, and report implementation and activation limits.
