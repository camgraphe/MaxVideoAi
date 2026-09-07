# Audio Creative Workspace Implementation Plan

> Execute inline using executing-plans. User authorized implementation and reversible design decisions.

**Goal:** Deliver five honest, distinct audio creation intents and preserve video soundtrack mixing.
**Architecture:** Contextual route UI consumes a shared request/quote contract; existing server job, wallet and media owners remain authoritative. Exact provider selection and canonical factual costs are extended additively.
**Tech Stack:** Next.js, React, CSS modules, existing SWR/auth, canonical pricing, Fal/Vertex adapters.
**Spec:** docs/engineering/audio-workspace.md

## Constraints

No push/deploy, paid calls, inherited remote environment or edits in coordinating checkouts. FR/EN/ES, dark/light, mobile 44px targets, no fabricated waveform, no silent paid fallback. Preserve existing pack and source identities.

## 1. Provider/request/price contracts

- [ ] Extend src/lib/audio-generation.ts and server/audio/audio-generate-validation.ts for song, ambience and explicit voice model; tests cover rejected lyrics/script confusion, unsupported references and durations.
- [ ] Add exact MiniMax song/speech and Stable ambience adapters; injected subscribe tests verify payload and single-call failure. Retain Studio SFX adapter.
- [ ] Share preparation between quote and generation, compare fresh amount/config before debit, fail missing providers before billing. Test canonical vendor facts and stale quote rejection.
- [ ] Persist requested versus measured duration and providers; retain full songs and original standalone outputs.

## 2. Executable workspace

- [ ] Add route-local intention copy, illustrations, CSS and editor components. Five equal named intents with useful model settings; source video workflow available from explicit tab.
- [ ] Add account-scoped draft hook and quote hook. Debounced quote rejects late responses and edit/session/expiry changes; request sent exactly as quoted.
- [ ] Bind generation, real job polling, history selection, errors and original playback/downloads. Retain sources through navigation and model changes.
- [ ] Run DOM checks for field semantics, switching, stale quote, drafts and sessions.

## 3. Integration and QA

- [ ] Notify Studio/Toolbox of final entry/result contract and first running screens.
- [ ] Run focused provider/pricing/workspace tests, tsc, lint, exposure, diff; broaden test:validate and build without remote env.
- [ ] Run local fixture desktop/mobile FR/EN/ES and light/dark, inspect screenshots and console. Check no horizontal overflow, touch controls, keyboard and actual navigation.
- [ ] Record evidence, limitations and commits for integration. No merge/push/deploy.
