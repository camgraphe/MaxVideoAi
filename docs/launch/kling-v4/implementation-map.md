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

The current source is the captured Fal contract; see `provider-evidence-2026-10-21.md`. Fal is now the initial target. No direct V4 request contract or cross-provider voice identity has been established for a later direct route. Do not invent a V4 direct endpoint or reuse the V3 direct request shape.

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
- `frontend/src/server/agent-api/generation-normalization.ts`: V4 integer shot-plan budget and ordered reference semantics. Explicit canonical subjects now bind existing ordered reference slots; subject media cannot arrive as arbitrary settings URLs.
- `frontend/src/server/agent-api/generation-capability-validation.ts`: per-model multi-shot limits, retaining V3 defaults.
- `frontend/src/server/mcp/tools/prepare-generation.ts`: outer schema can represent the V4 envelope; canonical validation still applies the selected model's limit and executable model discovery remains closed.
- `frontend/src/server/agent-api/paid-video-request-body.ts`: V4 `image_urls` entries also remain in `inputs`, preserving asset IDs, dimensions, sizes and other metadata; existing video slots are preserved. Existing private-reference resolution is required, never bypassed.
- `tests/kling-v4-request-projections.test.ts`: seven-element/voice transport, invalid rounding and duration sums, old-model limits, draft detail projection, ordered refs, and owned-media fixtures for I2V start/end, REF2V images/videos/start, V2V source/image refs. Tests call pure builders only; they do not price or execute a request.

The dedicated provider request builder, no-spend gates, direct routing policy and pricing/media workflow are owned separately by this change's lead. Relevant files include `frontend/src/lib/kling-v4.ts`, `fal-request-body.ts`, `fal.ts`, `frontend/app/api/generate/_lib/route-context.ts`, `frontend/src/server/agent-runtime/model-executability.ts`, `frontend/app/api/preflight/_lib/media-aware-preflight.ts` and the model launch asset configuration. Keep these gates closed even if a pure projection test succeeds.

## App, Studio and MCP offline completion

The follow-on phase implements explicit V4 workspace controls, strict shot editing, active-mode reference projection, seven owned subjects, saved setup recreation and preflight subjects. V3 defaults remain separate. Hidden inactive assets survive mode changes without entering the active request. Arbitrary voice bindings are preserved for explanation but cannot be submitted.

Canonical subjects group existing owned reference slots. Materialization retains the exact original IDs/URLs in provider elements without duplicating them in flat inputs. Owned resolution precedes pricing; exact video cadence, dimensions and duration are checked. The immutable pricing snapshot binds those resolved physical facts, so changed source facts require a new quote at confirmation. A conservative 15-visual-source ceiling counts subject views while the provider's mixed-limit wording remains unqualified.

Studio exposes structured shot plans in `video.prepare`, quote presentation and editing. An edited plan travels in a bounded persisted revision and requires a fresh quote; a long plan does not bypass the ordinary message limit. The video action can reference up to50 existing media, while the ordinary chat attachment pool remains10: larger subject sets must use ready project outputs. MCP carries the same subjects and strict model-specific normalization. Discovery/execution remain gated.

Server validation requires an owned original for every flat or subject reference, ignores browser-supplied facts, preserves repetitions and probes source cadence without rounding or an invented30FPS default. Images require300px sides, video700–4553px sides, ratio0.4–2.5, documented file-size caps and source tolerances. The media30.05s tolerance does not expand the30s combined reference budget or integer output limit.

Remaining certification prerequisites are real approved provider calls and full-output review, provider billing precision, exact-model evidence, and a server-owned fal voice issuance/selection workflow if voices are offered. No V4 mode is newly certified. A fixture cannot establish quality, entitlement or future direct/fallback parity.

## Media and normal-page empty states

No fake hero, poster, generated prompt demonstration, quality score or reference file is supplied. The normal page's draft ideas are editorial text. `_lib/model-page-media.ts` returns no media badges when neither playable video nor poster exists. `_components/ModelDecisionMediaCard.tsx` suppresses media caption/watch links in that case. `_components/ModelDecisionPromptingSection.tsx` suppresses a demonstration lacking playable media or poster rather than displaying view-model fallback duration/audio as evidence. Existing real media keeps its badges/caption.

Launch asset readiness is a separate gate and remains incomplete without real accepted assets. Follow the lead's media-readiness/preview requirements; empty playlists and fallback media are not substitutes. `external-fal-import/kling-v4.ts` now provides an explicit four-mode adapter beside FLUX. It verifies original/poster/short-preview evidence and retains owned ordered references. Historical provider field names map to the workspace schema for recreation; never relabel another model’s manifest. No admin playlist write or reorder is part of this preparation.

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
