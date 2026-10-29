# Shared Milo levels implementation plan

> **For agentic workers:** Use superpowers:executing-plans, followed by an independent review. Keep this work in PR #555.

**Goal:** Connect Lite (GPT-6 Luna/high), Standard (GPT-6.1 Terra/high), Max (GPT-6.1 Sol/xhigh) in Studio and all prompt assistants; clicking Milo opens the existing credits dialog.
**Architecture:** Extend the shared assistance contract, frozen tariffs and existing credit ledger. Luna remains sponsored; Terra shares the existing included/purchased credit lots with Sol. Retain historical policies and settlements. New task profiles and composer request limits freeze their reasoning/output policy. Reuse one accessible dialog.
**Tech Stack:** Next.js/React, TypeScript, PostgreSQL, OpenAI Responses API.
**Spec:** User-approved tier table and direct Studio dialog, confirmed for both Studio and generators on 2026-10-29; this plan records that approved design.

## Global constraints
- No new credit pool, balance reset, default-model change, automatic purchases, deployment or shared-database migration.
- Historical model choices, task profiles, tariffs, receipts and in-flight payloads retain their meaning.
- Terra Standard/global/short-context provider rates per million: $1 input, $0.05 cached, $1.25 30-minute cache-write, $5 output. Same 100% markup on conservative basis: $2.50/$0.10/$10 retail. No long-context, regional or paid hosted tools.
- Existing Sol tariff and paid authorization remain valid; Terra selections disclose their own rates. Lite stays sponsored, subject to existing availability gates.
- New task/composer reasoning output allowance: 6000 tokens including reasoning; existing monetary/call ceilings remain, with explicit incomplete-output handling.
- English product copy; existing French dialog copy stays consistent.

## Review focus
- A model switch or purchase during a request must not alter its frozen model/tariff.
- Terra reservations, unused-credit release and support recovery must never debit twice or settle with Sol pricing.
- A paused purchased balance must stay paused across all three selections.
- Old task profiles and 2200-token composer requests must recover after migration.
- Keyboard/mobile dialog use and close/focus must work in Studio and all generators.

### Task 1: Shared models and funding
Files: assistance-contract/provider-facts/ledger/resolution, quote-studio-assistance, new migration, pricing and PostgreSQL tests.
- [ ] Add failing tests for Terra rates, all three choices, shared credit lots, replay, pauses and old settlement.
- [ ] Extend canonical tariff/model ownership and ledger paths; retain stored mode names for compatibility.
- [ ] Run focused financial tests and commit.

### Task 2: Frozen runtime policies
Files: task-budget-contract, conversation-director/image-run/tasks service, composer repository/provider/service, migration, task/provider tests.
- [ ] Add failing tests for three exact reasoning efforts and frozen historical profiles.
- [ ] Freeze new 6000-token limits and effort, extend guarded database constraints, preserve unknown recovery and fallback to Lite.
- [ ] Run task/composer integration tests and commit.

### Task 3: Shared panel and verification
Files: Studio credits dialog/control/status parser, composer trigger, browser tests, engineering docs.
- [ ] Test direct opening, all three selections, tariff display and no purchase on opening/switching.
- [ ] Render Lite/Standard/Max and common balances; replace composer level menu and separate Credits button with one dialog trigger.
- [ ] Run focused browser tests, Studio suite, type check, lint and exposure check.
- [ ] Independently review, address important findings, update documentation and push current PR.
