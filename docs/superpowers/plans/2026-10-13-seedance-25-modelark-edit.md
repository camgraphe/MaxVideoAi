# Seedance 2.5 ModelArk Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Qualify and activate Seedance 2.5 Edit through the existing ModelArk account, without requiring LAS onboarding.

**Architecture:** The selected Edit transport is explicit; existing LAS behavior remains available for its separately qualified environment and recorded LAS jobs retain their transport. ModelArk Edit uses the existing `/api/v3` credential, source-inheriting parameters and ModelArk supplier accounting. New ModelArk Edit work stays behind its own disabled-by-default gate until a bounded genuine canary succeeds.

**Tech Stack:** Next.js, TypeScript, PostgreSQL 17, existing BytePlus client, wallet, canonical customer tariffs and owned media services.

**Spec:** The owner's end-to-end Edit request, root `AGENTS.md`, `docs/engineering/pricing-engine.md`, and the official ModelArk tutorial/API reviewed in the browser on 2026-10-13:
- https://docs.byteplus.com/en/docs/modelark/seedance-2-5
- https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api

## Global Constraints

- Preserve T2V, I2V, Ref2V and Extend behavior and current customer prices.
- No provider request before a fresh verified quote and the previously approved limits: two POSTs maximum, USD 2 supplier, USD 4.94 temporary wallet exposure. No hidden retry.
- No vendor mail, form submission, new agreement, purchase or new provider credential. The owner explicitly declined the commercial form.
- Keep originals, paid snapshots, quote history and accepted job transport immutable. Do not apply the prepared LAS tariff correction to a ModelArk launch.
- Preserve single debit/POST, durable acceptance, uncertain submission retention, definite stored-amount refund and durable media/library completion.
- Follow the normal isolated branch, PR, required Quality CI, current-main deployment check, Git Vercel deployment and both-domain SHA checks.

## Review Focus

- A recorded LAS task continues using LAS after current Edit selection changes.
- Explicit transport selection without its matching gate cannot expose executable Edit.
- Source-preserving provider output and the customer quote cannot disagree silently on timing/cadrage.
- Fractional source measurements remain supported without invented generation limits; any rounding used to select a reviewed tariff class must be explicit in the quote and UI.
- Accepted-task or refund persistence outages cannot resend the paid job or lose its original locked charge.

### Task 1: Transport, provider payload and reliability

**Files:** `frontend/src/server/video-providers/byteplus-modelark.ts`, `byteplus-modelark-payload.ts`, `frontend/src/lib/env.ts`, `frontend/server/byteplus-submission-state.ts`, `frontend/app/api/generate/_lib/byteplus-submission.ts`, `frontend/server/byteplus-poll.ts`, related provider/submission/PostgreSQL tests.

**Interfaces:** Keep `resolveBytePlusTransport(engineId, mode)` and persisted poll selection stable. Add `SEEDANCE_2_5_EDIT_TRANSPORT` (default `las`, preserving guarded production until explicit cutover), and `SEEDANCE_2_5_MODELARK_EDIT_ENABLED` (default false). Only the explicit `modelark` selection enables the alternative; it still requires the ModelArk key and its matching gate. Supply the actual selected transport to the owned attempt/rejection persistence owner instead of hardcoding `las`.

- [x] Add failing tests for the closed ModelArk gate, valid ModelArk routing with no LAS key/flag, correct explicit Edit payload (`omni_reference_task_type=edit`, `ratio=adaptive`, `duration=-1`), and unchanged four-mode payloads.
- [x] Implement the guarded transport selection and payload. Keep the source clip as the exact owned `reference_video`.
- [x] Extend existing Edit reliability owners to preserve selected transport through claims, rejection, polling and durable completion; preserve compatibility for existing LAS callers and stored jobs.
- [x] Verify real PostgreSQL single-submit, uncertain/accepted recovery, stored-amount refund and durable output/library cases for both transports.

### Task 2: Current quote and supplier ownership

**Files:** `frontend/server/byteplus-las-tariff.ts`, `frontend/server/byteplus-normal-cost.ts`, `frontend/server/pricing/quote-billing.ts`, `resolve-customer-tariff.ts`, `seedance-input-tariff.ts`, `frontend/server/pricing-admin/provider-cost-comparison.ts`, maintenance environment evidence and related pricing/financial tests.

**Interfaces:** The current LAS-price classifier must follow the selected transport for new quotes. Persisted terminal accounting already uses stored transport and must keep that authority. Explicit LAS authoring stays a separate operation; prevent it from overwriting an active ModelArk Edit launch accidentally.

- [x] Add failing current-quote tests proving ModelArk Edit reads reviewed ModelArk-shaped active cells, uses ModelArk video-input supplier facts/discount, and never consumes LAS literal rates. Preserve LAS rejection of token-minimum shapes when LAS is selected.
- [x] Implement transport-aware current pricing and include selection in factual/cutover evidence. Do not rewrite the active production grid or historical paid amounts.
- [x] Prove quote/customer/supplier parity for measured 4s input + source-preserved 4s output at 480p/720p; verify all four other modes remain unchanged.
- [x] Run focused pricing and maintenance tests and start exhaustive financial qualification; its final result remains a mandatory Task 4 release gate.

### Task 3: Trusted inherited timing and source-facing controls

**Files:** `frontend/app/api/preflight/_lib/media-aware-preflight.ts`, generation preflight/request options, `frontend/src/server/agent-api` normalization/preparation, `frontend/app/(core)/(workspace)/app/_hooks` and `_lib`, shared duration/settings controls, related workspace/MCP/Studio tests and localized copy.

**Interfaces:** ModelArk Edit takes the source's server-measured duration (4–30s) and framing. The execution duration `-1` is a provider instruction and cannot enter the customer calculator as a negative duration. Customer prices must still come from exact reviewed literal cells; preserve actual source facts separately from any explicitly disclosed billed-duration class. A mismatched/stale source or unsupported current quote fails before spending.

- [x] Pin trusted owned-source timing, fractional boundaries, source replacement/removal and stale-quote refusal in tests.
- [x] Make source timing/framing truthful in UI and quote projections, with no independent output-duration choice that the provider ignores.
- [x] Make workspace, MCP and Studio preserve the same trusted execution and quote facts. Keep the current source/image/audio ownership boundary and default paid backend.
- [x] Smoke-test authenticated source controls on an isolated candidate without changing the owner's production draft; verify its complete fresh-price/generation flow in the real production-build Task 4 canary.

### Task 4: Review, bounded canary and delivery

- [x] Update launch/pricing guides to distinguish the qualified ModelArk path from the optional LAS path. Include current official evidence and the commercial proof limitation; an old ticket cannot establish the current contract state.
- [ ] Run lint, exposure, type checks, focused contracts, appropriate integration/browser/financial checks and `git diff --check`; obtain independent source review.
- [x] Validate one genuine successful authenticated Edit, including task acceptance, polling, byte-preserved source, durable media/download/library, one debit and ModelArk terminal reconciliation.
- [x] Validate one genuine definite rejection/failure and exactly one stored-amount refund. This counts toward the same two-POST limit. Stop on any uncertain submission.
- [ ] Only after proof, configure the explicit ModelArk Edit selection/gate while preserving all four other modes; deliver through PR and Git Vercel, then verify both production domains and the complete user flow.

Execution remains within the owner's existing implementation and canary authorization. No separate vendor access request is part of this plan.


Task 4 qualification result: both genuine authorized POSTs are consumed. The first
proves account access, acceptance, one charge, edited visuals, source framing,
durable output, original download, Library read/save and reported usage. The
4.000000s / 96-frame source became 3.708333s / 89 frames. The initial exact-duration
blocker was corrected on 2026-10-14 after reading the English prompt guide: it
permits about 0.3s difference, and the tutorial allows up to 0.4s shorter output.
The observed 0.291667s delta complies. No source or result padding is performed.
The second proves definite rejection and one exact stored-amount refund.

The remaining application correction captures the existing original-file probe
callback during BytePlus copying, persists its URL/hash/byte-bound measurements
before output projections, and retains them during recovery. Paid PostgreSQL
qualification verifies measured Recent/Saved media timing and keyframes while
source quotes, supplier accounting and wallet amounts remain immutable. UI copy
states approximate output inheritance. No third provider POST is authorized.
Release still requires latest mandatory Quality CI and both-domain Git provenance.
