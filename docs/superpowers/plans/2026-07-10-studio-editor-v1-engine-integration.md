# Studio Editor V1 Engine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MaxVideoAI Studio editor usable as a V1: users can build an infinite-canvas workflow, connect supported engines/tools with correct inputs and controls, generate typed outputs, send media to a sequence timeline, preview/edit, and export with clear readiness.

**Architecture:** Keep Studio route-local and capability-driven. The engine catalog and tool adapters define what each block can do; canvas nodes, inspectors, pricing, requests, and validation derive from those contracts. Timeline, project media, viewer, and export keep separate ownership so the editor remains reliable as engines grow.

**Tech Stack:** Next.js App Router, React 19, TypeScript, React Flow (`@xyflow/react`), route-local CSS modules, existing MaxVideoAI engine catalog, existing generation APIs (`runGenerate`, `runImageGeneration`, `runAudioGenerate`, `runAngleTool`, `runCharacterBuilderTool`, `runUpscaleTool`), Studio API routes, Remotion timeline export worker, Node `test` through `tsx`, and Playwright editor specs.

## Global Constraints

- Work only on the active feature branch; do not merge into `main` from this plan.
- Preserve the Studio product entity boundaries from `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`.
- Keep `WorkspacePage.client.tsx` as an orchestrator; new rules belong in focused `_lib`, `_state`, `_controllers`, `_hooks`, or `_components` owners.
- Model capability is the source of truth for block inputs, render controls, disabled states, request routing, and pricing-relevant fields.
- Canvas templates mutate graph nodes and edges only; they must not reset timeline state, project media, sequences, export state, or project settings.
- Project media and inspector remain available on mobile through accessible panels; do not permanently hide them.
- Timeline final state must not overlap clips on the same track unless a future explicit overlay feature defines it with tests.
- Linked video/audio moves together by default; invalid linked drops revert.
- Imported media must not invent duration or dimensions. Missing metadata remains unknown until measured.
- Export belongs to the timeline toolbar and exports the active sequence.
- Server MP4 export requires API job state, worker progress, billing/quota, artifact URL, and a clear completed/failed status.
- Every task ends with focused tests and a commit.

---

## Current Code Map

- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`: Studio graph, node, timeline, asset, tool, chat, and capability types.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`: visible block presets in the canvas toolbar.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`: derives `WorkspaceModelCapability` from engine catalog and defines virtual Studio tool/chat/audio capabilities.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`: maps engine input schema to canvas handles, compatibility, capacity, and workflow mode.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy.ts`: resolves block mode, required/optional inputs, disabled connectors, controls, output media, and pricing fields.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`: prepares prompts, pending outputs, and generic video generation requests.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`: dispatches Studio blocks to video/image/audio/tool routes.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests.ts`: builds image, audio, angle, upscale, character, storyboard, and chat requests.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing.ts`: video preflight estimate builder.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`: local pricing estimates for tool/audio/chat blocks.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/*`: canvas node presentation.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeSettingsPanel.tsx`: inspector shell for selected canvas nodes.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`: Viewer project media cards and drag surfaces.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceTimeline.tsx`: timeline shell.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/*`: pure timeline editing rules.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export.ts`: export request/readiness helpers.
- `frontend/src/server/timeline-exports/*`: server-side export jobs, billing, renderer, repository, worker.
- `tests/maxvideoai-editor-generation-blocks.test.ts`: current generation block contracts.
- `tests/maxvideoai-editor-workspace-architecture.test.ts`: Studio ownership and architecture contracts.
- `tests/maxvideoai-editor-timeline-*.test.ts`: timeline editing/export/interaction contracts.
- `tests/e2e/editor/editor-timeline.spec.ts`: browser timeline behavior.

---

## V1 Acceptance Criteria

1. Canvas block palette contains only intentional V1 blocks: image generation, image modify, video generation, video modify, audio music, voice-over, SFX, sound design, angle tool, character builder, storyboard, upscale image, upscale video, text prompt, chat, output.
2. Every block exposes exactly the controls that affect its selected engine/tool request.
3. Unsupported controls and connectors are disabled with a short reason instead of silently disappearing when that helps comprehension.
4. Every block can estimate price when all pricing-relevant inputs are present; blocked price states explain the missing input.
5. Generated outputs are typed (`image`, `video`, `audio`, `text`) and expose matching source handles.
6. Generated media can be reused in canvas, added to project media, sent to timeline, and persisted.
7. Project media gives access to imported and generated assets without partial-library surprises, supports kind filters, search, load-more, multi-select delete/import, and metadata hydration.
8. Viewer previews clips in sequence resolution space, not source-resolution fantasy space.
9. Timeline supports video plus linked audio editing without same-track overlaps, supports gap delete/ripple, supports undo/redo for timeline operations, and has export readiness warnings.
10. Export creates a real server job in non-mock mode and does not pretend a final MP4 exists before completion.
11. Studio is usable on desktop and survivable on mobile with Project media and inspector drawers.
12. Localization covers visible Studio copy for English, French, and Spanish.

---

### Task 1: Freeze The V1 Block And Engine Capability Matrix

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Create: `tests/maxvideoai-editor-v1-capability-matrix.test.ts`

**Interfaces:**
- Produces: `WORKSPACE_V1_BLOCK_MATRIX`, keyed by `WorkspaceGenerationPresetId`.
- Produces: `getWorkspaceV1BlockContract(presetId): WorkspaceV1BlockContract`.
- Consumes: `WorkspaceGenerationPresetId`, `WorkspaceWorkflowType`, `WorkspacePolicyControlField`, and `WorkspaceEdgeKind`.

- [ ] **Step 1: Write the failing V1 matrix test**

Add `tests/maxvideoai-editor-v1-capability-matrix.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_V1_BLOCK_MATRIX,
  getWorkspaceV1BlockContract,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix';
import { WORKSPACE_BLOCK_PRESETS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';

const expectedV1Presets = [
  'generate-image',
  'modify-image',
  'generate-video',
  'modify-video',
  'audio-music',
  'audio-voiceover',
  'audio-sfx',
  'audio-sound-design',
  'audio-sound-design-voice',
  'angle',
  'character-builder',
  'storyboard',
  'upscale-image',
  'upscale-video',
  'chat-box',
] as const;

test('Studio V1 has an explicit contract for every generation block preset', () => {
  const presetIds = WORKSPACE_BLOCK_PRESETS
    .filter((preset) => preset.nodeKind === 'shot' || preset.nodeKind === 'chat')
    .map((preset) => preset.id);

  for (const presetId of expectedV1Presets) {
    assert.ok(presetIds.includes(presetId), `${presetId} must be available in the palette`);
    assert.ok(WORKSPACE_V1_BLOCK_MATRIX[presetId], `${presetId} must have a V1 block contract`);
  }
});

test('Studio V1 block contracts define exact workflow intent and output media', () => {
  assert.deepEqual(getWorkspaceV1BlockContract('generate-video').workflows, [
    'text_to_video',
    'image_to_video',
    'storyboard_to_video',
    'character_to_video',
  ]);
  assert.deepEqual(getWorkspaceV1BlockContract('modify-video').workflows, ['video_to_video']);
  assert.deepEqual(getWorkspaceV1BlockContract('generate-image').workflows, ['text_to_image']);
  assert.deepEqual(getWorkspaceV1BlockContract('modify-image').workflows, ['image_to_image']);
  assert.equal(getWorkspaceV1BlockContract('angle').outputKind, 'image');
  assert.equal(getWorkspaceV1BlockContract('audio-music').outputKind, 'audio');
  assert.equal(getWorkspaceV1BlockContract('chat-box').outputKind, 'text');
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts
```

Expected: FAIL because `workspace-v1-block-matrix.ts` does not exist.

- [ ] **Step 3: Add the V1 block matrix**

Create `workspace-v1-block-matrix.ts`:

```ts
import type {
  WorkspaceEdgeKind,
  WorkspaceGenerationPresetId,
  WorkspaceOutputMediaKind,
  WorkspacePolicyControlField,
  WorkspaceWorkflowType,
} from '../workspace-types';

export type WorkspaceV1BlockContract = {
  presetId: WorkspaceGenerationPresetId;
  family: 'audio' | 'chat' | 'image' | 'upscale' | 'video';
  outputKind: WorkspaceOutputMediaKind;
  workflows: WorkspaceWorkflowType[];
  requiredInputsByWorkflow: Partial<Record<WorkspaceWorkflowType, WorkspaceEdgeKind[]>>;
  optionalInputs: WorkspaceEdgeKind[];
  visibleControls: WorkspacePolicyControlField[];
  pricingRelevantFields: WorkspacePolicyControlField[];
};

export const WORKSPACE_V1_BLOCK_MATRIX = {
  'generate-video': {
    presetId: 'generate-video',
    family: 'video',
    outputKind: 'video',
    workflows: ['text_to_video', 'image_to_video', 'storyboard_to_video', 'character_to_video'],
    requiredInputsByWorkflow: {
      text_to_video: ['prompt'],
      image_to_video: ['prompt', 'start_image'],
      storyboard_to_video: ['prompt', 'reference'],
      character_to_video: ['prompt', 'character'],
    },
    optionalInputs: ['reference', 'style', 'camera', 'end_image', 'audio', 'voiceover', 'music', 'sfx'],
    visibleControls: ['model', 'durationSec', 'aspectRatio', 'resolution', 'fps', 'referenceStrength', 'audioEnabled', 'lipSyncEnabled'],
    pricingRelevantFields: ['model', 'durationSec', 'resolution', 'audioEnabled', 'lipSyncEnabled'],
  },
  'modify-video': {
    presetId: 'modify-video',
    family: 'video',
    outputKind: 'video',
    workflows: ['video_to_video'],
    requiredInputsByWorkflow: { video_to_video: ['prompt', 'video_reference'] },
    optionalInputs: ['motion_reference', 'previous_shot', 'continuity', 'style', 'camera', 'audio'],
    visibleControls: ['model', 'durationSec', 'aspectRatio', 'resolution', 'fps', 'referenceStrength'],
    pricingRelevantFields: ['model', 'durationSec', 'resolution'],
  },
  'generate-image': {
    presetId: 'generate-image',
    family: 'image',
    outputKind: 'image',
    workflows: ['text_to_image'],
    requiredInputsByWorkflow: { text_to_image: ['prompt'] },
    optionalInputs: ['style', 'reference'],
    visibleControls: ['model', 'aspectRatio', 'resolution', 'seed', 'outputCount'],
    pricingRelevantFields: ['model', 'resolution', 'outputCount'],
  },
  'modify-image': {
    presetId: 'modify-image',
    family: 'image',
    outputKind: 'image',
    workflows: ['image_to_image'],
    requiredInputsByWorkflow: { image_to_image: ['prompt', 'reference'] },
    optionalInputs: ['style', 'logo', 'composition'],
    visibleControls: ['model', 'aspectRatio', 'resolution', 'seed', 'referenceStrength', 'outputCount'],
    pricingRelevantFields: ['model', 'resolution', 'outputCount'],
  },
  'audio-music': {
    presetId: 'audio-music',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['music_generation'],
    requiredInputsByWorkflow: { music_generation: ['prompt'] },
    optionalInputs: ['style'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity', 'audioMusicEnabled'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-voiceover': {
    presetId: 'audio-voiceover',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['voiceover_generation'],
    requiredInputsByWorkflow: { voiceover_generation: ['prompt'] },
    optionalInputs: ['voiceover', 'dialogue', 'narration'],
    visibleControls: ['model', 'durationSec', 'voiceGender', 'voiceProfile', 'voiceDelivery', 'audioLanguage'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-sfx': {
    presetId: 'audio-sfx',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['sfx_generation'],
    requiredInputsByWorkflow: { sfx_generation: ['prompt'] },
    optionalInputs: ['video_reference', 'motion_reference'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-sound-design': {
    presetId: 'audio-sound-design',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['cinematic_audio'],
    requiredInputsByWorkflow: { cinematic_audio: ['video_reference'] },
    optionalInputs: ['prompt', 'music', 'sfx'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity', 'audioMusicEnabled'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-sound-design-voice': {
    presetId: 'audio-sound-design-voice',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['cinematic_voiceover'],
    requiredInputsByWorkflow: { cinematic_voiceover: ['video_reference', 'prompt'] },
    optionalInputs: ['music', 'sfx', 'voiceover', 'dialogue', 'narration'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity', 'voiceGender', 'voiceProfile', 'voiceDelivery', 'audioLanguage'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  angle: {
    presetId: 'angle',
    family: 'image',
    outputKind: 'image',
    workflows: ['angle_generation'],
    requiredInputsByWorkflow: { angle_generation: ['reference'] },
    optionalInputs: ['prompt'],
    visibleControls: ['model', 'outputCount', 'angleRotation', 'angleTilt', 'angleZoom', 'angleSafeMode', 'angleBestAngles'],
    pricingRelevantFields: ['model', 'outputCount'],
  },
  'character-builder': {
    presetId: 'character-builder',
    family: 'image',
    outputKind: 'image',
    workflows: ['character_builder'],
    requiredInputsByWorkflow: { character_builder: [] },
    optionalInputs: ['prompt', 'reference', 'style'],
    visibleControls: ['model', 'outputCount', 'characterOutputMode', 'characterConsistencyMode', 'characterQualityMode', 'characterFormatMode', 'characterReferenceStrength', 'characterTraits'],
    pricingRelevantFields: ['model', 'outputCount', 'characterQualityMode', 'characterFormatMode'],
  },
  storyboard: {
    presetId: 'storyboard',
    family: 'image',
    outputKind: 'image',
    workflows: ['storyboard_generation'],
    requiredInputsByWorkflow: { storyboard_generation: ['prompt'] },
    optionalInputs: ['reference', 'character', 'style'],
    visibleControls: ['model', 'outputCount', 'tool.storyboard.targetModel', 'tool.storyboard.frameCount', 'tool.storyboard.durationSec', 'tool.storyboard.orientation', 'tool.storyboard.tier'],
    pricingRelevantFields: ['model', 'outputCount', 'tool.storyboard.frameCount', 'tool.storyboard.tier'],
  },
  'upscale-image': {
    presetId: 'upscale-image',
    family: 'upscale',
    outputKind: 'image',
    workflows: ['image_upscale'],
    requiredInputsByWorkflow: { image_upscale: ['reference'] },
    optionalInputs: ['prompt'],
    visibleControls: ['model', 'resolution', 'upscaleMode', 'upscaleFactor', 'outputFormat'],
    pricingRelevantFields: ['model', 'resolution', 'upscaleFactor'],
  },
  'upscale-video': {
    presetId: 'upscale-video',
    family: 'upscale',
    outputKind: 'video',
    workflows: ['video_upscale'],
    requiredInputsByWorkflow: { video_upscale: ['video_reference'] },
    optionalInputs: ['prompt'],
    visibleControls: ['model', 'durationSec', 'resolution', 'upscaleMode', 'upscaleFactor', 'outputFormat'],
    pricingRelevantFields: ['model', 'durationSec', 'resolution', 'upscaleFactor'],
  },
  'chat-box': {
    presetId: 'chat-box',
    family: 'chat',
    outputKind: 'text',
    workflows: ['chat_completion'],
    requiredInputsByWorkflow: { chat_completion: ['prompt'] },
    optionalInputs: ['style', 'camera', 'dialogue', 'narration'],
    visibleControls: ['chatProvider', 'chatModel', 'chatSystemPrompt', 'chatMessage'],
    pricingRelevantFields: [],
  },
} satisfies Record<WorkspaceGenerationPresetId, WorkspaceV1BlockContract>;

export function getWorkspaceV1BlockContract(presetId: WorkspaceGenerationPresetId): WorkspaceV1BlockContract {
  return WORKSPACE_V1_BLOCK_MATRIX[presetId];
}
```

- [ ] **Step 4: Wire capability policy to the matrix**

Modify `workspace-block-capability-policy.ts` so `controlFieldsForPolicy`, `pricingRelevantFieldsForPolicy`, and preset-specific optional inputs first consult `getWorkspaceV1BlockContract(settings.presetId)`. Preserve engine-specific capability limits by intersecting compatible controls with selected capability support.

- [ ] **Step 5: Run focused tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/models/workspace-v1-block-matrix.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/models/workspace-block-capability-policy.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/models/model-capability-registry.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts
git commit -m "feat: define Studio V1 engine capability matrix"
```

---

### Task 2: Audit And Correct Engine-To-Block Compatibility

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Modify: `tests/maxvideoai-editor-v1-capability-matrix.test.ts`

**Interfaces:**
- Consumes: `WORKSPACE_V1_BLOCK_MATRIX`.
- Produces: model filtering that prevents generate/modify/image/video/tool blocks from cannibalizing one another.

- [ ] **Step 1: Add compatibility assertions**

Add to `tests/maxvideoai-editor-v1-capability-matrix.test.ts`:

```ts
import {
  getWorkspaceBlockCompatibleCapabilities,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import {
  getWorkspaceModelCapabilities,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import {
  getWorkspaceBlockPreset,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';

function compatibleIds(presetId: Parameters<typeof getWorkspaceBlockPreset>[0]): string[] {
  const preset = getWorkspaceBlockPreset(presetId);
  assert.ok(preset?.defaultShot);
  return getWorkspaceBlockCompatibleCapabilities({
    settings: preset.defaultShot,
    capabilities: getWorkspaceModelCapabilities(),
  }).map((capability) => capability.id);
}

test('Studio V1 keeps generate and modify model lists distinct', () => {
  const generateVideoIds = compatibleIds('generate-video');
  const modifyVideoIds = compatibleIds('modify-video');
  const generateImageIds = compatibleIds('generate-image');
  const modifyImageIds = compatibleIds('modify-image');

  assert.ok(generateVideoIds.some((id) => id.includes('seedance') || id.includes('veo') || id.includes('kling')));
  assert.ok(modifyVideoIds.includes('luma-ray-3-2'));
  assert.ok(!generateVideoIds.includes('upscale-video-seedvr'));
  assert.ok(!modifyVideoIds.includes('audio-music-only'));
  assert.ok(generateImageIds.includes('seedream') || generateImageIds.includes('nano-banana-2'));
  assert.ok(modifyImageIds.every((id) => !id.startsWith('audio-')));
});

test('Studio V1 tool blocks only expose their product tool capabilities', () => {
  assert.deepEqual(compatibleIds('character-builder'), ['character-builder-tool']);
  assert.deepEqual(compatibleIds('storyboard'), ['storyboard-gpt-image-2']);
  assert.ok(compatibleIds('angle').every((id) => id.startsWith('angle-')));
  assert.ok(compatibleIds('upscale-image').every((id) => id.startsWith('upscale-image-')));
  assert.ok(compatibleIds('upscale-video').every((id) => id.startsWith('upscale-video-')));
});
```

- [ ] **Step 2: Run test and verify red or incomplete**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts
```

Expected: FAIL if any incompatible model appears.

- [ ] **Step 3: Implement compatibility filtering**

In `getWorkspaceBlockCompatibleCapabilities`, enforce:

```ts
if (settings.presetId === 'generate-video') {
  return capabilities.filter((capability) =>
    capability.family === 'video' &&
    capability.outputKind === 'video' &&
    (capability.text_to_video || capability.image_to_video || capability.storyboard_to_video || capability.character_to_video)
  );
}

if (settings.presetId === 'modify-video') {
  return capabilities.filter((capability) =>
    capability.family === 'video' &&
    capability.outputKind === 'video' &&
    capability.video_to_video
  );
}

if (settings.presetId === 'generate-image') {
  return capabilities.filter((capability) =>
    capability.family === 'image' &&
    capability.outputKind === 'image' &&
    capability.text_to_image
  );
}

if (settings.presetId === 'modify-image') {
  return capabilities.filter((capability) =>
    capability.family === 'image' &&
    capability.outputKind === 'image' &&
    capability.image_to_image
  );
}
```

Keep the existing tool-only branches for character, storyboard, angle, and upscale.

- [ ] **Step 4: Verify all block presets still have a valid default model**

Add this assertion to `tests/maxvideoai-editor-generation-blocks.test.ts`:

```ts
test('every Studio V1 generation preset selects a compatible default model', () => {
  const capabilities = getWorkspaceModelCapabilities();
  for (const preset of WORKSPACE_BLOCK_PRESETS.filter((candidate) => candidate.defaultShot)) {
    const compatible = getWorkspaceBlockCompatibleCapabilities({
      settings: preset.defaultShot!,
      capabilities,
    });
    assert.ok(
      compatible.some((capability) => capability.id === preset.defaultShot!.modelId),
      `${preset.id} default model ${preset.defaultShot!.modelId} must be compatible`
    );
  }
});
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/models \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-block-presets.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts
git commit -m "fix: scope Studio block model compatibility"
```

---

### Task 3: Make Node Controls Fully Capability-Driven

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/WorkspaceControlField.tsx`
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-control-field.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeInspectorControls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeToolSections.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

**Interfaces:**
- Produces: `WorkspaceControlField`, a compact renderer for `WorkspaceResolvedControl` and `WorkspacePolicyControlField`.
- Consumes: `resolveWorkspaceBlockPolicy().controlFields`.

- [ ] **Step 1: Add control field coverage test**

Add to `tests/maxvideoai-editor-generation-blocks.test.ts`:

```ts
test('Studio shot node controls render from policy control fields instead of hardcoded generic controls', () => {
  const source = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx'),
    'utf8'
  );

  assert.match(source, /resolveWorkspaceBlockPolicy|policy\.controlFields|controlFields/);
  assert.match(source, /WorkspaceControlField/);
  assert.doesNotMatch(source, /shot\.family !== 'audio' && !shot\.toolKind/);
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-generation-blocks.test.ts
```

Expected: FAIL until the hardcoded control section is replaced.

- [ ] **Step 3: Create the focused control renderer**

Create `WorkspaceControlField.tsx`:

```tsx
'use client';

import type { WorkspacePolicyControlField, WorkspaceShotSettings } from '../../_lib/workspace-types';
import styles from './workspace-control-field.module.css';

export type WorkspaceControlFieldProps = {
  field: WorkspacePolicyControlField;
  shot: WorkspaceShotSettings;
  disabled?: boolean;
  disabledReason?: string;
  onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void;
};

export function WorkspaceControlField({
  field,
  shot,
  disabled = false,
  disabledReason,
  onPatchShot,
}: WorkspaceControlFieldProps) {
  if (field === 'durationSec') {
    return (
      <label className={styles.field} title={disabledReason}>
        <span>Duration</span>
        <input
          className={styles.number}
          type="number"
          min={1}
          step={1}
          disabled={disabled}
          value={shot.durationSec}
          onChange={(event) => onPatchShot({ durationSec: Number(event.currentTarget.value) })}
        />
      </label>
    );
  }

  if (field === 'referenceStrength') {
    return (
      <label className={styles.field} title={disabledReason}>
        <span>Reference</span>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={1}
          step={0.05}
          disabled={disabled}
          value={shot.referenceStrength}
          onChange={(event) => onPatchShot({ referenceStrength: Number(event.currentTarget.value) })}
        />
        <strong>{Math.round(shot.referenceStrength * 100)}%</strong>
      </label>
    );
  }

  return null;
}
```

Then expand the renderer incrementally for `aspectRatio`, `resolution`, `fps`, `seed`, `outputCount`, `audioEnabled`, `lipSyncEnabled`, `angle*`, `character*`, `upscale*`, `audio*`, and `chat*` fields. Keep each field compact and keyboard accessible.

- [ ] **Step 4: Replace hardcoded controls in shot nodes**

In `workspace-shot-node-controls.tsx`, derive:

```ts
const policy = resolveWorkspaceBlockPolicy({
  settings: shot,
  capability: selectedCapability,
  connectedInputs: data.connectedInputs ?? [],
});
```

Render:

```tsx
<div className={styles.shotSettingsGrid}>
  {policy.controlFields.map((field) => (
    <WorkspaceControlField
      key={field}
      field={field}
      shot={shot}
      onPatchShot={patchShot}
    />
  ))}
</div>
```

Preserve model select and generate button placement.

- [ ] **Step 5: Mirror the same control field logic in inspector**

Modify `NodeInspectorControls.tsx` and `ShotNodeToolSections.tsx` so inspector controls use the same `WorkspaceControlField` contract or the same policy field list. The inspector may expose more vertical detail, but it must not expose unsupported controls.

- [ ] **Step 6: Run tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-generation-blocks.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/nodes \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/NodeInspectorControls.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/ShotNodeToolSections.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-shot-inspector-helpers.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts
git commit -m "feat: render Studio node controls from capabilities"
```

---

### Task 4: Build A Payload Parity Test For Every V1 Block Route

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-settings.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Create: `tests/maxvideoai-editor-v1-request-payloads.test.ts`

**Interfaces:**
- Produces: request payload tests for video, image, audio, angle, character, storyboard, upscale, and chat routes.
- Consumes: `buildWorkspaceShotGenerateRequest`, `buildWorkspaceImageGenerationRequest`, `buildWorkspaceAudioGenerateRequest`, `buildWorkspaceAngleToolRequest`, `buildWorkspaceCharacterBuilderRequest`, `buildWorkspaceUpscaleToolRequest`, `buildWorkspaceChatApiRequest`.

- [ ] **Step 1: Add request payload tests**

Create `tests/maxvideoai-editor-v1-request-payloads.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkspaceShotGenerateRequest } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation';
import {
  buildWorkspaceAngleToolRequest,
  buildWorkspaceAudioGenerateRequest,
  buildWorkspaceCharacterBuilderRequest,
  buildWorkspaceImageGenerationRequest,
  buildWorkspaceUpscaleToolRequest,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests';
import { getWorkspaceModelCapability } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import { resolveWorkspaceBlockPolicy } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';

function shot(presetId: Parameters<typeof getWorkspaceBlockPreset>[0]) {
  const preset = getWorkspaceBlockPreset(presetId);
  assert.ok(preset?.defaultShot);
  return preset.defaultShot;
}

test('generate video payload uses image references and selected engine mode', () => {
  const settings = { ...shot('generate-video'), modelId: 'seedance-2-0', durationSec: 7 };
  const capability = getWorkspaceModelCapability(settings.modelId);
  const request = buildWorkspaceShotGenerateRequest({
    settings,
    capability,
    prompt: 'A product hero shot on a rotating glass plinth.',
    connectedInputs: ['prompt', 'start_image'],
    referenceImages: ['https://example.com/product.png'],
    videoReferences: [],
    audioReferences: [],
    shotNodeId: 'shot-video',
    outputName: 'Product hero',
  });

  assert.equal(request.engine, 'seedance-2-0');
  assert.equal(request.mode, 'i2v');
  assert.equal(request.prompt, 'A product hero shot on a rotating glass plinth.');
  assert.deepEqual(request.referenceImages, ['https://example.com/product.png']);
  assert.equal(request.durationSec, 7);
});

test('modify video payload requires source video and does not masquerade as image generation', () => {
  const settings = { ...shot('modify-video'), modelId: 'luma-ray-3-2', durationSec: 5 };
  const capability = getWorkspaceModelCapability(settings.modelId);
  const request = buildWorkspaceShotGenerateRequest({
    settings,
    capability,
    prompt: 'Make the lighting more cinematic while preserving the subject.',
    connectedInputs: ['prompt', 'video_reference'],
    referenceImages: [],
    videoReferences: ['https://example.com/source.mp4'],
    audioReferences: [],
    shotNodeId: 'shot-modify',
    outputName: 'Modified shot',
  });

  assert.equal(request.engine, 'luma-ray-3-2');
  assert.equal(request.mode, 'v2v');
  assert.deepEqual(request.videoReferences, ['https://example.com/source.mp4']);
});

test('image modify payload includes source images and selected image engine', () => {
  const settings = { ...shot('modify-image'), modelId: 'seedream' };
  const capability = getWorkspaceModelCapability(settings.modelId);
  const policy = resolveWorkspaceBlockPolicy({ settings, capability, connectedInputs: ['prompt', 'reference'] });
  const request = buildWorkspaceImageGenerationRequest({
    settings,
    prompt: 'Change the jacket to red.',
    referenceImages: ['https://example.com/person.png'],
    policy,
  });

  assert.equal(request.mode, 'i2i');
  assert.equal(request.engineId, 'seedream');
  assert.deepEqual(request.imageUrls, ['https://example.com/person.png']);
});
```

Add parallel tests for:
- `audio-music` -> `pack: 'music_only'`, no `sourceVideoUrl`.
- `audio-sound-design` -> `pack: 'cinematic'`, includes `sourceVideoUrl`.
- `angle` -> `AngleToolRequest` with rotation, tilt, zoom, safe mode.
- `character-builder` -> `CharacterBuilderRequest` with traits and reference image roles.
- `storyboard` -> prompt/template request.
- `upscale-image` -> `mediaType: 'image'`.
- `upscale-video` -> `mediaType: 'video'`.
- `chat-box` -> provider/model/messages/context summaries.

- [ ] **Step 2: Run test and verify red where payload gaps exist**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-v1-request-payloads.test.ts
```

Expected: FAIL for any missing fields or wrong route mapping.

- [ ] **Step 3: Fix request builders**

Adjust builders so every test passes:
- `buildWorkspaceShotGenerateRequest` preserves `referenceImages`, `videoReferences`, `audioReferences`, `mode`, `durationSec`, `aspectRatio`, `resolution`, `fps`, `seed`, and audio toggles.
- `buildWorkspaceImageGenerationRequest` keeps generate vs modify distinct.
- `buildWorkspaceAudioGenerateRequest` maps workflow to the correct audio pack.
- `buildWorkspaceCharacterBuilderRequest` mirrors the existing Character Builder tool options.
- `buildWorkspaceUpscaleToolRequest` uses source media type and target resolution.
- `buildWorkspaceChatApiRequest` includes system prompt, user/assistant history, and text context summaries.

- [ ] **Step 4: Run focused payload tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-v1-request-payloads.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-generation.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-generation-routing.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-tool-requests.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-tool-settings.ts \
  tests/maxvideoai-editor-v1-request-payloads.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts
git commit -m "test: lock Studio V1 generation payloads"
```

---

### Task 5: Unify Pricing And Generate Button State

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Create: `tests/maxvideoai-editor-v1-pricing.test.ts`

**Interfaces:**
- Produces: `WorkspacePricingEstimate.status` values used consistently: `blocked`, `loading`, `ready`, `error`.
- Consumes: `policy.pricingRelevantFields`, `validation.canGenerate`, and connected input state.

- [ ] **Step 1: Add V1 pricing tests**

Create `tests/maxvideoai-editor-v1-pricing.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkspaceToolPricingEstimate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing';
import { validateShotConnections } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';

function defaultShot(presetId: Parameters<typeof getWorkspaceBlockPreset>[0]) {
  const preset = getWorkspaceBlockPreset(presetId);
  assert.ok(preset?.defaultShot);
  return preset.defaultShot;
}

test('tool pricing is blocked when required inputs are missing', () => {
  const settings = defaultShot('angle');
  const validation = validateShotConnections({ settings, connectedInputs: [] });
  const estimate = buildWorkspaceToolPricingEstimate({
    settings,
    validation,
    prompt: '',
    connectedInputs: [],
  });

  assert.equal(estimate?.status, 'blocked');
  assert.match(estimate?.label ?? '', /Connect input|Needs attention/);
});

test('character builder can price from scratch because reference is optional', () => {
  const settings = defaultShot('character-builder');
  const validation = validateShotConnections({ settings, connectedInputs: [] });
  const estimate = buildWorkspaceToolPricingEstimate({
    settings,
    validation,
    prompt: 'A consistent young founder character.',
    connectedInputs: [],
  });

  assert.equal(estimate?.status, 'ready');
  assert.ok((estimate?.totalCents ?? 0) > 0);
});

test('chat pricing is explicitly unavailable without blocking chat send', () => {
  const settings = defaultShot('chat-box');
  const validation = validateShotConnections({ settings, connectedInputs: ['prompt'] });
  const estimate = buildWorkspaceToolPricingEstimate({
    settings,
    validation,
    prompt: 'Improve this shot plan.',
    connectedInputs: ['prompt'],
  });

  assert.equal(estimate?.status, 'error');
  assert.match(estimate?.error ?? '', /chat/i);
});
```

- [ ] **Step 2: Run pricing tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-v1-pricing.test.ts
```

Expected: FAIL if pricing states are inconsistent.

- [ ] **Step 3: Normalize blocked pricing**

In `workspace-tool-pricing.ts`, keep:

```ts
if (!validation.canGenerate && !characterCanPriceFromScratch) {
  return blockedWorkspacePricingEstimate(validation, policy.disabledReason);
}
```

Then ensure every block returns:
- `ready` when total cents can be computed.
- `blocked` when required input or incompatible input prevents generation.
- `error` when a V1 feature intentionally has no price estimate yet, such as chat.

- [ ] **Step 4: Ensure generate button displays price without huge pill overflow**

In `workspace-shot-node-controls.tsx`, ensure price text is inside the button, compact, and clipped with `title`:

```tsx
<strong className={styles.shotGeneratePrice} title={estimatedCost}>
  {estimatedCost}
</strong>
```

In CSS, enforce:

```css
.shotGeneratePrice {
  min-width: 0;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run tests and lint**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-v1-pricing.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/eslint app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-pricing.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-tool-pricing.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/canvas-shot-controls.module.css \
  tests/maxvideoai-editor-v1-pricing.test.ts
git commit -m "fix: unify Studio pricing states"
```

---

### Task 6: Complete Generated Media Lifecycle

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-media.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-timeline.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers.ts`
- Modify: `tests/maxvideoai-editor-project-media-timeline.test.ts`
- Modify: `tests/maxvideoai-editor-generation-blocks.test.ts`

**Interfaces:**
- Produces: `workspaceAssetFromOutputNode(node): WorkspaceAssetRecord | null`.
- Produces: typed add-to-project-media behavior after generation completes.
- Consumes: `WorkspaceOutputMetadata.kind`, `url`, `audioUrl`, `thumbUrl`, `durationSec`, `dimensions`.

- [ ] **Step 1: Add generated media asset tests**

Add to `tests/maxvideoai-editor-project-media-timeline.test.ts`:

```ts
test('ready generated output nodes become typed project media assets', () => {
  const asset = workspaceAssetFromOutputNode({
    id: 'output-video-1',
    type: 'output',
    position: { x: 0, y: 0 },
    data: {
      kind: 'output',
      title: 'Generated Output',
      subtitle: 'Video',
      output: {
        kind: 'video',
        modelId: 'seedance-2-0',
        modelLabel: 'Seedance 2.0',
        workflowType: 'text_to_video',
        durationSec: 7,
        aspectRatio: '16:9',
        resolution: '1080p',
        pricing: null,
        status: 'ready',
        createdAt: '2026-07-10T00:00:00.000Z',
        sourceShotId: 'shot-1',
        url: 'https://example.com/video.mp4',
        audioUrl: null,
        thumbUrl: 'https://example.com/thumb.jpg',
        hasAudio: false,
        jobId: 'job-1',
      },
    },
  } as WorkspaceGraphNode);

  assert.equal(asset?.kind, 'video');
  assert.equal(asset?.url, 'https://example.com/video.mp4');
  assert.equal(asset?.thumbUrl, 'https://example.com/thumb.jpg');
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-project-media-timeline.test.ts
```

Expected: FAIL until `workspace-generated-media.ts` exists and is imported.

- [ ] **Step 3: Implement generated media helper**

Create `workspace-generated-media.ts`:

```ts
import type { WorkspaceAssetRecord, WorkspaceGraphNode } from './workspace-types';

export function workspaceAssetFromOutputNode(node: WorkspaceGraphNode): WorkspaceAssetRecord | null {
  const output = node.data.output;
  if (!output || output.status !== 'ready' || !output.url) return null;

  const extension = output.kind === 'video' ? 'mp4' : output.kind === 'audio' ? 'mp3' : output.kind === 'image' ? 'png' : 'txt';
  return {
    id: `asset-${node.id}`,
    kind: output.kind === 'text' ? 'text' : output.kind,
    filename: `${node.data.title || 'Generated output'}.${extension}`,
    subtitle: [output.modelLabel, output.durationSec ? `${output.durationSec}s` : null, output.aspectRatio].filter(Boolean).join(' • '),
    url: output.url,
    thumbUrl: output.thumbUrl ?? undefined,
    durationSec: output.durationSec,
    dimensions: output.resolution && output.aspectRatio ? `${output.resolution} • ${output.aspectRatio}` : undefined,
  };
}
```

- [ ] **Step 4: Wire add-to-project-media after generation**

In `useWorkspaceGenerationActions`, after a ready generation:
- keep output node selected.
- add the generated asset to `projectAssets` through a callback owned by `WorkspacePage.client.tsx`.
- avoid duplicate asset ids when regenerating the same output node.

- [ ] **Step 5: Ensure send-to-timeline uses typed media**

In `workspace-project-media-timeline.ts`, use `WorkspaceAssetRecord.kind` to decide video/audio/image insertion. Image outputs can become still clips with default duration; audio outputs go to audio tracks; video outputs preserve linked audio when `audioUrl` exists.

- [ ] **Step 6: Run tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-generated-media.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-project-media-timeline.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_state/workspace-normalizers.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts
git commit -m "feat: persist Studio generated outputs as project media"
```

---

### Task 7: Harden Project Media Library Access And Metadata

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryModal.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineProjectSidebar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-metadata.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaMetadataHydration.ts`
- Modify: `tests/maxvideoai-editor-project-media-timeline.test.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

**Interfaces:**
- Produces: media kind filters (`all`, `image`, `video`, `audio`), search, load-more pagination, multi-select import.
- Produces: metadata hydration that repairs `durationSec`, `width`, `height`, and `dimensions` without inventing unknown values.

- [ ] **Step 1: Add library contract tests**

Add to `tests/maxvideoai-editor-workspace-architecture.test.ts`:

```ts
test('Studio asset library exposes scalable filters and load-more access', () => {
  const browserSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx'),
    'utf8'
  );
  const hookSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts'),
    'utf8'
  );

  assert.match(browserSource, /mediaKindFilter/);
  assert.match(browserSource, /Load more|loadMore|onLoadMore/);
  assert.match(browserSource, /selectedAssetIds|multi/i);
  assert.match(hookSource, /cursor|page|hasMore/);
});
```

- [ ] **Step 2: Add metadata tests**

Add to `tests/maxvideoai-editor-project-media-timeline.test.ts`:

```ts
test('project media metadata helpers do not invent resolution for unknown videos', () => {
  const asset = {
    id: 'asset-unknown-video',
    kind: 'video',
    filename: 'unknown.mp4',
    subtitle: 'Video',
    url: 'https://example.com/unknown.mp4',
  } as WorkspaceAssetRecord;

  assert.equal(workspaceProjectMediaNeedsMetadata(asset), true);
  assert.equal(workspaceProjectMediaResolutionLabel(asset), null);
});
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts
```

Expected: FAIL for missing filters/load-more/multi-select or metadata helper names.

- [ ] **Step 4: Implement scalable library state**

In `useWorkspaceEditorAssetLibrary.ts`, expose:

```ts
type WorkspaceAssetLibraryState = {
  assets: WorkspaceAssetRecord[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  mediaKindFilter: 'all' | 'image' | 'video' | 'audio';
  searchQuery: string;
  selectedAssetIds: string[];
  hasMore: boolean;
  loadMore: () => Promise<void>;
  setMediaKindFilter: (kind: WorkspaceAssetLibraryState['mediaKindFilter']) => void;
  setSearchQuery: (query: string) => void;
  toggleAssetSelection: (assetId: string, mode: 'replace' | 'toggle' | 'range') => void;
};
```

Use thumbnails for grids. Avoid mounting full media elements in the library grid.

- [ ] **Step 5: Wire multi-select import/delete**

In `WorkspaceAssetLibraryBrowser.tsx`, support:
- normal click: select one asset.
- `Shift` click: range select.
- `Meta/Ctrl` click: toggle selection.
- primary import button imports all selected compatible assets.

- [ ] **Step 6: Run tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceAssetLibraryBrowser.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceAssetLibraryModal.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/TimelineProjectSidebar.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-library-assets.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-project-media-metadata.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceProjectMediaMetadataHydration.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts \
  tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: harden Studio asset library access"
```

---

### Task 8: Make Timeline And Viewer V1-Ready

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-collisions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-linked-audio.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-gap-editing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-resize-editing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-clip-composition.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/viewer/ProgramPlaybackLayers.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/TimelineClipInspector.tsx`
- Modify: `tests/maxvideoai-editor-timeline-interaction.test.ts`
- Modify: `tests/maxvideoai-editor-timeline-selection.test.ts`
- Modify: `tests/maxvideoai-editor-timeline-export.test.ts`
- Modify: `tests/e2e/editor/editor-timeline.spec.ts`

**Interfaces:**
- Produces: sequence-space clip transform rules.
- Produces: fit-height action in inspector.
- Produces: no-overlap enforcement for linked video/audio, including when tracks differ.
- Produces: gap delete/ripple across all tracks.

- [ ] **Step 1: Add pure timeline tests**

Add to `tests/maxvideoai-editor-timeline-interaction.test.ts`:

```ts
test('linked audio cannot be dragged into an occupied audio range through a video drag', () => {
  const result = moveLinkedTimelineSelection({
    items: [
      videoClip({ id: 'video-a', linkedGroupId: 'group-a', startSec: 10, durationSec: 5, track: 'video' }),
      audioClip({ id: 'audio-a', linkedGroupId: 'group-a', startSec: 10, durationSec: 5, track: 'audio' }),
      audioClip({ id: 'audio-b', startSec: 14, durationSec: 5, track: 'audio' }),
    ],
    selectedItemId: 'video-a',
    deltaSec: 4,
    targetTrack: 'video',
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /overlap/i);
});

test('gap delete ripples all timeline tracks after the selected empty range', () => {
  const result = deleteTimelineGapAndRipple({
    items: [
      videoClip({ id: 'video-a', startSec: 0, durationSec: 5, track: 'video' }),
      videoClip({ id: 'video-b', startSec: 10, durationSec: 5, track: 'video' }),
      audioClip({ id: 'audio-a', startSec: 10, durationSec: 5, track: 'audio' }),
    ],
    gap: { startSec: 5, endSec: 10, track: 'video' },
  });

  assert.deepEqual(result.items.map((item) => [item.id, item.startSec]), [
    ['video-a', 0],
    ['video-b', 5],
    ['audio-a', 5],
  ]);
});
```

- [ ] **Step 2: Add viewer composition tests**

Add to `tests/maxvideoai-editor-timeline-export.test.ts`:

```ts
test('viewer composition keeps source dimensions separate from sequence dimensions', () => {
  const composition = buildWorkspaceClipComposition({
    sourceWidth: 1280,
    sourceHeight: 720,
    sequenceWidth: 1920,
    sequenceHeight: 1080,
    transform: { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 },
  });

  assert.equal(composition.renderWidth, 1280);
  assert.equal(composition.renderHeight, 720);
  assert.equal(composition.sequenceWidth, 1920);
  assert.equal(composition.sequenceHeight, 1080);
});
```

- [ ] **Step 3: Implement pure rules first**

Implement:
- `moveLinkedTimelineSelection` checks every linked member against the target track occupancy before committing.
- `deleteTimelineGapAndRipple` computes a time range and shifts all tracks by the gap duration.
- `buildWorkspaceClipComposition` returns source size, sequence size, fit scale, fill scale, current scale, and export transform.

- [ ] **Step 4: Wire UI**

Wire:
- gap ghost only on clicked track.
- gap selection delete action.
- inspector `Fit height` button that sets scale to `sequenceHeight / sourceHeight`.
- viewer composition using sequence dimensions and clip transform.

- [ ] **Step 5: Add Playwright coverage**

In `tests/e2e/editor/editor-timeline.spec.ts`, add:

```ts
test('timeline prevents linked audio overlap when dragging the video partner', async ({ page }) => {
  await page.goto('/app/studio/workspace/project_e2e_timeline');
  await page.getByRole('button', { name: /viewer/i }).click();
  await expect(page.getByText(/Drop generated outputs here/i).first()).toBeVisible();
  // Use existing fixture helpers in this spec to drag a linked video clip over an occupied audio range.
  // Assert the original clip positions remain visible after mouseup.
});
```

Use the spec’s existing drag helpers; do not create a second custom drag implementation.

- [ ] **Step 6: Run focused tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-timeline-interaction.test.ts \
  tests/maxvideoai-editor-timeline-selection.test.ts \
  tests/maxvideoai-editor-timeline-export.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/timeline \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-clip-composition.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/viewer/ProgramPlaybackLayers.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/TimelineClipInspector.tsx \
  tests/maxvideoai-editor-timeline-interaction.test.ts \
  tests/maxvideoai-editor-timeline-selection.test.ts \
  tests/maxvideoai-editor-timeline-export.test.ts \
  tests/e2e/editor/editor-timeline.spec.ts
git commit -m "fix: harden Studio timeline viewer editing"
```

---

### Task 9: Complete Export Readiness And Server Job UX

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useExportController.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceExportDialog.tsx`
- Modify: `frontend/app/api/studio/timeline-exports/estimate/route.ts`
- Modify: `frontend/app/api/studio/timeline-exports/route.ts`
- Modify: `frontend/app/api/studio/timeline-exports/[exportId]/route.ts`
- Modify: `frontend/src/server/timeline-exports/contracts.ts`
- Modify: `frontend/src/server/timeline-exports/renderer.ts`
- Modify: `frontend/src/server/timeline-exports/repository.ts`
- Modify: `tests/maxvideoai-editor-timeline-export.test.ts`
- Modify: `tests/timeline-export-server-contract.test.ts`

**Interfaces:**
- Produces: clear queued/rendering/completed/failed export states.
- Produces: manifest readiness warnings for missing media, processing media, overlaps, missing dimensions, invalid transitions.
- Consumes: active sequence manifest and export quality preset.

- [ ] **Step 1: Add export readiness tests**

Add to `tests/maxvideoai-editor-timeline-export.test.ts`:

```ts
test('export readiness warns on missing source dimensions without inventing 1080p', () => {
  const manifest = buildWorkspaceTimelineRenderManifest({
    projectName: 'Test export',
    projectSettings: { aspectRatio: '16:9', resolution: '1080p', fps: 24 },
    timelineItems: [
      videoTimelineItem({ id: 'clip-unknown', sourceWidth: null, sourceHeight: null }),
    ],
    rangeMode: 'sequence',
  });

  assert.ok(manifest.issues.some((issue) => issue.code === 'missing_dimensions' && issue.severity === 'warning'));
});
```

Add to `tests/timeline-export-server-contract.test.ts`:

```ts
test('timeline export API contract exposes job status and artifact separately', () => {
  const contractSource = readFileSync('frontend/src/server/timeline-exports/contracts.ts', 'utf8');
  assert.match(contractSource, /TimelineExportStatus = 'queued' \| 'rendering' \| 'completed' \| 'failed' \| 'canceled'/);
  assert.match(contractSource, /outputUrl/);
  assert.match(contractSource, /progress/);
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-timeline-export.test.ts \
  tests/timeline-export-server-contract.test.ts
```

Expected: FAIL where readiness/status fields are incomplete.

- [ ] **Step 3: Implement readiness and job state**

Ensure export dialog:
- blocks submit for missing or processing media.
- warns but allows submit for missing dimensions.
- shows estimate before reservation.
- shows queued/rendering/completed/failed state after submit.
- shows download/playback only when `status === 'completed' && outputUrl`.

- [ ] **Step 4: Run tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-timeline-export.test.ts \
  tests/timeline-export-server-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-timeline-export.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-timeline-render.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_controllers/useExportController.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceExportDialog.tsx \
  frontend/app/api/studio/timeline-exports \
  frontend/src/server/timeline-exports \
  tests/maxvideoai-editor-timeline-export.test.ts \
  tests/timeline-export-server-contract.test.ts
git commit -m "feat: complete Studio export job readiness"
```

---

### Task 10: Make Canvas Operations Feel Like A Real Editor

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasHandleDropPreview.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-clipboard.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-handle-drop.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory.ts`
- Modify: `tests/maxvideoai-editor-graph-helpers.test.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`

**Interfaces:**
- Produces: copy/paste selected nodes with internal edges.
- Produces: drag-from-handle ghost line for every handle direction.
- Produces: easy-to-hit visual handles with larger invisible hit targets.
- Produces: canvas-only undo/redo when canvas has focus.

- [ ] **Step 1: Add canvas operation tests**

Add to `tests/maxvideoai-editor-graph-helpers.test.ts`:

```ts
test('canvas clipboard duplicates selected graph nodes and keeps internal edges only', () => {
  const result = duplicateWorkspaceGraphSelection({
    nodes: [
      graphNode('prompt-1', 'text-prompt', 0, 0),
      graphNode('shot-1', 'shot', 300, 0),
      graphNode('shot-2', 'shot', 600, 0),
    ],
    edges: [
      graphEdge('edge-internal', 'prompt-1', 'shot-1', 'prompt'),
      graphEdge('edge-external', 'shot-1', 'shot-2', 'generated_output'),
    ],
    selectedNodeIds: ['prompt-1', 'shot-1'],
    offset: { x: 48, y: 48 },
  });

  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.length, 1);
  assert.ok(result.edges[0].source !== 'prompt-1');
  assert.ok(result.edges[0].target !== 'shot-1');
});
```

- [ ] **Step 2: Add architecture assertions**

Add to `tests/maxvideoai-editor-workspace-architecture.test.ts`:

```ts
test('canvas handle drop and clipboard behavior stay in focused helpers', () => {
  const canvasSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx'),
    'utf8'
  );
  assert.match(canvasSource, /workspace-handle-drop/);
  assert.match(canvasSource, /workspace-graph-clipboard/);
  assert.doesNotMatch(canvasSource, /navigator\.clipboard\.writeText\(JSON\.stringify/);
});
```

- [ ] **Step 3: Implement handle hit targets**

CSS rule:

```css
.nodeHandle::before {
  content: '';
  position: absolute;
  inset: -8px;
}
```

Keep the visible square small and on the node border; enlarge only the hit target.

- [ ] **Step 4: Implement keyboard and focus rules**

Canvas focus owns:
- `Cmd/Ctrl+Z`: canvas undo.
- `Cmd/Ctrl+Shift+Z` and `Cmd/Ctrl+Y`: canvas redo.
- `Cmd/Ctrl+C`: copy selected canvas nodes.
- `Cmd/Ctrl+V`: paste selected canvas nodes near viewport center.

Timeline focus owns its own undo/redo and must not trigger canvas history.

- [ ] **Step 5: Run tests**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-graph-helpers.test.ts \
  tests/maxvideoai-editor-workspace-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/canvas \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-graph-clipboard.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-handle-drop.ts \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory.ts \
  tests/maxvideoai-editor-graph-helpers.test.ts \
  tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: polish Studio canvas editor operations"
```

---

### Task 11: Responsive And Accessibility Pass

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceMobilePanelControls.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceMobilePanelFrame.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/media.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/inspector.module.css`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_styles/timeline.module.css`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Create: `tests/e2e/editor/editor-responsive.spec.ts`

**Interfaces:**
- Produces: desktop layout, tablet layout, mobile panel controls, accessible drawer state.
- Consumes: existing `WorkspaceMobilePanelControls` and `WorkspaceEditorLayout` ownership boundaries.

- [ ] **Step 1: Add responsive architecture test**

Add to `tests/maxvideoai-editor-workspace-architecture.test.ts`:

```ts
test('Studio responsive shell keeps Project media and inspector accessible on mobile', () => {
  const layoutSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx'),
    'utf8'
  );
  const controlsSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceMobilePanelControls.tsx'),
    'utf8'
  );

  assert.match(layoutSource, /WorkspaceMobilePanelControls/);
  assert.match(controlsSource, /aria-controls/);
  assert.match(controlsSource, /aria-expanded/);
  assert.match(controlsSource, /project-media/);
  assert.match(controlsSource, /inspector/);
});
```

- [ ] **Step 2: Add Playwright responsive smoke**

Create `tests/e2e/editor/editor-responsive.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('Studio mobile exposes media and inspector panels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/studio/workspace/project_responsive_smoke');
  await expect(page.getByRole('button', { name: /Project media|Médias du projet|Medios del proyecto/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Inspector|Inspecteur|Inspector/i })).toBeVisible();
});

test('Studio desktop keeps canvas viewer and timeline visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto('/app/studio/workspace/project_responsive_smoke');
  await expect(page.getByRole('button', { name: /Canvas|Canevas/i })).toBeVisible();
  await expect(page.getByText(/00:00:00:00/)).toBeVisible();
});
```

- [ ] **Step 3: Implement responsive shell**

Keep:
- desktop: project media left, primary surface center, inspector right, timeline bottom.
- tablet: project media and inspector can collapse into side drawers.
- mobile: one primary surface, mobile panel controls for project media and inspector, timeline horizontally scrollable.

- [ ] **Step 4: Run checks**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts
```

Then run Playwright when local server is available:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-responsive.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceMobilePanelControls.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceMobilePanelFrame.tsx \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/shell.module.css \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/media.module.css \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/inspector.module.css \
  frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_styles/timeline.module.css \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/e2e/editor/editor-responsive.spec.ts
git commit -m "feat: make Studio responsive and accessible"
```

---

### Task 12: Final V1 QA, User Simulations, And Documentation

**Files:**
- Modify: `docs/engineering/studio-editor-architecture.md`
- Modify: `frontend/app/(core)/(workspace)/app/studio/AGENTS.md`
- Create: `docs/engineering/studio-editor-v1-qa.md`
- Modify: `tests/e2e/editor/editor-timeline.spec.ts`
- Create: `tests/e2e/editor/editor-v1-user-flows.spec.ts`

**Interfaces:**
- Produces: written V1 acceptance checklist and browser user simulations.
- Consumes: all previous tasks.

- [ ] **Step 1: Add V1 user-flow Playwright spec**

Create `tests/e2e/editor/editor-v1-user-flows.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('creator builds a simple image to video workflow and sends output to timeline', async ({ page }) => {
  await page.goto('/app/studio/workspace/project_v1_creator');
  await page.getByRole('button', { name: /Canvas|Canevas/i }).click();
  await page.getByRole('button', { name: /Image|Imagen/i }).click();
  await page.getByText(/Generate image|Générer une image|Generar imagen/i).click();
  await expect(page.getByText(/Generate|Générer|Generar/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Viewer|Visionneuse/i }).click();
  await expect(page.getByText(/Project media|Médias du projet|Medios del proyecto/i)).toBeVisible();
});

test('editor trims a linked video/audio clip and exports active sequence readiness', async ({ page }) => {
  await page.goto('/app/studio/workspace/project_v1_editor');
  await page.getByRole('button', { name: /Viewer|Visionneuse/i }).click();
  await expect(page.getByRole('button', { name: /Export|Exporter/i })).toBeVisible();
  await page.getByRole('button', { name: /Export|Exporter/i }).click();
  await expect(page.getByText(/Readiness|Préparation|Preparación/i)).toBeVisible();
});
```

- [ ] **Step 2: Add QA guide**

Create `docs/engineering/studio-editor-v1-qa.md`:

```md
# Studio Editor V1 QA

## Required Manual Flows

1. Create a project from `/app/studio/projects`.
2. Add a text prompt node and connect it to video generation.
3. Generate in mock mode and confirm a typed output node appears.
4. Add generated output to Project media.
5. Switch to Viewer and insert media into the active sequence.
6. Drag linked video/audio and confirm no same-track overlap is committed.
7. Use Project media filters for image, video, and audio.
8. Open inspector for a clip, a media asset, a sequence, and a canvas node.
9. Export active sequence and verify readiness checks.
10. Repeat at 1440 × 1024, 1024 × 768, and 390 × 844.

## Required Automated Checks

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-*.test.ts tests/studio-localization-contract.test.ts
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./frontend/node_modules/.bin/eslint app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx
git diff --check
```
```

- [ ] **Step 3: Update architecture docs**

Add a `Studio V1 Capability Rules` section to `docs/engineering/studio-editor-architecture.md`:

```md
## Studio V1 Capability Rules

- Block presets define user intent.
- Engine capabilities define what each selected model supports.
- The V1 block matrix defines which workflows a block may expose.
- Node UI, inspector UI, pricing, and request payloads must derive from the same policy result.
- Adding a new engine requires a test showing the engine appears in the right block lists and is absent from incompatible block lists.
- Adding a new block requires payload, pricing, output media, and connector tests.
```

Update `frontend/app/(core)/(workspace)/app/studio/AGENTS.md` with the same short rule set.

- [ ] **Step 4: Run final checks**

Run:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/maxvideoai-editor-sequence-api-persistence.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts \
  tests/maxvideoai-editor-timeline-external-drop.test.ts \
  tests/maxvideoai-editor-timeline-interaction.test.ts \
  tests/maxvideoai-editor-timeline-selection.test.ts \
  tests/maxvideoai-editor-timeline-export.test.ts \
  tests/studio-localization-contract.test.ts \
  tests/maxvideoai-editor-v1-capability-matrix.test.ts \
  tests/maxvideoai-editor-v1-request-payloads.test.ts \
  tests/maxvideoai-editor-v1-pricing.test.ts

PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/eslint app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx

git diff --check
```

Run Playwright when the local server is available:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts \
  tests/e2e/editor/editor-timeline.spec.ts \
  tests/e2e/editor/editor-responsive.spec.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
```

Expected: PASS or documented external-environment failure only.

- [ ] **Step 5: Commit**

```bash
git add docs/engineering/studio-editor-architecture.md \
  frontend/app/\(core\)/\(workspace\)/app/studio/AGENTS.md \
  docs/engineering/studio-editor-v1-qa.md \
  tests/e2e/editor/editor-timeline.spec.ts \
  tests/e2e/editor/editor-responsive.spec.ts \
  tests/e2e/editor/editor-v1-user-flows.spec.ts
git commit -m "docs: define Studio V1 QA contract"
```

---

## Suggested Execution Order

1. Tasks 1-2: define and enforce V1 block/engine contracts.
2. Tasks 3-5: make nodes, inspector, payloads, and pricing derive from the same policy.
3. Tasks 6-7: make generated and imported media reliable.
4. Tasks 8-9: make viewer, timeline, and export usable.
5. Tasks 10-12: editor feel, responsive QA, and documentation.

## Suggested Subagents

- **Agent A: Capability/contracts**: Tasks 1-2.
- **Agent B: Node UI/payload/pricing**: Tasks 3-5.
- **Agent C: Media/timeline/export**: Tasks 6-9.
- **Agent D: UX/QA/docs**: Tasks 10-12.

Each agent should work task-by-task and stop after its own verification/commit. A reviewer should run the focused tests after every task before starting the next task.

## Final Verification Gate

Before calling the V1 complete:

```bash
PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-editor-workspace-architecture.test.ts \
  tests/maxvideoai-editor-sequence-api-persistence.test.ts \
  tests/maxvideoai-editor-generation-blocks.test.ts \
  tests/maxvideoai-editor-project-media-timeline.test.ts \
  tests/maxvideoai-editor-timeline-external-drop.test.ts \
  tests/maxvideoai-editor-timeline-interaction.test.ts \
  tests/maxvideoai-editor-timeline-selection.test.ts \
  tests/maxvideoai-editor-timeline-export.test.ts \
  tests/studio-localization-contract.test.ts

PATH="/Users/adrienmillot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
./frontend/node_modules/.bin/eslint app pages components lib src middleware.ts --ext .js,.jsx,.ts,.tsx

git diff --check
```

Manual browser smoke:

1. `/app/studio/projects`: create/open a project.
2. Canvas: create prompt -> image -> video -> output.
3. Canvas: character builder and angle tool produce image outputs.
4. Canvas: chat node can continue a conversation with connected prompt context.
5. Viewer: import image/video/audio, inspect metadata, insert to timeline.
6. Timeline: move linked video/audio, trim, ripple gap delete, undo/redo.
7. Export: estimate, submit, poll, completed asset appears in Project media.
8. Responsive: desktop, tablet, mobile panel controls.

