# GA4 Payment Outbox Implementation Plan

> Execute inline using superpowers:executing-plans and test-driven-development. The user already requested implementation of the audited queue; no additional design approval is needed.

**Goal:** Recover payment analytics from transient delivery failure without blocking fulfillment.
**Architecture:** Canonical receipt intents plus bounded repair, durable PostgreSQL leases and a separate cron sender.
**Tech Stack:** Existing Next.js, pg, node:test, PostgreSQL 17; no new dependencies.
**Spec:** ../specs/2026-10-20-ga4-payment-outbox.md

## Global Constraints
Live consented wallet payments only; no historical replay; terminal HTTP failures require review; eight attempts, 71-hour TTL, five-second HTTP timeout, two-minute leases, 20 rows/four workers per run. All financial CI lanes required.

## Review Focus
Concurrent delivery and stale lease acknowledgment; receipt success despite queue failure; withdrawal/regrant before delayed delivery; expiry after worker crash; correct timestamp and currency despite retries.

### Task 1: Durable store and transport
- [ ] Write and run failing `tests/ga4-payment-outbox-postgres.test.ts` for rollback, uniqueness, competing claims, stale acknowledgments, expiry and payload scrubbing.
- [ ] Add `neon/migrations/77_ga4_payment_outbox.sql` and `frontend/server/ga4-payment-outbox.ts`: enqueueGa4PaymentEvent(executor,input), claimGa4PaymentEvents(executor,limit), finishGa4PaymentEvent(executor,row,result).
- [ ] Add `sendGa4EventWithResult(args)` retaining boolean sendGa4Event; test original timestamp, timeout, HTTP terminal and accepted responses.
- [ ] Run focused tests and commit.

### Task 2: Producers, repair and consent-aware worker
- [ ] Write failing tests for receipt conversion, failed enqueue repair, no legacy replay, refunds, consent/admin exclusion and retry exhaustion.
- [ ] Add `ga4-wallet-events.ts` to build/enqueue and repair only marked receipts; update topup transaction and refund owner.
- [ ] Add `ga4-payment-worker.ts`: resolve eligibility and drain; preserve signed checkout consent time in event metadata.
- [ ] Add strict authenticated production `/api/cron/ga4-payments`, five-minute schedule and disabled override; test authorization and worker failure behavior.
- [ ] Update architecture contracts and operational documentation; run focused suites and commit.

### Task 3: Release and handoff
- [ ] Full validation, type/lint/exposure/build, independent final review, PR and successful latest CI.
- [ ] Apply exact additive migration after validation, verify schema, follow production alignment and Git deployment policy.
- [ ] Verify secret auth/config and aggregate drain/queue state without synthetic live events.
- [ ] Save dated aggregate evidence in OUTREACH, record action, sync/doctor/export; update existing 48h followup scope while preserving its schedule.
