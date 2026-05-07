# Architecture 4x3 Wave Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four waves of three architecture PRs that continue reducing oversized route, workspace, marketing, and server files without changing product behavior.

**Architecture:** Each PR targets one bounded responsibility and adds or extends a contract test. Branches are created from `main`, verified locally, opened as PRs, then rebased before merge if prior PRs move `main`.

**Tech Stack:** Next.js App Router, React/TypeScript, route-local `_components`/`_hooks`/`_lib`, Node `node:test` architecture contracts, GitHub/Vercel CI.

---

### Wave 1: UI And Marketing Surface Split

**PR 1:** Split Character Builder component module further.
- Create component modules under `frontend/src/components/tools/character-builder/_components/`.
- Keep `CharacterBuilderWorkspace.tsx` focused on orchestration.
- Extend `tests/character-builder-workspace-architecture.test.ts`.

**PR 2:** Split Models catalog route sections/helpers.
- Inspect `frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx`.
- Extract route-local components/helpers under its directory.
- Add or extend a catalog architecture contract test.

**PR 3:** Split Examples marketing route sections/helpers.
- Inspect `frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx`.
- Extract sections/helpers under route-local `_components`/`_lib`.
- Add or extend an examples architecture contract test.

### Wave 2: Workspace Follow-Up Split

**PR 4:** Split Audio generated picker/result UI.
- Extract modal/rail composition from `AudioWorkspace.tsx`.
- Extend `tests/audio-workspace-architecture.test.ts`.

**PR 5:** Split Image workspace modals/shell sections.
- Extract auth modal and gallery shell components/hooks from `ImageWorkspace.tsx`.
- Extend `tests/image-workspace-split-contract.test.ts`.

**PR 6:** Split Angle/Upscale remaining route UI surfaces.
- Choose the larger remaining tool file after audit.
- Extract isolated UI module and extend its architecture test.

### Wave 3: Server Tools Split

**PR 7:** Split `frontend/src/server/tools/upscale.ts`.
- Extract request parsing/normalization helpers.
- Add server tool architecture contract test.

**PR 8:** Split `frontend/src/server/tools/angle.ts`.
- Extract request parsing/normalization helpers.
- Add server tool architecture contract test.

**PR 9:** Split `frontend/server/fal-webhook-handler.ts`.
- Extract event/result mapping helpers.
- Add webhook architecture contract test.

### Wave 4: Generation Server Split

**PR 10:** Split `frontend/app/api/generate/route.ts`.
- Extract request validation and response helpers.
- Add route architecture contract test.

**PR 11:** Split `frontend/src/server/images/execute-image-generation.ts`.
- Extract provider payload/result helpers.
- Add image execution architecture contract test.

**PR 12:** Split one remaining high-impact shared file from final audit.
- Candidate order: `frontend/src/lib/fal.ts`, `frontend/lib/api.ts`, `frontend/src/server/audio/generate-audio.ts`, or `frontend/components/marketing/home/HomeRedesignSections.tsx`.
- Pick the safest candidate from the current audit after PR 11.
- Add or extend an architecture contract test.

### Verification Pattern For Every PR

- Run the focused architecture test.
- Run `pnpm --prefix frontend exec tsc --noEmit --pretty false`.
- Run `npm --prefix frontend run lint`.
- Run `npm run lint:exposure`.
- Run `git diff --check`.
- Run `pnpm --prefix frontend run build` before pushing/opening PR.
- After opening PR, wait for GitHub `quality`, Vercel, and Vercel Preview Comments to pass.
- Merge in order, rebasing later PRs when `main` moves.
