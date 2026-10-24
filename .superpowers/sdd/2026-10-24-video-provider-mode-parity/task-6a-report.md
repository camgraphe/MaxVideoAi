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


# Task6A follow-up — hosted findings and scoped CI coherence (2026-10-24)

Base: `f5c7b3c9e409b712b585049480fd97c9eeb8b977` (6B independently reviewed). This section supersedes the original Task6A status only for the follow-up changes. The original implementation, read-only Linux/phone/Studio diagnosis and earlier evidence remain above and in `task-6a-linux-diagnostic.md`. No financial policy, tariff inventory, wallet, provider capability, provider limit, CI selection or test timeout changed.

## Implemented boundaries

- **Relight:** MP4 video track timescale is explicitly 24. Decoded 24fps/CFR, 17n+5 frames, exact accepted duration, rotation, audio, original hash and existing 90s encoding / 45s probing bounds remain enforced. Model-limit text uses the selector's existing locale-aware formatter; the numeric policy is unchanged. The existing media test passes with both Mac and bundled Linux binaries. The prior read-only actual 4K phone-MOV Linux measurement remains applicable to this exact option; it is not a hosted qualification claim.
- **Native FLUX Draft provenance:** the private resolver accepts one exact completed provider attempt, or one exact authoritative enqueue followed by completed queue evidence for the current owned native job/output/provider ID. New standard Fal submissions persist a versioned native endpoint and digest of the final server-built wire request. The shared writer covers Site, MCP and Studio callers and both enqueue and synchronous result paths. Queue-status callbacks cannot swallow this proof; repeated callbacks do not duplicate it. Legacy non-Draft tracker deduplication is unchanged.
- **Historical canonical recovery:** only strict canonical native Draft requests (explicit engine, mode, surface, schema version, settings, references/roles, matching queue slots and prompt length) derive the corresponding native endpoint. Their exact server-stored snapshot digest is rechecked. Native Extend, Enhance, imports, conflicting attempts, missing/ambiguous queue proof and insufficient historical Web snapshots fail closed. No client cache/endpoint claim is accepted and no historical provider attempt is invented. Future Web snapshots use the newly persisted standard-writer proof, so they do not depend on the historical canonical fallback.
- **Private proof lifecycle:** exact owner, ready first output, original URL/hash, current provider request, authoritative proof, then the existing provider GET/cache/decoded video-and-audio pair comparison remain mandatory. Persistence locks the owned job/output and rechecks the proof in its transaction; quote/submit readers resolve it again. Picker DTOs expose neither provider/cache URLs nor proof hashes. Migration 80 explicitly upgrades an already-created 79 table with a nullable real attempt ID and discriminated private origin. The PostgreSQL test applies 79, inserts an old row, applies 80 twice and proves that row is preserved. Existing attempt-origin cache identities/fingerprints remain readable.
- **Optional cache capture:** `fal-webhook-draft-cache.ts` owns the post-output, post-settlement, post-lifecycle optional recovery hook. Failure cannot undo or resubmit paid completion. Unrelated webhook fixtures inject that optional owner explicitly; the handler remains within its existing 690-line architecture cap. No read-route mutation or schema bootstrap was introduced.
- **H3 Max Create:** duplicate media field variants are treated as alternatives, and the displayed picker selects the active/creation variant. Valid frame-plus-reference ref2v reaches the real builder, including ordered middle frames and image/video/audio references. Frame-only i2v, independent target soundtrack, H3/Wan incompatible-mixture rejection and invalid H3 Max order/resolution rejection remain covered. New H3 Extend/Insert/Reframe remain pending as instructed.
- **Source and quote UI:** Luma 3.2 Extend and FLUX Draft Enhance require their owned source and a current successful preflight before enabling the real composer action. Valid zero-cent preflights remain allowed. The existing pricing gate clears the prior quote on source/mode changes. This does not change wallet policy or general pricing. Active operation fields/payload/price use the operation projection; mode navigation uses complete engine capabilities. FAST/Enhance ↔ native Extend works in both directions with Draft settings preserved and the old quote invalidated. Promptless operations use their exact `promptRequired` contract; other prompts remain required.
- **Connected Studio test:** application state was already keyed by user/project and is unchanged. The browser test now observes the successful creation POST, requires a different returned project ID and waits for that exact route within the existing 30s navigation allowance. Its post-navigation Open timeline 5s visibility assertion is unchanged. The bounded delayed-response diagnosis already proved why matching the old route caused the false failure.

## Focused red/green evidence

Commands ran from this worktree. `T` below denotes exactly `pnpm exec tsx --tsconfig frontend/tsconfig.json --test`; file lists below are the arguments for the named focused invocation. Logs are local review evidence under `/tmp`, not committed production artifacts. Counts are per invocation and overlap; they must not be summed as distinct coverage.

| Area | Red evidence | Completed green evidence |
| --- | --- | --- |
| H3 inference | `/tmp/task6a-fix-h3-red.log`: actual H3 Max reference case selected i2v instead of ref2v. | `T tests/workspace-multimodal-reference-workflow.test.ts tests/h3-source-operations.test.ts`: **52/52**, `/tmp/task6a-fix-h3-final.log`. |
| Mac Relight/selector | Prior Linux failure and actual-phone timing are recorded in the diagnostic. | `h3-relight-media` and selector cases passed in `/tmp/task6a-fix-h3-green.log` (86/87 overall; its sole obsolete H3 Max mixed-input expectation was then corrected and passed in the 52/52 run). No media assertion was relaxed. |
| Linux Relight | Baseline bundled Linux stream duration 5.166992 failed the unchanged exact-duration validation. | Existing `h3-relight-media.test.ts` bundled for Linux: **2/2**, `/tmp/task6a-h3-linux-green.log`, 1.19s; exact command below. |
| Historical Draft | `/tmp/task6a-fix-flux-red.log`: owned canonical no-attempt Draft rejected with REFERENCE_INVALID. | `T tests/flux-draft-provenance.test.ts tests/flux-draft-origin-provenance-postgres.test.ts tests/flux-draft-cache-postgres.test.ts tests/owned-generation-sources-postgres.test.ts`: **7/7**, `/tmp/task6a-flux-final.log`. Actual disposable PG17, no remote DB. |
| Existing FLUX recovery/writer | Existing proof fixtures needed the explicit origin discriminator; first PG fixture also lacked the now-read queue table. | `T tests/fal-enqueue-generation.test.ts tests/generate-provider-job-tracker.test.ts tests/generate-fal-submission.test.ts tests/flux-draft-cache.test.ts tests/flux-draft-recovery.test.ts tests/flux-draft-explicit-preparation.test.ts tests/owned-generation-source-picker.test.ts`: **46/46**, `/tmp/task6a-fix-flux-fast.log`. |
| Additional writer/PG proof | New actual wire-body digest, future Web/canonical proof and repeated migration coverage. | `T tests/flux-draft-origin-provenance-postgres.test.ts tests/fal-enqueue-generation.test.ts tests/generate-fal-submission.test.ts`: **27/27**, `/tmp/task6a-fix-flux-proof.log`; migration upgrade also **1/1**, `/tmp/task6a-flux-upgrade-green.log`. |
| Queue status before request callback | `T tests/fal-enqueue-generation.test.ts tests/generate-provider-job-tracker.test.ts`: **9 pass/1 fail**, `/tmp/task6a-tracker-order-red.log`; expected one persisted native proof, observed zero. | `T tests/fal-enqueue-generation.test.ts tests/generate-provider-job-tracker.test.ts tests/generate-fal-submission.test.ts`: **30/30**, `/tmp/task6a-tracker-order-green.log`. Actual `generateVideo` callback and real tracker; duplicate concurrent hooks persist one enqueue; ordinary tracker behavior retained. |
| Webhook boundary | `/tmp/task6a-fix-webhook-red.log`: 11/15; old fixtures pulled optional recovery and architecture exceeded 690 lines. | Optional helper and persistence/sanitization checks passed in `/tmp/task6a-fix-webhook-green.log` (16/17; only 691-line cap remained). Final 690-line architecture checks all passed in `/tmp/task6a-fix-coherence-green.log`. No threshold changed. |
| Promptless Enhance | `/tmp/task6a-promptless-red.log`: exact Enhance projection incorrectly required absent prompt. | Source workflow coverage passed in `/tmp/task6a-workspace-final.log`; actual Enhance zero-cent action passed in final browser run below. |
| Workspace contracts | Intermediate broad fixture expectations failed when they treated every Modify as an upload or required the generic Composer to own the Surface's source gate. | `T tests/workspace-multimodal-reference-workflow.test.ts tests/workspace-requested-workflow-dom.test.ts tests/workspace-source-workflow-coverage.test.ts tests/workspace-pricing-lifecycle-dom.test.ts tests/workspace-modify-composer-dom.test.ts tests/workspace-composer-state-hook-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts tests/workspace-draft-and-surfaces-contract.test.ts tests/workspace-omni-ui-contract.test.ts`: **154/155**, `/tmp/task6a-workspace-final.log`; only the incorrectly placed generic Composer gate assertion failed. The corrected Composer fixture then passed **17/17**, `T tests/workspace-modify-composer-dom.test.ts`, `/tmp/task6a-composer-final.log`. The actual source gate remains asserted through the real Surface/browser. |
| Mode/field/read-route contracts | Existing negative/public DTO boundaries preserved. | `T tests/video-provider-mode-fields.test.ts tests/video-provider-mode-matrix.test.ts tests/video-generation-service-parity.test.ts tests/read-route-schema-latency-contract.test.ts tests/owned-generation-source-picker-dom.test.ts tests/workspace-generation-request-helpers.test.ts`: **36/36**, `/tmp/task6a-contracts-final.log`. |
| Actual source browser | `/tmp/task6a-browser-source*.log` reproduced Luma enabled without source/quote, Enhance disabled despite valid source/zero price, and FAST hiding Extend. Fixture synchronization then needed to observe its actual held request, without changing timeouts. | `T tests/seedance-edit-workspace-browser.test.ts`: **1/1, 0 skip, 70 source workflows desktop/mobile**, Chromium 147.0.7727.15, **20.55s**, `/tmp/task6a-browser-source-final.log` (also preceding green6 run 20.70s). Real engine mode hook, operation schemas, pricing hook, composer Surface and owned picker; local HTTP/provider responses are injected. This is not live Vercel or live tariff evidence. |

Coherence files and completed evidence: `generate-extra-input-values`, `mcp-media-contract`, `mcp-p0-video-parity`, `p0-launch-readiness`, `p1-video-round1-security-integration`, `validate-request`, `workspace-pricing-lifecycle-dom`, `workspace-source-workflow-coverage` and final `fal-webhook-architecture` pass in `/tmp/task6a-fix-coherence-green.log`. That batch was **209/219**, with only raw engine order, new whole-body expectations and Modify fixture ownership still failing. Whole P0 request bodies then pass in `/tmp/task6a-fix-coherence-last.log`; exact raw registry/caps ordering passes **7/7** in `/tmp/task6a-browser-source-green2.log`; all Modify cases pass in `/tmp/task6a-composer-final.log`. The other batch failures were the browser defects now covered above. No unresolved failure is being represented as a passing batch.

The P0 fixtures retain all original 27 tuples and add four explicit native keyframes/FAST/Enhance tuples for 31. Whole wire bodies include the server-only qualified Enhance seam and reject an unqualified caller. Veo accepts the authorized 4/6/8s matrix while rejecting 5s. MCP internal reference facts and middle-frame role are typed; public DTO secret exclusions remain. These are capability/coherence changes, not tariff/snapshot weakening.

MCP canonical command `pnpm --prefix frontend run qa:mcp-tool-selection` first reported stale policy fixture in `/tmp/task6a-mcp-canonical-red.log`. After reviewing its canonical reported digest, only the fixture policy fingerprint changed to `35c0f9e9b5d2e1e8ea75c36c8d65d907e54ba7294e14355625c1ca33ca2a24d9`; all 70 curated decisions and fixture data hash remain unchanged. `pnpm mcp:client:check` passed **177 tests, 1 existing intentional skip, 0 failures**, including the canonical evaluator and metadata budgets, `/tmp/task6a-mcp-client.log`. Earlier ad-hoc TS collector invocations did not produce a usable fingerprint (including one ESM export error); they are not counted as successful regeneration/evidence. No hosted MCP result is claimed.

Exact Linux test command (existing tests and assertions; only native package resolution externalized for Linux):

```sh
pnpm exec node - <<'JS'
const {build}=require('esbuild');
build({entryPoints:['tests/h3-relight-media.test.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',outfile:'/tmp/task6a-h3-relight-linux-test.cjs',plugins:[{name:'linux-native-binaries',setup(b){b.onResolve({filter:/^\.\.\/frontend\/node_modules\/@ffmpeg-installer\/ffmpeg$/},()=>({path:'@ffmpeg-installer/ffmpeg',external:true}));}}]}).catch(()=>process.exit(1));
JS
docker run --rm --platform linux/amd64 -v /tmp/task6a-h3-relight-linux-test.cjs:/tmp/h3-test.cjs:ro -e NODE_PATH=/app/node_modules:/app/frontend/node_modules --entrypoint node maxvideoai-openai-review:main500-final --test /tmp/h3-test.cjs
```

Other completed checks:

- `pnpm --prefix frontend exec tsc --noEmit` — exit 0, final `/tmp/task6a-fix-typecheck-final.log` empty after the callback-order fix. Initial missing-return type error was fixed; no type bypass.
- `npm --prefix frontend run lint` — exit 0, 0 errors and six existing warnings in unchanged image/Studio/billing files, `/tmp/task6a-fix-lint.log`.
- `npm run lint:exposure` — exit 0, Public exposure check passed, `/tmp/task6a-fix-exposure.log`.
- `pnpm model:registry:check` — exit 0; 56 models, 2 tombstones, current 56-entry projections, unchanged 55-entry roster, `/tmp/task6a-fix-registry.log`.
- `git diff --check` — clean. No generated registry projection changed. New `*-postgres.test.ts` is selected by the existing integration filename rule; no CI selection change required.

## Candidate handoff and last verification

All completed checks are above. **At this candidate commit, the single connected Studio browser invocation is still pending.** Its fixture uses `git archive HEAD`, so it will run only after this candidate is committed, and that HEAD will remain unchanged until the result. Command: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/connected-studio-conversation-browser-integration.test.ts`. Its result and exact candidate SHA will be appended in a report-only commit. Root may review this frozen candidate read-only during that run; review corrections must wait for its completion.

Self-review covered the source/proof union, exact wire-body hashing, queue callback ordering, migration-79 compatibility, owned original/pair revalidation, public DTO non-disclosure, optional cache failure isolation, operation-vs-navigation boundaries, valid zero-price action, prompt requirements and preserved architecture limits. The only 6B fixture adjustment is the explicit `{kind:'provider_attempt'}` origin discriminator; 6B financial logic and Studio source resolver are unchanged. Root's separate f5c initial-cutover replay passed 27,071 checkpoints; it was not rerun or claimed as verification of this follow-up.

## Root qualification seams and remaining gates

- Apply reviewed **79 then 80 for a fresh schema, or 80 after existing 79** on root's intended preview only; no migration was applied externally here. Production has no assumed schema state.
- Requalify the actual owned historical FLUX Draft through GET `/api/jobs/source-options?operation=flux-draft-enhance&sourceJobId=...`, explicit POST `/api/jobs/{jobId}/draft-cache`, and picker readiness. `[data-testid="owned-generation-source-picker"]`, `[data-testid="prepare-owned-draft"]` and the real Generate action remain stable. Cache availability/TTL is not guaranteed; insufficient proof or expired cache remains an explicit ineligible source, with original Draft still usable.
- Relight actual phone QA: `/app?engine=minimax-h3-max&mode=v2v&operation=h3-relight`, `.video-excerpt-trigger`, dialog and `[data-testid="video-compatible-copy-disclosure"]`, POST `/api/uploads/video/excerpt` with accepted copy duration. Confirm decoded facts, original hash, private ownership and 390×844 overflow. FAST route and policy remain unchanged. Prior hosted 429 cause is still unattributed; prior direct 500 is not claimed fixed on Vercel until root's new preview test.
- Source navigation: `.app-mode-switch [data-composer-mode="extend"]` and `[data-composer-mode="v2v"]`; `video-operation-selector`; FAST/Enhance↔Extend must preserve compatible Draft settings and clear old quote. The local fixture's `data-form`/`data-quote` instrumentation is test-only.
- Studio: exact successful new project ID/route, heading, Projects dialog dismissal, Open timeline and empty timeline remain the observable seams. No application navigation/state workaround was added.
- Root owns independent review, full required Quality CI (including selected integration/browser/financial lanes), reviewed Git push, actual Vercel/phone tests and any release. Task7 owns marketing/comparison coherence. No paid generation, remote writes, push, deployment, client-media mutation, schema/tariff/config changes or subagents occurred. Existing `.serena/` and `PASSATION-VIDEO-MODES-2026-10-24.md` remain untracked and untouched.

## Follow-up scoped files

- `.superpowers/sdd/2026-10-24-video-provider-mode-parity/task-6a-report.md`
- `docs/engineering/flux-ltx-source-operations.md`
- `docs/engineering/mcp-client-experience.md`
- `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-multimodal-workflow.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection.ts`
- `frontend/app/api/generate/_lib/fal-submission.ts`
- `frontend/app/api/generate/_lib/provider-job-tracker.ts`
- `frontend/components/media/VideoExcerptSelector.client.tsx`
- `frontend/server/fal-webhook-draft-cache.ts`
- `frontend/server/fal-webhook-handler.ts`
- `frontend/server/flux-draft-cache-store.ts`
- `frontend/server/flux-draft-cache.ts`
- `frontend/server/flux-draft-provenance.ts`
- `frontend/server/generations/owned-operation-sources.ts`
- `frontend/server/video-excerpts/h3-relight.ts`
- `frontend/src/lib/fal-types.ts`
- `frontend/src/lib/fal.ts`
- `neon/migrations/80_flux_draft_origin_provenance.sql`
- `tests/connected-studio-conversation-browser-integration.test.ts`
- `tests/fal-enqueue-generation.test.ts`
- `tests/fal-provider-diagnostic-sanitization.test.ts`
- `tests/fal-webhook-architecture.test.ts`
- `tests/fal-webhook-content-persistence.test.ts`
- `tests/fal-webhook-draft-cache.test.ts`
- `tests/fixtures/mcp-media-type-contract.ts`
- `tests/fixtures/mcp-tool-selection-curated-policy.json`
- `tests/flux-draft-cache-postgres.test.ts`
- `tests/flux-draft-cache.test.ts`
- `tests/flux-draft-explicit-preparation.test.ts`
- `tests/flux-draft-origin-provenance-postgres.test.ts`
- `tests/flux-draft-provenance.test.ts`
- `tests/flux-draft-recovery.test.ts`
- `tests/generate-extra-input-values.test.ts`
- `tests/generate-fal-submission.test.ts`
- `tests/generated-video-persistence.test.ts`
- `tests/helpers/studio-video-workflow-fixtures.ts`
- `tests/mcp-media-contract.test.ts`
- `tests/mcp-p0-video-parity.test.ts`
- `tests/owned-generation-source-picker.test.ts`
- `tests/owned-generation-sources-postgres.test.ts`
- `tests/p0-launch-readiness.test.ts`
- `tests/p0-video-engine-contracts.test.ts`
- `tests/p0-video-request-bodies.test.ts`
- `tests/p1-video-round1-security-integration.test.ts`
- `tests/seedance-edit-workspace-browser.test.ts`
- `tests/validate-request.test.ts`
- `tests/workspace-modify-composer-dom.test.ts`
- `tests/workspace-multimodal-reference-workflow.test.ts`
- `tests/workspace-pricing-lifecycle-dom.test.ts`
- `tests/workspace-source-workflow-coverage.test.ts`

### Connected Studio candidate invocation — compilation correction

Candidate `17c4eda7bdd5e8712f773c347787eec2e993327d` was frozen for the specified single browser command. It exited before initializing any browser/runtime: the new local `created` binding collided with the existing montage creation binding in the same test scope. `/tmp/task6a-connected-studio-final.log`: transform error at line 381, 0 pass / 1 test-file failure, 0.82s. This is an implementer test-compilation defect, not an application/browser failure. Renamed the new binding to `newConversation` only; no assertion, application code or timing changed. The same browser command will run again on the next frozen commit; all application checks above remain valid.
