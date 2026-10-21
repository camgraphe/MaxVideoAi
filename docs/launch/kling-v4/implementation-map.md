# Kling V4 — surfaces and request preparation

Prepared on 2026-10-22 Europe/Madrid in the isolated `kling-v4-launch-prep` worktree. This document describes a branch candidate, not a launch or an end-to-end certified integration. No generation, deployment, storage upload, database change, admin publication or paid quote was performed for these surfaces.

## Identity and publication

`frontend/config/model-registry.json` owns the sole identity `kling-v4`, slug `kling-v4`, family `kling`. The model page is published in the branch so its normal production template can be reviewed, with `indexable:false`; app, pricing, examples, compare and sitemap publication all remain false. `presentationOnly` is deliberately absent because that path selects the prelaunch template. Deploy only to a protected preview until release approval; noindex is not authentication.

The new identity has no successor/replacement relationship. Existing Kling URLs, media and playlist order are unchanged. Family/comparison/navigation discovery must continue using registry surface gates; do not add hardcoded V4 links. The future flip requires separate provider qualification, customer tariff approval, media acceptance and explicit publication approval. Turning on the model page alone must not turn on generation or pricing.

Authored owners:

- `frontend/src/config/fal-engines/kling-v4.ts`: four mode contracts, no customer price or media, and the exact **unrendered** Ignition writing prompt from `films.json`. Shared constants feed the dedicated Fal builder; no exclusive-provider claim.
- `frontend/src/config/fal-engines/registry.ts`: raw entry wiring.
- `content/models/{en,fr,es}/kling-v4.json`: normal-page copy, editorial prompt ideas, contract limits and empty examples; no generated-evidence claim.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/kling-v4.ts` and `model-page-template-registry.ts`: normal template, anchor-only CTAs, no pricing or comparison CTA.

Generated owners (regenerate, do not hand edit): `frontend/config/model-runtime.json`, `frontend/config/engine-catalog.json`, `frontend/config/model-roster.json`, `docs/model-roster.json`, `docs/model-roster.csv`.

## Exact prepared control envelope

The current source is the captured Fal contract; see `provider-evidence-2026-10-21.md`. Direct Kling remains the intended primary route, but no direct V4 request contract or cross-provider voice identity has been established. Do not invent a V4 direct endpoint or reuse the V3 direct request shape.

| Mode | Prepared inputs | Deliberately absent |
| --- | --- | --- |
| `t2v` | prompt or `multi_prompt`; 3–30 whole seconds; 720p/1080p; 16:9, 9:16, 1:1, 21:9 | FPS selector, audio switch, negative prompt, seed, CFG |
| `i2v` | canonical `image_url` mapped to `start_image_url`; optional `end_image_url`; prompt or shot plan | aspect selector, timed keyframe array |
| `ref2v` | optional start image, up to ten images including start, up to five reference videos; provider elements up to seven | end frame, global voice list, edit-only source video |
| `v2v` | required source video and prompt; optional reference images and image-based elements; requested duration3–30 or provider source-duration inheritance when omitted | multi-shot, video/voice elements, aspect selector |

Each shot has 1–512 prompt characters and an integer duration from 1 through30; the total must equal the requested3–30 seconds. The thirty-item transport bound follows from the one-second minimum and thirty-second total, not a separately documented provider shot-count limit. Existing V3 canonical six-shot/fifteen-second limits remain unchanged. Native audio is a provider claim described through the prompt, not a locally measured output or a new API switch.

## Bounded transport work verified offline

- `frontend/src/lib/video-provider-elements.ts`: explicit `{engineId:'kling-v4'}` scope preserves seven subjects and per-element `voiceId`; rejects overflow instead of truncating. Default normalization and direct V3 element-list behavior remain unchanged.
- `frontend/app/api/generate/_lib/request-option-normalizers.ts` and `request-options.ts`: V4 shot durations reject rounding, empty scenes, overflows and mismatched total; route-shaped elements preserve `voiceId` and seven entries. Invalid normalized controls return400. These are preparation functions behind the release gate.
- `frontend/src/server/agent-api/generation-normalization.ts`: V4 integer shot-plan budget and ordered reference semantics. No new canonical elements field was introduced.
- `frontend/src/server/agent-api/generation-capability-validation.ts`: per-model multi-shot limits, retaining V3 defaults.
- `frontend/src/server/mcp/tools/prepare-generation.ts`: outer schema can represent the V4 envelope; canonical validation still applies the selected model's limit and executable model discovery remains closed.
- `frontend/src/server/agent-api/paid-video-request-body.ts`: V4 `image_urls` entries also remain in `inputs`, preserving asset IDs, dimensions, sizes and other metadata; existing video slots are preserved. Existing private-reference resolution is required, never bypassed.
- `tests/kling-v4-request-projections.test.ts`: seven-element/voice transport, invalid rounding and duration sums, old-model limits, draft detail projection, ordered refs, and owned-media fixtures for I2V start/end, REF2V images/videos/start, V2V source/image refs. Tests call pure builders only; they do not price or execute a request.

The dedicated provider request builder, no-spend gates, direct routing policy and pricing/media workflow are owned separately by this change's lead. Relevant files include `frontend/src/lib/kling-v4.ts`, `fal-request-body.ts`, `fal.ts`, `frontend/app/api/generate/_lib/route-context.ts`, `frontend/src/server/agent-runtime/model-executability.ts`, `frontend/app/api/preflight/_lib/media-aware-preflight.ts` and the model launch asset configuration. Keep these gates closed even if a pure projection test succeeds.

## App, Studio and MCP gaps that block certification

This branch does **not** claim fully working Kling V4 controls in all product editors.

1. `workspace-workflow-projection.ts`, `useWorkspaceEngineModeState.ts`, `WorkspaceComposerSurface.tsx` and the existing Kling controls still require an explicit V4 UI design. The common workspace state uses V3 fifteen-second totals and global voice handling. The Composer editor supports adding scenes; six scenes is a canonical V3 limit, not a hardcoded six-row rendering limit. Do not expose V4 by simply broadening `supportsKlingV3Controls` because that also enables V3 shotType/CFG/voice behavior.
2. `workspace-generation-inputs.ts` currently builds elements according to V3/Omni rules (including a single video element). `workspace-generation-payload.ts` groups elements with those controls. Their editor/state/persistence paths need V4-specific seven-subject, max-three video and max-three voiced-element validation before app certification. `KlingElementsBuilder.tsx`, `workspace-video-settings.ts` and `workspace-model-setups.ts` do not yet provide a complete per-element voice editor and persistence contract.
3. Canonical agent requests support flat controlled/owned references plus settings; they have no canonical element grouping or voice-binding structure. **Do not inject element URLs via arbitrary settings.** A future contract must preserve ownership checks, reference identity/order, quote hashing, confirmation immutability and provider-specific voice provenance. Touchpoints: `generation-types.ts`, `generation-normalization.ts`, reference resolution, capability validation, paid body projection and MCP input schemas.
4. `frontend/src/server/studio/conversation-capabilities.ts` deliberately filters out `multi_prompt` settings. Studio conversation input/action schemas and editors need an explicit shot-plan representation before exposure. Do not claim Studio multi-shot support merely because the canonical MCP schema accepts the array.
5. `workspace-model-certification.ts` remains unchanged. No V4 mode is newly certified. Exact-model editorial/quality evidence is required; siblings cannot confer certification.

Future tests must cover all four app modes through the actual editor state and saved setups; thirty-second shot plans without stale durationOption; rejection of fractions/overflow; seven subjects with mixed allowed visual inputs; per-element voices limited to three and bound to the chosen provider; ownership failure before quote and confirmation; canonical hash changes when element order or voice changes; parity of Studio/MCP/app paid bodies; direct-primary/fallback equivalence only after the direct contract exists. Then execute explicitly approved canaries for every claimed mode and inspect complete audio/video outputs. A fixture alone cannot establish output quality, provider access or fallback equivalence.

## Media and normal-page empty states

No fake hero, poster, generated prompt demonstration, quality score or reference file is supplied. The normal page's draft ideas are editorial text. `_lib/model-page-media.ts` returns no media badges when neither playable video nor poster exists. `_components/ModelDecisionMediaCard.tsx` suppresses media caption/watch links in that case. `_components/ModelDecisionPromptingSection.tsx` suppresses a demonstration lacking playable media or poster rather than displaying view-model fallback duration/audio as evidence. Existing real media keeps its badges/caption.

Launch asset readiness is a separate gate and remains incomplete without real accepted assets. Follow the lead's media-readiness/preview requirements; empty playlists and fallback media are not substitutes. `external-fal-import/contract.ts` remains FLUX-specific unless separately generalized with an explicit Kling adapter; never feed it a Kling manifest by renaming the model. No admin playlist write or reorder is part of this preparation.

## Local verification commands

```sh
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/kling-v4-marketing.test.ts tests/kling-v4-request-projections.test.ts tests/model-page-hero-media.test.ts tests/model-prompting-view-model.test.ts tests/model-prompting-architecture.test.ts tests/model-page-template-content.test.ts tests/model-page-template-registry.test.ts tests/generate-request-options.test.ts tests/mcp-generation-normalization.test.ts tests/generation-image-dimensions.test.ts tests/p0-video-request-bodies.test.ts tests/mcp-provider-reference-parity.test.ts
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
# From frontend/:
./node_modules/.bin/tsc --noEmit
```

The full normal page should additionally be inspected in the protected preview after the lead's build succeeds, including empty hero/example/Prompt Lab states in all three locales. Passing offline tests is not authorization to flip publication, pricing, provider execution or media gates.
