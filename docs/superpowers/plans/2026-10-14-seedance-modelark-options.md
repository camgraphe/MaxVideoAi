# Seedance ModelArk Options Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for parent integration and superpowers:dispatching-parallel-agents for the independent pricing, durable media and Draft domains. Preserve a single shared interface contract and review the complete branch before release.

**Goal:** Ship all documented creative Seedance ModelArk options across the workspace and shared APIs without further paid provider calls.

**Architecture:** Extend authored engine input schemas and the existing canonical request/quote pipeline. Keep provider option validation, pricing facts, media durability and owned Draft lineage in their established owners; add focused pure helpers where a new responsibility needs an explicit contract.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL 17, FFmpeg, existing ModelArk REST transport.

**Spec:** docs/superpowers/specs/2026-10-14-seedance-modelark-options-design.md

## Global Constraints

- Two genuine generation POSTs already consumed; zero additional supplier calls or temporary wallet operations.
- Preserve existing tariffs; use existing reviewed 4s and 1080p cells.
- No new keys, vendor forms, direct production uploads or shared Desktop edits.
- Current main base a9c1b843fffdc0cba1ad08b18f4c156a95d9b4d6; refetch before release.
- MP4/no returned frame/no watermark remain defaults. Current 2.x seed/camera-fixed capabilities remain unsupported.

## Review Focus

- Auto quotes cannot be lowered by forged numeric duration, source metadata, or stale preflight responses.
- Adaptive outputs and arbitrary inherited source ratios cannot escape a supplier-safe reviewed pricing bound.
- MOV decoding failures cannot lose the original, mislabel a short preview as the full video, or debit again.
- Last-frame copy/projection failure cannot cause another provider submission, lose the completed original, or leak output ownership.
- Final must retain the owned Draft's mode, verified media cost and output choices even after caller tampering, reload or asset deletion.

### Task 1: Catalogue, creative option validation and workspace/API propagation

**Files:** authored seedance-2-{standard,fast,mini,5}.ts; byteplus-modelark-{constants,payload,profile-policy}.ts; byteplus-submission.ts; workspace settings/schema/payload helpers; shared request validation and MCP projection where needed.

**Interfaces:** Provider builder accepts outputFormat?: 'mp4'|'mov', returnLastFrame?: boolean, watermark?: boolean, durationOption?: 'auto'|number|string. Validated advanced keys are output_format, return_last_frame, watermark. Pricing duration remains positive; provider Auto duration is -1. Aggregate reference caps include primary source slots.

- [ ] Write and run failing payload/workspace tests for MOV, returned JPEG, watermark, audio-only references, supplementary refs and their aggregate limits.
- [ ] Implement validated propagation and current-model capability schemas, including 4s, Auto and source-aware 1080p.
- [ ] Regenerate the catalogue using its existing generation command; run registry, payload and workspace contracts; commit.

### Task 2: Truthful Auto and adaptive pricing

**Files:** existing pricing facts/public scenario/preflight owners; new focused Seedance option pricing helper; mode-resolution helper; focused pricing tests.

**Interfaces:** Resolve automatic pricing to fixed model maximum 15s/30s, with source-timed Edit taking precedence. Resolve adaptive pricing through a proven bounded reviewed basis, preserve requested provider mode independently, and annotate the quote with its pricing basis.

- [ ] Write and run failing quote/request tests for Auto max pricing, forged duration, adaptive geometry and 1080p ModelArk versus LAS.
- [ ] Implement canonical normalization shared by quote and generation; retain existing exact tariffs and input-video pricing.
- [ ] Verify focused disposable PostgreSQL/public quote tests, unchanged fixed-option prices and selected financial coverage; commit.

### Task 3: Durable MOV and returned last frame

**Files:** provider response/types, provider-video-original-copy.ts, byteplus-poll.ts, byteplus-output-persistence.ts, media-library outputs/promotion, result DTO/MCP schemas and output actions; new artifact helper/tests.

**Interfaces:** normalized task carries optional lastFrameUrl and outputFormat; video original retains exact .mov bytes/MIME. Returned JPEG uses metadata.role='last_frame', source-video provenance and separate lastFrameUrl projection. Compatible full playback derivative is distinct from original and incidental preview.

- [ ] Write and run failing real-media/persistence tests for exact MOV/JPEG copy and replay after partial artifact/projection failure.
- [ ] Implement bounded copies, durable checkpoints, role-aware projections and download/reuse actions.
- [ ] Verify FFmpeg compatibility, owned outputs, original downloads, duplicate polling and existing Edit recovery; commit.

### Task 4: Multimodal Draft and inherited Final

**Files:** seedance-workflow request/submission/view/contract owners, Draft/Final hooks and request preparation; parent integration in preflight/generate and workspace ReadyView.

**Interfaces:** Draft accepts a fully prepared WorkspaceGeneratePayload plus strict preflight media inputs, preserving immutable payload for replay. Final inherits its owned Draft mode, core/advanced/refs and trusted media pricing facts; provider content remains only draft_task. Final output is 1080p and inherits MOV/last-frame/watermark options.

- [ ] Write and run failing per-mode, tampering, media replay, pricing and concurrency tests.
- [ ] Expand owned lifecycle and UI hooks; integrate canonical preflight/generate without clearing inherited references or trusting caller facts.
- [ ] Verify real PostgreSQL reservation/refund/recovery and DOM workflows; commit.

### Task 5: Review, complete validation and Git production delivery

- [ ] Run lint, exposure, TypeScript, registry check, complete validation lanes and production build; fix regressions.
- [ ] Run one fresh whole-branch review and fix material findings with regression tests.
- [ ] Create/attach PR, wait for every selected Quality CI lane; refetch/integrate current main and run deployment:check from committed candidate.
- [ ] Merge through GitHub, wait for Vercel Git READY, verify both domain SHAs, UI/catalogue/quote/download behavior and runtime errors without paid generation.
