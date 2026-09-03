# P1 Video Model Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Gemini Omni Flash 1.1, Kling 3 Turbo Standard, Kling 3 Turbo Pro, and MiniMax H3 Max as one production-ready P1 release with correct direct-provider routing, fallback behavior, public pages, pricing, MCP parity, examples, scoreboards, SEO preservation, and production playlist attachment.

**Architecture:** Keep `frontend/config/model-registry.json` as the authored identity and publication source, use dedicated provider adapters behind the existing generation router, keep commercial pricing in `packages/pricing` with factual provider calculators in `frontend/src/lib`, and project public model data into marketing, comparison, sitemap, and MCP surfaces. Build every model unpublished first, generate and review its launch media through the normal admin workflow, then publish the whole P1 atomically after runtime, content, pricing, SEO, and observability gates pass.

**Tech Stack:** Next.js App Router, TypeScript, React, Vitest/Node test runner, Neon/Postgres, Vertex AI Interactions API, Kling direct API, Fal fallback endpoints, generated model-registry projections, Search Console OAuth/API, MCP tools.

**Spec:** `docs/superpowers/specs/2026-09-03-p1-video-model-refresh-design.md`

## Global Constraints

- Preserve the canonical `gemini-omni-flash` route and every currently indexed Gemini comparison URL. Upgrade their visible contract to 1.1 without creating a second canonical Gemini model page.
- Add one-hop aliases `gemini-omni-flash-1-1` and `gemini-omni-1-1-flash` through the model registry. Do not introduce a public “Gemini Omni Flash 1.0” identity.
- Route Gemini directly through Google. Do not add a Fal fallback for Gemini.
- Route Kling Turbo directly through Kling first and use Fal only for portable pre-acceptance failures. Never fall back after a direct task ID exists.
- Keep Kling Turbo direct-first even while the current Kling account is unfunded:
  activate the mapped direct route, allow the observed pre-acceptance depleted
  balance response to fall back once to Fal, and never fall back after a direct
  task ID exists. A future funded accepted task must use the existing direct
  poller; lack of provider credit does not block this P1 release.
- Keep MiniMax H3 and MiniMax H3 Max as separate public models. H3 Max uses Fal internally but public UI, metadata, comparison copy, pricing, documentation, and MCP responses must say MiniMax/Hailuo only.
- Preserve MiniMax H3's generic search intent and existing page signals. Target exact `MiniMax H3 Max` intent only on the H3 Max page, and centralize overlapping decision content on the comparison page instead of duplicating it across both model pages.
- Treat `MaxVideoAI` as the publisher/site entity, not as an extra H3 Max keyword. Preserve its existing natural publisher mentions and the normal title suffix, but do not repeat “Max” beyond the actual H3 Max model name and the single reciprocal decision link to manufacture token overlap.
- Exclude Runway and MiniMax H3 Max Turbo from this release.
- Give every shipped model all 11 benchmark scores. A missing measurement blocks publication; it must never become a blank, zero-by-default, `N/A`, or invented value.
- Produce exactly eight accepted launch videos: two per P1 model target. Prompts must be unique across the pack, include people, scenes, and product imagery, and use multishot where it demonstrates Kling Turbo.
- Submit paid generations only after one aggregate quote is shown and explicitly confirmed. Space accepted submissions by at least 10 seconds. A retry requires a new quote and confirmation.
- Publish videos as ordinary public gallery videos and attach them to the correct model and family playlists. Do not enroll them in the video-SEO editorial/watch-page rollout during P1.
- Comparison pages remain scoreboard/specification pages without side-by-side media or explanatory copy promising future comparison renders.
- Treat pricing, MCP, model pages, comparison pages, menus, internal links, examples, localized metadata, and sitemap projections as one launch contract.
- Do not add a database migration unless implementation uncovers a genuine persisted-data contract change. The expected result is no schema migration.
- Expected sitemap delta: seven new English canonical routes and 21 new localized `<url><loc>` entries—nine model entries and 12 comparison entries. Gemini aliases and the existing Gemini canonical route add zero.
- Preserve unrelated working-tree files and generated media directories.

---

## Task 1: Freeze Live Provider, Pricing, SEO, and Release Evidence

**Files:**

- Create: `docs/model-launch/p1-video-model-refresh-evidence.md`
- Create: `tests/p1-video-model-refresh-evidence.test.ts`
- Reference: `docs/superpowers/specs/2026-09-03-p1-video-model-refresh-design.md`

**Interfaces:**

- Evidence headings: `Scope`, `Google`, `Kling Direct`, `Kling Fal Fallback`, `MiniMax H3 Max`, `Pricing Inputs`, `Search Console`, `Release Gates`.
- Machine-checked identifiers: `gemini-omni-flash`, `kling-3-turbo-standard`, `kling-3-turbo-pro`, `minimax-h3-max`.
- Release-gate states: `proven`, `blocked`, `not-applicable`.

- [ ] Write a failing evidence contract test that requires the four model IDs, the exact Fal endpoint names, the four preserved Gemini comparison slugs, the two Gemini aliases, a no-Runway assertion, and a launch gate for Kling direct access.

```ts
const scopeIds = parseEvidenceModelIds(evidence)
assert.deepEqual(scopeIds, [
  'gemini-omni-flash',
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
])
assert.match(evidence, /fal-ai\/kling-video\/v3\/turbo\/standard\/text-to-video/)
assert.match(evidence, /minimax\/h3-max\/reference-to-video/)
assert.match(evidence, /Kling direct publication gate:\s+(proven|blocked)/)
```

- [ ] Run `pnpm exec tsx --test tests/p1-video-model-refresh-evidence.test.ts` and confirm it fails because the evidence file does not exist.
- [ ] Create the evidence file with dated primary-source URLs and exact observed contracts. Include Google’s model/deprecation/changelog pages, all seven Fal endpoint pages, and the direct Kling account probe result.
- [ ] Record the Search Console evidence from 2026-06-01 through 2026-08-31: 809 Gemini-query impressions, 11 clicks, 310 impressions for `gemini omni flash`, 98 for `gemini omni flash vs veo 3.1`, and the existing comparison-page preservation decision.
- [ ] Record the H3 baseline from the same period: queries containing `minimax h3` produced 756 impressions, 17 clicks, 2.2% CTR, and average position 14.9; exact `minimax h3 max` produced 350 impressions, six clicks, 1.7% CTR, and average position 7.6. Record its current URL ownership: ES H3 page 261 impressions/six clicks/position 5.9, FR H3 page 74/zero/9.5, EN H3 page 15/zero/26.9.
- [ ] Record the current `invalid_grant` failure of the local/admin Search Console refresh token as an operational launch blocker without storing any token or secret.
- [ ] Quote the smallest Google and Kling contract probes, present their combined maximum debit, and wait for explicit confirmation before sending either request. Space the two accepted submissions by at least 10 seconds.
- [ ] For Google, execute the confirmed minimal authenticated staging request using the exact Vertex Interactions model ID documented for the account. Record the accepted provider model ID and response envelope; do not infer it from the public Gemini API alias.
- [ ] For Kling Turbo, use the configured staging account to execute the confirmed smallest billable Standard request. Record the accepted path, request keys, task ID location, status values, output location, and error envelope.
- [ ] If the Kling probe fails for access, auth, or unsupported model, set
  `Kling direct publication gate: blocked` and stop P1 publication. If it fails
  only for the observed depleted prepaid balance before acceptance, keep the
  mapped direct route active and prove the explicitly enabled one-time Fal
  fallback instead of requiring provider funding.
- [ ] For H3 Max, fetch the live OpenAPI schemas and record the exact 480P and 768P per-second prices, duration bounds, end-frame field, reference-token formula, and whether native audio is automatic or configurable. The evidence test must reject a missing 480P rate.
- [ ] Run the evidence test again and confirm it passes.
- [ ] Commit the evidence contract.

```bash
git add docs/model-launch/p1-video-model-refresh-evidence.md tests/p1-video-model-refresh-evidence.test.ts
git commit -m "docs: freeze p1 provider and seo evidence"
```

## Task 2: Generalize Launch Assets from P0 to Versioned Waves

**Files:**

- Create: `frontend/config/model-launch-waves.ts`
- Create: `scripts/generate-model-launch-assets.ts`
- Modify: `frontend/config/model-launch-readiness-schema.ts`
- Modify: `frontend/server/model-launch-assets-validation.ts`
- Modify: `frontend/config/model-launch-readiness.generated.json`
- Modify: `frontend/server/model-launch-assets.generated.json`
- Modify: `package.json`
- Delete: `scripts/generate-p0-launch-assets.ts`
- Create: `tests/model-launch-waves.test.ts`
- Modify: `tests/p0-launch-readiness.test.ts`

**Interfaces:**

```ts
export type ModelLaunchWave = {
  id: 'p0' | 'p1'
  sourceManifest: string
  models: readonly { modelId: string; familyId: string; requiredVideos: 2 }[]
}
```

- Preserve the exported `MODEL_LAUNCH_READY_MODELS` name so current consumers do not need a synchronized rewrite.
- Add `waveId` to each generated readiness and asset entry.
- P1 mappings: Gemini → `veo`, both Kling Turbo variants → `kling`, H3 Max → `hailuo`.

- [ ] Write failing tests that load both launch waves, preserve every existing P0 model, require exactly two videos for each P1 target, and reject duplicate accepted video IDs across waves.
- [ ] Add a generated-schema fixture test proving a missing P1 source manifest leaves P0 validation intact but marks the P1 wave unready.
- [ ] Run `pnpm exec tsx --test tests/model-launch-waves.test.ts tests/p0-launch-readiness.test.ts` and confirm the new expectations fail.
- [ ] Implement `model-launch-waves.ts` as the only authored wave-to-model mapping.
- [ ] Generalize the generator to read each configured source manifest, normalize accepted generation records, attach `waveId`, and keep deterministic ordering by wave, model, and video ID.
- [ ] Rename package scripts to `model:launch-assets:generate` and `model:launch-assets:check`; keep temporary compatibility aliases for `model:p0-launch-assets:*` during this release.
- [ ] Regenerate the current projections. P1 must be present as unready until Task 9 creates its accepted manifest.
- [ ] Run the focused tests and `pnpm model:launch-assets:check`.
- [ ] Commit the wave abstraction.

```bash
git add frontend/config/model-launch-waves.ts frontend/config/model-launch-readiness-schema.ts frontend/server/model-launch-assets-validation.ts frontend/config/model-launch-readiness.generated.json frontend/server/model-launch-assets.generated.json scripts/generate-model-launch-assets.ts scripts/generate-p0-launch-assets.ts package.json tests/model-launch-waves.test.ts tests/p0-launch-readiness.test.ts
git commit -m "refactor: support versioned model launch waves"
```

## Task 3: Upgrade Gemini Omni Flash Runtime to 1.1

**Files:**

- Modify: `frontend/src/config/fal-engines/gemini-omni-flash.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-omni/model-map.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-omni/payload.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-omni/media-input.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-omni/client.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-omni/cost.ts`
- Create: `frontend/src/lib/google-omni-pricing.ts`
- Modify: `frontend/src/lib/pricing-context.ts`
- Modify: `frontend/src/lib/pricing-billing-facts.ts`
- Modify: `frontend/src/lib/pricing-public-facts.ts`
- Modify: `docs/engineering/google-vertex-omni.md`
- Modify: `tests/google-vertex-omni-engine-catalog.test.ts`
- Modify: `tests/google-vertex-omni-payload.test.ts`
- Modify: `tests/google-vertex-omni-client.test.ts`
- Modify: `tests/google-vertex-omni-runtime.test.ts`
- Create: `tests/google-omni-pricing.test.ts`

**Interfaces:**

```ts
export type GoogleOmniPricingInput = {
  outputResolution: '360p' | '720p' | '1080p' | '4k'
  outputDurationSec: number
  inputImageCount: number
  inputVideoDurationSec: number
}
```

- Public modes: `t2v`, `i2v`, `ref2v`, `fl2v`, `v2v`, `extend`, `retake`.
- Public durations: integer seconds from 3 through 10.
- Public aspect ratios: `16:9`, `9:16`.
- Direct provider remains `google-vertex-omni`; launch stage becomes `ga` only if the account probe accepted the GA ID.

- [ ] Extend the existing tests first so they expect “Gemini Omni Flash 1.1”, all four resolutions, first/last frame, extension, and the account-proven provider model ID from Task 1.
- [ ] Add payload tests proving first/last-frame requests serialize two ordered images, extension carries one owned source video, and ordinary i2v still serializes one start image.
- [ ] Add negative tests for 11-second output, unsupported ratios, missing source video for `extend`, and direct requests that attempt a Fal provider.
- [ ] Add pricing tests using Google’s exact token rates: 1,931/5,792/8,688/17,376 output tokens per second, $17.50 per million output tokens, 1,120 tokens per input image, 5,792 tokens per input-video second, and $1.50 per million input tokens.
- [ ] Run the focused Gemini suite and confirm the new assertions fail.

```bash
pnpm exec tsx --test tests/google-vertex-omni-engine-catalog.test.ts tests/google-vertex-omni-payload.test.ts tests/google-vertex-omni-client.test.ts tests/google-vertex-omni-runtime.test.ts tests/google-omni-pricing.test.ts
```

- [ ] Update the engine schema and provider map using the exact provider model ID proven in Task 1.
- [ ] Implement the new payload branches while preserving the existing Vertex service-account, `global` location, Interactions API, GCS upload, and polling architecture.
- [ ] Implement `calculateGoogleOmniProviderCostCents()` with integer-cent rounding only at the final money boundary. Pass verified image counts and source-video duration through `PricingContext`; reject an exact quote when required media duration metadata is absent.
- [ ] Update billing facts, public pricing facts, provider attempt cost estimates, and the engineering guide from the same calculator.
- [ ] Run all focused tests and confirm they pass.
- [ ] Commit the Gemini runtime upgrade.

```bash
git add frontend/src/config/fal-engines/gemini-omni-flash.ts frontend/src/server/video-providers/google-vertex-omni frontend/src/lib/google-omni-pricing.ts frontend/src/lib/pricing-context.ts frontend/src/lib/pricing-billing-facts.ts frontend/src/lib/pricing-public-facts.ts docs/engineering/google-vertex-omni.md tests/google-vertex-omni-*.test.ts tests/google-omni-pricing.test.ts
git commit -m "feat: upgrade Gemini Omni Flash to 1.1"
```

## Task 4: Add Kling 3 Turbo Engine Contracts and Fal Fallbacks

**Files:**

- Create: `frontend/src/config/fal-engines/kling-3-turbo-shared.ts`
- Create: `frontend/src/config/fal-engines/kling-3-turbo-standard.ts`
- Create: `frontend/src/config/fal-engines/kling-3-turbo-pro.ts`
- Modify: `frontend/src/config/fal-engines/registry.ts`
- Create: `frontend/src/lib/kling-3-turbo.ts`
- Create: `tests/kling-3-turbo-engine-catalog.test.ts`
- Create: `tests/kling-3-turbo-request-body.test.ts`
- Create: `tests/kling-3-turbo-pricing.test.ts`

**Interfaces:**

- Engine IDs: `kling-3-turbo-standard`, `kling-3-turbo-pro`.
- Fal endpoints: the four exact Standard/Pro text-to-video and image-to-video endpoints recorded in Task 1.
- Modes: `t2v`, `i2v`.
- Duration: integer 3–15 seconds.
- Text ratios: `16:9`, `9:16`, `1:1`.
- Multishot: one to six prompts, mutually exclusive with a single prompt, total duration at most 15 seconds.
- Commercial provider-cost ceiling: 11.2 cents/second for Standard and 14 cents/second for Pro until the direct account cost is proven lower.

- [ ] Write failing catalog tests for names, 720p Standard, 1080p Pro, exact modes, ratios, native audio capability, and absence of Runway/H3 Max Turbo.
- [ ] Write request-body tests for single-prompt t2v, required-image i2v, six-segment multishot, mixed single/multishot rejection, and segment-duration overflow.
- [ ] Write pricing tests for 3-, 5-, 10-, and 15-second requests at both tiers.
- [ ] Run the three new test files and confirm they fail before the engine files exist.
- [ ] Implement the shared schema and thin Standard/Pro engine modules. Map only fields that the live Fal schemas accept.
- [ ] Implement one portable request normalizer used by both Fal fallback and the direct adapter. Include an end frame only if Task 1 proved a common field on both routes.
- [ ] Register both engines and keep them hidden from public catalog projections until Task 7.
- [ ] Run the focused tests and `pnpm engine:catalog`.
- [ ] Commit the fallback contracts.

```bash
git add frontend/src/config/fal-engines/kling-3-turbo-shared.ts frontend/src/config/fal-engines/kling-3-turbo-standard.ts frontend/src/config/fal-engines/kling-3-turbo-pro.ts frontend/src/config/fal-engines/registry.ts frontend/src/lib/kling-3-turbo.ts tests/kling-3-turbo-*.test.ts
git commit -m "feat: add Kling 3 Turbo engine contracts"
```

## Task 5: Implement Kling Turbo Direct-First Routing

**Files:**

- Modify: `frontend/src/server/video-providers/kling-direct/model-map.ts`
- Modify: `frontend/src/server/video-providers/kling-direct/index.ts`
- Modify: `frontend/src/server/video-providers/kling-direct/capabilities.ts`
- Modify: `frontend/src/server/video-providers/kling-direct/cost.ts`
- Modify: `frontend/src/server/video-providers/router.ts`
- Modify: `frontend/app/api/generate/_lib/kling-direct-submission.ts`
- Modify: `frontend/server/kling-direct-poll.ts`
- Modify: `tests/kling-provider-routing.test.ts`
- Modify: `tests/kling-direct-poll.test.ts`
- Create: `tests/kling-3-turbo-direct-contract.test.ts`
- Create: `tests/kling-3-turbo-fallback.test.ts`

**Interfaces:**

```ts
type KlingTurboVariant = 'standard' | 'pro'
type KlingTurboDirectRequest = {
  promptSegments: readonly { prompt: string; durationSec: number }[]
  durationSec: number
  aspectRatio: '16:9' | '9:16' | '1:1'
  variant: KlingTurboVariant
  imageUrl?: string
}
```

- [ ] Add direct-contract tests from the exact rejected submit envelope captured
  in Task 1 and the existing shared V3 polling contract. Keep the Turbo IDs
  explicit even though they select the same provider model and endpoint family.
- [ ] Extend router tests so both Turbo IDs choose `kling_direct` first when enabled and record Fal as the fallback provider.
- [ ] Add fallback-matrix tests: network failure, timeout, 429, 5xx, and empty response may fall back before acceptance; moderation, invalid input, auth failure, nonportable input, or any returned task ID must not.
- [ ] Add poll tests proving the stored `provider_attempts.request_snapshot` selects the Turbo poll contract after process restart.
- [ ] Run the four Kling test files and confirm the new cases fail.
- [ ] Map both Turbo IDs into the existing V3 direct adapter around the observed
  account contract. Standard and Pro select `std`/`pro` explicitly, without
  changing the public model ID after submission.
- [ ] Implement response normalization into the existing provider result shape and record provider, provider model, task ID, request snapshot, estimated cost, and final output URL.
- [ ] Update direct cost estimation from the observed account contract. Keep the customer preflight ceiling at the verified Fal rate unless the direct rate is both lower and contractually stable.
- [ ] Implement pre-acceptance fallback with a single portable request object so fields cannot drift between direct and Fal attempts.
- [ ] Run the focused tests and existing Kling architecture suite.
- [ ] Commit the direct adapter.

```bash
git add frontend/src/server/video-providers/kling-direct frontend/src/server/video-providers/router.ts frontend/app/api/generate/_lib/kling-direct-submission.ts frontend/server/kling-direct-poll.ts tests/kling-provider-routing.test.ts tests/kling-direct-poll.test.ts tests/kling-3-turbo-direct-contract.test.ts tests/kling-3-turbo-fallback.test.ts
git commit -m "feat: route Kling 3 Turbo direct first"
```

## Task 6: Add MiniMax H3 Max Runtime and Exact Pricing

**Files:**

- Create: `frontend/src/config/fal-engines/minimax-h3-max.ts`
- Modify: `frontend/src/config/fal-engines/registry.ts`
- Create: `frontend/src/lib/minimax-h3-max.ts`
- Create: `frontend/src/lib/minimax-h3-max-pricing.ts`
- Modify: `frontend/src/lib/pricing-context.ts`
- Modify: `frontend/src/lib/pricing-billing-facts.ts`
- Modify: `frontend/src/lib/pricing-public-facts.ts`
- Create: `tests/minimax-h3-max-engine-catalog.test.ts`
- Create: `tests/minimax-h3-max-request-body.test.ts`
- Create: `tests/minimax-h3-max-validation.test.ts`
- Create: `tests/minimax-h3-max-pricing.test.ts`
- Create: `tests/minimax-h3-max-provider-privacy.test.ts`

**Interfaces:**

```ts
export type MinimaxH3MaxMode = 't2v' | 'i2v' | 'ref2v'
export type PromptExpansionMode = 'balanced' | 'quality'
```

- Resolution values: `480P`, `768P`, default `768P`.
- Text ratios: `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`.
- i2v requires a start image and accepts an end image only under the live field name proven in Task 1.
- ref2v accepts image, video, and audio references subject to live count and size limits.

- [ ] Write failing engine tests for identity, modes, resolution values, duration bounds from Task 1, ratios, native audio, and default `prompt_expansion_mode: 'balanced'`.
- [ ] Write failing body tests for all three endpoints, end-frame i2v, balanced/quality expansion, and mixed reference media.
- [ ] Write validation tests for missing start image, invalid reference type, duration overflow, resolution mismatch, and absent media metadata when an exact reference quote is required.
- [ ] Write factual pricing tests using the exact 480P/768P per-second values from Task 1 and the reference rule: first 4,096 tokens free, then $0.02 per 1,000 tokens. Keep fractional provider cost until the final cent conversion.
- [ ] Write provider-privacy tests that scan public engine details, validation messages, metadata, and MCP serialization for the strings `fal`, `fal.ai`, and endpoint paths.
- [ ] Run the five new tests and confirm they fail.
- [ ] Implement the engine and request builder. Keep H3 Max logic separate from `minimax-h3.ts` because its mode/resolution/reference pricing contract differs.
- [ ] Implement `calculateMinimaxH3MaxProviderCostCents()` and add verified reference token count to `PricingContext`. Reject exact paid submission before provider dispatch when the wallet preflight cannot derive the reference cost.
- [ ] Update billing/public pricing facts through the factual calculator and return only MiniMax/Hailuo branding to public consumers.
- [ ] Run the focused H3 Max suite and existing H3 regression suite.
- [ ] Commit H3 Max runtime support.

```bash
git add frontend/src/config/fal-engines/minimax-h3-max.ts frontend/src/config/fal-engines/registry.ts frontend/src/lib/minimax-h3-max.ts frontend/src/lib/minimax-h3-max-pricing.ts frontend/src/lib/pricing-context.ts frontend/src/lib/pricing-billing-facts.ts frontend/src/lib/pricing-public-facts.ts tests/minimax-h3-max-*.test.ts
git commit -m "feat: add MiniMax H3 Max runtime"
```

## Task 7: Register P1 Identities Unpublished and Regenerate Projections

**Files:**

- Modify: `frontend/config/model-registry.json`
- Generate: `frontend/config/model-runtime.json`
- Generate: `frontend/config/engine-catalog.json`
- Generate: `frontend/config/model-roster.json`
- Generate: `docs/model-roster.json`
- Generate: `docs/model-roster.csv`
- Modify: `frontend/config/model-families.ts`
- Modify: `frontend/config/navigation.ts`
- Create: `tests/p1-model-registry.test.ts`

**Interfaces:**

- Gemini remains family `veo`, category `video`, canonical slug `gemini-omni-flash`.
- Kling Turbo variants join family `kling`; neither replaces Kling 3 Standard/Pro.
- H3 Max joins family `hailuo`; neither replaces nor redirects MiniMax H3.
- New model publication flags remain false until Task 15.

- [ ] Write failing registry tests for the two Gemini aliases, three new identities, family membership, no replacement links, unpublished state, and no Runway/H3 Max Turbo identity.
- [ ] Add a one-hop redirect test for both Gemini aliases and a regression assertion that every existing canonical model slug still resolves to itself.
- [ ] Run the registry test and `pnpm model:registry:check`; confirm the new expectations fail.
- [ ] Edit only the authored registry and family/navigation configuration. Do not hand-edit generated projections.
- [ ] Run all four generation commands.

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
```

- [ ] Confirm generated projections contain the three new IDs as unpublished and the Gemini aliases as noncanonical redirects.
- [ ] Run `pnpm exec tsx --test tests/p1-model-registry.test.ts`.
- [ ] Commit the registry batch.

```bash
git add frontend/config/model-registry.json frontend/config/model-runtime.json frontend/config/engine-catalog.json frontend/config/model-roster.json frontend/config/model-families.ts frontend/config/navigation.ts docs/model-roster.json docs/model-roster.csv tests/p1-model-registry.test.ts
git commit -m "feat: register p1 video model identities"
```

## Task 8: Wire Workspace, Generation Validation, and MCP Parity

**Files:**

- Modify: `frontend/src/server/agent-api/model-catalog.ts`
- Modify: `frontend/src/server/agent-api/model-details.ts`
- Modify: `frontend/src/server/agent-api/generation-capability-validation.ts`
- Modify: `frontend/src/server/agent-api/paid-video-request-body.ts`
- Modify: `frontend/src/server/agent-runtime/model-executability.ts`
- Modify: `frontend/app/api/generate/_lib/validate.ts`
- Modify: `frontend/app/api/generate/_lib/generation-media-constraints.ts`
- Modify: `frontend/app/api/generate/_lib/generation-attachment-processing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- Modify: `docs/engineering/mcp-mode-coverage.md`
- Create: `tests/mcp-p1-video-parity.test.ts`
- Modify: `tests/mcp-special-video-modes.test.ts`
- Create: `tests/p1-workspace-capabilities.test.ts`

**Interfaces:**

- MCP must expose the exact same public modes, durations, ratios, resolutions, reference requirements, and pricing inputs as the workspace.
- Gemini `retake` remains closed in MCP when it requires a private previous-interaction ID; `fl2v` and `extend` become public only after owned-media validation passes.
- P1 unpublished models may be invoked only through the existing authenticated launch-canary mechanism; they must not appear in the general public MCP catalog before Task 15.

- [ ] Write parity tests that compare registry/runtime capabilities against MCP details and workspace form options for all four P1 IDs.
- [ ] Add validation tests for Gemini first/last frame and extension, Kling multishot, and H3 Max typed references.
- [ ] Add privacy tests proving H3 Max public MCP output contains no Fal route/provider text and Kling public output describes Kling as primary without exposing fallback internals.
- [ ] Run the three focused tests and confirm failures.
- [ ] Update generic catalog/detail projection so no model-specific public fields are duplicated by hand.
- [ ] Extend paid request building and generation validation to normalize the new modes before routing. Use owned asset references and verified media metadata for every paid quote.
- [ ] Update workspace controls only where a capability is present; do not render disabled controls for unsupported modes.
- [ ] Update the MCP coverage guide with explicit reasons for any closed mode.
- [ ] Run focused tests plus current workspace contract tests.
- [ ] Commit runtime-surface parity.

```bash
git add frontend/src/server/agent-api frontend/src/server/agent-runtime/model-executability.ts frontend/app/api/generate/_lib frontend/app/'(core)'/'(workspace)'/app/_hooks/useWorkspaceEngineModeState.ts frontend/app/'(core)'/'(workspace)'/app/_components/WorkspaceComposerSurface.tsx docs/engineering/mcp-mode-coverage.md tests/mcp-p1-video-parity.test.ts tests/mcp-special-video-modes.test.ts tests/p1-workspace-capabilities.test.ts
git commit -m "feat: expose p1 capabilities in workspace and mcp"
```

## Task 9: Quote, Generate, and Approve the Eight Launch Videos

**Files:**

- Create: `docs/model-launch/p1-generation-brief.json`
- Create: `output/p1-model-launch/p1-generation-manifest.json`
- Create: `tests/p1-generation-brief.test.ts`
- Modify: `docs/model-launch/p1-video-model-refresh-evidence.md`

**Interfaces:**

```ts
type P1GenerationBrief = {
  modelId: string
  prompt: string
  mode: string
  durationSec: number
  aspectRatio: string
  intent: 'human' | 'scene' | 'product' | 'multishot'
}
```

- Required distribution: two briefs for each target; at least two human-led videos, two environment/action scenes, two commercial/product shots, and one Kling Turbo multishot.
- No prompt string or merely color-swapped prompt may be reused across models.

- [ ] Write a failing brief contract test requiring exactly eight entries, two per model, the required intent distribution, unique prompt hashes, at least one Kling multishot, and no recognizable public figure or trademark-dependent prompt.
- [ ] Run `pnpm exec tsx --test tests/p1-generation-brief.test.ts` and confirm it fails because the brief does not exist.
- [ ] Write the eight concrete briefs in the JSON file. Include one Standard and one Pro Kling concept that visibly distinguish speed/value from detail/finish; use multishot only where it sells the model.
- [ ] Validate all briefs against the live model constraints and run the brief contract test before requesting money.
- [ ] Request exact generation quotes for all eight briefs through the current pricing endpoint. Sum the maximum wallet debit and present model-by-model and aggregate costs to the user.
- [ ] Stop and wait for explicit confirmation of that aggregate quote. Earlier confirmations for other batches do not authorize this batch.
- [ ] After confirmation, submit each generation using the standard paid workflow, waiting at least 10 seconds after each accepted submission before sending the next.
- [ ] Persist generation ID, task ID, actual provider, accepted timestamp, final status, cost, output URL, prompt hash, and moderation outcome in the source manifest. Do not store provider credentials or signed URLs that expire.
- [ ] If a submission is rejected before acceptance, repair only the incompatible brief, recalculate the aggregate remaining quote, and obtain a fresh confirmation before retrying.
- [ ] Inspect every completed video for prompt adherence, motion, temporal consistency, anatomy, text artifacts, and audio behavior. Mark `accepted` only when it can represent the public model page.
- [ ] If a video fails editorial review, generate a distinct replacement under a fresh quote; never silently reuse another model’s video.
- [ ] Record the resulting qualitative observations in the evidence document for Task 11 scoring.
- [ ] Do not commit binary video files. Commit only the brief and manifest metadata after stripping expiring URLs.

```bash
git add docs/model-launch/p1-generation-brief.json output/p1-model-launch/p1-generation-manifest.json tests/p1-generation-brief.test.ts docs/model-launch/p1-video-model-refresh-evidence.md
git commit -m "content: record p1 launch video evidence"
```

## Task 10: Publish Videos Through the Normal Admin Workflow and Build P1 Readiness

**Files:**

- Modify: `frontend/config/model-launch-readiness.generated.json`
- Modify: `frontend/server/model-launch-assets.generated.json`
- Modify: `frontend/server/example-family-playlists.ts`
- Modify: `tests/p0-launch-readiness.test.ts`
- Create: `tests/p1-video-publication-readiness.test.ts`
- Reference: `frontend/app/(core)/admin/playlists/page.tsx`
- Reference: `frontend/app/api/admin/playlists/[playlistId]/items/route.ts`
- Reference: `frontend/app/api/admin/videos/[videoId]/visibility/route.ts`
- Reference: `frontend/app/(core)/admin/video-seo/`

**Interfaces:**

- Each accepted video becomes a normal public/discoverable gallery video.
- Each video receives its exact model playlist plus the `veo`, `kling`, or `hailuo` family playlist.
- `watchPageCandidate` remains false and no P1 video is added to the video-SEO editorial rollout.

- [ ] Add a failing readiness test requiring two unique accepted public videos per target, exact model/family playlist membership, durable production media URLs, and absence from the video-SEO editorial set.
- [ ] Run the readiness test and confirm it fails against the unimported staging manifest.
- [ ] In staging, publish the accepted jobs through the existing admin visibility workflow. Do not update database rows directly if the admin route can express the transition.
- [ ] Attach each accepted video to its exact model playlist and family playlist through the playlist admin API.
- [ ] Verify the videos appear in normal examples/gallery queries but do not appear as eligible indexed watch pages.
- [ ] Run `pnpm model:launch-assets:generate`, inspect the diff, then run `pnpm model:launch-assets:check`.
- [ ] Run the readiness and validation tests.
- [ ] Commit only generated readiness metadata and code/config changes. Production import and playlist attachment happen after deployment in Task 16.

```bash
git add frontend/config/model-launch-readiness.generated.json frontend/server/model-launch-assets.generated.json frontend/server/example-family-playlists.ts tests/p0-launch-readiness.test.ts tests/p1-video-publication-readiness.test.ts
git commit -m "content: prepare p1 model launch assets"
```

## Task 11: Build Complete Scoreboards and Comparison Routes

**Files:**

- Modify: `data/benchmarks/engine-scores.v1.json`
- Modify: `data/benchmarks/engine-key-specs.v1.json`
- Modify: `data/benchmarks/benchmark-methodology.v1.json`
- Modify: `frontend/config/compare-config.json`
- Modify: `frontend/config/compare-hub.json`
- Create: `content/comparisons/minimax-h3-max-vs-minimax-h3.json`
- Create: `content/comparisons/kling-3-turbo-pro-vs-kling-3-turbo-standard.json`
- Create: `content/comparisons/kling-3-turbo-pro-vs-kling-3-pro.json`
- Create: `content/comparisons/gemini-omni-flash-vs-kling-3-turbo-pro.json`
- Create: `tests/p1-benchmark-completeness.test.ts`
- Create: `tests/p1-comparison-pages.test.ts`

**Interfaces:**

- Required score keys: `fidelity`, `visualQuality`, `motion`, `consistency`, `anatomy`, `textRendering`, `lipsyncQuality`, `sequencingQuality`, `controllability`, `speedStability`, `pricing`.
- New canonical comparison slugs are the four filenames above.
- All four belong to `scoreboardOnlyComparisons`.

- [ ] Write a failing benchmark test that requires exactly 11 finite in-range scores and a complete key-spec row for each P1 model and every published model referenced by any comparison route. Reject null, omitted, `N/A`, zero-by-default, or duplicate evidence IDs, and reject any rendered scoreboard cell without a numeric source value.
- [ ] Write failing comparison tests for all four routes, both model links, localized metadata fallback, scoreboard presence, and absence of side-by-side/showdown/future-render promises.
- [ ] Add the eight accepted launch videos to the benchmark evidence set alongside the existing canonical prompt pack. Where the eight videos do not measure a criterion, run the relevant canonical benchmark prompt or use a dated primary-source fact for objective capabilities.
- [ ] Research any remaining factual gap using current official model documentation first and independent current tests second. Record every source URL and observation date in the methodology/evidence row.
- [ ] Assign all 11 scores from the shared rubric. Do not score provider marketing claims as observed quality and do not bias H3 Max because of its internal route.
- [ ] Update key specs with proven duration, resolution, audio, mode, reference, and pricing facts.
- [ ] Add the four minimal comparison content files and hub/config entries. Keep body copy concise and differentiating.
- [ ] Run benchmark and comparison tests plus existing benchmark architecture tests.
- [ ] Commit the benchmark/comparison batch.

```bash
git add data/benchmarks/engine-scores.v1.json data/benchmarks/engine-key-specs.v1.json data/benchmarks/benchmark-methodology.v1.json frontend/config/compare-config.json frontend/config/compare-hub.json content/comparisons tests/p1-benchmark-completeness.test.ts tests/p1-comparison-pages.test.ts
git commit -m "feat: add p1 scoreboards and comparisons"
```

## Task 12: Build Localized Model Pages Without Cannibalization

**Files:**

- Create: `content/models/en/kling-3-turbo-standard.json`
- Create: `content/models/fr/kling-3-turbo-standard.json`
- Create: `content/models/es/kling-3-turbo-standard.json`
- Create: `content/models/en/kling-3-turbo-pro.json`
- Create: `content/models/fr/kling-3-turbo-pro.json`
- Create: `content/models/es/kling-3-turbo-pro.json`
- Create: `content/models/en/minimax-h3-max.json`
- Create: `content/models/fr/minimax-h3-max.json`
- Create: `content/models/es/minimax-h3-max.json`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/kling-3-turbo.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/minimax-h3-max.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`
- Create: `tests/p1-model-marketing-pages.test.ts`
- Create: `tests/minimax-h3-max-cannibalization.test.ts`

**Interfaces:**

- H3 positioning: broad Hailuo flagship, high-resolution multimodal/reference control.
- H3 Max positioning: premium visual finish, prompt adherence, and focused fast production workflow.
- Kling Standard positioning: 720p value/speed.
- Kling Pro positioning: 1080p finish/detail.
- Query ownership: `/models/minimax-h3` owns generic MiniMax H3/4K/reference/control intent; `/models/minimax-h3-max` owns exact H3 Max/premium visual finish/prompt-adherence intent; the comparison page owns “H3 vs H3 Max” decision intent.
- GEO entity roles: both model pages use MiniMax as model brand/provider and MaxVideoAI only as publisher. Their structured names, descriptions, capability facts, and `about` entities remain distinct.

- [ ] Write failing tests that require three localized content files per new model, exactly two launch videos on each page, canonical/hreflang metadata, and no unsupported capability claim.
- [ ] Add anti-cannibalization tests proving H3 and H3 Max have distinct title/H1/description/search intent, link to each other once through the compact decision block, and never redirect between identities.
- [ ] Add ownership tests proving the existing H3 title, H1, lead, canonical, and primary internal anchors remain generic and do not absorb H3 Max positioning; only the H3 Max page may target the exact `MiniMax H3 Max` term in title and H1.
- [ ] Add structured-data tests proving `brand`/model provider is MiniMax and `publisher` is MaxVideoAI, without repeated `MaxVideoAI + H3 Max` phrasing outside the standard title suffix and single reciprocal link.
- [ ] Add public privacy tests scanning all H3 Max localized copy, metadata, JSON-LD, FAQ, and template output for `Fal`, `fal.ai`, or endpoint strings.
- [ ] Run the tests and confirm failures.
- [ ] Write concise EN/FR/ES model content. Preserve the current H3 title/lead structure except for one reciprocal decision link; place detailed overlap/differences on the comparison page. Reuse the existing page structure and avoid adding explanatory sections merely to describe internal provider behavior.
- [ ] Implement shared templates for the two Kling tiers and H3 Max, register them, and attach the two reviewed static media records per new model.
- [ ] Validate model claims against Task 1 evidence and Task 11 specs.
- [ ] Run the focused tests and existing model-page architecture tests.
- [ ] Commit the new model pages.

```bash
git add content/models frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-templates frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-template-registry.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-static-media.ts tests/p1-model-marketing-pages.test.ts tests/minimax-h3-max-cannibalization.test.ts
git commit -m "feat: add localized p1 model pages"
```

## Task 13: Update Existing Gemini Pages and Preserve SEO Equity

**Files:**

- Modify: `content/models/en/gemini-omni-flash.json`
- Modify: `content/models/fr/gemini-omni-flash.json`
- Modify: `content/models/es/gemini-omni-flash.json`
- Modify: `content/comparisons/gemini-omni-flash-vs-veo-3-1.json`
- Modify: `frontend/config/compare-config.json`
- Modify: `frontend/config/compare-hub.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`
- Modify: `docs/model-launch/gemini-omni-flash-seo-research.md`
- Modify: `docs/model-launch/gemini-omni-flash-cannibalization-map.md`
- Modify: `docs/model-launch/gemini-omni-flash-linking-plan.md`
- Modify: `tests/gemini-omni-marketing-surfaces.test.ts`
- Create: `tests/gemini-omni-1-1-seo-preservation.test.ts`

**Interfaces:**

- Preserved comparison slugs: `gemini-omni-flash-vs-veo-3-1`, `gemini-omni-flash-vs-veo-3-1-fast`, `gemini-omni-flash-vs-sora-2`, `gemini-omni-flash-vs-seedance-2-0`.
- All visible product naming becomes “Gemini Omni Flash 1.1”.
- Existing canonical and localized URL shapes remain unchanged.

- [ ] Write a failing SEO test that snapshots the five existing English canonicals, all localized alternates, the two alias redirects, and the absence of a new canonical `/models/gemini-omni-flash-1-1` page.
- [ ] Extend marketing tests to reject `Preview`, the old provider model ID, and claims limited to the former 720p contract.
- [ ] Add assertions that the Gemini model page resolves exactly the two newly accepted 1.1 videos and that all four existing comparison pages use 1.1 labels/specs/scores while remaining scoreboard-only without new media promises.
- [ ] Run the focused tests and confirm failures.
- [ ] Update the three model content files and comparison data in place. Preserve slugs, canonical generation, and current internal-link targets.
- [ ] Refresh SEO/linking documentation with the GSC evidence: model pages and comparison pages each retain meaningful visibility; the Seedance comparison is a CTR improvement target, not a redirect target.
- [ ] Run Gemini marketing, redirect, hreflang, compare, and sitemap tests.
- [ ] Commit the in-place Gemini upgrade.

```bash
git add content/models/en/gemini-omni-flash.json content/models/fr/gemini-omni-flash.json content/models/es/gemini-omni-flash.json content/comparisons/gemini-omni-flash-vs-veo-3-1.json frontend/config/compare-config.json frontend/config/compare-hub.json frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-static-media.ts docs/model-launch/gemini-omni-flash-*.md tests/gemini-omni-marketing-surfaces.test.ts tests/gemini-omni-1-1-seo-preservation.test.ts
git commit -m "seo: upgrade Gemini pages to Omni Flash 1.1"
```

## Task 14: Update Pricing, Menus, Examples, Internal Links, and LLM Discovery

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts`
- Modify: `frontend/config/navigation.ts`
- Modify: `frontend/config/model-families.ts`
- Modify: `frontend/server/example-family-playlists.ts`
- Modify: `frontend/lib/seo/llms-text.ts`
- Modify: `frontend/config/sitemap-timestamps.ts`
- Create: `tests/p1-pricing-surfaces.test.ts`
- Create: `tests/p1-navigation-and-linking.test.ts`
- Create: `tests/p1-examples-layout.test.ts`
- Create: `tests/p1-llms-discovery.test.ts`

**Interfaces:**

- Pricing surfaces consume canonical pricing facts; they do not copy raw provider rates into page modules.
- Menus add the Hailuo and Kling children without widening beyond the current responsive container.
- Examples retain current card proportions and wrap/fold behavior at desktop, tablet, and mobile breakpoints.

- [ ] Write failing pricing tests for all four P1 targets at representative durations/resolutions/modes and assert parity among checkout preflight, pricing page, pay-as-you-go content, and MCP quotes.
- [ ] Write failing navigation/linking tests requiring new model links from family pages, compare hub, relevant existing model pages, pricing, and examples—without changing existing canonical destinations.
- [ ] Write a layout regression test for model/family menu width and examples filters/cards at 1440, 1024, 768, and 390 CSS pixels.
- [ ] Write an LLM-discovery test requiring current model names and canonical URLs while forbidding Fal attribution for H3 Max.
- [ ] Run the four focused tests and confirm failures.
- [ ] Wire pricing page and pay-as-you-go data to the canonical pricing facts.
- [ ] Add model/family/menu links with responsive wrapping or horizontal scrolling consistent with the existing component, not fixed wider containers.
- [ ] Update examples family/model filters, family playlist mapping, internal link graph, LLM text, and sitemap modification timestamps.
- [ ] Run the focused tests and existing navigation/examples visual contract tests.
- [ ] Run pricing drift checks without regenerating the frozen baseline.

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
```

- [ ] If the intentional public pricing contract changes the frozen baseline, inspect and approve the exact diff before running the repository’s documented baseline-generation command.
- [ ] Commit the discovery/surface batch.

```bash
git add frontend/app/'(localized)'/'[locale]'/'(marketing)'/pricing frontend/app/'(localized)'/'[locale]'/'(marketing)'/pay-as-you-go-ai-video-generator/_content/index.ts frontend/config/navigation.ts frontend/config/model-families.ts frontend/server/example-family-playlists.ts frontend/lib/seo/llms-text.ts frontend/config/sitemap-timestamps.ts tests/p1-pricing-surfaces.test.ts tests/p1-navigation-and-linking.test.ts tests/p1-examples-layout.test.ts tests/p1-llms-discovery.test.ts
git commit -m "feat: link p1 models across public surfaces"
```

## Task 15: Publish P1 Atomically and Verify the Sitemap Delta

**Files:**

- Modify: `frontend/config/model-registry.json`
- Generate: `frontend/config/model-runtime.json`
- Generate: `frontend/config/engine-catalog.json`
- Generate: `frontend/config/model-roster.json`
- Generate: `docs/model-roster.json`
- Generate: `docs/model-roster.csv`
- Create: `tests/fixtures/p1-production-routes-before.json`
- Create: `tests/p1-atomic-publication.test.ts`
- Create: `tests/p1-sitemap-delta.test.ts`

**Interfaces:**

- Atomic state: either all three new identities are public or none are public.
- Expected new English canonical routes: three models plus four comparisons.
- Expected localized sitemap entries: nine model entries plus 12 comparison entries.

- [ ] Write a failing atomic-publication test that rejects a mixed public/private state and requires launch assets, pricing, localized content, score/spec rows, comparison config, MCP executability, and direct-provider gates before publication.
- [ ] Write a failing sitemap-delta test that compares the last production route fixture with the proposed projection and asserts exactly seven new English canonical routes and 21 localized `<loc>` entries.
- [ ] Add negative assertions that Gemini aliases, the existing Gemini page, preserved Gemini comparisons, Runway, and H3 Max Turbo add zero canonical URLs.
- [ ] Run the tests and confirm they fail while new model publication flags remain false.
- [ ] Verify the Kling direct mapping is active, the depleted-balance fallback
  is enabled and tested, all eight videos are accepted, P1 readiness is green,
  and no score/pricing/MCP/content field is missing.
- [ ] Flip all three new model identities to public in one authored registry edit.
- [ ] Regenerate every registry/catalog/roster projection and run the model registry check.
- [ ] Run the atomic publication and sitemap delta tests; inspect the generated URL list, not only the count.
- [ ] Commit the launch switch.

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
git add frontend/config/model-registry.json frontend/config/model-runtime.json frontend/config/engine-catalog.json frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv tests/p1-atomic-publication.test.ts tests/p1-sitemap-delta.test.ts
git commit -m "feat: publish p1 video models atomically"
```

## Task 16: Repair Search Console Refresh, Run Full QA, Deploy, and Attach Production Videos

**Files:**

- Modify only if a code defect is proven: `frontend/app/api/admin/seo/gsc/refresh/route.ts`
- Modify only if a code defect is proven: `tests/gsc-oauth-auth.test.ts`
- Create: `docs/model-launch/p1-production-runbook.md`
- Modify: `docs/model-launch/p1-video-model-refresh-evidence.md`

**Interfaces:**

- Search Console refresh must return a current `fetchedAt` value without `invalid_grant`.
- Production readiness requires successful generation smoke tests for Google direct, Kling direct, Kling fallback under a controlled pre-acceptance failure, and H3 Max.
- Production video attachment must use the same admin visibility and playlist APIs as staging.

- [ ] Re-authorize the Search Console OAuth client and rotate `GOOGLE_OAUTH_REFRESH_TOKEN` in local and production environment stores. Never print, commit, or paste the token into the runbook.
- [ ] Restart the local app and call the admin refresh route for `range=3m`. Verify current data replaces the stale May cache and the admin page shows the expected Gemini queries/pages.
- [ ] If refresh still fails with a fresh token, add a failing auth regression test that reproduces the exact response and fix only the proven route defect. If it succeeds, make no code change to the route.
- [ ] Run formatting and focused architecture checks.

```bash
git diff --check
npm --prefix frontend run lint
npm run lint:exposure
pnpm model:registry:check
pnpm model:launch-assets:check
pnpm pricing:audit
```

- [ ] Run all P1 tests plus the existing Gemini, Kling, H3, MCP, pricing, sitemap, hreflang, redirect, navigation, comparison, model-page, workspace, and video-SEO contract suites.
- [ ] Start the production build locally and smoke-test EN/FR/ES model routes, the four new comparisons, four preserved Gemini comparisons, pricing, examples, menus, alias redirects, workspace selectors, and MCP catalog/details/generate quote.
- [ ] Verify canonical, hreflang, JSON-LD, metadata, responsive layout, provider privacy, and no new console/hydration errors.
- [ ] Quote the final provider-route smoke pack, present its aggregate maximum debit, and wait for explicit confirmation. Then run one minimal staging generation per provider route with at least 10 seconds between accepted submissions. For Kling fallback, induce only a controlled pre-acceptance direct failure and confirm exactly one Fal attempt; do not create two accepted billable tasks.
- [ ] Write the production runbook with exact deploy SHA, expected sitemap delta, environment gates, smoke URLs, playlist IDs, rollback conditions, and post-launch queries.
- [ ] Push the reviewed commit series and deploy the same SHA. Confirm the deployment is production, not the MCP staging project.
- [ ] Import/publish the eight accepted videos in production through the normal admin video workflow, then attach each to its exact model and family playlists.
- [ ] Verify the production examples/model pages resolve durable production media URLs. Confirm none of the eight is enrolled in the video-SEO editorial/watch-page rollout.
- [ ] Submit or refresh sitemaps only after the production routes return 200 with correct canonicals.
- [ ] Monitor Search Console coverage, impressions, CTR, server/provider errors, fallback rate, wallet reconciliation, and broken-media logs for 72 hours. Pay special attention to the preserved Gemini/Seedance comparison CTR and one-hop alias behavior.
- [ ] Record H3/H3 Max query-to-URL ownership at launch, day 7, and day 28. Exact `minimax h3 max` impressions should consolidate onto the H3 Max canonical while generic `minimax h3`, 4K, reference, and control queries remain assigned to the H3 canonical; investigate duplication or a material generic-H3 decline before changing redirects, canonicals, or titles.
- [ ] If any atomic-release gate fails, disable publication for all three new identities in one registry rollback and regenerate projections; do not redirect or remove the existing Gemini canonical pages.
- [ ] Commit runbook/evidence updates if they contain no secrets.

```bash
git add docs/model-launch/p1-production-runbook.md docs/model-launch/p1-video-model-refresh-evidence.md frontend/app/api/admin/seo/gsc/refresh/route.ts tests/gsc-oauth-auth.test.ts
git commit -m "docs: record p1 production verification"
```

## Final Acceptance Checklist

- [ ] Gemini public identity and indexed URLs are preserved while every visible contract says 1.1.
- [ ] Gemini generations use Google direct only.
- [ ] Kling Turbo Standard and Pro use the mapped Kling direct contracts first
  and safe Fal fallback only before acceptance, including the explicitly
  enabled depleted-balance case.
- [ ] H3 Max is distinct from H3 and exposes no Fal attribution publicly.
- [ ] All runtime capabilities, validation, and exact quotes match between workspace and MCP.
- [ ] Eight distinct videos are accepted, public in galleries, attached to exact model/family playlists, and excluded from immediate video-SEO editorial indexing.
- [ ] Every shipped model has all 11 evidence-backed scores and complete key specs.
- [ ] The four new comparisons and four preserved Gemini comparisons render scoreboard/spec data without side-by-side promises.
- [ ] Pricing, menus, examples, family pages, model pages, compare hub, LLM discovery, internal links, and localized metadata are synchronized.
- [ ] Sitemap delta is exactly seven English canonical routes and 21 localized `<loc>` entries.
- [ ] Search Console refresh works with current data and no committed credential.
- [ ] No database schema migration was added unless separately justified by a proven persisted-data contract change.
- [ ] Production SHA, routes, provider attempts, media attachments, and rollback instructions are recorded in the runbook.
