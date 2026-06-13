# Studio Canvas Generation Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Studio canvas blocks first-class workflow presets: image generation, video generation, storyboard, character, video/image upscale, music, voice-over, SFX, and LLM chat box, each routed to the correct engine family and Studio output behavior.

**Architecture:** Keep the existing canvas node model compatible by extending `shot` generation nodes with a `presetId`, `family`, and `outputKind`, then add one new `chat` node kind for conversational LLM state. The toolbar should drag block presets, not raw node kinds. Generation routing should move out of `workspace-generation.ts` into a small dispatcher that calls the existing video, image, audio, upscale APIs and a new Studio chat API.

**Tech Stack:** Next.js App Router, React Flow, route-local Studio TypeScript modules, existing `/api/generate`, `/api/images/generate`, `/api/audio/generate`, `/api/tools/upscale/*`, OpenAI SDK, Gemini REST API, Node test runner, Playwright editor tests.

---

## File Structure

Create:
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`: source of truth for canvas toolbar blocks and their default generation settings.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`: routes Studio generation requests to video, image, audio, upscale, or chat APIs.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx`: inspector for chat provider/model/system prompt/history.
- `frontend/app/api/studio/chat/route.ts`: authenticated LLM chat route for Studio.
- `frontend/src/server/studio/chat.ts`: server-only OpenAI/Gemini chat adapter.
- `tests/maxvideoai-editor-generation-blocks.test.ts`: pure contract tests for block presets, capability filtering, and output kinds.

Modify:
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`: add preset/family/output/chat types.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-canvas-imports.ts`: create nodes from block presets.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`: include image engines and virtual audio/upscale/chat capabilities.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`: add connector rules for image, audio, upscale, and chat workflows.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`: keep output-node helpers, delegate actual submission to `workspace-generation-routing.ts`.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`: render preset-backed toolbar menus.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasPaletteDragPreview.tsx`: carry `presetId` in drag payloads.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useCanvasController.ts`: accept preset drops.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGraphActions.ts`: pass preset id into node creation.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeInspector.tsx`: filter models by preset family and output kind.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeSettingsPanel.tsx`: render chat inspector.
- `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-types.tsx`: render image/audio/upscale/chat-specific labels and icons.
- `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`, `frontend/messages/en.json`, `frontend/messages/fr.json`, `frontend/messages/es.json`: localize labels.
- `frontend/src/lib/audio-generation.ts`, `frontend/src/server/audio/audio-generate-validation.ts`, `frontend/src/server/audio/generate-audio.ts`: add `sfx_only` if standalone SFX is required by the Studio block.
- `tests/maxvideoai-editor-workspace-architecture.test.ts`: assert new owners and no raw toolbar special cases.
- `tests/e2e/editor/editor-smoke.spec.ts`: add browser smoke coverage for toolbar presets and chat.

Do not modify:
- `WorkspacePage.client.tsx` beyond prop wiring that already exists. New rules belong in the files above.
- Marketing pages or global app composer code, unless a shared API contract changes.

---

### Task 1: Lock Current Gaps With Failing Tests

**Files:**
- Create: `tests/maxvideoai-editor-generation-blocks.test.ts`
- Modify: `tests/maxvideoai-editor-workspace-architecture.test.ts`
- Modify: `tests/e2e/editor/editor-smoke.spec.ts`

- [ ] **Step 1: Write the pure failing test**

Create `tests/maxvideoai-editor-generation-blocks.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWorkspaceBlockPreset,
  WORKSPACE_BLOCK_PRESETS,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import {
  getWorkspaceModelCapabilities,
  validateShotConnections,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';

test('Studio canvas exposes generation block presets for every requested workflow', () => {
  const presetIds = WORKSPACE_BLOCK_PRESETS.map((preset) => preset.id);
  assert.deepEqual(
    [
      'generate-image',
      'generate-video',
      'storyboard-video',
      'character-video',
      'modify-video',
      'upscale-image',
      'upscale-video',
      'audio-music',
      'audio-voiceover',
      'audio-sfx',
      'chat-box',
    ].every((id) => presetIds.includes(id)),
    true
  );

  assert.equal(getWorkspaceBlockPreset('generate-image')?.outputKind, 'image');
  assert.equal(getWorkspaceBlockPreset('audio-music')?.outputKind, 'audio');
  assert.equal(getWorkspaceBlockPreset('chat-box')?.family, 'chat');
});

test('Studio capabilities expose image, audio, upscale, video, storyboard, character, and chat families', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const families = new Set(capabilities.map((capability) => capability.family));
  assert.equal(families.has('image'), true);
  assert.equal(families.has('video'), true);
  assert.equal(families.has('audio'), true);
  assert.equal(families.has('upscale'), true);
  assert.equal(families.has('chat'), true);

  assert.ok(capabilities.some((capability) => capability.id === 'seedream' && capability.outputKind === 'image'));
  assert.ok(capabilities.some((capability) => capability.id === 'audio-music-only' && capability.outputKind === 'audio'));
  assert.ok(capabilities.some((capability) => capability.id === 'upscale-video-seedvr' && capability.required_inputs.includes('video_reference')));
  assert.ok(capabilities.some((capability) => capability.id === 'studio-chat-openai' && capability.required_inputs.includes('prompt')));
});

test('image generation preset validates against image models and rejects video-only models', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const imagePreset = getWorkspaceBlockPreset('generate-image');
  assert.ok(imagePreset);

  const valid = validateShotConnections({
    settings: imagePreset.defaultShot,
    connectedInputs: ['prompt'],
    capabilities,
  });
  assert.equal(valid.canGenerate, true);
  assert.equal(valid.capability?.outputKind, 'image');

  const invalid = validateShotConnections({
    settings: { ...imagePreset.defaultShot, modelId: 'seedance-2-0' },
    connectedInputs: ['prompt'],
    capabilities,
  });
  assert.equal(invalid.canGenerate, false);
  assert.ok(invalid.incompatibleInputs.includes('prompt') || invalid.capability?.outputKind !== 'image');
});
```

- [ ] **Step 2: Add architecture assertions**

Append these assertions inside `tests/maxvideoai-editor-workspace-architecture.test.ts` near the canvas/model contract tests:

```ts
const blockPresetsPath = join(workspaceDir, '_lib/workspace-block-presets.ts');
const generationRoutingPath = join(workspaceDir, '_lib/workspace-generation-routing.ts');
const chatInspectorPath = join(workspaceDir, '_components/ChatNodeInspector.tsx');
const studioChatApiPath = join(studioApiDir, 'chat/route.ts');
const studioChatServerPath = join(studioServerDir, 'chat.ts');

assert.ok(existsSync(blockPresetsPath), 'canvas block presets should live in a focused route-local helper');
assert.ok(existsSync(generationRoutingPath), 'generation routing should live outside WorkspacePage and UI components');
assert.ok(existsSync(chatInspectorPath), 'chat node inspector should live in a focused route-local component');
assert.ok(existsSync(studioChatApiPath), 'Studio chat should use an authenticated route handler');
assert.ok(existsSync(studioChatServerPath), 'Studio chat provider calls should live in server-only Studio code');
```

- [ ] **Step 3: Add Playwright smoke expectations**

Add a test near existing canvas toolbar smoke tests in `tests/e2e/editor/editor-smoke.spec.ts`:

```ts
test('canvas toolbar creates image, audio, upscale, storyboard, character, and chat blocks', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  await page.getByRole('button', { name: 'Image' }).click();
  await page.getByRole('button', { name: 'Generate image' }).click();
  await expect(page.getByText('Image generation')).toBeVisible();

  await page.getByRole('button', { name: 'Video' }).click();
  await page.getByRole('button', { name: 'Storyboard' }).click();
  await expect(page.getByText('Storyboard generation')).toBeVisible();
  await page.getByRole('button', { name: 'Video' }).click();
  await page.getByRole('button', { name: 'Character' }).click();
  await expect(page.getByText('Character generation')).toBeVisible();
  await page.getByRole('button', { name: 'Video' }).click();
  await page.getByRole('button', { name: 'Upscale video' }).click();
  await expect(page.getByText('Video upscale')).toBeVisible();

  await page.getByRole('button', { name: 'Audio' }).click();
  await page.getByRole('button', { name: 'Music' }).click();
  await expect(page.getByText('Music generation')).toBeVisible();
  await page.getByRole('button', { name: 'Audio' }).click();
  await page.getByRole('button', { name: 'Voice over' }).click();
  await expect(page.getByText('Voice-over generation')).toBeVisible();
  await page.getByRole('button', { name: 'Audio' }).click();
  await page.getByRole('button', { name: 'SFX' }).click();
  await expect(page.getByText('SFX generation')).toBeVisible();

  await page.getByRole('button', { name: 'Text' }).click();
  await page.getByRole('button', { name: 'Chat box' }).click();
  await expect(page.getByText('LLM chat')).toBeVisible();

  assertNoEditorClientErrors(errors);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
npm run test:editor
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 PLAYWRIGHT_EDITOR_BASE_URL=http://localhost:3000/app/studio/workspace frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "canvas toolbar creates"
```

Expected:
- Pure test fails because `workspace-block-presets.ts` does not exist.
- Architecture test fails on missing files.
- Playwright fails because toolbar labels and node defaults are not implemented yet.

- [ ] **Step 5: Commit failing tests**

```bash
git add tests/maxvideoai-editor-generation-blocks.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts tests/e2e/editor/editor-smoke.spec.ts
git commit -m "test: lock studio canvas generation block contracts"
```

---

### Task 2: Add Block Preset Contracts And Palette Drag Payloads

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasPaletteDragPreview.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useCanvasController.ts`

- [ ] **Step 1: Add types**

In `workspace-types.ts`, extend the contracts:

```ts
export type WorkspaceNodeKind =
  | 'asset-image'
  | 'asset-video'
  | 'asset-audio'
  | 'text-prompt'
  | 'note'
  | 'shot'
  | 'chat'
  | 'output';

export type WorkspaceWorkflowType =
  | 'text_to_video'
  | 'image_to_video'
  | 'video_to_video'
  | 'storyboard_to_video'
  | 'character_to_video'
  | 'text_to_image'
  | 'image_to_image'
  | 'image_upscale'
  | 'video_upscale'
  | 'music_generation'
  | 'voiceover_generation'
  | 'sfx_generation'
  | 'chat_completion';

export type WorkspaceGenerationFamily = 'video' | 'image' | 'audio' | 'upscale' | 'chat';

export type WorkspaceGenerationPresetId =
  | 'generate-video'
  | 'modify-video'
  | 'storyboard-video'
  | 'character-video'
  | 'generate-image'
  | 'upscale-image'
  | 'upscale-video'
  | 'audio-music'
  | 'audio-voiceover'
  | 'audio-sfx'
  | 'chat-box';

export type WorkspaceChatProvider = 'openai' | 'gemini';

export type WorkspaceChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type WorkspaceChatSettings = {
  provider: WorkspaceChatProvider;
  modelId: string;
  systemPrompt: string;
  draftMessage: string;
  messages: WorkspaceChatMessage[];
  status: 'idle' | 'running' | 'failed';
};
```

Extend `WorkspaceShotSettings`:

```ts
export type WorkspaceShotSettings = {
  presetId?: WorkspaceGenerationPresetId;
  family?: WorkspaceGenerationFamily;
  outputKind?: 'video' | 'image' | 'audio';
  modelId: string;
  workflowType: WorkspaceWorkflowType;
  durationSec: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  fps: number;
  seed?: number | null;
  audioEnabled: boolean;
  lipSyncEnabled: boolean;
  referenceStrength: number;
  outputName: string;
  status: WorkspaceShotStatus;
};
```

Extend `WorkspaceModelCapability`:

```ts
family: WorkspaceGenerationFamily;
outputKind: 'video' | 'image' | 'audio' | 'text';
```

Extend `WorkspaceNodeData`:

```ts
chat?: WorkspaceChatSettings;
```

- [ ] **Step 2: Create preset registry**

Create `workspace-block-presets.ts`:

```ts
import type {
  WorkspaceGenerationFamily,
  WorkspaceGenerationPresetId,
  WorkspaceChatSettings,
  WorkspaceNodeKind,
  WorkspaceShotSettings,
  WorkspaceWorkflowType,
} from './workspace-types';

export type WorkspaceBlockPreset = {
  id: WorkspaceGenerationPresetId;
  menu: 'audio' | 'image' | 'text' | 'video';
  nodeKind: WorkspaceNodeKind;
  labelKey: string;
  descriptionKey: string;
  titleKey: string;
  subtitleKey: string;
  accent: string;
  family: WorkspaceGenerationFamily;
  outputKind: 'audio' | 'image' | 'text' | 'video';
  defaultModelId: string;
  defaultWorkflowType: WorkspaceWorkflowType;
  defaultShot?: WorkspaceShotSettings;
  defaultChat?: WorkspaceChatSettings;
};

function shotDefaults(input: {
  presetId: WorkspaceGenerationPresetId;
  family: WorkspaceGenerationFamily;
  outputKind: 'audio' | 'image' | 'video';
  modelId: string;
  workflowType: WorkspaceWorkflowType;
  outputName: string;
  durationSec?: number;
}): WorkspaceShotSettings {
  return {
    presetId: input.presetId,
    family: input.family,
    outputKind: input.outputKind,
    modelId: input.modelId,
    workflowType: input.workflowType,
    durationSec: input.durationSec ?? 7,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    seed: null,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.65,
    outputName: input.outputName,
    status: 'draft',
  };
}

export const WORKSPACE_BLOCK_PRESETS: WorkspaceBlockPreset[] = [
  {
    id: 'generate-image',
    menu: 'image',
    nodeKind: 'shot',
    labelKey: 'generateImage',
    descriptionKey: 'generateImageDescription',
    titleKey: 'imageGenerationTitle',
    subtitleKey: 'imageGenerationSubtitle',
    accent: '#6366f1',
    family: 'image',
    outputKind: 'image',
    defaultModelId: 'seedream',
    defaultWorkflowType: 'text_to_image',
    defaultShot: shotDefaults({
      presetId: 'generate-image',
      family: 'image',
      outputKind: 'image',
      modelId: 'seedream',
      workflowType: 'text_to_image',
      outputName: 'Image output',
      durationSec: 1,
    }),
  },
  {
    id: 'generate-video',
    menu: 'video',
    nodeKind: 'shot',
    labelKey: 'generateVideo',
    descriptionKey: 'generateVideoDescription',
    titleKey: 'videoGenerationTitle',
    subtitleKey: 'videoGenerationSubtitle',
    accent: '#f97316',
    family: 'video',
    outputKind: 'video',
    defaultModelId: 'seedance-2-0',
    defaultWorkflowType: 'image_to_video',
    defaultShot: shotDefaults({
      presetId: 'generate-video',
      family: 'video',
      outputKind: 'video',
      modelId: 'seedance-2-0',
      workflowType: 'image_to_video',
      outputName: 'Video output',
    }),
  },
  {
    id: 'storyboard-video',
    menu: 'video',
    nodeKind: 'shot',
    labelKey: 'storyboard',
    descriptionKey: 'storyboardDescription',
    titleKey: 'storyboardGenerationTitle',
    subtitleKey: 'storyboardGenerationSubtitle',
    accent: '#38bdf8',
    family: 'video',
    outputKind: 'video',
    defaultModelId: 'kling-3-pro',
    defaultWorkflowType: 'storyboard_to_video',
    defaultShot: shotDefaults({
      presetId: 'storyboard-video',
      family: 'video',
      outputKind: 'video',
      modelId: 'kling-3-pro',
      workflowType: 'storyboard_to_video',
      outputName: 'Storyboard output',
    }),
  },
  {
    id: 'character-video',
    menu: 'video',
    nodeKind: 'shot',
    labelKey: 'character',
    descriptionKey: 'characterDescription',
    titleKey: 'characterGenerationTitle',
    subtitleKey: 'characterGenerationSubtitle',
    accent: '#ec4899',
    family: 'video',
    outputKind: 'video',
    defaultModelId: 'kling-3-pro',
    defaultWorkflowType: 'character_to_video',
    defaultShot: shotDefaults({
      presetId: 'character-video',
      family: 'video',
      outputKind: 'video',
      modelId: 'kling-3-pro',
      workflowType: 'character_to_video',
      outputName: 'Character output',
    }),
  },
  {
    id: 'modify-video',
    menu: 'video',
    nodeKind: 'shot',
    labelKey: 'modifyVideo',
    descriptionKey: 'modifyVideoDescription',
    titleKey: 'modifyVideoTitle',
    subtitleKey: 'modifyVideoSubtitle',
    accent: '#2563eb',
    family: 'video',
    outputKind: 'video',
    defaultModelId: 'luma-ray-2',
    defaultWorkflowType: 'video_to_video',
    defaultShot: shotDefaults({
      presetId: 'modify-video',
      family: 'video',
      outputKind: 'video',
      modelId: 'luma-ray-2',
      workflowType: 'video_to_video',
      outputName: 'Modified video',
    }),
  },
  {
    id: 'upscale-image',
    menu: 'image',
    nodeKind: 'shot',
    labelKey: 'upscaleImage',
    descriptionKey: 'upscaleImageDescription',
    titleKey: 'imageUpscaleTitle',
    subtitleKey: 'imageUpscaleSubtitle',
    accent: '#0ea5e9',
    family: 'upscale',
    outputKind: 'image',
    defaultModelId: 'upscale-image-seedvr',
    defaultWorkflowType: 'image_upscale',
    defaultShot: shotDefaults({
      presetId: 'upscale-image',
      family: 'upscale',
      outputKind: 'image',
      modelId: 'upscale-image-seedvr',
      workflowType: 'image_upscale',
      outputName: 'Upscaled image',
      durationSec: 1,
    }),
  },
  {
    id: 'upscale-video',
    menu: 'video',
    nodeKind: 'shot',
    labelKey: 'upscaleVideo',
    descriptionKey: 'upscaleVideoDescription',
    titleKey: 'videoUpscaleTitle',
    subtitleKey: 'videoUpscaleSubtitle',
    accent: '#0ea5e9',
    family: 'upscale',
    outputKind: 'video',
    defaultModelId: 'upscale-video-seedvr',
    defaultWorkflowType: 'video_upscale',
    defaultShot: shotDefaults({
      presetId: 'upscale-video',
      family: 'upscale',
      outputKind: 'video',
      modelId: 'upscale-video-seedvr',
      workflowType: 'video_upscale',
      outputName: 'Upscaled video',
    }),
  },
  {
    id: 'audio-music',
    menu: 'audio',
    nodeKind: 'shot',
    labelKey: 'music',
    descriptionKey: 'musicGenerationDescription',
    titleKey: 'musicGenerationTitle',
    subtitleKey: 'musicGenerationSubtitle',
    accent: '#16a34a',
    family: 'audio',
    outputKind: 'audio',
    defaultModelId: 'audio-music-only',
    defaultWorkflowType: 'music_generation',
    defaultShot: shotDefaults({
      presetId: 'audio-music',
      family: 'audio',
      outputKind: 'audio',
      modelId: 'audio-music-only',
      workflowType: 'music_generation',
      outputName: 'Music output',
      durationSec: 30,
    }),
  },
  {
    id: 'audio-voiceover',
    menu: 'audio',
    nodeKind: 'shot',
    labelKey: 'voiceOver',
    descriptionKey: 'voiceOverDescription',
    titleKey: 'voiceOverGenerationTitle',
    subtitleKey: 'voiceOverGenerationSubtitle',
    accent: '#14b8a6',
    family: 'audio',
    outputKind: 'audio',
    defaultModelId: 'audio-voice-only',
    defaultWorkflowType: 'voiceover_generation',
    defaultShot: shotDefaults({
      presetId: 'audio-voiceover',
      family: 'audio',
      outputKind: 'audio',
      modelId: 'audio-voice-only',
      workflowType: 'voiceover_generation',
      outputName: 'Voice-over output',
      durationSec: 15,
    }),
  },
  {
    id: 'audio-sfx',
    menu: 'audio',
    nodeKind: 'shot',
    labelKey: 'sfx',
    descriptionKey: 'sfxDescription',
    titleKey: 'sfxGenerationTitle',
    subtitleKey: 'sfxGenerationSubtitle',
    accent: '#7c3aed',
    family: 'audio',
    outputKind: 'audio',
    defaultModelId: 'audio-sfx-only',
    defaultWorkflowType: 'sfx_generation',
    defaultShot: shotDefaults({
      presetId: 'audio-sfx',
      family: 'audio',
      outputKind: 'audio',
      modelId: 'audio-sfx-only',
      workflowType: 'sfx_generation',
      outputName: 'SFX output',
      durationSec: 8,
    }),
  },
  {
    id: 'chat-box',
    menu: 'text',
    nodeKind: 'chat',
    labelKey: 'chatBox',
    descriptionKey: 'chatBoxDescription',
    titleKey: 'chatBoxTitle',
    subtitleKey: 'chatBoxSubtitle',
    accent: '#64748b',
    family: 'chat',
    outputKind: 'text',
    defaultModelId: 'studio-chat-openai',
    defaultWorkflowType: 'chat_completion',
    defaultChat: {
      provider: 'openai',
      modelId: 'gpt-4.1-mini',
      systemPrompt: '',
      draftMessage: '',
      messages: [],
      status: 'idle',
    },
  },
];

export function getWorkspaceBlockPreset(id?: string | null): WorkspaceBlockPreset | null {
  return WORKSPACE_BLOCK_PRESETS.find((preset) => preset.id === id) ?? null;
}
```

- [ ] **Step 3: Update toolbar to use presets**

In `CanvasFloatingToolbar.tsx`, replace the hard-coded `toolbarBlocks()` body with preset-backed definitions:

```ts
import { WORKSPACE_BLOCK_PRESETS, type WorkspaceBlockPreset } from '../../_lib/workspace-block-presets';
import type { WorkspaceGenerationPresetId, WorkspaceNodeKind } from '../../_lib/workspace-types';

type ToolbarBlockDefinition = {
  id: WorkspaceGenerationPresetId | 'image' | 'video' | 'free-text';
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
  label: string;
  description: string;
  icon: ReactNode;
  accent: string;
};

function copyValue(copy: StudioCopy['canvas']['nodes'], key: string, fallback: string): string {
  return copy[key] ?? fallback;
}

function blockFromPreset(preset: WorkspaceBlockPreset, copy: StudioCopy['canvas']['nodes'], icon: ReactNode): ToolbarBlockDefinition {
  return {
    id: preset.id,
    kind: preset.nodeKind,
    presetId: preset.id,
    label: copyValue(copy, preset.labelKey, preset.id),
    description: copyValue(copy, preset.descriptionKey, preset.id),
    icon,
    accent: preset.accent,
  };
}
```

In the `onMouseDown` handler call:

```ts
onMouseDown={(event) => handleBlockMouseDown(event, block.kind, block.presetId)}
```

Update the signature:

```ts
const handleBlockMouseDown = (
  event: ReactMouseEvent,
  kind: WorkspaceNodeKind,
  presetId?: WorkspaceGenerationPresetId
) => {
  // existing drag threshold code
  window.dispatchEvent(
    new CustomEvent(PALETTE_DRAG_START_EVENT, {
      detail: {
        kind,
        presetId,
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
      },
    })
  );
};
```

- [ ] **Step 4: Carry preset id in canvas drag**

In `CanvasPaletteDragPreview.tsx`:

```ts
import { getWorkspaceBlockPreset } from '../../_lib/workspace-block-presets';
import type { WorkspaceGenerationPresetId, WorkspaceNodeKind } from '../../_lib/workspace-types';

export type PaletteDragPreview = {
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
  title: string;
  subtitle: string;
  accent: string;
  position: XYPosition;
};

export type PaletteDragStartDetail = {
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
  clientX: number;
  clientY: number;
};

export function palettePreviewForKind(
  kind: WorkspaceNodeKind,
  position: XYPosition,
  copy: StudioCopy['canvas']['nodes'],
  presetId?: WorkspaceGenerationPresetId
): PaletteDragPreview {
  const preset = getWorkspaceBlockPreset(presetId);
  if (preset) {
    return {
      kind,
      presetId: preset.id,
      title: copy[preset.titleKey] ?? copy[preset.labelKey] ?? preset.id,
      subtitle: copy[preset.subtitleKey] ?? copy[preset.descriptionKey] ?? '',
      accent: preset.accent,
      position,
    };
  }
  // keep existing fallback branches
}
```

In `useCanvasController.ts`, extend `WorkspacePaletteDropRequest`:

```ts
export type WorkspacePaletteDropRequest = {
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
  position: XYPosition;
};
```

Pass the preset through on mouseup and native drop:

```ts
onCreateNodeFromPaletteDrop({
  kind: preview.kind,
  presetId: preview.presetId,
  position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
});
```

- [ ] **Step 5: Run contract tests**

Run:

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
npm run test:editor
```

Expected:
- Preset existence assertions pass.
- Capability assertions still fail until Task 3.

- [ ] **Step 6: Commit preset and drag contracts**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-types.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-block-presets.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/canvas/CanvasPaletteDragPreview.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_controllers/useCanvasController.ts tests/maxvideoai-editor-generation-blocks.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts
git commit -m "feat: add studio canvas block preset contracts"
```

---

### Task 3: Expand Studio Model Capabilities

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-input-connectors.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities.ts`
- Test: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] **Step 1: Include image engines**

In `model-capability-registry.ts`, import `getBaseEnginesByCategory`:

```ts
import { getBaseEngines, getBaseEnginesByCategory } from '@/lib/engines';
```

Change default capability loading:

```ts
export function getWorkspaceModelCapabilities(
  engines: EngineCaps[] = getBaseEnginesByCategory('all')
): WorkspaceModelCapability[] {
  return [
    ...engines.map(buildCapability).filter((capability) => capability.workflows.length > 0),
    ...getVirtualWorkspaceCapabilities(),
  ];
}
```

- [ ] **Step 2: Add image, audio, upscale, and chat capability fields**

Inside `buildCapability(engine)`, derive category and output:

```ts
const category = engine.modes.every((mode) => mode === 't2i' || mode === 'i2i') || engine.pricing?.unit === 'image'
  ? 'image'
  : 'video';
const outputKind = category === 'image' ? 'image' : 'video';
```

Return:

```ts
family: category,
outputKind,
```

Update `workflowTypesFor(engine)`:

```ts
if (hasMode(engine, ['t2i'])) workflows.push('text_to_image');
if (hasMode(engine, ['i2i'])) workflows.push('image_to_image');
```

- [ ] **Step 3: Add virtual capabilities**

Add this helper in `model-capability-registry.ts`:

```ts
function virtualCapability(input: {
  id: string;
  label: string;
  family: WorkspaceModelCapability['family'];
  outputKind: WorkspaceModelCapability['outputKind'];
  workflow: WorkspaceWorkflowType;
  requiredInputs: WorkspaceEdgeKind[];
  optionalInputs: WorkspaceEdgeKind[];
}): WorkspaceModelCapability {
  const inputConnectors = inputConnectorsFromKinds(input.requiredInputs, input.optionalInputs);
  const supportedInputs = new Set([...input.requiredInputs, ...input.optionalInputs]);
  return {
    id: input.id,
    label: input.label,
    provider: 'MaxVideoAI',
    providerEngineSlug: input.id,
    family: input.family,
    outputKind: input.outputKind,
    modes: [],
    workflows: [input.workflow],
    text_to_video: input.workflow === 'text_to_video',
    image_to_video: input.workflow === 'image_to_video',
    video_to_video: input.workflow === 'video_to_video',
    storyboard_to_video: input.workflow === 'storyboard_to_video',
    reference_image: input.optionalInputs.some((kind) => ['reference', 'start_image', 'product', 'character'].includes(kind)),
    reference_video: input.optionalInputs.includes('video_reference') || input.requiredInputs.includes('video_reference'),
    product_reference: input.optionalInputs.includes('product'),
    character_reference: input.optionalInputs.includes('character'),
    motion_reference: input.optionalInputs.includes('motion_reference'),
    audio_input: input.optionalInputs.includes('audio'),
    music_input: input.workflow === 'music_generation',
    voiceover_input: input.workflow === 'voiceover_generation',
    dialogue: input.workflow === 'voiceover_generation',
    lip_sync: false,
    audio_generation: input.family === 'audio',
    supports_people_reference: input.optionalInputs.includes('character'),
    supports_product_reference: input.optionalInputs.includes('product'),
    supported_aspect_ratios: ['16:9', '9:16', '1:1', '4:5'],
    supported_durations: input.family === 'audio' ? [3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180] : [5, 7, 8, 10],
    supported_resolutions: ['720p', '1080p', '1440p', '4k'],
    supported_fps: [24, 30],
    input_connectors: inputConnectors,
    render_options: [],
    required_inputs: input.requiredInputs,
    optional_inputs: input.optionalInputs,
    unsupported_inputs: ALL_INPUT_KINDS.filter((kind) => !supportedInputs.has(kind)),
  };
}

function getVirtualWorkspaceCapabilities(): WorkspaceModelCapability[] {
  return [
    virtualCapability({
      id: 'audio-music-only',
      label: 'Music generator',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'music_generation',
      requiredInputs: ['prompt'],
      optionalInputs: ['style'],
    }),
    virtualCapability({
      id: 'audio-voice-only',
      label: 'Voice-over generator',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'voiceover_generation',
      requiredInputs: ['prompt'],
      optionalInputs: ['voiceover', 'dialogue', 'narration'],
    }),
    virtualCapability({
      id: 'audio-sfx-only',
      label: 'SFX generator',
      family: 'audio',
      outputKind: 'audio',
      workflow: 'sfx_generation',
      requiredInputs: ['prompt'],
      optionalInputs: ['video_reference', 'motion_reference'],
    }),
    virtualCapability({
      id: 'upscale-image-seedvr',
      label: 'SeedVR image upscale',
      family: 'upscale',
      outputKind: 'image',
      workflow: 'image_upscale',
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'upscale-video-seedvr',
      label: 'SeedVR video upscale',
      family: 'upscale',
      outputKind: 'video',
      workflow: 'video_upscale',
      requiredInputs: ['video_reference'],
      optionalInputs: ['prompt'],
    }),
    virtualCapability({
      id: 'studio-chat-openai',
      label: 'OpenAI chat',
      family: 'chat',
      outputKind: 'text',
      workflow: 'chat_completion',
      requiredInputs: ['prompt'],
      optionalInputs: ['reference', 'video_reference', 'audio'],
    }),
    virtualCapability({
      id: 'studio-chat-gemini',
      label: 'Gemini chat',
      family: 'chat',
      outputKind: 'text',
      workflow: 'chat_completion',
      requiredInputs: ['prompt'],
      optionalInputs: ['reference', 'video_reference', 'audio'],
    }),
  ];
}
```

- [ ] **Step 4: Export connector-from-kind helper**

In `model-input-connectors.ts`, export:

```ts
export function inputConnectorsFromKinds(
  requiredInputs: WorkspaceEdgeKind[],
  optionalInputs: WorkspaceEdgeKind[]
): WorkspaceInputConnector[] {
  const connectors = new Map<WorkspaceEdgeKind, WorkspaceInputConnector>();
  requiredInputs.forEach((kind) => insertConnector(connectors, connectorFromKind(kind, true)));
  optionalInputs.forEach((kind) => insertConnector(connectors, connectorFromKind(kind, false)));
  return sortConnectors(Array.from(connectors.values()));
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
npm run test:editor
```

Expected:
- Capability family assertions pass.
- Image preset validation may still fail until node defaults are wired in Task 4.

- [ ] **Step 6: Commit capabilities**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/models/model-capability-registry.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/models/model-input-connectors.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-capabilities.ts tests/maxvideoai-editor-generation-blocks.test.ts
git commit -m "feat: expose studio image audio upscale and chat capabilities"
```

---

### Task 4: Create Correct Nodes From Toolbar Presets

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-canvas-imports.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGraphActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-types.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-frame.tsx`
- Test: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] **Step 1: Update ad hoc node creation signature**

In `workspace-canvas-imports.ts`, import presets:

```ts
import { getWorkspaceBlockPreset } from './workspace-block-presets';
import type { WorkspaceGenerationPresetId } from './workspace-types';
```

Change signature:

```ts
export function createAdHocWorkspaceNode(
  kind: WorkspaceNodeKind,
  index: number,
  modelId: string,
  notices: StudioCopy['notices'],
  positionOverride?: { x: number; y: number },
  presetId?: WorkspaceGenerationPresetId
): WorkspaceGraphNode {
```

Before the existing final `shot` fallback, add:

```ts
const preset = getWorkspaceBlockPreset(presetId);
if (preset?.nodeKind === 'chat') {
  return {
    id,
    type: 'chat',
    position,
    data: {
      kind: 'chat',
      title: notices.chatBoxTitle,
      subtitle: notices.chatBoxSubtitle,
      accent: preset.accent,
      chat: {
        ...preset.defaultChat,
        provider: 'openai',
        modelId: 'gpt-4.1-mini',
        systemPrompt: notices.defaultChatSystemPrompt,
        draftMessage: '',
        messages: [],
        status: 'idle',
      },
      targetHandles: ['prompt', 'reference', 'video_reference', 'audio'],
      sourceHandles: ['prompt'],
    },
  };
}

if (preset?.nodeKind === 'shot' && preset.defaultShot) {
  return {
    id,
    type: 'shot',
    position,
    data: {
      kind: 'shot',
      title: notices[preset.titleKey] ?? preset.id,
      subtitle: notices[preset.subtitleKey] ?? notices.newGenerationBlockSubtitle,
      accent: preset.accent,
      shot: preset.defaultShot,
      targetHandles: preset.defaultShot.workflowType === 'text_to_image'
        ? ['prompt', 'reference', 'product', 'character', 'style', 'composition', 'logo']
        : preset.defaultShot.workflowType === 'image_upscale'
          ? ['reference', 'prompt']
          : preset.defaultShot.workflowType === 'video_upscale'
            ? ['video_reference', 'prompt']
            : preset.defaultShot.family === 'audio'
              ? ['prompt', 'video_reference', 'voiceover', 'dialogue', 'narration']
              : ['prompt', 'negative_prompt', 'product', 'character', 'style', 'video_reference', 'motion_reference', 'audio', 'voiceover', 'music', 'camera', 'dialogue', 'narration', 'previous_shot'],
      sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
    },
  };
}
```

- [ ] **Step 2: Pass preset from graph actions**

In `useWorkspaceGraphActions.ts`, change:

```ts
const node = createAdHocWorkspaceNode(request.kind, nodes.length, defaultModelId, studioNotices, {
  x: request.position.x - 105,
  y: request.position.y - 48,
}, request.presetId);
```

- [ ] **Step 3: Render chat nodes**

In `workspace-node-types.tsx`, add:

```tsx
export function ChatNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  const messages = props.data.chat?.messages ?? [];
  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<MessageSquareText size={14} />} className={styles.promptNode}>
      <div className={styles.promptNodeBody}>
        <textarea
          value={props.data.chat?.draftMessage ?? ''}
          readOnly
          rows={4}
          aria-label={copy?.chatBox ?? 'Chat box'}
        />
      </div>
      <div className={styles.promptMeta}>
        <span>{props.data.chat?.provider === 'gemini' ? 'Gemini' : 'OpenAI'}</span>
        <span>{messages.length} messages</span>
      </div>
    </NodeFrame>
  );
}
```

Add to `workspaceNodeTypes`:

```ts
chat: memo(ChatNode),
```

In `workspace-node-frame.tsx`, add `chat` to source-resizable nodes:

```ts
const SOURCE_RESIZABLE_NODE_KINDS = new Set<WorkspaceNodeKind>([
  'asset-image',
  'asset-video',
  'asset-audio',
  'text-prompt',
  'note',
  'chat',
  'output',
]);
```

- [ ] **Step 4: Run tests**

Run:

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
npm run test:editor
```

Expected:
- Pure preset/default tests pass.
- Playwright still fails until localized labels and inspector are complete.

- [ ] **Step 5: Commit node creation**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-canvas-imports.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceGraphActions.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/nodes/workspace-node-types.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/nodes/workspace-node-frame.tsx tests/maxvideoai-editor-generation-blocks.test.ts
git commit -m "feat: create studio canvas nodes from generation presets"
```

---

### Task 5: Inspector UX For Preset-Specific Models And Chat

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeInspector.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/NodeSettingsPanel.tsx`

- [ ] **Step 1: Filter models by family/output/workflow**

In `ShotNodeInspector.tsx`, replace current capability list derivation:

```ts
const compatibleCapabilities = capabilities.filter((capability) => {
  const familyMatches = !shot.family || capability.family === shot.family;
  const outputMatches = !shot.outputKind || capability.outputKind === shot.outputKind;
  const workflowMatches = capability.workflows.includes(shot.workflowType);
  return familyMatches && outputMatches && workflowMatches;
});
const recommendedModels = (validation?.recommendedModels ?? [])
  .filter((capability) => compatibleCapabilities.some((candidate) => candidate.id === capability.id))
  .slice(0, 4);
const recommendedModelIds = new Set(recommendedModels.map((model) => model.id));
const remainingCapabilities = compatibleCapabilities.filter((capability) => !recommendedModelIds.has(capability.id));
```

When model changes, preserve preset family/output:

```ts
onPatchShot(node.id, {
  modelId: value,
  family: nextCapability?.family ?? shot.family,
  outputKind: nextCapability?.outputKind === 'text' ? shot.outputKind : nextCapability?.outputKind ?? shot.outputKind,
  audioEnabled: nextAudioOption?.control === 'toggle' ? nextAudioOption.defaultEnabled : false,
  lipSyncEnabled: nextLipSyncOption?.control === 'toggle' ? nextLipSyncOption.defaultEnabled : false,
});
```

- [ ] **Step 2: Hide video-only controls for image/audio/upscale**

In `ShotNodeInspector.tsx`, render duration/ratio/resolution/fps conditionally:

```tsx
{shot.outputKind === 'video' || shot.family === 'audio' ? (
  <FieldLabel>
    {copy.duration}
    <SelectControl value={shot.durationSec} onChange={(value) => onPatchShot(node.id, { durationSec: Number(value) })}>
      {durations.map((duration) => <option key={duration} value={duration}>{duration}s</option>)}
    </SelectControl>
  </FieldLabel>
) : null}

{shot.outputKind === 'video' || shot.outputKind === 'image' ? (
  <FieldLabel>
    {copy.aspect}
    <SelectControl value={shot.aspectRatio} onChange={(value) => onPatchShot(node.id, { aspectRatio: value as WorkspaceShotSettings['aspectRatio'] })}>
      {ratios.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
    </SelectControl>
  </FieldLabel>
) : null}
```

Do not show FPS for image/audio/chat.

- [ ] **Step 3: Create chat inspector**

Create `ChatNodeInspector.tsx`:

```tsx
'use client';

import { Send } from 'lucide-react';
import { FieldLabel, SelectControl } from './NodeInspectorControls';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type { WorkspaceChatSettings, WorkspaceGraphNode } from '../_lib/workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';

const styles = { ...baseStyles, ...inspectorStyles };

type ChatNodeInspectorProps = {
  copy: StudioCopy['canvas']['nodes'];
  node: WorkspaceGraphNode;
  onPatchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  onRunChat: (nodeId: string) => void;
};

function patchChat(chat: WorkspaceChatSettings | undefined, patch: Partial<WorkspaceChatSettings>): WorkspaceChatSettings {
  return {
    provider: chat?.provider ?? 'openai',
    modelId: chat?.modelId ?? 'gpt-4.1-mini',
    systemPrompt: chat?.systemPrompt ?? '',
    draftMessage: chat?.draftMessage ?? '',
    messages: chat?.messages ?? [],
    status: chat?.status ?? 'idle',
    ...patch,
  };
}

export function ChatNodeInspector({ copy, node, onPatchNodeData, onRunChat }: ChatNodeInspectorProps) {
  const chat = patchChat(node.data.chat, {});
  return (
    <>
      <FieldLabel>
        {copy.provider}
        <SelectControl
          value={chat.provider}
          onChange={(value) => onPatchNodeData(node.id, {
            chat: patchChat(chat, {
              provider: value === 'gemini' ? 'gemini' : 'openai',
              modelId: value === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4.1-mini',
            }),
          })}
        >
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        {copy.model}
        <SelectControl value={chat.modelId} onChange={(value) => onPatchNodeData(node.id, { chat: patchChat(chat, { modelId: value }) })}>
          {chat.provider === 'openai' ? (
            <>
              <option value="gpt-4.1-mini">GPT-4.1 mini</option>
              <option value="gpt-4.1">GPT-4.1</option>
            </>
          ) : (
            <>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            </>
          )}
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        {copy.systemPrompt}
        <textarea className={styles.settingsTextarea} rows={4} value={chat.systemPrompt} onChange={(event) => onPatchNodeData(node.id, { chat: patchChat(chat, { systemPrompt: event.currentTarget.value }) })} />
      </FieldLabel>
      <FieldLabel>
        {copy.message}
        <textarea className={styles.settingsTextarea} rows={6} value={chat.draftMessage} onChange={(event) => onPatchNodeData(node.id, { chat: patchChat(chat, { draftMessage: event.currentTarget.value }) })} />
      </FieldLabel>
      <button type="button" className={styles.primaryPanelButton} disabled={!chat.draftMessage.trim() || chat.status === 'running'} onClick={() => onRunChat(node.id)}>
        <Send size={15} />
        {chat.status === 'running' ? copy.running : copy.send}
      </button>
      <div className={styles.connectedList}>
        {chat.messages.map((message) => (
          <div key={message.id} className={styles.connectedRow}>
            <span />
            <p>{message.role}</p>
            <small>{message.content}</small>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Wire chat inspector**

In `NodeSettingsPanel.tsx`, import `ChatNodeInspector` and add prop:

```ts
onRunChat: (nodeId: string) => void;
```

Render:

```tsx
{selectedNode.data.kind === 'chat' ? (
  <ChatNodeInspector copy={copy} node={selectedNode} onPatchNodeData={onPatchNodeData} onRunChat={onRunChat} />
) : null}
```

- [ ] **Step 5: Run TypeScript**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: fails until `onRunChat` is wired in Task 7 or temporarily passed as a noop in layout. For this task, add a noop in wiring:

```tsx
onRunChat={() => undefined}
```

Then rerun and expect pass.

- [ ] **Step 6: Commit inspector**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/ChatNodeInspector.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/ShotNodeInspector.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/NodeSettingsPanel.tsx
git commit -m "feat: add studio generation and chat inspectors"
```

---

### Task 6: Route Generation By Output Family

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing.ts`
- Test: `tests/maxvideoai-editor-generation-blocks.test.ts`

- [ ] **Step 1: Add route dispatcher**

Create `workspace-generation-routing.ts`:

```ts
import { runGenerate } from '@/lib/api';
import type { WorkspaceGraphEdge, WorkspaceGraphNode, WorkspaceModelCapability, WorkspaceOutputMetadata, WorkspaceShotSettings } from './workspace-types';
import { mediaUrlsFromKinds, prepareWorkspaceShotGenerationInputs } from './workspace-generation';

export type WorkspaceGenerationRouteResult = {
  output: WorkspaceOutputMetadata;
};

export async function submitWorkspaceGenerationByFamily(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  canvasNodeCopy?: Record<string, string>;
}): Promise<WorkspaceGenerationRouteResult> {
  if (params.settings.family === 'image' || params.settings.outputKind === 'image') {
    return submitStudioImageGeneration(params);
  }
  if (params.settings.family === 'audio' || params.settings.outputKind === 'audio') {
    return submitStudioAudioGeneration(params);
  }
  if (params.settings.family === 'upscale') {
    return submitStudioUpscaleGeneration(params);
  }
  return submitStudioVideoGeneration(params);
}
```

Add `submitStudioVideoGeneration()` by moving the current `runGenerate` logic from `submitWorkspaceShotGeneration()` without changing payload behavior.

Add image route:

```ts
async function submitStudioImageGeneration(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  canvasNodeCopy?: Record<string, string>;
}): Promise<WorkspaceGenerationRouteResult> {
  const prepared = prepareWorkspaceShotGenerationInputs(params);
  const referenceImages = mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['reference', 'start_image', 'product', 'character', 'style', 'composition', 'logo']);
  const response = await fetch('/api/images/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: referenceImages.length ? 'i2i' : 't2i',
      engineId: params.settings.modelId,
      prompt: prepared.prompt,
      referenceImages,
      aspectRatio: params.settings.aspectRatio,
      resolution: params.settings.resolution,
      source: 'studio',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !Array.isArray(data.images) || !data.images[0]?.url) {
    throw new Error(data?.error?.message ?? 'Image generation failed.');
  }
  const image = data.images[0];
  return {
    output: {
      kind: 'image',
      modelId: params.settings.modelId,
      modelLabel: params.capability?.label ?? params.settings.modelId,
      workflowType: params.settings.workflowType,
      aspectRatio: params.settings.aspectRatio,
      resolution: params.settings.resolution,
      pricing: data.pricing ?? null,
      status: 'ready',
      createdAt: new Date().toISOString(),
      sourceShotId: params.shotNode.id,
      url: image.url,
      thumbUrl: image.thumbUrl ?? image.url,
      jobId: data.jobId ?? null,
    },
  };
}
```

Add audio route:

```ts
function audioPackForWorkflow(workflow: WorkspaceShotSettings['workflowType']): string {
  if (workflow === 'voiceover_generation') return 'voice_only';
  if (workflow === 'sfx_generation') return 'sfx_only';
  return 'music_only';
}

async function submitStudioAudioGeneration(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  canvasNodeCopy?: Record<string, string>;
}): Promise<WorkspaceGenerationRouteResult> {
  const prepared = prepareWorkspaceShotGenerationInputs(params);
  const sourceVideoUrl = mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['video_reference', 'motion_reference'])[0] ?? undefined;
  const response = await fetch('/api/audio/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pack: audioPackForWorkflow(params.settings.workflowType),
      prompt: prepared.prompt,
      script: prepared.prompt,
      mood: 'cinematic',
      intensity: 'standard',
      durationSec: params.settings.durationSec,
      sourceVideoUrl,
      exportAudioFile: true,
      locale: 'en',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data.audioUrl) {
    throw new Error(data?.message ?? 'Audio generation failed.');
  }
  return {
    output: {
      kind: 'audio',
      modelId: params.settings.modelId,
      modelLabel: params.capability?.label ?? params.settings.modelId,
      workflowType: params.settings.workflowType,
      durationSec: params.settings.durationSec,
      pricing: data.pricing ?? null,
      status: 'ready',
      createdAt: new Date().toISOString(),
      sourceShotId: params.shotNode.id,
      url: data.audioUrl,
      audioUrl: data.audioUrl,
      thumbUrl: data.thumbUrl ?? null,
      jobId: data.jobId ?? null,
    },
  };
}
```

Add upscale route:

```ts
async function submitStudioUpscaleGeneration(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
}): Promise<WorkspaceGenerationRouteResult> {
  const isVideo = params.settings.workflowType === 'video_upscale';
  const mediaUrl = mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, [isVideo ? 'video_reference' : 'reference'])[0];
  if (!mediaUrl) throw new Error(isVideo ? 'Video source is required for upscale.' : 'Image source is required for upscale.');
  const response = await fetch(isVideo ? '/api/tools/upscale/video' : '/api/tools/upscale/image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mediaType: isVideo ? 'video' : 'image',
      mediaUrl,
      engineId: isVideo ? 'seedvr-video' : 'seedvr-image',
      mode: 'target',
      targetResolution: '2160p',
      outputFormat: isVideo ? 'mp4' : 'png',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data.output?.url) {
    throw new Error(data?.error?.message ?? 'Upscale failed.');
  }
  return {
    output: {
      kind: isVideo ? 'video' : 'image',
      modelId: params.settings.modelId,
      modelLabel: params.capability?.label ?? params.settings.modelId,
      workflowType: params.settings.workflowType,
      durationSec: isVideo ? params.settings.durationSec : undefined,
      resolution: '4k',
      pricing: data.pricing ?? null,
      status: 'ready',
      createdAt: new Date().toISOString(),
      sourceShotId: params.shotNode.id,
      url: data.output.url,
      thumbUrl: data.output.thumbUrl ?? data.output.url,
      jobId: data.jobId ?? null,
    },
  };
}
```

- [ ] **Step 2: Delegate existing generation**

In `workspace-generation.ts`, update `submitWorkspaceShotGeneration()` to call `submitWorkspaceGenerationByFamily()` and keep mock output logic unchanged:

```ts
const routed = await submitWorkspaceGenerationByFamily({
  nodes: params.nodes,
  edges: params.edges,
  shotNode,
  settings,
  capability: params.capability,
  canvasNodeCopy: params.canvasNodeCopy,
});
return createWorkspaceGenerationResultFromOutput({
  shotNode,
  settings,
  capability: params.capability,
  output: routed.output,
  siblingCount,
});
```

Create `createWorkspaceGenerationResultFromOutput()` by extracting existing `buildOutputNode()` usage.

- [ ] **Step 3: Set pending output kind correctly**

In `createPendingWorkspaceOutput()`, change:

```ts
kind: params.settings.outputKind ?? 'video',
```

Set output node `sourceHandles`:

```ts
sourceHandles: [output.kind === 'audio' ? 'audio' : output.kind === 'image' ? 'reference' : 'video_reference'],
```

- [ ] **Step 4: Run tests**

Run:

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm run test:editor
```

Expected: pass after import cycles are resolved.

- [ ] **Step 5: Commit generation routing**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-generation-routing.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-generation.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_lib/workspace-pricing.ts tests/maxvideoai-editor-generation-blocks.test.ts
git commit -m "feat: route studio generation by block family"
```

---

### Task 7: Add Studio Chat API And Chat Actions

**Files:**
- Create: `frontend/app/api/studio/chat/route.ts`
- Create: `frontend/src/server/studio/chat.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx`

- [ ] **Step 1: Implement server chat adapter**

Create `frontend/src/server/studio/chat.ts`:

```ts
import OpenAI from 'openai';

export type StudioChatProvider = 'openai' | 'gemini';

export type StudioChatMessageInput = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StudioChatRequest = {
  provider: StudioChatProvider;
  modelId: string;
  messages: StudioChatMessageInput[];
};

export async function runStudioChat(request: StudioChatRequest): Promise<{ content: string; modelId: string; provider: StudioChatProvider }> {
  if (request.provider === 'gemini') {
    return runGeminiStudioChat(request);
  }
  return runOpenAIStudioChat(request);
}

async function runOpenAIStudioChat(request: StudioChatRequest): Promise<{ content: string; modelId: string; provider: StudioChatProvider }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: request.modelId || 'gpt-4.1-mini',
    input: request.messages.map((message) => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    })),
  });
  const content = response.output_text?.trim();
  if (!content) throw new Error('OpenAI returned an empty response.');
  return { content, modelId: request.modelId || 'gpt-4.1-mini', provider: 'openai' };
}

async function runGeminiStudioChat(request: StudioChatRequest): Promise<{ content: string; modelId: string; provider: StudioChatProvider }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  const modelId = request.modelId || 'gemini-2.5-flash';
  const system = request.messages.find((message) => message.role === 'system')?.content ?? '';
  const userMessages = request.messages.filter((message) => message.role !== 'system');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: userMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
    }),
  });
  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim();
  if (!response.ok || !content) throw new Error(data?.error?.message ?? 'Gemini returned an empty response.');
  return { content, modelId, provider: 'gemini' };
}
```

- [ ] **Step 2: Add authenticated API route**

Create `frontend/app/api/studio/chat/route.ts`:

```ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { runStudioChat } from '@/server/studio/chat';

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'auth_required', message: 'Authentication required.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload', message: 'Payload must be JSON.' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return NextResponse.json({ ok: false, error: 'message_required', message: 'At least one message is required.' }, { status: 400 });
  }

  try {
    const result = await runStudioChat({
      provider: body.provider === 'gemini' ? 'gemini' : 'openai',
      modelId: typeof body.modelId === 'string' ? body.modelId : '',
      messages: messages.map((message: { role?: string; content?: string }) => ({
        role: message.role === 'assistant' || message.role === 'system' ? message.role : 'user',
        content: String(message.content ?? ''),
      })),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'studio_chat_failed', message: error instanceof Error ? error.message : 'Studio chat failed.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Add chat action hook**

In `useWorkspaceGenerationActions.ts`, add return member:

```ts
handleRunChat: (nodeId: string) => Promise<void>;
```

Implementation:

```ts
const handleRunChat = useCallback(async (nodeId: string) => {
  const chatNode = nodes.find((node) => node.id === nodeId);
  const chat = chatNode?.data.chat;
  if (!chat || !chat.draftMessage.trim()) return;
  const userMessage = {
    id: `chat-user-${Date.now().toString(36)}`,
    role: 'user' as const,
    content: chat.draftMessage.trim(),
    createdAt: new Date().toISOString(),
  };
  const nextMessages = [
    ...(chat.systemPrompt.trim()
      ? [{ id: `chat-system-${nodeId}`, role: 'system' as const, content: chat.systemPrompt.trim(), createdAt: new Date().toISOString() }]
      : []),
    ...chat.messages,
    userMessage,
  ];
  setNodes((current) => current.map((node) => node.id === nodeId && node.data.chat
    ? { ...node, data: { ...node.data, chat: { ...node.data.chat, messages: nextMessages, draftMessage: '', status: 'running' } } }
    : node
  ));
  const response = await fetch('/api/studio/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: chat.provider,
      modelId: chat.modelId,
      messages: nextMessages.map(({ role, content }) => ({ role, content })),
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.ok) throw new Error(data?.message ?? 'Chat failed.');
  const assistantMessage = {
    id: `chat-assistant-${Date.now().toString(36)}`,
    role: 'assistant' as const,
    content: data.content,
    createdAt: new Date().toISOString(),
  };
  setNodes((current) => current.map((node) => node.id === nodeId && node.data.chat
    ? {
        ...node,
        data: {
          ...node.data,
          promptText: data.content,
          chat: { ...node.data.chat, messages: [...nextMessages, assistantMessage], status: 'idle' },
        },
      }
    : node
  ));
}, [nodes, setNodes]);
```

Catch errors and set status failed:

```ts
catch (error) {
  setNodes((current) => current.map((node) => node.id === nodeId && node.data.chat
    ? { ...node, data: { ...node.data, chat: { ...node.data.chat, status: 'failed' } } }
    : node
  ));
  setNotice(error instanceof Error ? error.message : studioNotices.generationFailed);
}
```

- [ ] **Step 4: Wire `onRunChat` through layout**

In `WorkspacePage.client.tsx`, pass `generation.handleRunChat` into `WorkspaceEditorLayout`.

In `WorkspaceEditorLayout.tsx`, pass it into `NodeSettingsPanel`.

- [ ] **Step 5: Run checks**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
npm run test:editor
```

Expected: pass.

- [ ] **Step 6: Commit chat**

```bash
git add frontend/src/server/studio/chat.ts frontend/app/api/studio/chat/route.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx frontend/app/\(core\)/\(workspace\)/app/studio/workspace/WorkspacePage.client.tsx
git commit -m "feat: add studio canvas chat box generation"
```

---

### Task 8: Support Standalone SFX Audio Pack

**Files:**
- Modify: `frontend/src/lib/audio-generation.ts`
- Modify: `frontend/src/server/audio/audio-generate-validation.ts`
- Modify: `frontend/src/server/audio/generate-audio.ts`
- Modify: `tests/audio-generation-config.test.ts`

- [ ] **Step 1: Add `sfx_only` audio pack**

In `audio-generation.ts`, change:

```ts
export const AUDIO_PACK_VALUES = ['music_only', 'voice_only', 'sfx_only', 'cinematic', 'cinematic_voice'] as const;
```

Add config:

```ts
sfx_only: {
  engineId: 'audio-sfx-only',
  billingProductKey: 'audio-sfx-only',
  label: 'SFX Only',
  description: 'Standalone sound effects and ambience as an audio file.',
  includesVoice: false,
  audioOnly: true,
  requiresVideo: false,
  requiresMood: true,
  requiresScript: false,
  supportsMusicToggle: false,
  supportsAudioExport: false,
  defaultMusicEnabled: false,
},
```

Update pricing line builder to include the sound design provider:

```ts
if (input.pack === 'sfx_only') {
  lines.push({
    type: 'sound_design_mirelo_sfx_v1_5',
    label: 'SFX generation',
    model: 'mirelo-ai/sfx-v1.5/video-to-audio',
    amountCents: Math.ceil(durationSec * AUDIO_PRICE_MIRELO_SFX_CENTS_PER_SECOND),
  });
}
```

- [ ] **Step 2: Validate sfx prompt**

In `audio-generate-validation.ts`, change prompt validation:

```ts
if ((pack === 'music_only' || pack === 'sfx_only' || pack === 'cinematic') && !prompt) {
  throw new AudioGenerationError('Prompt is required.', { status: 400, code: 'audio_prompt_required', field: 'prompt' });
}
```

Change duration default:

```ts
if ((pack === 'music_only' || pack === 'sfx_only') && !sourceVideoUrl && !sourceJobId && durationInput == null) {
  throw new AudioGenerationError('Duration is required.', { status: 400, code: 'audio_duration_required', field: 'durationSec' });
}
```

- [ ] **Step 3: Generate SFX without mandatory source video**

In `generate-audio.ts`, add:

```ts
let soundDesignTrack = null;
if (normalized.pack === 'sfx_only') {
  soundDesignTrack = await generateSoundDesignTrack({
    sourceVideoUrl: sourceVideoUrl ?? '',
    durationSec,
    mood: normalized.mood,
    intensity: normalized.intensity,
    prompt: normalized.prompt,
  });
}
```

Then return audio-only output using `soundDesignTrack.url`.

If `generateSoundDesignTrack()` rejects empty `sourceVideoUrl` for the first provider, update `providers/sound-design.ts` so text-only providers are tried first when no source video exists:

```ts
const canUseVideoProvider = Boolean(input.sourceVideoUrl);
if (candidate.key === 'mirelo_sfx_v1_5' && canUseVideoProvider) {
  return { video_url: input.sourceVideoUrl, text_prompt: prompt, duration: input.durationSec, num_samples: 2 };
}
if (candidate.key === 'mirelo_sfx_v1_5' && !canUseVideoProvider) {
  throw new Error('Mirelo SFX requires source video for this route.');
}
```

- [ ] **Step 4: Add audio config test**

In `tests/audio-generation-config.test.ts`:

```ts
test('sfx-only audio pack is standalone and billable', () => {
  const config = getAudioPackConfig('sfx_only');
  assert.equal(config.audioOnly, true);
  assert.equal(config.requiresVideo, false);
  assert.equal(config.requiresMood, true);
  const pricing = buildAudioPricingSnapshot({
    pack: 'sfx_only',
    durationSec: 8,
    mood: 'tense',
    voiceMode: null,
    script: null,
    musicEnabled: false,
  });
  assert.ok(pricing.itemization.some((line) => line.type === 'sound_design_mirelo_sfx_v1_5'));
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test tests/audio-generation-config.test.ts
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: pass.

- [ ] **Step 6: Commit SFX pack**

```bash
git add frontend/src/lib/audio-generation.ts frontend/src/server/audio/audio-generate-validation.ts frontend/src/server/audio/generate-audio.ts frontend/src/server/audio/providers/sound-design.ts tests/audio-generation-config.test.ts
git commit -m "feat: support standalone studio sfx generation"
```

---

### Task 9: Localize Toolbar, Nodes, Inspector, And Notices

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`

- [ ] **Step 1: Add typed copy keys**

Add to `StudioCopy['canvas']['nodes']` default copy:

```ts
storyboard: 'Storyboard',
storyboardDescription: 'Generate a video from storyboard panels, timing notes, and continuity references.',
character: 'Character',
characterDescription: 'Generate a character-consistent shot from identity references and dialogue.',
upscaleImage: 'Upscale image',
upscaleImageDescription: 'Enhance an image source to a higher-resolution output.',
upscaleVideo: 'Upscale video',
upscaleVideoDescription: 'Enhance a video source to a higher-resolution output.',
imageGenerationTitle: 'Image generation',
imageGenerationSubtitle: 'Prompt-to-image or reference image workflow.',
videoGenerationTitle: 'Video generation',
videoGenerationSubtitle: 'Model-aware video generation block.',
storyboardGenerationTitle: 'Storyboard generation',
storyboardGenerationSubtitle: 'Storyboard panels to video.',
characterGenerationTitle: 'Character generation',
characterGenerationSubtitle: 'Character reference to video.',
modifyVideoTitle: 'Modify video',
modifyVideoSubtitle: 'Video-to-video edit workflow.',
imageUpscaleTitle: 'Image upscale',
imageUpscaleSubtitle: 'Image enhancement workflow.',
videoUpscaleTitle: 'Video upscale',
videoUpscaleSubtitle: 'Video enhancement workflow.',
musicGenerationTitle: 'Music generation',
musicGenerationSubtitle: 'Standalone music bed.',
musicGenerationDescription: 'Generate a music track from a prompt.',
voiceOverGenerationTitle: 'Voice-over generation',
voiceOverGenerationSubtitle: 'Narration or dialogue audio.',
sfxGenerationTitle: 'SFX generation',
sfxGenerationSubtitle: 'Sound effects and ambience.',
chatBox: 'Chat box',
chatBoxDescription: 'Have an LLM conversation and reuse the answer as text context.',
chatBoxTitle: 'LLM chat',
chatBoxSubtitle: 'OpenAI or Gemini conversation.',
provider: 'Provider',
systemPrompt: 'System prompt',
message: 'Message',
running: 'Running',
send: 'Send',
defaultChatSystemPrompt: 'You are helping plan a MaxVideoAI Studio generation graph. Answer with concise, reusable production instructions.',
```

Add matching French and Spanish entries in messages:

```json
"chatBox": "Boite de chat",
"chatBoxDescription": "Avoir une conversation LLM et reutiliser la reponse comme contexte texte."
```

Use ASCII if the surrounding file uses ASCII-only generated content; otherwise use the existing locale style.

- [ ] **Step 2: Run copy tests**

Run:

```bash
npm run test:editor
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: pass.

- [ ] **Step 3: Commit copy**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/_lib/studio-copy.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json
git commit -m "feat: localize studio generation block copy"
```

---

### Task 10: Persistence, Normalization, And Backward Compatibility

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers.ts`
- Modify: `frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence.ts`
- Modify: `frontend/src/server/studio/contracts.ts`
- Modify: `tests/maxvideoai-editor-sequence-api-persistence.test.ts`

- [ ] **Step 1: Normalize old shot nodes**

In `workspace-normalizers.ts`, add `normalizeWorkspaceGenerationNode`:

```ts
function normalizeWorkspaceGenerationNode(node: WorkspaceGraphNode): WorkspaceGraphNode {
  if (node.data.kind === 'shot' && node.data.shot) {
    return {
      ...node,
      data: {
        ...node.data,
        shot: {
          ...node.data.shot,
          presetId: node.data.shot.presetId ?? 'generate-video',
          family: node.data.shot.family ?? 'video',
          outputKind: node.data.shot.outputKind ?? 'video',
        },
      },
    };
  }

  if (node.data.kind === 'chat') {
    return {
      ...node,
      type: 'chat',
      data: {
        ...node.data,
        kind: 'chat',
        chat: normalizeChatSettings(node.data.chat),
        sourceHandles: ['prompt'],
        targetHandles: ['prompt', 'reference', 'video_reference', 'audio'],
      },
    };
  }

  return node;
}
```

Add:

```ts
function normalizeChatSettings(value: unknown): WorkspaceChatSettings {
  const record = value && typeof value === 'object' ? value as Partial<WorkspaceChatSettings> : {};
  return {
    provider: record.provider === 'gemini' ? 'gemini' : 'openai',
    modelId: typeof record.modelId === 'string' && record.modelId.trim() ? record.modelId : 'gpt-4.1-mini',
    systemPrompt: typeof record.systemPrompt === 'string' ? record.systemPrompt : '',
    draftMessage: typeof record.draftMessage === 'string' ? record.draftMessage : '',
    messages: Array.isArray(record.messages) ? record.messages.filter((message) => message && typeof message.content === 'string') as WorkspaceChatMessage[] : [],
    status: record.status === 'running' || record.status === 'failed' ? record.status : 'idle',
  };
}

export function normalizeWorkspaceGraphNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return normalizeGeneratedOutputNodes(
    normalizeShotOutputNodes(
      normalizeOutputOnlySourceNodes(nodes.map(normalizeWorkspaceGenerationNode))
    )
  );
}
```

- [ ] **Step 2: Add persistence test**

In `tests/maxvideoai-editor-sequence-api-persistence.test.ts`:

```ts
import {
  normalizeWorkspaceGraphNodes,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers';

test('workspace normalization preserves new generation presets and chat nodes', () => {
  const normalized = normalizeWorkspaceGraphNodes([
    {
      id: 'chat-1',
      type: 'chat',
      position: { x: 0, y: 0 },
      data: {
        kind: 'chat',
        title: 'LLM chat',
        chat: { provider: 'gemini', modelId: 'gemini-2.5-flash', messages: [], systemPrompt: '', draftMessage: '', status: 'idle' },
      },
    },
    {
      id: 'shot-1',
      type: 'shot',
      position: { x: 100, y: 0 },
      data: {
        kind: 'shot',
        title: 'Image generation',
        shot: { modelId: 'seedream', workflowType: 'text_to_image', durationSec: 1, aspectRatio: '16:9', resolution: '1080p', fps: 24, audioEnabled: false, lipSyncEnabled: false, referenceStrength: 0.65, outputName: 'Image', status: 'draft' },
      },
    },
  ]);
  assert.equal(normalized[0].data.kind, 'chat');
  assert.equal(normalized[0].data.chat?.provider, 'gemini');
  assert.equal(normalized[1].data.shot?.presetId, 'generate-video');
  assert.equal(normalized[1].data.shot?.family, 'video');
});
```

In `workspace-api-persistence.ts`, replace both inline node normalization chains with `normalizeWorkspaceGraphNodes(...)` so local hydration and server-sequence hydration use the same preset/chat normalization path.

- [ ] **Step 3: Run persistence tests**

Run:

```bash
npm run test:editor
```

Expected: pass.

- [ ] **Step 4: Commit persistence**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_state/workspace-normalizers.ts frontend/app/\(core\)/\(workspace\)/app/studio/workspace/_state/workspace-persistence.ts frontend/src/server/studio/contracts.ts tests/maxvideoai-editor-sequence-api-persistence.test.ts
git commit -m "feat: persist studio generation presets and chat nodes"
```

---

### Task 11: Browser Verification And Final QA

**Files:**
- Test only unless defects are found.

- [ ] **Step 1: Run focused pure tests**

```bash
node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-generation-blocks.test.ts tests/maxvideoai-editor-workspace-architecture.test.ts tests/maxvideoai-editor-sequence-api-persistence.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run full editor QA**

```bash
npm run qa:editor
```

Expected: all pass.

- [ ] **Step 3: Run Playwright smoke**

```bash
PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 PLAYWRIGHT_EDITOR_BASE_URL=http://localhost:3000/app/studio/workspace frontend/node_modules/.bin/playwright test -c playwright.editor.config.ts tests/e2e/editor/editor-smoke.spec.ts -g "canvas toolbar creates"
```

Expected: pass.

- [ ] **Step 4: Manual browser checklist**

Open `http://localhost:3000/app/studio/workspace/project_630fb2af-524c-4ca6-a8d2-22687884b106` and verify:

```txt
Image menu:
- Image source still exists.
- Generate image creates an Image generation node.
- Upscale image creates an Image upscale node.
- Inspector model list only shows image/upscale models as appropriate.

Video menu:
- Generate video creates a normal video generation node.
- Modify video requires video input.
- Storyboard creates a storyboard-to-video node with storyboard/reference connectors.
- Character creates a character-reference node with character connector.
- Upscale video requires video input.

Audio menu:
- Music creates an audio output block.
- Voice over creates an audio output block with script/message fields.
- SFX creates an audio output block and accepts prompt-only generation.

Text menu:
- Free text still exists.
- Chat box creates an LLM chat node.
- Provider switch changes OpenAI/Gemini model options.
- Chat answer becomes text output that can connect to prompt inputs.
```

- [ ] **Step 5: Check formatting**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 6: Final commit**

```bash
git status --short
git add frontend tests docs
git commit -m "feat: add studio canvas generation block families"
```

---

## Self-Review

Spec coverage:
- Generate image block connected to image models: Tasks 2, 3, 4, 5, 6.
- Storyboard block connected to storyboard/video engines: Tasks 2, 3, 4, 5.
- Character block connected to character-capable engines: Tasks 2, 3, 4, 5.
- Upscale blocks: Tasks 2, 3, 4, 6.
- Music, voice-over, SFX audio blocks: Tasks 2, 3, 4, 6, 8.
- Chat box with Gemini/OpenAI choice: Tasks 2, 4, 5, 7.
- Better existing blocks and Studio integration: Tasks 3, 5, 6, 10.
- Tests and verification: Tasks 1 and 11.

Placeholder scan:
- The plan uses concrete file paths, test snippets, commands, and expected outcomes.
- No step is left as "implement later".

Type consistency:
- `WorkspaceGenerationPresetId`, `WorkspaceGenerationFamily`, `WorkspaceChatSettings`, `WorkspaceModelCapability.family`, and `WorkspaceModelCapability.outputKind` are introduced before later tasks use them.
- Toolbar, controller, graph action, and node creation all pass the same `presetId`.
- Chat node uses `kind: 'chat'`; generation blocks continue using `kind: 'shot'` for backward compatibility.
