# Studio Specialized Blocks And Luma Ray 3.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Studio canvas generation blocks into specialized product tools that call the existing MaxVideoAI tool APIs, and add Luma Ray 3.2 to the model catalog and Studio video workflows with direct Luma as the primary provider and fal.ai only as fallback.

**Architecture:** Keep Studio as the orchestration canvas. Model generation blocks continue through the normal engine catalog and `/api/generate`; tool blocks get explicit `toolKind` settings and route to existing APIs such as Character Builder, Angle, Upscale, Image, and Audio. Luma Ray 3.2 is represented as a Luma-direct engine first, with fal endpoint ids retained only as fallback routing metadata. Inspectors use the same node shell but render block-specific controls instead of showing irrelevant generic model options.

**Tech Stack:** Next.js App Router, React, TypeScript, node:test contracts, existing Studio canvas modules under `frontend/app/(core)/(workspace)/app/studio/workspace`, existing tool runners in `frontend/lib/api-generation.ts`, model catalog under `frontend/src/config/fal-engines`, and direct/fallback provider routing under the existing generation provider server modules.

---

### Task 1: Strengthen Studio Block Contracts

**Files:**
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Modify after red: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`
- Modify after red: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`
- Modify after red: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`

- [ ] **Step 1: Add failing contract tests for specialized preset identities**

Add tests asserting these preset ids exist: `generate-image`, `generate-video`, `modify-video`, `storyboard`, `character-builder`, `angle`, `upscale-image`, `upscale-video`, `audio-music`, `audio-voiceover`, `audio-sfx`, `audio-sound-design`, `audio-sound-design-voice`, `chat-box`.

Assert `character-builder` has `toolKind: 'character-builder'`, `outputKind: 'image'`, no video family, and default model `character-builder-tool`.

Assert `angle` has `toolKind: 'angle'`, `outputKind: 'image'`, default model `angle-flux-multiple-angles`, and requires a reference image.

Assert `storyboard` has `toolKind: 'storyboard'`, `outputKind: 'image'`, default model `storyboard-gpt-image-2`, and is not a direct video block.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- tests/maxvideoai-editor-generation-blocks.test.ts
```

Expected: FAIL because the new preset ids and `toolKind` field do not exist yet.

- [ ] **Step 3: Add the minimum types and presets**

Add `WorkspaceToolKind` and extend `WorkspaceShotSettings` with:

```ts
toolKind?: WorkspaceToolKind;
toolSettings?: WorkspaceToolSettings;
```

Add union ids for the new presets. Replace `character-video` with `character-builder`, replace `storyboard-video` with `storyboard`, add `angle`, `audio-sound-design`, and `audio-sound-design-voice`.

- [ ] **Step 4: Add virtual tool capabilities**

Add virtual capabilities for:

```ts
character-builder-tool
storyboard-gpt-image-2
angle-flux-multiple-angles
angle-qwen-multiple-angles
upscale-image-seedvr
upscale-image-topaz
upscale-image-recraft-crisp
upscale-video-seedvr
upscale-video-flashvsr
upscale-video-topaz
audio-cinematic
audio-cinematic-voice
```

Use exact required inputs from the product tools:
- Character Builder: optional `reference`, `style`, `prompt`
- Storyboard: required `prompt`, optional `reference`, `character`, `style`
- Angle: required `reference`
- Upscale image: required `reference`
- Upscale video: required `video_reference`
- Cinematic audio: required `video_reference`, optional `prompt`
- Cinematic voice: required `video_reference` and `prompt`

- [ ] **Step 5: Run the contract test and verify GREEN**

Run:

```bash
npm test -- tests/maxvideoai-editor-generation-blocks.test.ts
```

Expected: PASS.

### Task 2: Route Tool Blocks To Real Product APIs

**Files:**
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`

- [ ] **Step 1: Add failing tests for API routing helpers**

Add tests for pure helper functions that should be exported from `workspace-generation-routing.ts`:

```ts
resolveWorkspaceGenerationRoute({ family: 'image', workflowType: 'text_to_image' }) === 'image'
resolveWorkspaceGenerationRoute({ toolKind: 'character-builder' }) === 'character-builder'
resolveWorkspaceGenerationRoute({ toolKind: 'storyboard' }) === 'storyboard'
resolveWorkspaceGenerationRoute({ toolKind: 'angle' }) === 'angle'
resolveWorkspaceGenerationRoute({ family: 'upscale', workflowType: 'video_upscale' }) === 'upscale'
resolveWorkspaceGenerationRoute({ family: 'audio', workflowType: 'cinematic_audio' }) === 'audio'
```

Expected RED: `resolveWorkspaceGenerationRoute` and new workflow values do not exist.

- [ ] **Step 2: Implement the route resolver**

Export `resolveWorkspaceGenerationRoute(settings)` returning:

```ts
'video' | 'image' | 'audio' | 'upscale' | 'character-builder' | 'storyboard' | 'angle'
```

Route `settings.toolKind` before generic family.

- [ ] **Step 3: Implement `submitCharacterBuilderGeneration`**

Import `runCharacterBuilderTool`. Build request from connected image/text inputs:
- If a reference image is connected, use `sourceMode: 'reference-image'`; otherwise `scratch`.
- Put connected `reference` as `identity`, connected `style` as `style`.
- Use compact defaults: `outputMode: 'portrait-reference'`, `consistencyMode: 'balanced'`, `referenceStrength: 'balanced'`, `qualityMode: 'draft'`, `formatMode: 'standard'`.
- Use the prompt as `advancedNotes`.
- Output first `response.run.results[0]` as an image output.

- [ ] **Step 4: Implement `submitStoryboardGeneration`**

Import storyboard helpers already used by `StoryboardWorkspace` where reusable. Build a board generation request with:
- `engineId: 'gpt-image-2'`
- `mode: 'i2i'` when references exist, otherwise `t2i`
- `source: 'storyboard'`
- `metadata.storyboard.role: 'board'`
- `metadata.storyboard.targetModel` from settings defaulting to `seedance`

Output the first image as an image output.

- [ ] **Step 5: Implement `submitAngleGeneration`**

Import `runAngleTool`. Require one connected image. Use `engineId` from settings: `angle-flux-multiple-angles` maps to `flux-multiple-angles`, `angle-qwen-multiple-angles` maps to `qwen-multiple-angles`. Default params: `{ rotation: 35, tilt: 0, zoom: 1 }`. Output the first returned image.

- [ ] **Step 6: Upgrade `submitUpscaleGeneration`**

Stop hardcoding SeedVR. Map Studio model ids to real `UpscaleToolEngineId`:

```ts
upscale-image-seedvr -> seedvr-image
upscale-image-topaz -> topaz-image
upscale-image-recraft-crisp -> recraft-crisp
upscale-video-seedvr -> seedvr-video
upscale-video-flashvsr -> flashvsr-video
upscale-video-topaz -> topaz-video
```

Preserve current target resolution behavior.

- [ ] **Step 7: Upgrade audio routing**

Add workflow types `cinematic_audio` and `cinematic_voiceover`. Map:
- `music_generation` -> `music_only`
- `voiceover_generation` -> `voice_only`
- `sfx_generation` -> `sfx_only`
- `cinematic_audio` -> `cinematic`
- `cinematic_voiceover` -> `cinematic_voice`

- [ ] **Step 8: Run contracts**

Run:

```bash
npm test -- tests/maxvideoai-editor-generation-blocks.test.ts
```

Expected: PASS.

### Task 3: Add Luma Ray 3.2 To The Engine Catalog With Direct Luma Primary

**Files:**
- Create: `frontend/src/config/fal-engines/luma-ray-3-2.ts`
- Modify: `frontend/src/config/fal-engines/registry.ts`
- Modify: `frontend/src/config/engineCatalog.overrides.ts`
- Modify or create direct Luma provider routing under the existing `frontend/src/server` generation provider layout after inspecting current provider files
- Modify: `tests/validate-request.test.ts`
- Modify: `tests/fal-engine-catalog-architecture.test.ts`
- Modify if needed: pricing tests/helpers for Luma Ray pricing

- [ ] **Step 1: Add failing registry tests**

Assert the registry includes `lumaRay3_2`, modes `t2v`, `i2v`, `v2v`, and direct-provider metadata for Luma. Also assert the fal endpoint ids exist only as fallback metadata:

```ts
luma/agent/ray/v3.2/text-to-video
luma/agent/ray/v3.2/image-to-video
luma/agent/ray/v3.2/video-to-video
```

Assert caps include durations `5s` and `10s`, resolutions `540p`, `720p`, `1080p`, HDR and EXR controls, and no native audio.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- tests/validate-request.test.ts
```

Expected: FAIL because `lumaRay3_2` and direct Luma routing metadata are missing.

- [ ] **Step 3: Add the Luma Ray 3.2 engine file**

Base it on `luma-ray-2.ts`, but do not model it as fal-primary. Use Ray 3.2 values:
- id `lumaRay3_2`
- public slug `luma-ray-3-2`
- label `Luma Ray 3.2`
- provider `Luma AI`
- provider metadata `provider: 'luma'`, direct routing primary, fal fallback ids
- modes `t2v`, `i2v`, `v2v`
- durations `5s`, `10s`
- resolutions `540p`, `720p`, `1080p`
- aspect ratios `3:4`, `4:3`, `1:1`, `9:16`, `16:9`, `21:9`
- direct Luma request mapping first; fal model ids from fal docs only for fallback
- optional controls `loop`, `hdr`, `exr_export`, `reference_image_urls`, `keyframes`, `keyframe_indexes`, `edit_strength`, `auto_controls`

- [ ] **Step 4: Register direct-provider routing**

Inspect current generation provider routing. Add or extend Luma routing so `lumaRay3_2` goes to direct Luma by default. Use fal fallback only when the direct Luma path is disabled, unconfigured, or returns a provider-level unavailable error.

- [ ] **Step 5: Register it**

Import the new registry in `frontend/src/config/fal-engines/registry.ts` and add `lumaRay3_2` to `engineCatalog.overrides.ts` with best-for copy focused on cinematic control, HDR, keyframes and video edit.

- [ ] **Step 6: Run engine tests**

Run:

```bash
npm test -- tests/validate-request.test.ts tests/fal-engine-catalog-architecture.test.ts
```

Expected: PASS.

### Task 4: Make Inspectors Specialized

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeInspector.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeInspectorControls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`

- [ ] **Step 1: Add inspector behavior tests if feasible**

Use contract tests to assert helper functions exist for:
- hiding model select on `toolKind: 'character-builder'` when there is a single tool engine
- showing only tool engine ids for `upscale-image`, `upscale-video`, `angle`
- showing video-to-video models only for `modify-video`

- [ ] **Step 2: Add helper functions**

Create or export helper functions:

```ts
isToolOnlyPreset(settings)
compatibleCapabilitiesForShot(settings, capabilities)
toolPanelSectionsForShot(settings)
```

- [ ] **Step 3: Render specialized sections**

For each tool kind:
- Character Builder: Source mode, output mode, consistency, quality, format, output options.
- Storyboard: target model, length, orientation, tier.
- Angle: engine, rotation, tilt, zoom, best angles.
- Upscale: engine, mode, factor/target, output format.
- Audio: pack-specific prompt/script/video requirements.

Keep generic model controls for `generate-video`, `generate-image`, `modify-video`.

- [ ] **Step 4: Localize new copy**

Add copy keys in `studio-copy.ts` and messages for English, French and Spanish. French labels should be natural Studio labels: `Créateur de personnage`, `Storyboard`, `Angle`, `Sound design`, `Sound design + voix`.

### Task 5: Update Toolbar And Preset Menus

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`

- [ ] **Step 1: Ensure menus match the requested product shape**

Toolbar groups:
- Arrow
- Selection
- Image: Image source, Generate image, Character Builder, Angle, Upscale image
- Video: Video source, Generate video, Modify video, Upscale video
- Audio: Music, Voice over, SFX, Sound design, Sound design + voice
- Text: Free text, Chat box
- Canvas templates

- [ ] **Step 2: Remove stale direct `character-video` and `storyboard-video` menu items**

If templates still need character/storyboard video flows, keep them as templates, but do not expose them as misleading tool blocks.

### Task 6: Verify Studio End To End

**Files:**
- Modify tests as needed under `tests/e2e/editor/`

- [ ] **Step 1: Run focused unit/contract tests**

```bash
npm test -- tests/maxvideoai-editor-generation-blocks.test.ts tests/validate-request.test.ts tests/fal-engine-catalog-architecture.test.ts
```

- [ ] **Step 2: Run lint/diff checks**

```bash
npm --prefix frontend run lint
git diff --check
```

- [ ] **Step 3: Browser smoke**

Open `http://localhost:3000/app/studio/workspace/project_630fb2af-524c-4ca6-a8d2-22687884b106` and verify:
- Toolbar menus contain the new specialized blocks.
- Character Builder does not show video models.
- Upscale image/video show the real upscale engines.
- Modify Video only offers video edit models.
- Luma Ray 3.2 appears in Generate Video and Modify Video when workflow-compatible.
- Missing input states are explicit.
