# Studio Tool Block Mini Apps Implementation Plan

> Use `superpowers:executing-plans` for execution. TDD is required for behavior changes.

## Goal

Turn Studio's specialized canvas blocks into product-specific mini tools instead of generic shot forms. Each specialized block must expose the relevant options from its existing MaxVideoAI tool, persist those settings on the node, send them to the right API, and show a trustworthy price only when the block is ready to generate.

## Current Gaps

- Character Builder stores only a small subset of the real tool settings and generation currently sends default traits/output options.
- Angle and Upscale tool responses include pricing, but Studio outputs discard it.
- Studio pricing still uses video preflight for every `shot`, so non-video tools can show wrong or noisy estimates.
- `ShotNodeInspector` is generic and does not behave like a mini tool for Character, Angle, Upscale, Storyboard, or Audio.

## Task 1: Lock Tool Settings And Pricing Contracts

- Add failing tests in `tests/maxvideoai-editor-generation-blocks.test.ts` for:
  - Character Builder default settings include full real tool state: traits, output options, advanced notes, visibility locks.
  - A helper can build a Character Builder request from Studio settings without dropping user-selected traits/options.
  - Angle and Upscale output metadata preserves API pricing.
  - Tool-aware pricing returns a blocked estimate when required inputs are missing.
  - Tool-aware pricing returns deterministic estimates for Character Builder and Audio without calling video preflight.

## Task 2: Add Tool-Specific Pure Adapters

- Create or extend route-local helpers under `workspace/_lib/`:
  - `workspace-tool-settings.ts` for defaults/normalization/patching.
  - `workspace-tool-requests.ts` for Character Builder, Angle, Upscale, Storyboard, and Audio request construction.
  - `workspace-tool-pricing.ts` for blocked/ready pricing estimates.
- Keep provider/server-only logic out of client components.
- Reuse existing product tool constants from:
  - `@/lib/character-builder`
  - `@/lib/audio-generation`
  - `@/lib/tools-angle`
  - `@/lib/tools-upscale`

## Task 3: Wire Generation Routing To The Adapters

- Make `workspace-generation-routing.ts` call pure request builders.
- Preserve `result.pricing` from Angle and Upscale in `WorkspaceOutputMetadata`.
- Ensure Character Builder sends traits, outputOptions, advancedNotes, mustRemainVisible, quality, format, and generateCount.
- Keep video generation behavior and Luma Ray 3.2 routing unchanged.

## Task 4: Replace Generic Inspector Sections With Mini Tool Panels

- Split `ShotNodeInspector` into compact reusable blocks and specialized sections:
  - Character Builder: output mode, quality, format, count, consistency, reference strength, traits, hair/outfit toggles, notes, output options.
  - Angle: engine, rotation, tilt, zoom, safe mode, best angles.
  - Upscale: engine, factor/target, target resolution, output format.
  - Storyboard: target model, length/frame count, orientation, tier.
  - Audio: pack-specific prompt/script, mood, intensity, duration, voice settings where applicable.
- Keep the model select hidden for single-engine tools and filtered for multi-engine tools.
- Show "Connect input" / "Needs attention" instead of price when validation blocks generation.

## Task 5: Verification

- Run focused tests:
  - `node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts`
  - `npm run test:editor`
  - `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`
- Run `git diff --check`.
- Browser smoke the Studio workspace if the dev server is available.
