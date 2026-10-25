# Shared video excerpt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Choose a real source passage shared across video models and quote its measured derivative.

**Architecture:** Owned source → shared start/end selection → bounded real MP4 preparation → distinct measured asset → existing pricing/generation. Shared pure model policy drives browser guidance and server validation.

**Tech Stack:** Next.js, React, TypeScript, existing FFmpeg/FFprobe, PostgreSQL, existing storage and quote owners.

**Spec:** docs/superpowers/specs/2026-10-23-video-excerpt-design.md

## Global Constraints

- Work only in the existing isolated `codex/marketing-media` worktree; preserve other untracked files.
- No deployment, push, production database writes or paid generation.
- Preserve originals and model capabilities; input limits are distinct from output-duration choices.
- Only owned measured assets establish timing and price; never browser URL/duration declarations.
- EN/FR/ES UI, accessible keyboard/touch controls, existing authenticated and pricing boundaries.

## Review Focus

- Long source with a short legal range: source model cap applies to result, not original upload.
- Rotated/VFR phone source: measured orientation, duration and audio match the chosen passage.
- Source/account/model change during preparation: stale result cannot enter the current composer.
- Price during edits: no stale quote can authorize generation for a new range.
- Unchanged/full selection: no unnecessary preparation or lost original identity.

### Task 1: Trusted excerpt preparation and shared policy

**Files:** new `frontend/lib/video-excerpt.ts`, `frontend/server/video-excerpts/{prepare,media}.ts`, `frontend/app/api/uploads/video/excerpt/route.ts`; focused tests `tests/video-excerpt-*.test.ts`. Reuse existing media owners, minimal compatibility extensions only when justified.

**Interfaces:** Export `VideoExcerptRange = {startSec:number;endSec:number}` and `getVideoExcerptLimits(engine,mode)` from the shared policy, with source min/max and inherited/requested timing. Export `prepareVideoExcerpt(userId,input,dependencies?)` taking `{source: ToolAssetRef; engineId:string; mode:'v2v'|'extend'|'reframe'; range:VideoExcerptRange}` and returning `{asset: UploadedVideoAsset; range:VideoExcerptRange; original:ToolAssetRef}`. Route returns `{ok:true,...result}` or explicit bounded errors. Original stored URL remains distinct from signed playback access.

- [x] Write failing policy/preparation tests: Luma18/Reframe10; Kling input10/output15; Wan15; Seedance authored fields; Ray2 no invented generation cap; invalid ranges; unauthorized/changed source; real rotated cut with preserved audio.
- [x] Implement policy from actual source field constraints, not a second model table. Server must verify active model/mode, identity ownership, actual source and range, output facts and policy, and preserve lineage. Use bounded download/FFmpeg with cleanup, concurrent work protection, rotation-aware probing, frame tolerance, size/timeout limits. Operational preparation limits must never narrow existing full-source workflows.
- [x] Add authenticated, same-origin, bounded JSON adapter. Do not tie excerpt preparation to paid Creator gates or billing. Existing storage/owned assets provide persistence and reuse; no new migration unless unavoidable.
- [x] Run focused tests plus real FFmpeg qualification; report limits and verification in task report; commit only scoped files.

### Task 2: Shared selector and workspace source lifecycle

**Files:** shared `frontend/components/media/VideoExcerptSelector.client.tsx`, shared copy/client request owner, composer reference wiring, route-local excerpt hook, asset types, focused UI/lifecycle tests.

**Interfaces:** Consume Task1 range/limits/endpoint. Optional composer callback `onPrepareVideoExcerpt(field,index,range): Promise<void>` applies owned prepared media, and editor state must block stale Generate/price. Source identity and measured duration must survive attachment projection.

- [x] Write failing tests for legal long-source import, exact range editing, cancel, model/source/account changes, duplicate apply, preparation failure, stale prices and preserved model output settings.
- [x] Implement shared lazy dialog with manual video, start/end touch sliders and numeric controls, selected length/limits, cancel/apply and readable failures. Use existing modal focus and styling owners. Show action for ready source assets only.
- [x] Implement route-local preparation with existing account/upload-lifetime fencing and reservation settlement. Insert actual measured derivative; cancel/failure restores original; stale results cannot overwrite another selection. Long imports can reach selector without being rejected by model input duration; retain platform upload bounds and generation validation.
- [x] Verify normal quote pipeline uses derivative duration/URL, including source-inherited and requested output models, and hides pending/stale prices. Retain original library item.
- [x] Run DOM/lifecycle/architecture and type/lint checks; commit scoped implementation.

### Task 3: Complete integration, demonstration and review

**Files:** focused quote/integration/browser tests, engineering guide and QA report; local demo under ignored/untracked output only.

- [x] Exercise source selection, actual preparation and quote invalidation on a supplied iPhone source and one-minute fixture, at mobile and desktop sizes. Use actual UI and media owners; disclose any simulated account/pricing transport.
- [x] Check per-model source policy and inherited vs requested pricing against existing canonical tests. Run applicable validation lanes, TypeScript, lint, exposure and full build.
- [x] Review whole feature diff independently, resolve concrete findings and rerun affected checks. Record screenshots, measurements, remaining operational limitations and unchanged production state.
- [x] Commit only source/tests/docs; leave no product modifications unverified, no push/deploy.
