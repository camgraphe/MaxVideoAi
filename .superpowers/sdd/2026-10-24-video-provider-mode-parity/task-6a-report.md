# Task 6A implementation receipt — 2026-10-24

Status: DONE_WITH_CONCERNS (application scope complete; external qualification and tariff prerequisites remain with controller/6B).
Base: `93f46b16ebaef2b7b2632d8d5d785b8dbfdecdd7`; branch `codex/video-provider-mode-parity`.
Worktree: `/Users/adrienmillot/.codex/worktrees/modify-workflow-release/MaxVideoAi V2`.

## Delivered boundaries

- Strict optional operation travels through shared video/audio/reference excerpt requests, initial policy, operation-specific schema validation, reauthorization, private-v3 derivative lineage and stale UI session fencing. Legacy omission adds no operation field to lineage and keeps Reference semantics. Kling Edit accepts its actual 3–15 second domain and validates measured dimensions; Reference remains 3–10 seconds. Luma/Enhance lineage cannot be manufactured by excerpts.
- Real HTTP → owned-media preparation → FFmpeg/probe → storage service → owned playback response is tested with storage/network/ownership IO injected at their owners. Whole unchanged FAST MOV is encoded into positively probed MP4; Relight uses the existing decoded 24fps/17n+5 owner with selected range. The user sees chosen duration, actual duration, decoded frames and ending removal before Apply. Original bytes, portrait geometry and audio are retained. Generic cadence and legacy source duration behavior are unchanged. A real test found generic persistence's millisecond container rounding incompatible with Relight's exact frame duration; only the Relight response now preserves independently decoded frames/24 after validating the persisted facts. Operation validation was not weakened.
- New Kling Modify selects explicit Edit; new Create video references select explicit Reference. Old omitted v2v links/snapshots stay omitted Reference. Explicit operation links, removal, selection switches and legacy links are tested. Existing H3/FLUX mode links infer the supported default operation. Unsupported generic prompt/timing/frame/audio aliases are absent from specialized source requests; no-prompt workflows hide the composer prompt without deleting saved text.
- Four Site entry gaps are closed: Luma3.2 owned-generation Extend, LTX2.3 Reframe, FLUX base Keyframes and FLUX Draft Keyframes. Operation choice and custom source/keyframe controls precede affected inputs. Functional touched copy is EN/FR/ES. Existing FLUX Max keyframes and native FLUX Draft Extend remain supported.
- The owned-generation picker lists successful owned job outputs directly, including outputs without a media_assets row. It revalidates current canonical provider lineage, handles pagination/saved source/recovery and never asks for typed IDs. Absent/raw/mismatched qualified cache provenance is distinguished without provider IO on GET. Application job/output identities are public-safe; provider/cache identifiers remain private. Historical Draft selection does not enter quote state until explicit recovery succeeds; account/source changes discard late completions.
- Explicit MCP prepare and Studio video.prepare can recover an eligible historical native Draft using the canonical bounded recovery owner, then re-resolve. Studio first authorizes attached/project output and validates capability settings. Read-only model listing, pricing.read and history GET do not recover, decode or bootstrap schema. Missing/null cache is a safe unavailable error; busy is retryable; normal exact quote/confirm remains mandatory.
- Public recreation recipes strip only private source job/output binding (top level and extra input values), keeping prompt, operation and reusable settings. Authenticated personal job recall retains binding and still revalidates the owner server-side. No public media was migrated.
- Seedance's 50-reference request authority is restored within the shared 66-input transport ceiling; Luma64 keyframes remain valid. Updated exact Studio descriptions, MCP mode-order expectations, H3 explicit-operation executability assertions, Luma source-first fixtures and session-key architecture contract. The generation orchestrator is now 493 lines under its unchanged <500 gate; owned lineage/accepted-job replay has a meaningful owner in prepare-generation-lineage.ts.
- Independent 38-entry mode/source-field inventory crosses the actual engines HTTP projection in ordinary/admin contexts. All expected actions and operation-specific prompt/timing/settings are asserted. Native Seedance2.5 Draft is exercised in t2v/i2v/ref2v/v2v/extend. Private Gemini Retake workspace capability and its deliberate MCP exclusion remain intact; new H3 Extend/Insert/Reframe remain pending by settled human decision.

## Red/green and verification commands

Commands ran from the worktree above. Logs are local `/tmp/task6a-*.log`, not repository artifacts. No timeouts, budgets, assertions or checks were weakened.

1. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-excerpt-prepare.test.ts tests/audio-excerpt-prepare.test.ts`
   Initial operation regressions: red (Edit rejected / mismatched operation behavior). Initial green: 15 tests. Relight consent/profile regression red then green with `tests/h3-relight-media.test.ts` included: 18 tests. Logs: excerpt-red/green, relight-red/green.
2. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-provider-mode-matrix.test.ts tests/workspace-requested-workflow-dom.test.ts`
   Four Site/action/intent regressions red (14/18); green 18/18. Logs: actions-red/green.
3. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/flux-draft-explicit-preparation.test.ts tests/flux-ltx-studio-source.test.ts`
   Explicit MCP/Studio recovery red against omitted preparation (2 actual boundary failures), restored implementation green 11/11. Logs: recovery-red/green. Test price 222 cents is an explicitly injected test fixture, not a tariff/fallback.
4. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-options-review-regressions.test.ts tests/video-generation-service-parity.test.ts`
   Red: per-model 50 bound and >500 owner. Green after restoring per-model admission and extracting lineage owner (subsequent integration command includes both). Logs: boundary-red/green; boundary-more diagnosed exact stale Studio/MCP fixtures.
5. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-operation-copy-http-storage.test.ts tests/mcp-special-video-modes.test.ts tests/workspace-extend-inputs.test.ts tests/workspace-extend-composer-dom.test.ts`
   47/48, with the real Relight storage-duration mismatch as the only failure. Corrected at the measured-response boundary; HTTP copy test subsequently green in fields log and the 99-test media run. Fixture corrections are positive owned-source/operation assertions, not skipped coverage.
6. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-excerpt-*.test.ts tests/audio-excerpt-*.test.ts tests/client-video-excerpt.test.ts tests/h3-relight-media.test.ts tests/video-operation-copy-http-storage.test.ts`
   **99/99 passed, zero skipped**. Log: media. Includes real encodes/probes, private persistence, no original mutation, output validation, access/storage regressions and selector behavior. Synthetic 25fps rotated H264/AAC MOV is used for HTTP copy integration; this is not the user's real phone file or live Vercel storage.
7. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-*-contract.test.ts tests/workspace-requested-workflow-dom.test.ts tests/workspace-video-settings.test.ts tests/workspace-example-recreation-dom.test.ts tests/workspace-video-excerpt-dom.test.ts tests/workspace-extend-inputs.test.ts tests/workspace-extend-composer-dom.test.ts tests/video-provider-mode-matrix.test.ts tests/owned-generation-source-picker*.test.ts tests/seedance-draft-workspace*.test.ts tests/seedance-options-review-regressions.test.ts tests/video-generation-service-parity.test.ts tests/studio-capability-projection.test.ts tests/mcp-special-video-modes.test.ts tests/flux-ltx-studio-source.test.ts`
   195/196 initially passed; only old `key={asset.url}` architecture expectation failed. Updated it to require URL **and operation** fencing. Focused rerun below passed; unrelated green tests were not repeated. Log: integration.
8. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-provider-mode-fields.test.ts tests/workspace-assets-hook-contract.test.ts`
   **5/5 passed**. Log: matrix-final. Independent inventory covers 38 entries across real HTTP normal/admin projections. Native operation-cap records are distinguished from native keyframe mode inference; Create's intentional cross-mode inputs and private Gemini Retake keep their existing behavior.
9. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-provider-mode-fields.test.ts tests/seedance-draft-workspace-dom.test.ts`
   All 6 Draft DOM cases passed (including added t2v/i2v), one initial inventory expectation for implicit native keyframes failed and was corrected to explicit capability-record semantics; matrix-final above is green. Log: fields-green.
10. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-provider-mode-fields.test.ts tests/video-excerpt-selector-dom.test.ts tests/flux-draft-explicit-preparation.test.ts`
    38/39, only initial matrix expectation around Gemini's private unified Retake UI failed; actual independent explicit expectation fixed and matrix-final is green. All disclosure/recovery tests passed. Log: matrix-ui.
11. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-generation-request-helpers.test.ts tests/workspace-preflight-request.test.ts tests/audio-excerpt-prepare.test.ts`
    42/43, only old Luma action list omitted Extend. Added the now-required Extend action; `pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern='workspace unifies Luma' tests/workspace-generation-request-helpers.test.ts` passed 1/1. Specialized outgoing alias/frame omission and optional-audio-operation tests passed. Logs: outgoing, luma-entry-fix.
12. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/owned-generation-source-picker*.test.ts`
    **3/3 passed** after final readiness provenance check. Log: picker-final. Includes actual picker DOM with explicit prepare and stale account/source completion rejection, no typed ID input, and absent/raw/matching cache states.
13. `node scripts/run-postgres-tests.mjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/owned-generation-sources-postgres.test.ts`
    **1/1 passed** on automatically selected PostgreSQL17. Log: picker-postgres-final. Real SELECTs plus real canonical lineage resolvers prove ownership isolation, missing media_assets, current successful native attempts, exact original URLs and exclusion of Draft Extend.
14. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/workspace-requested-workflow-dom.test.ts`
    **14/14 passed**, then added default-operation link cases and ran `pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-name-pattern='existing mode links' tests/workspace-requested-workflow-dom.test.ts`: **3/3 passed**. Logs: links-final, default-links.
15. `pnpm --prefix frontend exec tsc --noEmit`: passed (tsc-final2).
16. `npm --prefix frontend run lint`: passed, 0 errors / 6 pre-existing warnings in untouched image workspace, Studio conversation img readers, and billing (lint-close). Final changed picker/engine-hook/public-reuse/server inventory lint: `pnpm --prefix frontend exec eslint 'app/(core)/(workspace)/app/_components/OwnedGenerationSourcePicker.client.tsx' 'app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts' 'app/(core)/(workspace)/app/_lib/workspace-shared-video-snapshot.ts' server/generations/owned-operation-sources.ts`: passed without warnings.
17. `npm run lint:exposure`: passed. `pnpm model:registry:check`: passed; generated catalog/roster unchanged. `git diff --check`: passed.

## Preview QA seams (controller-owned, unpaid)

- Kling new Edit: `/app?engine=kling-o3-pro&mode=v2v&operation=kling-edit`; explicit Reference: same with `operation=kling-reference`; legacy: omit operation. `.app-mode-switch [data-composer-mode="v2v"]` and `[data-composer-mode="create"]` distinguish intent. `[data-testid="video-operation-selector"]` appears before affected sources. Check retained settings, clear/reload/account switch and no unsupported duration/aspect/fps/generated-audio control for Edit.
- Luma: `/app?engine=luma-ray-3-2&mode=extend`. Draft Enhance: `/app?engine=flux-3-draft&mode=v2v&operation=flux-draft-enhance`. `[data-testid="owned-generation-source-picker"]` (also `data-operation`) contains an accessible native select and readable job labels; `[data-testid="prepare-owned-draft"]` is the explicit recovery button. No raw source/provider/cache ID text field. GET `/api/jobs/source-options?operation=...` is read-only; POST `/api/jobs/{jobId}/draft-cache` is explicit preparation. Verify a successful personal output without media_assets and an unavailable cache; do not generate.
- FAST: `/app?engine=flux-3&mode=v2v&operation=flux-fast-edit`. Relight: `/app?engine=minimax-h3-max&mode=v2v&operation=h3-relight`. `.video-excerpt-trigger` opens the modal; `[role="dialog"]`, labeled start/end inputs, `[data-testid="video-compatible-copy-disclosure"]` and localized Apply/Cancel cover confirmation. POST `/api/uploads/video/excerpt` carries strict operation, and Relight additionally acceptedCopyDurationSec. Whole MOV selection must still create a distinct private MP4. Confirm original retrieval/playback, portrait/audio, no paid generation, account/source/op cancellation and temporary preview URLs. Server functions: `createVideoExcerptPostHandler`, `prepareVideoExcerpt`, `persistVideoExcerpt`, `prepareH3RelightCopy`.
- LTX: `/app?engine=ltx-2-3&mode=reframe&operation=ltx23-reframe`. FLUX base/Draft/Max Keyframes: `/app?engine=flux-3[or -draft/-max]&mode=ref2v`. `[data-testid="video-keyframe-editor"][data-engine-id="..."]` identifies the shared editor. Check all supported keyframe indexes/references/settings at desktop/mobile widths.
- Public reuse: shared published recipe must preserve prompt/settings but require own eligible source. Personal authenticated `/api/jobs/{id}` recall must preserve valid private binding; different account cannot adopt it. The server remains authoritative even if client values are altered.
- Studio/MCP: explicit Enhance prepare may recover, read-only pricing must not. Neither read path nor prepare creates a paid render. Confirm/requote still needs exact active tariffs.

## Remaining concerns / explicit non-claims

- No live browser/Vercel test or real user phone-file import was performed here. Controller owns reviewed push, preview deployment, migration79 application/configuration and unpaid desktop/mobile real import/excerpt QA. HTTP/storage tests above inject IO; they are not live S3/Vercel evidence.
- Task6B owns operation tariff inventory/compiler/cutover. Root reported production revision1798 lacks operation cells and 12 Veo combinations; this agent did not read or change production tariffs. Missing exact prices remain closed, with no runtime fallback. Final Quality CI/financial lanes/release remain controller/6B duties.
- No external database/service/environment/client-media writes, render, paid submission, push, PR, deploy or migration occurred. No agents were spawned. Untracked `.serena/` and `PASSATION-VIDEO-MODES-2026-10-24.md` are preserved.
- Self-review covered the diff and new owners: private/public reuse separation, operation defaults vs omission, no read-route mutation, exact output checks, bounded asynchronous ownership, source aliases, library identity, missing-cache feedback, provider secret non-projection and architecture threshold preservation. Independent review is the controller's next gate.

## Scoped files

- `docs/engineering/flux-ltx-source-operations.md`
- `docs/engineering/video-provider-mode-parity-matrix.md`
- `frontend/app/(core)/(workspace)/app/_components/LumaRay32KeyframeEditor.tsx`
- `frontend/app/(core)/(workspace)/app/_components/VideoOperationSelector.tsx`
- `frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx`
- `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts`
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoExcerpt.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-hydration.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-shared-video-snapshot.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection.ts`
- `frontend/app/api/preflight/_lib/preflight-request.ts`
- `frontend/components/Composer.tsx`
- `frontend/components/composer/composer-types.ts`
- `frontend/components/media/VideoExcerptControl.client.tsx`
- `frontend/components/media/VideoExcerptSelector.client.tsx`
- `frontend/lib/client-video-excerpt.ts`
- `frontend/lib/video-operation.ts`
- `frontend/server/video-excerpts/flux-ltx-source.ts`
- `frontend/server/video-excerpts/h3-relight.ts`
- `frontend/server/video-excerpts/prepare-audio.ts`
- `frontend/server/video-excerpts/prepare.ts`
- `frontend/src/server/agent-api/generation-pricing-read.ts`
- `frontend/src/server/agent-api/prepare-generation.ts`
- `frontend/src/server/studio/conversation-media-generation.ts`
- `frontend/src/server/studio/flux-draft-source.ts`
- `frontend/src/server/video-generation/execute-video-generation.ts`
- `frontend/types/engines.ts`
- `tests/audio-excerpt-prepare.test.ts`
- `tests/fixtures/video-provider-mode-parity.ts`
- `tests/mcp-special-video-modes.test.ts`
- `tests/seedance-draft-workspace-dom.test.ts`
- `tests/studio-capability-projection.test.ts`
- `tests/video-excerpt-prepare.test.ts`
- `tests/video-excerpt-selector-dom.test.ts`
- `tests/video-generation-service-parity.test.ts`
- `tests/video-provider-mode-matrix.test.ts`
- `tests/workspace-assets-hook-contract.test.ts`
- `tests/workspace-extend-composer-dom.test.ts`
- `tests/workspace-extend-inputs.test.ts`
- `tests/workspace-generation-request-helpers.test.ts`
- `tests/workspace-requested-workflow-dom.test.ts`
- `tests/workspace-video-excerpt-dom.test.ts`
- `tests/workspace-video-settings.test.ts`
- `frontend/app/(core)/(workspace)/app/_components/OwnedGenerationSourcePicker.client.tsx`
- `frontend/app/api/jobs/source-options/route.ts`
- `frontend/lib/owned-generation-source.ts`
- `frontend/server/generations/owned-operation-sources.ts`
- `frontend/server/prepare-flux-draft-source.ts`
- `frontend/server/video-excerpts/operation-policy.ts`
- `frontend/src/server/video-generation/prepare-generation-lineage.ts`
- `tests/fixtures/video-provider-field-parity.ts`
- `tests/flux-draft-explicit-preparation.test.ts`
- `tests/owned-generation-source-picker-dom.test.ts`
- `tests/owned-generation-source-picker.test.ts`
- `tests/owned-generation-sources-postgres.test.ts`
- `tests/video-operation-copy-http-storage.test.ts`
- `tests/video-provider-mode-fields.test.ts`
