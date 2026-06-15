# Studio Block Capabilities And LLM Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for the audit slices, then `superpowers:executing-plans` for implementation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Studio canvas block behave like a focused mini tool: expose all relevant capabilities for its purpose, hide or disable unavailable controls with clear reasons, prevent generate/modify blocks from cannibalizing each other, remove useless draft UI, and turn the LLM node into a real portable chat block.

**Architecture:** Keep `workspace-capabilities.ts` and the engine catalog as the source of model/tool truth, but add a block-level policy layer that interprets those raw capabilities for each preset. Node cards and inspectors must render from the same resolved control model, so compact node controls, full inspector controls, validation, pricing, and generation routing cannot drift. Server APIs keep provider validation and secrets server-side. Canvas nodes remain route-local under `frontend/app/(core)/(workspace)/app/studio/workspace`.

**Tech Stack:** Next.js App Router, React, TypeScript, route-local Studio components, `node:test` contracts, existing engine catalog in `frontend/config/engine-catalog.json`, Studio model registry under `workspace/_lib/models`, tool runners under `frontend/lib` and `frontend/src/server`, and current Studio verification commands.

**External references checked:** Google AI Gemini models documentation on 2026-06-15:
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash
- https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview
- https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite
- https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro
- https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash

---

## Current Findings

The current Studio already has useful foundations:

- Presets live in `workspace-block-presets.ts`.
- Engine and virtual tool capabilities are built in `model-capability-registry.ts`.
- Input connectors come from `model-input-connectors.ts`.
- Tool routing exists in `workspace-generation-routing.ts`.
- Tool pricing exists in `workspace-tool-pricing.ts`.
- Tool-specific inspector sections exist in `ShotNodeToolSections.tsx`.
- Chat dispatch exists in `/api/studio/chat` and `frontend/src/server/studio/chat.ts`.

The problems are structural:

- Capabilities are mostly model-centric, not block-intent-centric.
- Required inputs are not always mode-scoped. Example: a `video_url` required only for `v2v` can be treated too loosely.
- Node and inspector controls are not guaranteed to expose the same complete settings.
- Generate Image, Modify Image, Generate Video, and Modify Video are not separated strongly enough.
- Disabled states do not explain conflicts like `start image` versus `reference images`.
- `draft` is shown as a status even when it adds no decision value.
- The LLM node stores messages, but it is not yet a reliable portable mini chat with model registry, history controls, compaction, and useful canvas outputs.

---

## Target Block Matrix

### Generate Image

Purpose: create a new image from text, optionally with supported style/reference features only when the chosen model and mode allow them.

Must expose:
- Model
- Prompt
- Negative prompt when supported
- Aspect/size/resolution
- Count
- Quality
- Output format
- Seed when supported
- Safety/watermark when supported
- Reference/style inputs only if the selected model supports image-to-image or reference modes

Must not:
- Become the primary image edit workflow.
- Require a source image.
- Show mask/edit controls unless the user explicitly switches to Modify Image.

### Modify Image

Purpose: edit, restyle, inpaint, or transform an existing image.

Must add a new preset:
- `modify-image`
- Family `image`
- Output kind `image`
- Default workflow `image_to_image`
- Compatible models only when they support image edit or i2i workflows.

Must expose:
- Source image or reference image as required
- Prompt
- Mask if supported
- Strength/edit strength if supported
- Output size/format/quality/count where supported
- Style references when supported

Must not:
- Offer pure text-to-image models without i2i/edit support.
- Duplicate Generate Image's simple prompt-only flow.

### Generate Video

Purpose: create video from text, start image, first/last frame, or references depending on model capability.

Must expose:
- Model
- Mode selector derived from model support: text-to-video, image-to-video, first-last, reference-to-video
- Prompt
- Duration
- Aspect
- Resolution
- FPS
- Start image only in compatible modes
- End image only in first-last compatible modes
- Reference images/videos/audio only in reference compatible modes
- Audio toggle only for models with native audio
- Lip sync only for models that support it
- Reference strength only when the chosen model/mode uses references

Must disable:
- Reference images when a selected engine/mode treats start image as exclusive.
- Start image when the selected engine/mode is reference-only.
- End image unless the engine supports first-last or equivalent.
- Audio/lip sync if unsupported.

### Modify Video

Purpose: edit, reframe, retake, extend, or transform existing video.

Must expose:
- Model list filtered to v2v/edit/reframe/extend/retake capable engines only
- Source video as required
- Prompt when required
- Guide/start frame when supported
- Keyframes when supported
- Edit strength when supported
- Reframe/aspect controls only when the engine supports reframe
- Duration and resolution only if accepted by the selected engine/mode

Must not:
- Show text-to-video-only controls.
- Accept a no-source-video generation path.
- Compete with Generate Video for normal t2v/i2v creation.

### Character Builder

Purpose: call the product Character Builder tool, not a video model.

Must expose:
- Source mode: scratch or reference image
- Reference image input when source mode needs it
- Prompt/advanced notes
- Output mode
- Quality
- Format
- Generate count
- Consistency mode
- Reference strength
- Style/identity notes
- Traits
- Hair/outfit/accessories controls
- Must remain visible controls

Must disable:
- Reference strength when no reference image is connected.
- Reference-only fields in scratch mode.
- Output modes or formats not supported by the tool.

### Storyboard

Purpose: create storyboard boards or panels for a target video model.

Must expose:
- Prompt
- Target model
- Length preset
- Frame count
- Orientation
- Tier/quality
- Optional reference/character/style inputs

Must output:
- Image board/panels, not video.

### Angle

Purpose: use the Angle tool to generate camera-angle image variants from a reference image.

Must expose:
- Required reference image
- Engine: Flux multiple angles or Qwen multiple angles
- 3D angle picker inside the node
- Rotation
- Tilt
- Zoom
- Safe mode
- Generate best angles
- Output image metadata

Must disable:
- Generate button and price when no reference image exists.

### Upscale Image

Purpose: upscale a still image.

Must expose:
- Required image input
- Engine filtered to image upscalers
- Mode: factor or target resolution
- Factor only when mode is factor
- Target resolution only when mode is target
- Output format where supported

### Upscale Video

Purpose: upscale a video.

Must expose:
- Required video input
- Engine filtered to video upscalers
- Mode: factor or target resolution
- Factor only when mode is factor
- Target resolution only when mode is target
- Output format where supported

### Music

Purpose: generate standalone music.

Must expose:
- Prompt
- Duration
- Mood
- Intensity
- Optional style fields supported by the audio tool

Must not:
- Require a video source.

### Voice Over

Purpose: generate narration or dialogue audio.

Must expose:
- Script/prompt
- Duration
- Voice profile
- Delivery
- Language
- Optional gender/tone fields if supported

### SFX

Purpose: generate sound effects.

Must expose:
- Prompt
- Duration
- Intensity
- Optional motion/video reference only when the audio tool supports it

### Sound Design

Purpose: generate cinematic ambience/SFX for an existing video.

Must expose:
- Required video reference
- Prompt/brief
- Duration derived from source when possible
- Mood/intensity
- Music bed toggle if supported

### Sound Design + Voice

Purpose: generate cinematic audio plus voice/dialogue.

Must expose:
- Required video reference
- Prompt/brief
- Voice/script/dialogue field
- Voice profile
- Mood/intensity

### LLM Chat

Purpose: a portable canvas chatbot and text processor.

Must expose:
- Provider: OpenAI or Gemini
- Model registry with labels, roles, cost tier, and capability notes
- System instruction
- Chat mode
- Message composer
- Message history with scroll
- Clear conversation
- Regenerate last answer
- Copy answer
- Send last answer to a prompt/text node
- Output text handle for downstream blocks
- Input prompt handle to seed or continue a conversation
- Context compaction/windowing to avoid nonsensical long chats
- Loading, error, cancelled, and empty states

Recommended Gemini models after official doc check:
- `gemini-3.5-flash`: default powerful/fast model for Studio chat.
- `gemini-3.1-pro-preview`: advanced reasoning option, marked Preview in UI.
- `gemini-3.1-flash-lite`: fast and low-cost option.
- `gemini-2.5-pro`: stable deep reasoning fallback.
- `gemini-2.5-flash`: stable balanced fallback.

---

## Implementation Tasks

### Task 1: Add Capability Audit Contracts

**Files:**
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

- [ ] Add a contract test that every `WORKSPACE_BLOCK_PRESETS` entry has:
  - a unique id
  - a default shot or chat config
  - a compatible default model
  - at least one renderable input/output policy
  - no generic video model on tool-only presets

- [ ] Add tests for the target matrix:
  - Generate Image accepts t2i models and does not require a source image.
  - Modify Image exists and requires an image source.
  - Generate Video accepts t2v/i2v/ref2v style modes but not v2v-only intent.
  - Modify Video requires source video and filters to v2v/edit/reframe models.
  - Character Builder maps only to `character-builder-tool`.
  - Angle outputs image and requires reference image.
  - Upscale Image and Upscale Video are type-specific.
  - Audio presets have the expected required inputs.
  - Chat presets expose text input and text output.

- [ ] Add tests that no node control renders the literal `draft` label.

- [ ] Run the focused test and confirm RED:

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
```

### Task 2: Introduce A Block Capability Policy Layer

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers.ts`

- [ ] Add types:

```ts
export type WorkspaceBlockMode =
  | 'text-to-image'
  | 'image-edit'
  | 'text-to-video'
  | 'image-to-video'
  | 'reference-to-video'
  | 'first-last-video'
  | 'video-edit'
  | 'video-reframe'
  | 'tool'
  | 'chat';

export type WorkspaceResolvedControl = {
  id: string;
  label: string;
  kind: 'select' | 'number' | 'range' | 'toggle' | 'text' | 'textarea' | 'connection';
  value: unknown;
  options?: Array<{ value: string; label: string; disabled?: boolean; reason?: string }>;
  disabled: boolean;
  required: boolean;
  reason?: string;
  compact: boolean;
};
```

- [ ] Export pure helpers:

```ts
export function getWorkspaceBlockCompatibleCapabilities(input: {
  presetId: WorkspaceGenerationPresetId;
  capabilities: WorkspaceModelCapability[];
}): WorkspaceModelCapability[];

export function resolveWorkspaceBlockPolicy(input: {
  shot: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  connectedInputs: WorkspaceConnectedInputSummary[];
}): WorkspaceBlockPolicyResult;
```

- [ ] Make the policy layer own block intent:
  - `modify-video` allows only video edit/reframe/extend/retake style workflows.
  - `modify-image` allows only image edit/i2i workflows.
  - tool presets use `toolKind` before model family.
  - chat uses chat settings, not shot settings.

- [ ] Keep model registry raw. The policy layer interprets it; it must not hardcode one-off UI in components.

### Task 3: Normalize Engine Fields Into Renderable Controls

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-controls.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] Add a normalized control descriptor for engine fields:

```ts
export type WorkspaceModelControl = {
  id: string;
  label: string;
  valueType: 'string' | 'number' | 'boolean' | 'enum' | 'file' | 'array';
  ui: 'select' | 'number' | 'range' | 'toggle' | 'text' | 'textarea' | 'connection';
  modes: string[];
  requiredInModes: string[];
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  maxItems?: number;
};
```

- [ ] Populate `controls` on `WorkspaceModelCapability` from engine schemas, preserving:
  - modes
  - required modes
  - enum values
  - ranges
  - defaults
  - max items

- [ ] Replace broad required-input logic with mode-scoped checks:
  - `image_url` required only when the selected mode needs it.
  - `video_url` required only when the selected mode needs it.
  - `start_image_url` and generic references should not both appear as required unless the engine truly requires both.

- [ ] Add tests against real catalog engines:
  - `luma-ray-3-2` exposes source video for modify video.
  - `seedance-2-0` exposes reference inputs for reference mode.
  - `seedream` exposes image references for modify image.
  - `gpt-image-2` exposes edit controls without appearing as a video block.

### Task 4: Add Modify Image As A First-Class Preset

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Modify: `tests/studio-localization-contract.test.ts`

- [ ] Add `modify-image` to `WorkspaceGenerationPresetId`.

- [ ] Add the preset under the Image menu:
  - label: Modify image
  - family: image
  - output: image
  - workflow: image_to_image
  - required input: image source

- [ ] Add localized copy.

- [ ] Filter compatible models to image edit/i2i capable models.

- [ ] Make image generation routing use `mode: 'i2i'` for Modify Image.

- [ ] Add tests ensuring Generate Image and Modify Image do not return the same capability policy.

### Task 5: Split Generate And Modify Video Behavior

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] Generate Video policy:
  - Allows t2v, i2v, first-last, and reference-to-video modes.
  - Keeps source video disabled unless the selected model explicitly supports using video as reference in a generation mode.
  - Shows start/end/reference inputs only when selected mode supports them.

- [ ] Modify Video policy:
  - Requires source video.
  - Defaults to `luma-ray-3-2`.
  - Allows v2v/edit/reframe/extend/retake models only.
  - Exposes Luma Ray 3.2 modify controls when selected:
    - source video
    - prompt
    - guide/start image if supported
    - edit keyframes if supported
    - edit strength
    - duration/resolution only if accepted
    - reframe controls only in reframe mode

- [ ] Add conflict messages:
  - "Source video required for Modify Video."
  - "This model uses start image mode, so reference images are disabled."
  - "This model uses reference mode, so start image is disabled."

- [ ] Ensure generation requests include only fields accepted by the selected engine/mode.

### Task 6: Replace Ad Hoc Node Controls With Shared Resolved Controls

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotResolvedControls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeInspector.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-shot-controls.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/inspector.module.css`

- [ ] Render compact node controls from `WorkspaceResolvedControl[]`.

- [ ] Render full inspector controls from the same `WorkspaceResolvedControl[]`.

- [ ] Use these display rules:
  - Node card shows only core controls and readiness.
  - Inspector shows all controls.
  - Disabled controls are visible, greyed, and include a short reason.
  - Unsupported controls are hidden unless their absence would confuse the user.

- [ ] Remove the visible `draft` badge from node cards and inspector summary.

- [ ] Keep meaningful states:
  - ready
  - needs attention
  - estimating
  - generating
  - failed
  - completed

- [ ] Add tests for disabled state serialization and no `draft` label.

### Task 7: Complete Specialized Tool Mini Apps

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeToolSections.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-settings.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] Character Builder:
  - Mirror real tool options.
  - Disable reference-only controls when no reference image is connected.
  - Persist every control in `toolSettings.characterBuilder`.
  - Price by count/quality when all required inputs are present.

- [ ] Storyboard:
  - Persist target model, length, frame count, orientation, and tier.
  - Validate prompt.
  - Output image board metadata.

- [ ] Angle:
  - Put the 3D angle picker in the node body.
  - Persist rotation, tilt, zoom, safe mode, and best angles.
  - Price only when reference exists.

- [ ] Upscale:
  - Split image and video engines.
  - Disable factor/target controls based on mode.
  - Use correct file output type.

- [ ] Audio:
  - Split music, voice over, SFX, sound design, and sound design with voice.
  - Validate video reference only for cinematic sound design presets.
  - Persist voice/music/SFX options separately.

### Task 8: Make Pricing Trustworthy

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] Return one of these pricing states:

```ts
type WorkspacePricingState =
  | { status: 'blocked'; reason: string }
  | { status: 'estimating' }
  | { status: 'ready'; amountUsd: number; source: 'tool-local' | 'preflight' };
```

- [ ] Show price only for `ready`.

- [ ] Show "Connect input" or a specific missing input for `blocked`.

- [ ] Use local deterministic pricing for:
  - Character Builder
  - Angle
  - Upscale
  - Audio packs

- [ ] Use preflight only for normal engine generations.

- [ ] Add tests for blocked and ready states for every preset.

### Task 9: Build A Real Portable LLM Node

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-chat-models.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `frontend/app/api/studio/chat/route.ts`
- Modify: `frontend/src/server/studio/chat.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Add if needed: `tests/studio-chat-node.test.ts`

- [ ] Add a shared model registry:

```ts
export type WorkspaceChatModel = {
  provider: 'openai' | 'gemini';
  modelId: string;
  label: string;
  tier: 'fast' | 'balanced' | 'powerful' | 'preview';
  defaultFor?: 'chatbot' | 'assistant';
  supportsImages: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  notes: string;
};
```

- [ ] Include Gemini models:
  - `gemini-3.5-flash` as default Gemini balanced/powerful option.
  - `gemini-3.1-pro-preview` as preview advanced reasoning option.
  - `gemini-3.1-flash-lite` as fast/low-cost option.
  - `gemini-2.5-pro` as stable deep reasoning fallback.
  - `gemini-2.5-flash` as stable balanced fallback.

- [ ] Keep OpenAI models in the same registry and server whitelist.

- [ ] Validate provider/model combinations server-side in `/api/studio/chat`.

- [ ] Add chat history controls:
  - clear
  - regenerate last answer
  - copy last answer
  - send last answer to new text node
  - use connected prompt as user message

- [ ] Add context management:
  - cap sent history by character count or token estimate
  - keep system instruction
  - keep latest user/assistant pairs
  - optionally summarize older messages into a compact system note

- [ ] Render the node as a small chat:
  - scrollable transcript
  - sticky composer
  - provider/model chip
  - loading state
  - error state
  - empty state

- [ ] Output the latest assistant text through a text output handle.

### Task 10: Align Generation Requests With Resolved Controls

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `tests/workspace-generation-request-helpers.test.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] Build requests from the resolved policy, not from all node settings.

- [ ] Drop disabled fields before calling any generation API.

- [ ] Preserve explicit user values when enabled.

- [ ] Reject generation if required enabled controls are missing.

- [ ] Add request snapshot tests:
  - Generate Video with start image.
  - Generate Video with references.
  - Modify Video with source video.
  - Modify Image with source image.
  - Angle with reference image.
  - Character Builder in scratch and reference modes.
  - Audio music and cinematic sound design.

### Task 11: Update Canvas UX And Copy

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`

- [ ] Make block menu labels describe the job:
  - Generate image
  - Modify image
  - Generate video
  - Modify video
  - Character builder
  - Storyboard
  - Angle
  - Upscale image
  - Upscale video
  - Music
  - Voice over
  - SFX
  - Sound design
  - Chat

- [ ] Keep descriptions short. Avoid paragraph-sized menu cards.

- [ ] Keep node labels concise. Full detail belongs in the inspector.

- [ ] Localize new labels and disabled reasons.

### Task 12: Update Architecture Docs And Agent Contracts

**Files:**
- Modify: `docs/engineering/studio-editor-architecture.md`
- Modify: `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
- Modify: `docs/engineering/llm-working-guide.md` only if a cross-cutting rule is added

- [ ] Document that raw engine capabilities must not be rendered directly.

- [ ] Document the block policy layer as the mandatory path:
  - preset -> compatible capabilities -> selected mode -> resolved controls -> validation/pricing/request

- [ ] Document that `workspace-capabilities.ts`, model registry, and block policy tests must be updated when adding a generation block.

- [ ] Document LLM node server whitelist and provider separation.

### Task 13: Browser Verification Scenarios

**Files:**
- No code files unless issues are found.

- [ ] Start or reuse the dev server.

- [ ] Smoke test in light mode:
  - open Studio workspace
  - add every block from the toolbar
  - select each block
  - inspect compact node controls
  - inspect full right panel controls
  - connect valid and invalid inputs
  - confirm disabled options have reasons
  - confirm price appears only when ready

- [ ] Smoke test Generate Video:
  - text only
  - start image
  - reference images
  - incompatible start/reference conflict

- [ ] Smoke test Modify Video:
  - no source video blocked
  - source video connected ready
  - Luma Ray 3.2 settings visible

- [ ] Smoke test Modify Image:
  - no source image blocked
  - source image connected ready
  - image edit controls visible

- [ ] Smoke test LLM:
  - Gemini fast model
  - Gemini powerful/preview model
  - OpenAI model
  - multiple turns
  - clear/regenerate/copy
  - send answer to text node

### Task 14: Required Verification Commands

- [ ] Run focused contracts:

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/workspace-generation-request-helpers.test.ts
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/studio-localization-contract.test.ts
```

- [ ] Run Studio checks:

```bash
npm run test:editor
npm run qa:editor
```

- [ ] Run TypeScript and lint if touched files warrant it:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run lint
```

- [ ] Run diff validation:

```bash
git diff --check
```

---

## Self-Review Checklist

- [ ] Each block has a clear product purpose.
- [ ] Every control comes from model/tool capability or an explicit block policy.
- [ ] Disabled controls show a reason.
- [ ] Required inputs are mode-scoped.
- [ ] Generate and Modify blocks do not overlap in confusing ways.
- [ ] `draft` is no longer user-visible if it carries no action.
- [ ] Pricing is hidden when required inputs are missing.
- [ ] LLM model ids are server-whitelisted.
- [ ] Gemini model recommendations are tied to official docs and can be refreshed.
- [ ] Node card and inspector use the same resolved control model.
- [ ] Tests cover the capability matrix before browser QA.

## Execution Notes

This plan is intentionally larger than a cosmetic UI pass. Implement it in slices and commit each stable slice:

1. Capability policy and tests.
2. Modify Image and Generate/Modify split.
3. Shared control renderer and disabled reasons.
4. Tool mini app completeness.
5. Pricing and request sanitation.
6. Portable LLM node.
7. Docs and browser verification.

