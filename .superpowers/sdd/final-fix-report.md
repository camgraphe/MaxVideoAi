# Final commercial-trust review correction report

Date: 2026-07-11

## Result

All three whole-branch review findings were addressed in one correction pass:

- I-1: shared-video hydration now claims a shared-video id only after the engine catalog is ready, applies the snapshot and starts job hydration once for that id, ignores same-id effect replays caused by engine/callback revalidation, and resets the claim when the shared video clears or its id changes.
- M-1: the watch-page prompt breakdown now omits the `Recorded render cost` row when no stored cost label exists. It no longer shows `Shown before render`.
- M-2: the muted, control-less inline Examples gallery video is explicitly `aria-hidden="true"`; the full-card watch link retains its localized accessible name.

No resolver fallback, notice clearing, URL cleanup, auth, pricing, generation, polling, upload, draft precedence, route, or structured-data behavior was changed.

## Root cause and implementation

The existing engine-readiness predicate delayed shared-video hydration, but the effect still depended on callbacks rebuilt from SWR engine payloads and `engineMap`. Because `sharedVideoSettings` remains populated after URL cleanup, same-id engine revalidation could replay both the local snapshot application and job request, overwriting edits made after recreation.

The correction adds a small pure state transition, `claimSharedVideoHydration`, and a hook-owned `appliedSharedVideoIdRef`. The effect updates the ref from the transition and returns through a single one-shot guard before both `applyVideoSettingsSnapshot(...)` and `hydrateVideoSettingsFromJob(...)`. A changed id with no engines clears the old claim, a ready changed id is claimable, and clearing shared-video state resets the claim so the same id can be intentionally applied again later.

The commercial-copy and accessibility changes are intentionally local: one conditional array spread in `VideoWatchContent` and one ARIA attribute on the inline gallery video.

## TDD evidence

### I-1 RED

Command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-video-settings.test.ts tests/workspace-video-settings-hook-contract.test.ts
```

Observed result: exit 1; 1 passed, 3 failed. The behavioral tests failed because `claimSharedVideoHydration` did not exist, and the hook contract failed because there was no applied-id ref or one-shot guard.

### I-1 GREEN

Same command after the minimal implementation:

```text
tests 4
pass 4
fail 0
```

Coverage proves zero engines → ready → same-id/same-count revalidation starts snapshot application and job hydration once, preserves a simulated visitor edit, resets on a changed id while waiting, applies the new id when ready, resets on clear, and permits reapplication after clear. The hook source contract proves the ref-backed claim guard appears before both effect operations.

### M-1 RED

Command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/watch-page-commercial-copy.test.ts
```

Observed result: exit 1; 2 passed, 1 failed. The new absence-case contract found the unconditional recorded-cost row and the `Shown before render` fallback.

### M-1 GREEN

Same command after the minimal implementation:

```text
tests 3
pass 3
fail 0
```

### M-2 RED

Command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/examples-commercial-copy.test.ts tests/examples-gallery-architecture.test.ts
```

The first draft assertion was discovered to be too broad because it could cross the closing `<video>` tag and match the later CTA's `aria-hidden`. It was tightened before any production edit to `/<video[^>]*aria-hidden="true"[^>]*>/` and rerun.

Observed corrected RED result: exit 1; 3 passed, 2 failed. Both failures specifically reported that the inline video lacked `aria-hidden="true"`.

### M-2 GREEN

Same command after adding the video attribute:

```text
tests 5
pass 5
fail 0
```

The tests continue to require `aria-label={watchAnchorText}` on the full-card link and separately require the visual CTA to remain hidden from the accessibility tree.

## Requested focused validation

Command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-video-settings.test.ts tests/workspace-video-settings-hook-contract.test.ts tests/watch-page-commercial-copy.test.ts tests/video-page-architecture.test.ts tests/watch-page-signals-architecture.test.ts tests/examples-commercial-copy.test.ts tests/examples-gallery-architecture.test.ts
```

Result:

```text
tests 18
pass 18
fail 0
cancelled 0
skipped 0
```

## Static and repository-wide validation

- `cd frontend && npm run lint` — exit 0, no ESLint errors or warnings.
- `cd frontend && ./node_modules/.bin/tsc --noEmit` — exit 0.
- `git diff --check` — exit 0.
- `npm run lint:exposure` — exit 0, `Public exposure check passed.`
- `pnpm run test:validate` — exit 0; 1,584 passed, 0 failed, 0 cancelled, 0 skipped.

## Files changed

Production:

- `frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts`
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings.ts`
- `frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx`
- `frontend/components/examples/ExampleGalleryCard.tsx`

Tests:

- `tests/workspace-video-settings.test.ts`
- `tests/workspace-video-settings-hook-contract.test.ts`
- `tests/watch-page-commercial-copy.test.ts`
- `tests/examples-commercial-copy.test.ts`
- `tests/examples-gallery-architecture.test.ts`

Report:

- `.superpowers/sdd/final-fix-report.md`

## Self-review

- The applied shared-video id is marked before either hydration operation, so Strict Mode/effect re-entry and same-id callback identity changes cannot start a second application.
- A temporary zero-engine catalog cannot claim an id or invoke the resolver. If the id changes while engines are unavailable, the old claim is discarded and the new id waits for readiness.
- Clearing `sharedVideoSettings` resets the ref transition; the same id can be applied again only after that explicit clear/change lifecycle.
- The hook effect still uses `engines.length`, leaving resolver matching and fallback untouched.
- The guard dominates both snapshot application and job hydration, as asserted by the hook contract.
- The no-cost change affects only the prompt-breakdown row; existing detail-row derivation and JSON-LD are untouched.
- The gallery video remains muted, looping, inline, control-less, and visually unchanged. Only its accessibility-tree exposure changes; the watch-link action name remains required by tests.
- Architecture size contracts remain within their limits: `workspace-video-settings.ts` 418 lines (limit 430), `VideoWatchContent.tsx` 357 lines (limit 360), and `ExampleGalleryCard.tsx` 189 lines (limit 230).

## Concerns

None identified. The requested behaviors and the broader 1,584-test suite are green, and the correction stays within the reviewed surfaces.
