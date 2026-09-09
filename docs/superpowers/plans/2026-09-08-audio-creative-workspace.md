# Audio Creative Workspace Implementation Plan

> Execute inline using executing-plans. User authorized implementation and reversible design decisions.

**Goal:** Deliver five honest, distinct audio creation intents and preserve video soundtrack mixing.
**Architecture:** Contextual route UI consumes a shared request/quote contract; existing server job, wallet and media owners remain authoritative. Exact provider selection and canonical factual costs are extended additively.
**Tech Stack:** Next.js, React, CSS modules, existing SWR/auth, canonical pricing, Fal/Vertex adapters.
**Spec:** docs/engineering/audio-workspace.md

## Constraints

No push/deploy, paid calls, inherited remote environment or edits in coordinating checkouts. FR/EN/ES, dark/light, mobile 44px targets, no fabricated waveform, no silent paid fallback. Preserve existing pack and source identities.

## 1. Provider/request/price contracts

- [x] Extend src/lib/audio-generation.ts and server/audio/audio-generate-validation.ts for song, ambience and explicit voice model; tests cover rejected lyrics/script confusion, unsupported references and durations.
- [x] Add exact MiniMax song/speech and Stable ambience adapters; injected subscribe tests verify payload and single-call failure. Retain Studio SFX adapter.
- [x] Share preparation between quote and generation, compare fresh amount/config before debit, fail missing providers before billing. Test canonical vendor facts and stale quote rejection.
- [x] Persist requested versus measured duration and providers; retain full songs and original standalone outputs.

## 2. Executable workspace

- [x] Add route-local intention copy, illustrations, CSS and editor components. Five named intents with Standard/High quality and human voice choices; source video workflow available from explicit tab.
- [x] Add account-scoped draft hook and quote hook. Debounced quote rejects late responses and edit/session/expiry changes; request sent exactly as quoted.
- [x] Bind generation, real job polling, history selection, errors and original playback/downloads. Retain standalone references through intent changes; preserve historical video source links.
- [x] Run DOM checks for field semantics, switching, stale quote, drafts and sessions.

## 3. Integration and QA

- [x] Notify Studio/Toolbox of final entry/result contract and first running screens.
- [x] Run focused provider/pricing/workspace tests, tsc, lint, exposure, diff; broaden test:validate and build without remote env.
- [x] Run local fixture desktop/mobile FR/EN/ES and light/dark, inspect screenshots and console. Check no horizontal overflow, touch controls, keyboard playback and actual navigation.
- [x] Record evidence, limitations and commits for integration. No merge/push/deploy.

## Accepted deferrals

Fixed tariffs and High quality routing remain pending user input and live qualification. Studio confirmed its shared canonical upload/handoff runtime is not yet implemented; integrate that additive contract in a focused follow-up, with no placeholder Studio action. See docs/engineering/audio-workspace.md for evidence and limits.
