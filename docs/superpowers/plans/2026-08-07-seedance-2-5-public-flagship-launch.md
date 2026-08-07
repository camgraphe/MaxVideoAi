# Seedance 2.5 Public Flagship Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch Seedance 2.5 as MaxVideoAI's public, indexed, flagship video engine for every user, with the full unified Seedance workflow, public pricing, strong marketing discovery, benchmark placement, comparison pages, and non-destructive SEO coexistence with Seedance 2.0.

**Architecture:** Keep one canonical engine identity, `seedance-2-5`, and expand the existing ModelArk profile, generic reference schema, submission adapter, billing quote, and workspace components rather than creating a parallel generator. Use `frontend/config/model-registry.json` as the only publication and discovery owner, extend its app metadata with a reusable launch badge, and regenerate all projections. Ship runtime, commercial, marketing, and SEO work as independently reviewable commits, while production environment flags remain the final reversible execution gate.

**Tech Stack:** Next.js App Router, React, TypeScript, Node test runner, Zod, PostgreSQL/Neon, canonical `@maxvideoai/pricing`, BytePlus ModelArk asynchronous video tasks, localized JSON/MDX content, JSON-LD, sitemap and hreflang helpers.

## Global Constraints

- Public launch means all authenticated MaxVideoAI users can select and generate with `seedance-2-5`; no administrator-only or restricted-user UX remains.
- Seedance 2.5 becomes the first/default public video engine for new sessions through registry discovery ordering; existing stored user selections remain respected.
- The public engine exposes `t2v`, `i2v`, `ref2v`, `v2v`, and `extend` through the existing unified workspace.
- The factual Seedance 2.5 output contract remains 4–30 seconds, 480p/720p, 24 FPS, optional generated audio, and the currently documented 16:9 ratio. Do not copy Seedance 2.0's 1080p, 4K, `auto`, or wider ratio set into Seedance 2.5 without new official 2.5 evidence.
- Multimodal input limits are the recorded Seedance 2.5 model-card limits: 50 combined references, capped at 30 images, 10 videos, and 10 audio files.
- Seedance 2.0, Seedance 2.0 Fast, and Seedance 2.0 Mini stay live, indexed, self-canonical, and in their existing sitemaps. Do not redirect them to Seedance 2.5 and do not rewrite all historic Seedance 2.0 mentions.
- Preserve Seedance 2.0 as the explicit Seedance option for 1080p/4K intent while positioning Seedance 2.5 around latest-model, 30-second, continuity, multimodal, editing, and extension intent.
- Public marketing copy must not mention provider routing, ModelArk, canaries, rollout gates, internal price policy, or obvious provider-price caveats.
- Keep the approved 2.5× customer pricing policy and factual Seedance 2.5 token rates unchanged. Any different commercial multiple requires separate approval.
- No additional paid pre-launch generation is part of this plan. Existing City, Train, and Dialogue evidence is reused; first customer/live generations are monitored after deployment with no automated retry.
- Dialogue stays outside public playlists until its already-recorded human dialogue/lip-sync review is completed. City and Train remain the initial public marketing pair.
- Keep `SEEDANCE_2_5_BYTEPLUS_ENABLED` as the hard production kill switch and preserve refund/reconciliation behavior.
- No push, deployment, production environment mutation, Search Console request, LinkedIn publication, or other external side effect occurs without an explicit execution-stage approval.
- All authored EN/FR/ES model, comparison, navigation, pricing, and social copy changes must stay structurally aligned.

---

## Launch Sequence and Release Gates

1. **Contract gate:** the unified engine schema, payloads, validation, pricing, and refund behavior pass focused tests without paid generation.
2. **Product gate:** Seedance 2.5 appears first, carries `New`, exposes all five workflows, and the sidebar and CTAs select it.
3. **Content gate:** marketing, pricing, benchmark, comparison, homepage, models catalogue, examples, and linking changes are complete in EN/FR/ES.
4. **SEO gate:** the 2.5 page is self-canonical, indexable, hreflang-complete, in the sitemap, and linked from strategic pages while every 2.0 URL remains self-canonical and indexed.
5. **Build gate:** registry projections, pricing audits, focused tests, full validation, lint, TypeScript, exposure lint, i18n, SEO checks, and production build pass.
6. **Deployment gate:** production flags are set explicitly, a fresh deployment is healthy, and read-only production smoke checks pass before a user performs the first paid generation.
7. **Live-generation gate:** one owner-controlled T2V run is observed end-to-end; subsequent I2V/reference/edit/extend runs are normal product usage, not a pre-launch test campaign.

## File and Responsibility Map

### Runtime and unified input contract

- Modify `frontend/src/config/fal-engines/launch-config.ts`: define all five internal Seedance 2.5 mode route tokens while preserving the factual model ID and pricing builder.
- Modify `frontend/src/config/fal-engines/seedance-2-5.ts`: own customer-visible capabilities, input schema, reference budget, mode UI, media, prompts, and public pricing hints.
- Modify `frontend/src/server/video-providers/byteplus-modelark-constants.ts`: own factual Seedance 2.5 durations, resolutions, ratios, modes, and reference caps.
- Modify `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`: project the five-mode 2.5 provider profile.
- Modify `frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts`: retain early kill-switch enforcement while separating public discovery from hidden-engine fallback.
- Modify `frontend/app/api/generate/_lib/route-context.ts`: resolve 2.5 as a public configured engine and keep the early dedicated execution gate.
- Reuse `frontend/src/server/video-providers/byteplus-modelark-payload.ts`: send text, start/end images, image/video/audio references, edit sources, and extension sources through the existing content-role payload.
- Reuse `frontend/app/api/generate/_lib/byteplus-submission.ts`: submit, poll, account, store, and reconcile through the existing direct-provider path.

### Publication, discovery, and promotion

- Modify `frontend/config/model-registry-validation.ts`: add validated optional `launchBadge: 'new'` app metadata.
- Modify `frontend/config/model-publication.ts`: carry `launchBadge` in the browser-safe app surface.
- Modify `frontend/config/model-runtime.ts`: project `launchBadge` with the existing app metadata.
- Modify `frontend/config/model-registry.json`: publish every 2.5 surface, assign flagship ordering, add the approved comparison relationships, and mark it `New`.
- Regenerate `frontend/config/model-runtime.json`, `frontend/config/engine-catalog.json`, `frontend/config/model-roster.json`, `docs/model-roster.json`, and `docs/model-roster.csv`; never edit these files manually.

### Workspace and selector

- Modify `frontend/src/components/ui/engine-select/EngineSelectDropdown.tsx`: render the registry-owned `New` chip beside Seedance 2.5.
- Modify `frontend/src/components/ui/engine-select/engine-select-types.ts`: expose the optional launch badge to the dropdown without hard-coding an engine ID.
- Modify `frontend/components/AppSidebar.tsx`: replace the stale Seedance 2.0 launch card with Seedance 2.5 and route to `/app?engine=seedance-2-5`.
- Modify `frontend/config/navigation.ts`, `frontend/components/marketing/MarketingDesktopNav.tsx`, `frontend/components/marketing/MarketingMobileMenu.tsx`, `frontend/components/HeaderBar.tsx`, and `frontend/components/header/HeaderMobileMenu.tsx`: place Seedance 2.5 first in the public Models menu and render the same generic `New` label on desktop and mobile.
- Modify `frontend/messages/en.json`, `frontend/messages/fr.json`, and `frontend/messages/es.json`: localize the badge and flagship sidebar copy.
- Modify `frontend/lib/seedance-workflow.ts`: include `seedance-2-5` in the unified Seedance workflow set.
- Modify `frontend/components/Composer.tsx` and `frontend/components/composer/composer-layout.ts`: replace the Seedance layout/capability prefix checks with `UNIFIED_SEEDANCE_ENGINE_IDS` membership; leave unrelated engine conditions unchanged.

### Pricing and billing

- Modify `frontend/src/config/fal-engines/seedance-2-5.ts`: expose the canonical pricing hint and estimator scenario.
- Reuse the existing canonical Seedance 2.5 pricing selector and `provider-reference-current` compatibility profile; do not add formulas or change `frontend/config/pricing-policy.json`.
- Update `tests/seedance-2-pricing.test.ts`, `tests/generate-billing-preflight.test.ts`, and `tests/pricing-public-projection.test.ts` to cover no-video-input and video-input 2.5 quotes.
- Regenerate the public pricing baseline only after reviewing the exact new 2.5 rows; do not alter existing rows.

### Marketing, SEO, benchmark, and comparisons

- Modify `content/models/{en,fr,es}/seedance-2-5.json`: replace closed-generation copy with public conversion CTAs, unified workflow copy, pricing links, and approved comparisons.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-5.ts`: enable pricing and comparison sections and point the primary CTA to the generator.
- Modify `content/models/{en,fr,es}/seedance-2-0.json`: add a small non-destructive “latest Seedance 2.5” upgrade link while preserving 2.0 titles, canonicals, 4K copy, and existing intent.
- Modify `data/benchmarks/engine-scores.v1.json` and `data/benchmarks/engine-key-specs.v1.json`: add an evidence-bounded 2.5 row and factual specifications.
- Create `content/comparisons/seedance-2-0-vs-seedance-2-5.json`.
- Create `content/comparisons/kling-3-pro-vs-seedance-2-5.json`.
- Create `content/comparisons/seedance-2-5-vs-veo-3-1.json`.
- Modify `frontend/config/compare-config.json`: promote the three launch comparisons and related-link graph.
- Modify strategic homepage, models catalogue, examples, pricing, footer, workflow, and best-for owners identified in Task 10; do not perform a global Seedance 2.0 replacement.
- Create `docs/model-launch/seedance-2-5-linkedin-launch.md`: prepare copy, media choices, canonical URLs, and UTM conventions without posting externally.

### Operations and handoff

- Modify `frontend/.env.local.example`: document the factual model ID with fail-closed local defaults; production values remain in the launch handoff.
- Modify `docs/model-launch/seedance-2-5.md`: replace the hidden/noindex handoff with the approved public flagship state, production flags, smoke checks, monitoring, and rollback.
- Modify `docs/model-launch/seedance-2-5.engine.stub.ts`: record the public executable contract and remove stale closed-surface assertions.
- Add or update launch-focused tests so future work cannot silently hide, deindex, demote, or narrow Seedance 2.5.

---

### Task 1: Lock the Public Seedance 2.5 Capability Contract

**Files:**
- Modify: `frontend/src/server/video-providers/byteplus-modelark-constants.ts`
- Modify: `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`
- Modify: `tests/byteplus-seedance-profiles.test.ts`
- Modify: `tests/seedance-2-5-readiness.test.ts`

**Interfaces:**
- Produces: `BYTEPLUS_SEEDANCE_2_5_MODES`, `BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES`, `BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES`, `BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS`, and `BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO`.
- Produces: `requireBytePlusSeedanceProfile('seedance-2-5')` with five supported modes and the unchanged factual output contract.
- Consumes: the recorded official evidence in `docs/model-launch/seedance-2-5.md`.

- [ ] **Step 1: Replace the readiness test's hidden T2V expectation with the approved public capability expectation**

```ts
assert.deepEqual(profile.supportedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
assert.deepEqual(profile.resolutions, ['480p', '720p']);
assert.deepEqual(profile.aspectRatios, ['16:9']);
assert.deepEqual(profile.durationOptions, Array.from({ length: 27 }, (_, index) => index + 4));
assert.equal(profile.framesPerSecond, 24);
assert.equal(profile.generatedAudio, true);
```

- [ ] **Step 2: Add explicit reference-cap assertions**

```ts
assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES, 50);
assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES, 30);
assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS, 10);
assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO, 10);
```

- [ ] **Step 3: Run the focused tests and confirm they fail on the current T2V-only profile**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/byteplus-seedance-profiles.test.ts tests/seedance-2-5-readiness.test.ts`

Expected: FAIL because Seedance 2.5 currently reports only `t2v` and the cap constants do not exist.

- [ ] **Step 4: Add the factual constants and project them through the profile**

```ts
export const BYTEPLUS_SEEDANCE_2_5_MODES: Mode[] = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'];
export const BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES = 50;
export const BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES = 30;
export const BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS = 10;
export const BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO = 10;
```

Set the 2.5 profile's `supportedModes` to `BYTEPLUS_SEEDANCE_2_5_MODES`. Keep durations, resolutions, 16:9, FPS, audio, model ID, and pricing profile unchanged.

- [ ] **Step 5: Re-run the focused tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/byteplus-seedance-profiles.test.ts tests/seedance-2-5-readiness.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the factual capability contract**

```bash
git add frontend/src/server/video-providers/byteplus-modelark-constants.ts frontend/src/server/video-providers/byteplus-modelark-profiles.ts tests/byteplus-seedance-profiles.test.ts tests/seedance-2-5-readiness.test.ts
git commit -m "feat: define public Seedance 2.5 capabilities"
```

### Task 2: Build the Unified Five-Mode Engine Schema

**Files:**
- Modify: `frontend/src/config/fal-engines/launch-config.ts`
- Modify: `frontend/src/config/fal-engines/seedance-2-5.ts`
- Test: `tests/seedance-2-5-readiness.test.ts`
- Test: `tests/engine-reference-budget-propagation.test.ts`
- Test: `tests/validate-request.test.ts`

**Interfaces:**
- Consumes: the constants from Task 1.
- Produces: `SEEDANCE_2_5_FAL_ENGINE_REGISTRY` with five `RawFalEngineEntry` mode definitions.
- Produces: an `EngineInputSchema` with start/end images, multimodal references, edit/extension sources, `generate_audio`, and a 50-item reference budget.

- [ ] **Step 1: Add failing assertions for the unified engine shape**

```ts
const entry = getFalEngineById('seedance-2-5');
assert.ok(entry);
assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
assert.deepEqual(entry.modes.map(({ mode }) => mode), ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
assert.equal(entry.engine.inputSchema?.referenceBudget?.maxTotal, 50);
assert.deepEqual(entry.engine.inputSchema?.referenceBudget?.fieldIds, [
  'image_url',
  'end_image_url',
  'image_urls',
  'video_url',
  'video_urls',
  'extension_source_videos',
  'audio_urls',
]);
```

- [ ] **Step 2: Add failing request-validation cases for each input family**

Cover these exact cases without network calls:

```ts
[
  ['i2v requires image_url', { mode: 'i2v' }, 'image_url'],
  ['ref2v accepts image_urls', { mode: 'ref2v', image_urls: ['https://cdn.test/ref.png'] }, null],
  ['v2v requires video_url', { mode: 'v2v' }, 'video_url'],
  ['extend requires extension_source_videos', { mode: 'extend' }, 'extension_source_videos'],
]
```

Add one over-budget case with 31 images and one combined over-budget case with 51 unique references.

- [ ] **Step 3: Run the focused schema tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts tests/engine-reference-budget-propagation.test.ts tests/validate-request.test.ts`

Expected: FAIL because the current engine has only prompt, duration, ratio, resolution, and T2V.

- [ ] **Step 4: Define all internal mode route tokens**

```ts
export const BYTEPLUS_SEEDANCE_2_5_ENDPOINTS = {
  t2v: 'byteplus/dreamina-seedance-2.5/text-to-video',
  i2v: 'byteplus/dreamina-seedance-2.5/image-to-video',
  ref2v: 'byteplus/dreamina-seedance-2.5/reference-to-video',
  v2v: 'byteplus/dreamina-seedance-2.5/video-to-video',
  extend: 'byteplus/dreamina-seedance-2.5/extend',
} as const;
```

These are MaxVideoAI routing tokens. The provider request continues to use the single canonical model ID `dreamina-seedance-2-5-260628`.

- [ ] **Step 5: Expand `EngineCaps` and `inputLimits`**

Use:

```ts
modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
maxDurationSec: 30,
resolutions: ['480p', '720p'],
aspectRatios: ['16:9'],
fps: [24],
audio: true,
extend: true,
inputLimits: {
  imageMaxMB: 30,
  videoMaxMB: 50,
  audioMaxMB: 15,
  videoMaxDurationSec: 30,
},
```

- [ ] **Step 6: Add the unified fields and reference budget**

Mirror the established Seedance 2.0 field IDs so the existing workspace and payload preparation are reused, but apply the 2.5 caps:

```ts
referenceBudget: {
  fieldIds: ['image_url', 'end_image_url', 'image_urls', 'video_url', 'video_urls', 'extension_source_videos', 'audio_urls'],
  maxTotal: 50,
  countUniqueUrls: true,
  modes: ['i2v', 'ref2v', 'v2v', 'extend'],
},
```

Set `image_urls.maxCount = 30`, `video_urls.maxCount = 10`, and `audio_urls.maxCount = 10`. Keep `extension_source_videos.maxCount = 3`, matching the existing extend/stitch contract, while the global video-reference cap remains 10 across all video fields. Keep one required `image_url` for I2V and one required source video for V2V.

- [ ] **Step 7: Add one mode UI block per workflow**

Each mode uses 4–30 seconds, 480p/720p, 16:9, and the audio toggle. Add the accepted image, video, and audio formats to the modes that upload those assets. Public notes describe the workflow and limits only; they contain no provider or rollout language.

- [ ] **Step 8: Re-run the focused tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts tests/engine-reference-budget-propagation.test.ts tests/validate-request.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the unified schema**

```bash
git add frontend/src/config/fal-engines/launch-config.ts frontend/src/config/fal-engines/seedance-2-5.ts tests/seedance-2-5-readiness.test.ts tests/engine-reference-budget-propagation.test.ts tests/validate-request.test.ts
git commit -m "feat: unify Seedance 2.5 generation modes"
```

### Task 3: Route Public Users Through the Existing ModelArk Submission Path

**Files:**
- Modify: `frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts`
- Modify: `frontend/app/api/generate/_lib/route-context.ts`
- Modify: `frontend/app/api/generate/_lib/byteplus-submission.ts`
- Test: `tests/seedance-2-5-readiness.test.ts`
- Test: `tests/generate-byteplus-submission.test.ts`
- Test: `tests/byteplus-provider-architecture.test.ts`

**Interfaces:**
- Produces: `requiresBytePlusSeedanceEarlyGate(engineId): boolean` for the dedicated 2.5 kill switch.
- Preserves: `assertBytePlusSeedanceSubmissionEnabled` before database/configured-engine access.
- Consumes: generic `buildBytePlusSeedancePayload` and existing reservation/refund orchestration.

- [ ] **Step 1: Add a failing route-context test for a non-admin public user**

With `SEEDANCE_2_5_BYTEPLUS_ENABLED=true`, `SEEDANCE_2_5_PROVIDER=byteplus_modelark`, and `SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false`, assert that route context resolves a public configured 2.5 engine without calling `requireAdmin` or the hidden-engine fallback.

- [ ] **Step 2: Add table-driven payload tests for all five modes**

Assert the exact provider content roles:

```ts
[
  ['t2v', ['text']],
  ['i2v', ['text', 'image_url']],
  ['ref2v', ['text', 'image_url', 'video_url', 'audio_url']],
  ['v2v', ['text', 'image_url', 'video_url', 'audio_url']],
  ['extend', ['text', 'video_url']],
]
```

Also assert that video-input modes use the Seedance 2.5 `video_input` accounting rate and T2V/I2V-with-images-but-no-video use the correct factual no-video-input class.

- [ ] **Step 3: Run the focused routing/submission tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts tests/generate-byteplus-submission.test.ts tests/byteplus-provider-architecture.test.ts`

Expected: FAIL on public routing and non-T2V mode forwarding.

- [ ] **Step 4: Separate early gating from hidden-engine resolution**

Rename the current hidden-policy concept so `seedance-2-5` still executes the pre-database kill-switch check but is not resolved through `getConfiguredEngineIncludingHidden`. Keep `seedance-2-0-fast-byteplus` as the only hidden engine.

- [ ] **Step 5: Preserve the fail-closed source default and prove the explicit public production value**

Keep the source/default value of `SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY` at `true`. In the public-user route test, explicitly set it to `false` and assert that no administrator check runs. Production must also set the value explicitly to `false`; malformed or absent values remain restricted.

- [ ] **Step 6: Forward all mode assets through the existing submission builder**

Confirm `byteplus-submission.ts` passes the mode, start/end image, image references, video references, audio references, reference budget, and provenance items to `buildBytePlusSeedancePayload`. Add only missing mappings; do not duplicate payload construction.

- [ ] **Step 7: Re-run the focused routing/submission tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts tests/generate-byteplus-submission.test.ts tests/byteplus-provider-architecture.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit public routing**

```bash
git add frontend/src/server/video-providers/byteplus-modelark-profile-policy.ts frontend/app/api/generate/_lib/route-context.ts frontend/app/api/generate/_lib/byteplus-submission.ts tests/seedance-2-5-readiness.test.ts tests/generate-byteplus-submission.test.ts tests/byteplus-provider-architecture.test.ts
git commit -m "feat: open Seedance 2.5 generation to users"
```

### Task 4: Publish Canonical Billing and Public Pricing

**Files:**
- Modify: `frontend/src/config/fal-engines/seedance-2-5.ts`
- Test: `tests/seedance-2-pricing.test.ts`
- Test: `tests/generate-billing-preflight.test.ts`

**Interfaces:**
- Consumes: `buildSeedance25PricingDetails()` and the existing 2.5× policy.
- Produces: public estimator/model-page/workspace quotes for `no_video_input` and `video_input` without a second pricing formula.

- [ ] **Step 1: Add failing public-quote assertions**

Cover at least these exact scenarios:

- 4s, 480p, 16:9, audio off, T2V.
- 15s, 720p, 16:9, audio on, T2V.
- 24s, 720p, 16:9, audio off, I2V.
- 15s, 720p, 16:9, audio on, V2V using the factual video-input token rate.

Assert that every quote carries the canonical pricing source `byteplus_seedance_2_5_260628_approved_2_5x` and a positive customer total.

- [ ] **Step 2: Run the focused pricing tests and confirm the missing video-input coverage**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-pricing.test.ts tests/generate-billing-preflight.test.ts`

Expected: FAIL because the unified video-input scenarios are absent.

- [ ] **Step 3: Replace administrator-only pricing presentation**

Set `pricing.notes`, `billingNote`, and `pricingHint.label` to customer-facing factual copy. Use “Price calculated before generation” as the generic public label; do not expose provider costs or internal multipliers.

- [ ] **Step 4: Lock the existing canonical policy path**

Add an assertion that the 2.5 quote resolves through the existing canonical policy and `provider-reference-current` compatibility profile. Do not edit `frontend/config/pricing-policy.json`; a failure means the current quote adapter is bypassing canonical pricing and must be corrected in the existing Seedance 2.5 quote path.

- [ ] **Step 5: Run pricing audits before changing the public fixture**

Run:

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
```

Expected: all current rows remain unchanged. Public 2.5 rows are added after registry publication in Task 5.

- [ ] **Step 6: Re-run pricing tests and audits**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-pricing.test.ts tests/generate-billing-preflight.test.ts
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
```

Expected: PASS with zero unintended mismatches.

- [ ] **Step 7: Commit pricing readiness**

```bash
git add frontend/src/config/fal-engines/seedance-2-5.ts tests/seedance-2-pricing.test.ts tests/generate-billing-preflight.test.ts
git commit -m "feat: ready Seedance 2.5 public pricing"
```

### Task 5: Add Registry-Owned `New` Metadata and Open Every Publication Surface

**Files:**
- Modify: `frontend/config/model-registry-validation.ts`
- Modify: `frontend/config/model-publication.ts`
- Modify: `frontend/config/model-runtime.ts`
- Modify: `frontend/config/model-registry.json`
- Generated: `frontend/config/model-runtime.json`
- Generated: `frontend/config/engine-catalog.json`
- Generated: `frontend/config/model-roster.json`
- Generated: `docs/model-roster.json`
- Generated: `docs/model-roster.csv`
- Test: `tests/model-registry-validation.test.ts`
- Test: `tests/model-registry-parity.test.ts`
- Modify: `tests/seedance-2-5-readiness.test.ts`
- Test: `tests/pricing-public-projection.test.ts`
- Generated fixture: `tests/fixtures/pricing-public-projections.v1.json`

**Interfaces:**
- Produces: `ModelRegistryPublication.app.launchBadge?: 'new'`.
- Produces: public 2.5 app metadata with flagship rank, Seedance variant group, and `New` badge.

- [ ] **Step 1: Add failing validation/projection tests for `launchBadge`**

Assert that `launchBadge: 'new'` is accepted only when `publication.app.published === true`, and any other value or a badge on a hidden app surface fails validation.

- [ ] **Step 2: Replace all closed 2.5 publication assertions**

The readiness test must expect:

```ts
assert.equal(model.publication.model.indexable, true);
assert.equal(model.publication.examples.published, true);
assert.equal(model.publication.examples.includeInFamilyCopy, true);
assert.equal(model.publication.examples.current, true);
assert.equal(model.publication.compare.published, true);
assert.equal(model.publication.compare.indexed, true);
assert.equal(model.publication.app.published, true);
assert.equal(model.publication.pricing.published, true);
assert.equal(model.publication.sitemap.published, true);
assert.equal(model.publication.app.launchBadge, 'new');
```

- [ ] **Step 3: Run registry tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/seedance-2-5-readiness.test.ts`

Expected: FAIL because `launchBadge` is not part of the schema and all 2.5 discovery surfaces are closed.

- [ ] **Step 4: Add the typed badge field and projection**

```ts
app: {
  published: boolean;
  discoveryRank?: number;
  variantGroup?: string;
  variantLabel?: string;
  launchBadge?: 'new';
};
```

Carry the field into `AppPublicationConfig` as `launchBadge?: 'new'` and through `toLegacyModelSurfaces`.

- [ ] **Step 5: Author the full 2.5 registry publication state**

Use this policy:

```json
{
  "model": { "published": true, "indexable": true },
  "examples": { "published": true, "includeInFamilyCopy": true, "current": true, "familyRank": 0 },
  "compare": {
    "published": true,
    "indexed": true,
    "suggestedOpponentIds": ["seedance-2-0", "kling-3-pro", "veo-3-1"],
    "publishedPairIds": ["seedance-2-0", "kling-3-pro", "veo-3-1"]
  },
  "app": {
    "published": true,
    "discoveryRank": -3,
    "variantGroup": "seedance-2-0",
    "variantLabel": "2.5",
    "launchBadge": "new"
  },
  "pricing": { "published": true, "featuredScenario": "seedance-2-family" },
  "sitemap": { "published": true }
}
```

Shift the existing Seedance 2.0 Standard/Fast/Mini `familyRank` values from `0/1/2` to `1/2/3`, preserving their relative order. Add `seedance-2-5` reciprocally to the `publishedPairIds` of Seedance 2.0, Kling 3 Pro, and Veo 3.1. Preserve Seedance 2.0's current `suggestedOpponentIds`; its existing top-three recommendation order must not be displaced.

- [ ] **Step 6: Regenerate every projection**

Run:

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
```

- [ ] **Step 7: Verify registry and projection parity**

Run:

```bash
pnpm model:registry:check
pnpm model:check
pnpm models:audit
```

Expected: PASS with no critical model audit finding.

- [ ] **Step 8: Regenerate and verify the public pricing projection**

Run:

```bash
pnpm pricing:public-baseline:generate
pnpm pricing:public-baseline
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-public-projection.test.ts
```

Inspect `tests/fixtures/pricing-public-projections.v1.json` before committing. The diff must add only the newly published Seedance 2.5 rows; no cent value for any pre-existing public model may change.

- [ ] **Step 9: Commit authored policy and generated projections together**

```bash
git add frontend/config/model-registry-validation.ts frontend/config/model-publication.ts frontend/config/model-runtime.ts frontend/config/model-registry.json frontend/config/model-runtime.json frontend/config/engine-catalog.json frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/seedance-2-5-readiness.test.ts tests/pricing-public-projection.test.ts tests/fixtures/pricing-public-projections.v1.json
git commit -m "feat: publish Seedance 2.5 across product surfaces"
```

### Task 6: Make Seedance 2.5 the Flagship Generator Experience

**Files:**
- Modify: `frontend/src/components/ui/engine-select/EngineSelectDropdown.tsx`
- Modify: `frontend/src/components/ui/engine-select/engine-select-types.ts`
- Modify: `frontend/lib/seedance-workflow.ts`
- Modify: `frontend/components/Composer.tsx`
- Modify: `frontend/components/composer/composer-layout.ts`
- Modify: `frontend/components/AppSidebar.tsx`
- Modify: `frontend/config/navigation.ts`
- Modify: `frontend/components/marketing/MarketingDesktopNav.tsx`
- Modify: `frontend/components/marketing/MarketingMobileMenu.tsx`
- Modify: `frontend/components/HeaderBar.tsx`
- Modify: `frontend/components/header/HeaderMobileMenu.tsx`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Test: `tests/engine-select-architecture.test.ts`
- Test: `tests/engine-select-family-grouping.test.ts`
- Test: `tests/workspace-composer-surface-contract.test.ts`
- Test: `tests/marketing-navigation.test.ts`
- Test: `tests/header-bar-architecture.test.ts`
- Create: `tests/seedance-2-5-workspace-contract.test.ts`

**Interfaces:**
- Consumes: `surfaces.app.launchBadge` from Task 5.
- Produces: generic badge rendering and 2.5-first default ordering.
- Preserves: URL/stored engine choice precedence over the default order.

- [ ] **Step 1: Add failing selector and workspace tests**

Assert that:

```ts
assert.equal(getBaseEngines()[0]?.id, 'seedance-2-5');
assert.deepEqual(buildEngineFamilyGroups(...)[0].engines.map(({ id }) => id).slice(0, 4), [
  'seedance-2-5',
  'seedance-2-0',
  'seedance-2-0-fast',
  'seedance-2-0-mini',
]);
```

Also assert the dropdown reads `launchBadge` generically and does not contain a hard-coded `engine.id === 'seedance-2-5'` badge branch. In the public marketing Models menu, assert Seedance 2.5 is first, carries `badge: 'new'`, and all four desktop/mobile menu renderers consume that generic field without hard-coding the engine slug.

- [ ] **Step 2: Add failing unified-workflow checks**

Assert `UNIFIED_SEEDANCE_ENGINE_IDS.has('seedance-2-5') === true`, and confirm all five modes use the existing reference/composer layout rather than a separate 2.5 component.

- [ ] **Step 3: Run focused selector/workspace tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/engine-select-architecture.test.ts tests/engine-select-family-grouping.test.ts tests/workspace-composer-surface-contract.test.ts tests/seedance-2-5-workspace-contract.test.ts tests/marketing-navigation.test.ts tests/header-bar-architecture.test.ts`

Expected: FAIL on order, badge, and unified-workflow membership.

- [ ] **Step 4: Render the generic `New` badge**

In each engine row, render a compact chip beside the score:

```tsx
{meta?.surfaces.app.launchBadge === 'new' ? (
  <span className="rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-micro text-white">
    {copy.badges.new}
  </span>
) : null}
```

Add `badges.new` to the existing selector copy schema and localize it as `New`, `Nouveau`, and `Nuevo`.

- [ ] **Step 5: Reuse the existing Seedance composer layout**

Replace prefix-only checks such as `engine.id.startsWith('seedance-2-0')` with `UNIFIED_SEEDANCE_ENGINE_IDS.has(engine.id)` where they control layout or capability behavior. Do not broaden unrelated engine-specific conditions.

- [ ] **Step 6: Update the sidebar launch card**

Use `/app?engine=seedance-2-5` and these concepts:

- EN: `Seedance 2.5`, `Up to 30-second scenes`, `Images, references and video editing`, `Native audio workflow`.
- FR: `Seedance 2.5`, `Scènes jusqu’à 30 secondes`, `Images, références et montage vidéo`, `Workflow audio natif`.
- ES: `Seedance 2.5`, `Escenas de hasta 30 segundos`, `Imágenes, referencias y edición de vídeo`, `Flujo de audio nativo`.

- [ ] **Step 7: Promote Seedance 2.5 in the public Models menu**

Extend `MarketingNavItem` with `badge?: 'new'`. Put `{ slug: 'seedance-2-5', label: 'Seedance 2.5', badge: 'new' }` first in `MODEL_MENU`, immediately followed by Seedance 2.0. Render the field generically in `MarketingDesktopNav.tsx`, `MarketingMobileMenu.tsx`, `HeaderBar.tsx`, and `HeaderMobileMenu.tsx` using the localized labels `New`, `Nouveau`, and `Nuevo`.

- [ ] **Step 8: Confirm existing user selections still win**

Add a hydration assertion proving that a stored `seedance-2-0`, Kling, or Veo selection is not overwritten by the new default, while a new empty session resolves to the first discovered engine.

- [ ] **Step 9: Re-run focused tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/engine-select-architecture.test.ts tests/engine-select-family-grouping.test.ts tests/workspace-composer-surface-contract.test.ts tests/seedance-2-5-workspace-contract.test.ts tests/marketing-navigation.test.ts tests/header-bar-architecture.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit the flagship generator UX**

```bash
git add frontend/src/components/ui/engine-select frontend/lib/seedance-workflow.ts frontend/components/Composer.tsx frontend/components/composer/composer-layout.ts frontend/components/AppSidebar.tsx frontend/config/navigation.ts frontend/components/marketing/MarketingDesktopNav.tsx frontend/components/marketing/MarketingMobileMenu.tsx frontend/components/HeaderBar.tsx frontend/components/header/HeaderMobileMenu.tsx frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json tests/engine-select-architecture.test.ts tests/engine-select-family-grouping.test.ts tests/workspace-composer-surface-contract.test.ts tests/seedance-2-5-workspace-contract.test.ts tests/marketing-navigation.test.ts tests/header-bar-architecture.test.ts
git commit -m "feat: feature Seedance 2.5 in the workspace"
```

### Task 7: Convert the Model Page From Showcase to Public Conversion Page

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-5.ts`
- Modify: `content/models/en/seedance-2-5.json`
- Modify: `content/models/fr/seedance-2-5.json`
- Modify: `content/models/es/seedance-2-5.json`
- Modify: `tests/seedance-2-5-marketing-page.test.ts`
- Test: `tests/model-page-template-content.test.ts`
- Test: `tests/model-seo-signals.test.ts`

**Interfaces:**
- Consumes: public app, pricing, examples, compare, and sitemap publication from Task 5.
- Produces: `/app?engine=seedance-2-5` as the primary conversion destination in all locales.

- [ ] **Step 1: Replace closed-surface tests with public conversion tests**

Assert:

```ts
assert.equal(template.pricing.enabled, true);
assert.equal(template.sections.compare, true);
assert.equal(template.hero.primaryCtaHref, '/app?engine=seedance-2-5');
assert.match(JSON.stringify(document), /seedance-2-5/);
assert.doesNotMatch(JSON.stringify(document), /public generation is not open|génération publique n’est pas ouverte|generación pública no está abierta/i);
```

- [ ] **Step 2: Run the model-page tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-marketing-page.test.ts tests/model-page-template-content.test.ts tests/model-seo-signals.test.ts`

Expected: FAIL because pricing/compare are disabled and CTAs still point to Seedance examples or 2.0.

- [ ] **Step 3: Enable conversion sections and routes**

Set:

```ts
primaryCtaHref: '/app?engine=seedance-2-5',
secondaryCtaHref: '/examples/seedance',
pricing: { enabled: true, anchorHref: '#pricing', presets: [...] },
sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
```

Use canonical pricing scenarios from Task 4; do not author numeric prices in localized JSON.

- [ ] **Step 4: Update exact launch messages in EN/FR/ES**

Use public, sales-oriented wording:

- Primary CTA: `Generate with Seedance 2.5` / `Générer avec Seedance 2.5` / `Generar con Seedance 2.5`.
- Badge: `New · Up to 30 seconds · 720p · Native audio` with equivalent FR/ES translations.
- Secondary CTA: view the Seedance examples family.
- FAQ generation answer: generation is available to MaxVideoAI users with the price shown before each render.
- Unified workflow section: text, start/end image, multimodal references, video editing, extension, and optional generated audio.

Keep City and Train as the visible proof pair. Keep Dialogue private.

- [ ] **Step 5: Remove obsolete “available Seedance 2.0” conversion language without erasing 2.0**

Retain one contextual “Compare with Seedance 2.0” link. Remove wording that presents 2.0 as the only available Seedance engine.

- [ ] **Step 6: Verify public schema behavior**

Assert the Product schema contains an Offer sourced from the canonical public quote and that WebPage, BreadcrumbList, Product, canonical, and hreflang outputs remain present.

- [ ] **Step 7: Re-run focused model-page tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-marketing-page.test.ts tests/model-page-template-content.test.ts tests/model-seo-signals.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the public model page**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-5.ts' content/models/en/seedance-2-5.json content/models/fr/seedance-2-5.json content/models/es/seedance-2-5.json tests/seedance-2-5-marketing-page.test.ts tests/model-page-template-content.test.ts tests/model-seo-signals.test.ts
git commit -m "feat: launch the Seedance 2.5 model page"
```

### Task 8: Add an Evidence-Bounded Benchmark Score and Specifications

**Files:**
- Modify: `data/benchmarks/engine-scores.v1.json`
- Modify: `data/benchmarks/engine-key-specs.v1.json`
- Modify: `tests/benchmark-lab-data.test.ts`
- Modify: `tests/app-engine-scores.test.ts`
- Modify: `docs/model-launch/seedance-2-5.md`

**Interfaces:**
- Produces: a selector/benchmark score derived by the existing arithmetic mean of fidelity, motion, and consistency.
- Consumes: City and Train visual acceptance evidence plus the factual model-card specifications.

- [ ] **Step 1: Add a failing benchmark roster assertion**

```ts
assert.ok(slugs.has('seedance-2-5'));
assert.equal(typeof (await loadAppEngineScoreMap())['seedance-2-5'], 'number');
```

- [ ] **Step 2: Run benchmark tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-data.test.ts tests/app-engine-scores.test.ts`

Expected: FAIL because 2.5 has no benchmark row.

- [ ] **Step 3: Score only criteria supported by existing evidence**

Review City and Train acceptance notes against the versioned definitions in `data/benchmarks/benchmark-methodology.v1.json`. Record numeric values only for criteria that can be evaluated from those two approved outputs. Set `lipsyncQuality` to `null` until Dialogue passes human review. Set any other unevidenced criterion to `null`; do not infer it from marketing claims.

The row must contain:

```json
{
  "modelSlug": "seedance-2-5",
  "fidelity": 9.1,
  "visualQuality": 9.2,
  "motion": 9.2,
  "consistency": 9.0,
  "anatomy": null,
  "textRendering": null,
  "lipsyncQuality": null,
  "sequencingQuality": 9.1,
  "controllability": 9.0,
  "speedStability": null,
  "pricing": null,
  "last_updated": "2026-08-07"
}
```

These are the launch values proposed from the already accepted City and Train outputs. A reviewer must confirm that each scored criterion is supported by the acceptance ledger; if an existing note contradicts a value, lower that value and record the reason in the ledger. Do not add scores for the null criteria and do not generate new paid evidence. The test must reject zero-valued scored fields.

- [ ] **Step 4: Add factual key specifications**

Record model ID evidence privately in sources/docs but present public-safe specs: 4–30 seconds, 480p/720p, 24 FPS, optional generated audio, five workflows, up to 50 combined references with 30/10/10 type caps, and 16:9 as the currently documented ratio.

- [ ] **Step 5: Document the score evidence boundary**

Add a launch-ledger note stating that the initial score uses City and Train, leaves unevidenced fields null, and will be recalibrated from normal post-launch usage under the existing methodology. Do not call it a full eight-prompt benchmark run.

- [ ] **Step 6: Re-run benchmark tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-data.test.ts tests/app-engine-scores.test.ts`

Expected: PASS and a non-zero displayed overall score.

- [ ] **Step 7: Commit the benchmark entry**

```bash
git add data/benchmarks/engine-scores.v1.json data/benchmarks/engine-key-specs.v1.json tests/benchmark-lab-data.test.ts tests/app-engine-scores.test.ts docs/model-launch/seedance-2-5.md
git commit -m "feat: add Seedance 2.5 to Benchmark Lab"
```

### Task 9: Publish the Three Priority Comparison Pages

**Files:**
- Create: `content/comparisons/seedance-2-0-vs-seedance-2-5.json`
- Create: `content/comparisons/kling-3-pro-vs-seedance-2-5.json`
- Create: `content/comparisons/seedance-2-5-vs-veo-3-1.json`
- Modify: `frontend/config/compare-config.json`
- Modify: `tests/comparison-content-contract.test.ts`
- Modify: `tests/seedance-2-5-marketing-page.test.ts`
- Test: `tests/compare-page-architecture.test.ts`
- Test: `tests/compare-page-pricing-display.test.ts`

**Interfaces:**
- Consumes: the published pair graph from Task 5 and benchmark/spec data from Task 8.
- Produces: three indexed, localized, self-canonical comparison documents.

- [ ] **Step 1: Add failing comparison inventory assertions**

Assert all three canonical slugs are published and indexed:

```ts
[
  'seedance-2-0-vs-seedance-2-5',
  'kling-3-pro-vs-seedance-2-5',
  'seedance-2-5-vs-veo-3-1',
]
```

- [ ] **Step 2: Run comparison tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-content-contract.test.ts tests/compare-page-architecture.test.ts tests/compare-page-pricing-display.test.ts tests/seedance-2-5-marketing-page.test.ts`

Expected: FAIL because the documents and related graph are absent.

- [ ] **Step 3: Author the upgrade-intent comparison**

`seedance-2-0-vs-seedance-2-5.json` must preserve this decision:

- Choose 2.5 for the latest 30-second workflow, higher reference ceiling, editing/extension, and flagship placement.
- Choose 2.0 when its established 1080p/4K output path or mature 15-second workflow is the deciding requirement.
- Link each side to its own model page and generation destination; do not canonicalize 2.0 to 2.5.

- [ ] **Step 4: Author the Kling and Veo comparisons**

Use unique intents rather than duplicating the 2.0 upgrade page:

- Kling 3 Pro vs Seedance 2.5: cinematic control and character/reference workflow decision.
- Seedance 2.5 vs Veo 3.1: longer Seedance workflow and multimodal control versus Veo's premium prompt adherence/realism positioning.

Keep all EN/FR/ES keys structurally aligned and use live pricing projections rather than numeric authored prices.

- [ ] **Step 5: Promote the comparison graph**

Add the three slugs to popular/related arrays in `compare-config.json` where Seedance, cinematic realism, ads, reference video, and multi-shot intent are represented. Limit homepage/catalog promotion to these three pages.

- [ ] **Step 6: Re-run comparison tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/comparison-content-contract.test.ts tests/compare-page-architecture.test.ts tests/compare-page-pricing-display.test.ts tests/seedance-2-5-marketing-page.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the comparison launch set**

```bash
git add content/comparisons/seedance-2-0-vs-seedance-2-5.json content/comparisons/kling-3-pro-vs-seedance-2-5.json content/comparisons/seedance-2-5-vs-veo-3-1.json frontend/config/compare-config.json tests/comparison-content-contract.test.ts tests/seedance-2-5-marketing-page.test.ts
git commit -m "feat: publish Seedance 2.5 comparisons"
```

### Task 10: Build Strong, Non-Cannibalizing Internal Linking

**Files:**
- Modify: `content/models/en/seedance-2-0.json`
- Modify: `content/models/fr/seedance-2-0.json`
- Modify: `content/models/es/seedance-2-0.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/en.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/fr.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/es.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/constants.ts`
- Modify: `frontend/components/marketing/MarketingFooter.tsx`
- Modify selected files under `content/{en,fr,es}/best-for/` for ads, cinematic realism, image-to-video, reference-to-video, multi-shot video, product videos, and UGC ads.
- Modify: `tests/seo-internal-links.test.ts`
- Modify: `tests/home-seo-signals.test.ts`
- Modify: `tests/pricing-model-links.test.ts`
- Modify: `tests/model-page-template-content.test.ts`

**Interfaces:**
- Produces: at least one relevant followed link to the 2.5 model page from homepage, models catalogue, pricing hub, Seedance examples, footer, 2.0 model page, and each selected best-for cluster.
- Preserves: all existing 2.0 URLs, titles, canonicals, and 4K-specific recommendations.

- [ ] **Step 1: Add a launch-link matrix test**

Create a table of required source owners and localized target paths:

```ts
const requiredTargets = {
  en: '/models/seedance-2-5',
  fr: '/fr/modeles/seedance-2-5',
  es: '/es/modelos/seedance-2-5',
};
```

Assert that the homepage, models catalogue, pricing route, footer, Seedance 2.0 page, and selected best-for documents each contain the correct localized target.

- [ ] **Step 2: Add anti-cannibalization assertions**

Assert that:

- `/models/seedance-2-0` remains self-canonical and indexable.
- `/models/seedance-2-0-fast` and `/models/dreamina-seedance-2-0-mini` remain published.
- 4K best-for content still points to Seedance 2.0, not 2.5.
- No registry replacement or redirect targets 2.0 at 2.5.

- [ ] **Step 3: Run focused linking tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seo-internal-links.test.ts tests/home-seo-signals.test.ts tests/pricing-model-links.test.ts tests/model-page-template-content.test.ts`

Expected: FAIL because strategic 2.5 inbound links are currently absent.

- [ ] **Step 4: Add the highest-authority links first**

Add 2.5 as:

- the first “current model” card in the models catalogue;
- the first Seedance entry in pay-as-you-go model choices;
- the current Seedance profile link in the homepage model data;
- the first Seedance footer engine link;
- a compact “Discover the latest Seedance 2.5” module on the 2.0 model page.

- [ ] **Step 5: Update only relevant best-for clusters**

Move 2.5 to the first recommendation where its factual capabilities match: ads, cinematic realism, image-to-video, reference-to-video, multi-shot video, product videos, and UGC ads. Keep Seedance 2.0 present as an alternative. Keep 4K pages centered on 2.0.

- [ ] **Step 6: Protect unique keyword intent**

Use these anchor families:

- `Seedance 2.5 for 30-second cinematic video`
- `Generate with Seedance 2.5`
- `Seedance 2.5 image and reference workflows`
- `Compare Seedance 2.5 with Seedance 2.0`

Do not change Seedance 2.0 page titles or its exact-match internal anchors where the source is about 4K, Seedance 2.0 pricing, or an existing 2.0 comparison.

- [ ] **Step 7: Re-run focused linking tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seo-internal-links.test.ts tests/home-seo-signals.test.ts tests/pricing-model-links.test.ts tests/model-page-template-content.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the internal-link launch graph**

```bash
git add content/models/en/seedance-2-0.json content/models/fr/seedance-2-0.json content/models/es/seedance-2-0.json 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts' 'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator' 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/constants.ts' frontend/components/marketing/MarketingFooter.tsx content/en/best-for content/fr/best-for content/es/best-for tests/seo-internal-links.test.ts tests/home-seo-signals.test.ts tests/pricing-model-links.test.ts tests/model-page-template-content.test.ts
git commit -m "feat: strengthen Seedance 2.5 internal linking"
```

Omit unchanged directories/files from staging after reviewing the exact diff.

### Task 11: Complete Indexation, Sitemap, Metadata, and Social Cards

**Files:**
- Verify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- Modify: `content/models/en/seedance-2-5.json`
- Modify: `content/models/fr/seedance-2-5.json`
- Modify: `content/models/es/seedance-2-5.json`
- Create: `frontend/public/models/seedance-2-5-launch.jpg`
- Modify: `tests/seedance-2-5-marketing-page.test.ts`
- Modify: `tests/premerge-seo-routes.test.ts`
- Modify: `tests/hreflang-variants.test.ts`
- Modify: `tests/schema-sitemap-architecture.test.ts`
- Modify: `tests/model-seo-signals.test.ts`

**Interfaces:**
- Consumes: indexed/sitemap publication from Task 5 and localized content from Task 7.
- Produces: canonical, hreflang, Open Graph, Twitter card, Product/WebPage/Breadcrumb schema, and sitemap entries for all three locales.

- [ ] **Step 1: Add failing route-level SEO assertions**

Verify these exact canonical routes:

```text
https://maxvideoai.com/models/seedance-2-5
https://maxvideoai.com/fr/modeles/seedance-2-5
https://maxvideoai.com/es/modelos/seedance-2-5
```

Assert `index,follow`, self-canonical URLs, complete EN/FR/ES/x-default hreflang, Product Offer, non-empty Open Graph image, and sitemap membership.

- [ ] **Step 2: Add 2.0 preservation assertions**

Assert that all three localized Seedance 2.0 model URLs remain in their existing sitemap and keep self-canonical metadata after 2.5 becomes indexed.

- [ ] **Step 3: Run focused SEO tests and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-marketing-page.test.ts tests/premerge-seo-routes.test.ts tests/hreflang-variants.test.ts tests/schema-sitemap-architecture.test.ts tests/model-seo-signals.test.ts`

Expected: FAIL on current noindex/sitemap-off assumptions.

- [ ] **Step 4: Wire the launch social image through the existing model-page metadata owner**

Registry publication drives robots and sitemap. Existing localized route helpers drive canonical and hreflang. Export the accepted City poster at 1200×630 to `frontend/public/models/seedance-2-5-launch.jpg`, without generating new artwork. Set `seo.image` in all three Seedance 2.5 localized JSON documents to `/models/seedance-2-5-launch.jpg`; keep `page.tsx` as the metadata owner that selects this field.

- [ ] **Step 5: Remove obsolete coming-soon social references**

Keep historical assets if other documents reference them, but ensure public metadata and visible page surfaces do not use `seedance-2-5-coming-soon.png` or `.svg`.

- [ ] **Step 6: Re-run focused SEO tests**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-marketing-page.test.ts tests/premerge-seo-routes.test.ts tests/hreflang-variants.test.ts tests/schema-sitemap-architecture.test.ts tests/model-seo-signals.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit indexation and social metadata**

```bash
git add content/models/en/seedance-2-5.json content/models/fr/seedance-2-5.json content/models/es/seedance-2-5.json frontend/public/models/seedance-2-5-launch.jpg tests/seedance-2-5-marketing-page.test.ts tests/premerge-seo-routes.test.ts tests/hreflang-variants.test.ts tests/schema-sitemap-architecture.test.ts tests/model-seo-signals.test.ts
git commit -m "feat: index Seedance 2.5 launch pages"
```

Stage only the model-page, sitemap, and final social-asset files actually changed.

### Task 12: Prepare the LinkedIn and Launch-Marketing Package

**Files:**
- Create: `docs/model-launch/seedance-2-5-linkedin-launch.md`
- Modify: `docs/model-launch/seedance-2-5.md`
- Test: `tests/seedance-2-5-readiness.test.ts`

**Interfaces:**
- Consumes: City and Train public marketing media, the canonical model page, and generator URL.
- Produces: approved launch copy and tracked destinations; performs no external publication.

- [ ] **Step 1: Add a documentation contract test**

Assert the launch package contains both canonical destinations, the two approved media names, three post variants, UTM conventions, and an explicit “do not publish automatically” note.

- [ ] **Step 2: Run the documentation test and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts`

Expected: FAIL because the LinkedIn package does not exist.

- [ ] **Step 3: Write the launch package**

Include:

- Announcement post: Seedance 2.5 is live on MaxVideoAI, with 30-second scenes, unified image/reference/edit workflows, and native audio.
- Creative post: City as the hero video, focused on continuity and controlled reveal.
- Product post: Train as the hero video, focused on movement, structure, and longer-form direction.
- Primary URL: `https://maxvideoai.com/models/seedance-2-5`.
- Conversion URL: `https://maxvideoai.com/app?engine=seedance-2-5`.
- UTM pattern: `utm_source=linkedin&utm_medium=social&utm_campaign=seedance_2_5_launch&utm_content=<announcement|city|train>`.
- Alt text for City and Train based on the accepted marketing ledger.
- A note that external posting requires explicit owner approval and is outside repository deployment.

- [ ] **Step 4: Re-run the documentation test**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the launch-marketing package**

```bash
git add docs/model-launch/seedance-2-5-linkedin-launch.md docs/model-launch/seedance-2-5.md tests/seedance-2-5-readiness.test.ts
git commit -m "docs: prepare Seedance 2.5 launch campaign"
```

### Task 13: Update the Production Handoff, Environment Contract, and Rollback

**Files:**
- Modify: `frontend/.env.local.example`
- Modify: `docs/model-launch/seedance-2-5.md`
- Modify: `docs/model-launch/seedance-2-5.engine.stub.ts`
- Modify: `tests/seedance-2-5-readiness.test.ts`

**Interfaces:**
- Produces: one operational source of truth for production configuration, smoke checks, monitoring, and rollback.
- Preserves: the hard kill switch and stored-charge refund/reconciliation path.

- [ ] **Step 1: Replace stale handoff assertions**

The readiness test must require this public production matrix:

```text
BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-260628
SEEDANCE_2_5_BYTEPLUS_ENABLED=true
SEEDANCE_2_5_PROVIDER=byteplus_modelark
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false
SEEDANCE_2_5_BYTEPLUS_MODES=t2v,i2v,ref2v,v2v,extend
```

Also require the words `kill switch`, `no automated retry`, `rollback`, `wallet`, `refund`, `City`, `Train`, `indexable`, and `sitemap`.

- [ ] **Step 2: Run the readiness test and verify failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts`

Expected: FAIL because the handoff still records closed public surfaces and admin-only execution.

- [ ] **Step 3: Rewrite the current-state and phase sections**

Record that the approved target is public flagship launch, all five modes, app/pricing/examples/compare/sitemap/indexation enabled, City and Train public, Dialogue private, and no additional pre-launch paid generation.

- [ ] **Step 4: Keep checked-in environment defaults fail-closed**

Update `frontend/.env.local.example` with the factual model ID and safe source defaults:

```text
BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-260628
SEEDANCE_2_5_BYTEPLUS_ENABLED=false
SEEDANCE_2_5_PROVIDER=disabled
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true
SEEDANCE_2_5_BYTEPLUS_MODES=t2v
```

The handoff document, not `frontend/.env.local.example`, owns the explicit public production values from Step 1. This preserves the kill switch for fresh local or review environments.

- [ ] **Step 5: Add production smoke checks**

Document read-only checks for:

- model page HTTP 200 in EN/FR/ES;
- generator boot with `engine=seedance-2-5` selected;
- selector `New` badge and first position;
- five visible modes and their upload fields;
- positive live quote for T2V and V2V;
- sitemap inclusion and self-canonical metadata;
- three comparison pages HTTP 200;
- Benchmark Lab and pricing page inclusion;
- media range response for City and Train.

- [ ] **Step 6: Add rollback order**

Rollback must be reversible and ordered:

1. Set `SEEDANCE_2_5_BYTEPLUS_ENABLED=false` to stop new submissions while leaving marketing pages online.
2. If UI exposure must be removed, set only `publication.app.published=false` and `publication.pricing.published=false`, regenerate projections, and deploy.
3. Keep the model page indexed unless the content itself is inaccurate; execution incidents do not require deleting SEO equity.
4. If indexation must be reversed, set model indexable and sitemap flags false without redirecting or deleting the route.
5. Reconcile pending jobs and refund stored charged amounts through existing logic; never issue a blind retry.

- [ ] **Step 7: Update the evidence stub**

Set `currentPhase: 'public_flagship_launch'`, `publicGenerationAllowed: true`, `publicMarketingPageAllowed: true`, `publicDiscoveryAllowed: true`, and the five-mode/reference contract. Keep it documentation-only.

- [ ] **Step 8: Re-run the readiness test**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/seedance-2-5-readiness.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the production handoff**

```bash
git add frontend/.env.local.example docs/model-launch/seedance-2-5.md docs/model-launch/seedance-2-5.engine.stub.ts tests/seedance-2-5-readiness.test.ts
git commit -m "docs: finalize Seedance 2.5 production handoff"
```

### Task 14: Run the Complete Pre-Launch Verification Matrix

**Files:**
- Modify only files required to fix failures within the preceding task's scope.
- Do not weaken or delete an unrelated failing contract.

**Interfaces:**
- Consumes: every preceding task.
- Produces: a clean, buildable, deployable `main` state with documented verification evidence.

- [ ] **Step 1: Confirm worktree and commit boundaries**

Run:

```bash
git status --short --branch
git log --oneline -20
git diff --check
```

Expected: only intentional launch changes are present and `git diff --check` is clean.

- [ ] **Step 2: Run the focused Seedance/runtime suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/seedance-2-5-readiness.test.ts \
  tests/seedance-2-5-marketing-page.test.ts \
  tests/seedance-2-pricing.test.ts \
  tests/byteplus-seedance-profiles.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/generate-billing-preflight.test.ts \
  tests/engine-select-architecture.test.ts \
  tests/engine-select-family-grouping.test.ts \
  tests/seedance-2-5-workspace-contract.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the focused marketing/SEO suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-template-content.test.ts \
  tests/model-seo-signals.test.ts \
  tests/comparison-content-contract.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/compare-page-pricing-display.test.ts \
  tests/benchmark-lab-data.test.ts \
  tests/app-engine-scores.test.ts \
  tests/seo-internal-links.test.ts \
  tests/home-seo-signals.test.ts \
  tests/premerge-seo-routes.test.ts \
  tests/hreflang-variants.test.ts \
  tests/schema-sitemap-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run registry and model integrity checks**

Run:

```bash
pnpm model:registry:check
pnpm model:check
pnpm models:audit
```

Expected: PASS and zero critical audit findings.

- [ ] **Step 5: Run pricing integrity checks**

Run:

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
```

Expected: PASS with no change to pre-existing public rows and no mismatch in the canonical audit.

- [ ] **Step 6: Run full repository validation**

Run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 7: Perform a local visual and functional smoke without submitting a paid generation**

Inspect desktop and mobile states for:

- `/models/seedance-2-5`, `/fr/modeles/seedance-2-5`, `/es/modelos/seedance-2-5`;
- `/app?engine=seedance-2-5` selector, badge, five modes, uploads, audio toggle, quote, and disabled generate state when required assets are missing;
- `/pricing#seedance-2-5-pricing`;
- `/benchmarks`;
- the three comparison routes;
- homepage, models catalogue, Seedance examples, and Seedance 2.0 upgrade link.

Do not press Generate during this smoke.

- [ ] **Step 8: Record final verification evidence**

Append the command list, date, commit hash, test counts, build result, and local route smoke result to the final handoff section of `docs/model-launch/seedance-2-5.md`.

- [ ] **Step 9: Commit verification documentation if it changed**

```bash
git add docs/model-launch/seedance-2-5.md
git commit -m "docs: record Seedance 2.5 launch verification"
```

Skip this commit if the handoff already contains the exact final evidence and the file has no diff.

### Task 15: Deploy, Verify Production, and Start the Launch Window

**Files:**
- No source edits expected.
- External state: production environment values and deployment platform.
- External publication: LinkedIn remains separately authorized.

**Interfaces:**
- Consumes: the clean verified commit from Task 14.
- Produces: a public production launch with a reversible execution gate.

- [ ] **Step 1: Reconcile the current `main` tip before deployment**

Fetch the latest remote state, inspect divergence, and integrate without discarding local commits or user work. Re-run Task 14 if `main` moved or a merge/rebase changes source files.

- [ ] **Step 2: Review the final diff and commit list with the product owner**

Summarize runtime, UI, pricing, marketing, SEO, comparison, benchmark, and handoff changes. Explicitly state that Seedance 2.0 remains live/indexed and no new paid generation occurred.

- [ ] **Step 3: Set the explicit production environment matrix**

Configure:

```text
BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-260628
SEEDANCE_2_5_BYTEPLUS_ENABLED=true
SEEDANCE_2_5_PROVIDER=byteplus_modelark
SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false
SEEDANCE_2_5_BYTEPLUS_MODES=t2v,i2v,ref2v,v2v,extend
```

Confirm the existing ModelArk credentials and global BytePlus route are present without printing secret values.

- [ ] **Step 4: Push and deploy only after explicit approval**

Push the verified `main` commit and trigger the normal production deployment. Do not create a separate feature branch because the owner requested a `main` launch workflow.

- [ ] **Step 5: Run read-only production smoke checks**

Verify HTTP status, canonical, hreflang, robots, sitemap, structured data, comparison pages, Benchmark Lab, pricing, generator selector, five modes, and City/Train media. Confirm Seedance 2.0 pages still return 200 with self-canonicals.

- [ ] **Step 6: Observe one owner-controlled live T2V generation**

The product owner initiates the first normal paid render. Observe one wallet debit, provider acceptance, polling completion, durable media, and no duplicate charge. Do not retry automatically if it fails; verify refund/reconciliation before the owner chooses another attempt.

- [ ] **Step 7: Open normal user access**

Once the first live render is healthy, leave the public flags in place and monitor ordinary user traffic. I2V/reference/edit/extend evidence can accumulate from real product use; do not turn this into a paid pre-launch batch.

- [ ] **Step 8: Request indexation and publish LinkedIn only with separate approval**

After production verification, the owner may authorize Search Console indexation requests and LinkedIn posting using `docs/model-launch/seedance-2-5-linkedin-launch.md`. These are external side effects and are not implied by deployment approval.

- [ ] **Step 9: Monitor the first 24-hour launch window**

Track submission acceptance, completion/failure rate, median/p90 latency once eligible, duplicate charges, refunds, media durability, mode-specific failures, and customer-facing errors. Use the kill switch immediately for systemic billing duplication, unreconciled charges, or repeated provider rejection; keep marketing pages live unless their claims are inaccurate.

---

## Acceptance Criteria

- Seedance 2.5 is visible to every authenticated user and is the first/default engine for a fresh workspace.
- The selector and sidebar display Seedance 2.5 with a generic registry-owned `New` label.
- T2V, I2V, reference-to-video, video editing, and extension share the normal MaxVideoAI composer, uploads, quote, billing, polling, storage, and failure UX.
- The public options stay factual: 4–30 seconds, 480p/720p, 16:9, 24 FPS, audio optional, and 50 combined references capped at 30 images, 10 videos, and 10 audio files.
- Pricing is public, canonical, and unchanged from the approved Seedance 2.5 policy.
- The EN/FR/ES model pages are indexed, in sitemaps, self-canonical, hreflang-complete, schema-complete, and conversion-oriented.
- City and Train are visible; Dialogue remains private pending human audio review.
- Benchmark Lab and the generator selector show an evidence-bounded non-zero score with unevidenced metrics left null.
- The three priority comparison pages are indexed and linked.
- Homepage, models catalogue, pricing, examples, footer, Seedance 2.0, and relevant best-for clusters link to Seedance 2.5.
- Seedance 2.0, Fast, and Mini remain live, indexed, self-canonical, and discoverable; 4K intent continues to point to 2.0.
- Full validation and production build pass before push/deployment.
- Production can stop new 2.5 submissions with one kill switch without deleting marketing or SEO pages.
- No additional paid pre-launch generation or automatic retry occurs.

## Post-Launch Follow-Up

- Remove `launchBadge: 'new'` in a small registry-only change after the owner decides the launch window has ended; regenerate projections and keep the flagship discovery rank unless product strategy changes.
- Re-score Seedance 2.5 under the versioned eight-prompt methodology when normal usage provides enough representative outputs; preserve the initial score date in the changelog.
- Publish Dialogue only after human dialogue, speaker-attribution, and lip-sync review.
- Use the existing 30-day/30-completion/5-user thresholds before displaying operational latency; do not show zeros when data is unavailable.
- Expand comparison coverage only from real search demand and model-fit intent; avoid all-to-all comparison generation.
