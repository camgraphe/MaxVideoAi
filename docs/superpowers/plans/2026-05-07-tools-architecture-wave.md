# Tools Architecture Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three independent architecture PRs that reduce the largest authenticated tool workspaces without changing tool behavior.

**Architecture:** Keep each workspace component as the route-level/client orchestrator. Move copy, types, pure helpers, and isolated presentational subcomponents into colocated `_lib` and `_components` folders under each tool workspace area. Add contract tests so future edits do not collapse everything back into the main workspace files.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node test runner via `tsx`, existing npm/pnpm verification commands.

---

### Task 1: Angle Workspace Split

**Files:**
- Modify: `frontend/src/components/tools/AngleWorkspace.tsx`
- Create: `frontend/src/components/tools/angle/_lib/angle-workspace-copy.ts`
- Create: `frontend/src/components/tools/angle/_lib/angle-workspace-types.ts`
- Create: `frontend/src/components/tools/angle/_lib/angle-workspace-helpers.ts`
- Create: `tests/angle-workspace-architecture.test.ts`

- [ ] Create branch `codex/angle-workspace-split` from fresh `main`.
- [ ] Move `DEFAULT_ANGLE_COPY` and `AngleCopy` into `angle-workspace-copy.ts`.
- [ ] Move local response/asset/persistence types into `angle-workspace-types.ts`.
- [ ] Move pure helpers such as billing key resolution, numeric parameter sanitation, persisted-state parsing, preview collection, URL cleanup, and upload-size copy into `angle-workspace-helpers.ts`.
- [ ] Update `AngleWorkspace.tsx` imports and keep behavior unchanged.
- [ ] Add `tests/angle-workspace-architecture.test.ts` asserting the split modules exist, expected exports are present, and `AngleWorkspace.tsx` no longer owns copy/helper declarations.
- [ ] Verify with `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/angle-workspace-architecture.test.ts`, `pnpm --prefix frontend exec tsc --noEmit --pretty false`, `npm --prefix frontend run lint`, `npm run lint:exposure`, `git diff --check`, and `pnpm --prefix frontend run build`.
- [ ] Commit, push, open PR, wait for checks, then merge when green.

### Task 2: Upscale Workspace Split

**Files:**
- Modify: `frontend/src/components/tools/UpscaleWorkspace.tsx`
- Create: `frontend/src/components/tools/upscale/_lib/upscale-workspace-copy.ts`
- Create: `frontend/src/components/tools/upscale/_lib/upscale-workspace-types.ts`
- Create: `frontend/src/components/tools/upscale/_lib/upscale-workspace-helpers.ts`
- Create: `tests/upscale-workspace-architecture.test.ts`

- [ ] Create branch `codex/upscale-workspace-split` from fresh `main`.
- [ ] Move `DEFAULT_COPY` into `upscale-workspace-copy.ts`.
- [ ] Move local uploaded asset, preview, billing, library, and job response types into `upscale-workspace-types.ts`.
- [ ] Move pure recent-media, MIME, pricing metadata, source resolution, cache key, and compare-position helpers into `upscale-workspace-helpers.ts`.
- [ ] Update `UpscaleWorkspace.tsx` imports and keep behavior unchanged.
- [ ] Add `tests/upscale-workspace-architecture.test.ts` asserting the split modules exist, expected exports are present, and `UpscaleWorkspace.tsx` no longer owns copy/helper declarations.
- [ ] Verify with the same focused and full commands as Task 1.
- [ ] Commit, push, open PR, wait for checks, then merge when green.

### Task 3: Character Builder Workspace Split

**Files:**
- Modify: `frontend/src/components/tools/CharacterBuilderWorkspace.tsx`
- Create: `frontend/src/components/tools/character-builder/_lib/character-builder-copy.ts`
- Create: `frontend/src/components/tools/character-builder/_lib/character-builder-types.ts`
- Create: `frontend/src/components/tools/character-builder/_lib/character-builder-helpers.ts`
- Create: `tests/character-builder-workspace-architecture.test.ts`

- [ ] Create branch `codex/character-builder-workspace-split` from fresh `main`.
- [ ] Move `DEFAULT_CHARACTER_COPY` and `CharacterCopy` into `character-builder-copy.ts`.
- [ ] Move local asset, library, persistence, billing, loading, pending-run, and choice types into `character-builder-types.ts`.
- [ ] Move pure persistence, summary, reference image, billing, upload-size, reset, and trait helper functions into `character-builder-helpers.ts`.
- [ ] Update `CharacterBuilderWorkspace.tsx` imports and keep behavior unchanged.
- [ ] Add `tests/character-builder-workspace-architecture.test.ts` asserting the split modules exist, expected exports are present, and `CharacterBuilderWorkspace.tsx` no longer owns copy/helper declarations.
- [ ] Verify with the same focused and full commands as Task 1.
- [ ] Commit, push, open PR, wait for checks, then merge when green.

### Final Verification

- [ ] Sync local `main` after all merges.
- [ ] Run `npm run architecture:audit -- --min-lines 900` to show the new before/after position.
- [ ] Report merged PR URLs, verification commands, and remaining biggest architecture targets.
