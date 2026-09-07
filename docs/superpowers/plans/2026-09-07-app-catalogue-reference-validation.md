# App catalogue and reference validation implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development, executing tasks in order with independent task reviews and one final review. Root owns browser and connected-environment qualification alongside implementation.

**Goal:** Validate the integrated app with complete family-based model discovery and clear, faithful model-specific reference restrictions.

**Architecture:** Keep the registry, runtime schemas, mode selection, reference budgets, upload/Library/Recents handlers and generation contracts authoritative. The selector and compact commands expose those owners' state. Add focused presentation helpers and integration tests, without moving route orchestration or provider logic.

**Tech Stack:** Existing Next.js 15, React 18, TypeScript, SWR, scoped CSS, Node test runner and disposable PostgreSQL tooling. No added dependencies.

**Spec:** `docs/design/global-app-concept/catalogue-reference-validation.md` and the existing `integration-contract.md`.

## Global Constraints

- Use isolated branch `codex/app-catalogue-validation`, based on validated `8d431d688`; preserve the preceding branch.
- Preserve canonical publication, lifecycle, family, private canary and provider-availability boundaries. Never hardcode current catalogue counts or edit generated registry projections.
- Keep the existing quote, auth, wallet, draft, mode, original-media and reference-budget owners. No invented model compatibility rule.
- Keep 44px controls, touch-visible explanations, keyboard focus, Escape/restoration, light/dark contrast and mobile reachability.
- No added dependencies, production mutation, paid generation, push, merge or deployment. Connected qualification may use reviewed read paths; temporary fixtures must remain local and be removed before final builds.
- Each worker owns its specified files and tests; no worker-spawned subagents or reviewers. Root's browser fixtures and artifact directory are excluded from worker commits.

## Task 1: Catalogue coverage and family discovery

**Files:**
- Modify `frontend/src/components/ui/EngineSelect.tsx`, `engine-select/useEngineSelectRegistry.ts`, `engine-select/EngineSelectDropdown.tsx`, `engine-select/engine-select-copy.ts` as required for derived counts and clear filtering.
- Create `frontend/src/components/ui/engine-select/engine-select-catalogue.ts` only for reusable pure catalogue-summary/search presentation logic.
- Modify `frontend/messages/en.json`, `fr.json`, `es.json` for matching selector copy.
- Test `tests/engine-select-catalogue-coverage.test.ts`, `tests/engine-select-family-grouping.test.ts`, `tests/engine-select-architecture.test.ts` and a rendered selector interaction test.

**Interfaces:** Consume `EngineCaps[]`, the existing `EngineRegistryMeta`, `buildEngineFamilyGroups`, `showLegacy`, `selectedEngineId` and current search. If introducing a helper, export `getEngineSelectCatalogueSummary({ engines, visibleEngines, registryMeta })` returning `{ totalCount, visibleCount, legacyCount, hiddenLegacyCount, familyCount }`, all derived from the currently eligible input engines. Keep existing component public props and selection callbacks stable.

- [ ] Build a registry-to-runtime-to-family coverage test for video and image. The core assertion compares exact identities, not a frozen number:

```ts
const published = registry.models.filter(model => model.category === category && model.publication.app.published);
const engines = getBaseEnginesByCategory(category);
const groups = buildEngineFamilyGroups({ engines, registryMeta, showLegacy: true });
assert.deepEqual(groups.flatMap(group => group.engines.map(engine => engine.id)).sort(), published.map(model => model.id).sort());
```

- [ ] Add explicit fixtures for current/legacy filtering, selected legacy visibility, paused/private boundaries, category separation and unique family membership. Add a failing rendered test for visible catalogue/filter counts and an empty search that explains the hidden-legacy filter when relevant.
- [ ] Run the new focused tests with the repository tsconfig and record the red result. If coverage is already correct, retain its green baseline and make the new missing presentation expectation the red case.
- [ ] Implement the derived summary and localized filter/empty-search copy. Retain the current recommended-first policy and existing persistent legacy preference. Show full family names through appropriate layout/wrapping without enlarging touch controls unnecessarily. Model rows still select the exact engine ID; variants retain their current group owner.
- [ ] Run affected selector tests, lint and TypeScript once. Inspect the diff and commit only this task's files.

## Task 2: Reference command availability and compatibility matrix

**Files:**
- Modify `frontend/components/composer/WorkspaceReferenceSection.client.tsx`, `workspace-reference-copy.ts`, `frontend/src/styles/app-experience.css`.
- Create `frontend/components/composer/workspace-reference-availability.ts` for pure command availability, if necessary.
- Modify `frontend/app/(core)/(workspace)/app/_lib/workspace-reference-fields.ts` to preserve incoming restrictions.
- Test `tests/workspace-reference-availability.test.ts`, `tests/workspace-reference-model-matrix.test.ts` and existing progressive-reference/command/Recents behavior contracts.

**Interfaces:** Continue consuming exact `AssetFieldConfig[]` and the existing `assets` map. A command helper may expose `getReferenceCommandAvailability(entries, assets)` returning `{ addDisabled, canOpen, reasons }`; `canOpen` remains true when existing media needs management. Do not change `onAssetAdd`, `onAssetRemove`, `onOpenLibrary`, `onAssetUrlSelect` or Recents insertion signatures.

- [ ] Add red assertions for an upstream disabled entry and for empty locked compact commands. Example core preservation case:

```ts
const result = getWorkspaceReferenceFields([{ field, required: false, disabled: true, disabledReason: 'Model restriction' }], unlockedOptions);
assert.equal(result[0].disabled, true);
assert.equal(result[0].disabledReason, 'Model restriction');
```

- [ ] Build the model matrix from real runtime schemas and existing workflow owners. Cover unified Seedance 2.5/2.0/Fast/Mini with empty, start, end, reference image/video/audio and source-video inputs; Kling O3 with supported reference+frame combinations and source-video frame locks; Veo first/last versus reference mode; representative Happy Horse, Omni and Luma dedicated surfaces; required audio and source/mask preservation. Assert exact field identity, budget/mode delegation and no invented universal start/reference exclusion.
- [ ] Add stateful rendered interactions: adding a Seedance start locks reference addition; removing it unlocks; adding references locks empty start/end; a partially restricted collection still opens allowed fields; existing locked media can be removed; Library/Recents destinations inherit the same reasons; Escape returns focus to the stable command. Keep sparse-index and native-reader regressions.
- [ ] Preserve entry restrictions in `getWorkspaceReferenceFields`, then derive compact command state from its output. Use visible disabled styling and concise deduplicated reasons below the command row; blocked empty commands must not open import/library. Existing media management remains accessible. Popups continue mounting the original AssetDropzone controls and validators.
- [ ] Run focused tests red/green, affected architecture suites, lint and TypeScript. Keep the approved typography/icons/density and commit this bounded change.

## Task 3: Connected and visual qualification

**Files:** `docs/engineering/app-experience.md`, this plan and local ignored evidence. Root owns temporary browser fixtures and environment launchers; none enters production.

- [ ] Inspect available local backend configuration without printing secrets; identify remote versus local targets and review the wallet/catalogue/library/quote read handlers for side effects before connecting them. Use only the necessary configuration. Report exact remaining environment limitations rather than claiming a successful live generation from fixtures.
- [ ] Verify the real app selector against the canonical coverage inventory, including legacy search and category switching; inspect 1440/900/390/320 and short landscape where the browser supports emulation. Confirm full family labels, selection, price recalculation and no horizontal overflow.
- [ ] Mount actual components with controlled local assets to exercise the compatibility matrix without paid calls. Check light/dark, keyboard and touch-visible reasons, deletion/unlocking, popup handoff and exact callback identity. Capture before/after evidence and remove the complete temporary route before the build.
- [ ] Verify available connected wallet/history/catalogue/quote reads and existing validation/auth failure paths. Use existing disposable/fake-provider tests for accepted/pending/completed and invalid generation cases without billing. Distinguish this from actual provider success.
- [ ] Run focused checks first, then the full repository suite and production build if mode/input behavior changed. Preserve target-runtime and production-performance qualification limits.
- [ ] Obtain final independent review of this lot from `8d431d688` to its final source commit. Resolve material findings with one final fix wave and scoped review. Keep the branch and preview available for validation.
