import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  getGeminiOmniAssetFieldDisabledReason,
  getGeminiOmniModeDisabledReason,
  resolveGeminiOmniUnifiedMode,
} from '../frontend/app/(core)/(workspace)/app/_lib/gemini-omni-unified-workflow.ts';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema.ts';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

const root = process.cwd();
const composerSurfacePath = join(root, 'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx');
const appClientPath = join(root, 'frontend/app/(core)/(workspace)/app/AppClient.tsx');
const omniPanelPath = join(root, 'frontend/app/(core)/(workspace)/app/_components/omni/OmniStudioPanel.client.tsx');

function getGeminiOmniEngine() {
  const entry = listFalEngines().find((candidate) => candidate.id === 'gemini-omni-flash');
  assert.ok(entry, 'Gemini Omni Flash engine should exist');
  return entry.engine;
}

function asset(fieldId: string, kind: ReferenceAsset['kind']): ReferenceAsset {
  return {
    id: `${fieldId}-${kind}`,
    fieldId,
    previewUrl: `https://cdn.example.com/${fieldId}.${kind === 'video' ? 'mp4' : 'png'}`,
    kind,
    name: kind === 'video' ? 'clip.mp4' : 'image.png',
    size: 1000,
    type: kind === 'video' ? 'video/mp4' : 'image/png',
    url: `https://cdn.example.com/${fieldId}.${kind === 'video' ? 'mp4' : 'png'}`,
    status: 'ready',
  };
}

test('Gemini Omni Studio UI is isolated below WorkspaceComposerSurface', () => {
  assert.ok(existsSync(omniPanelPath), 'OmniStudioPanel.client.tsx should exist');
  const surfaceSource = readFileSync(composerSurfacePath, 'utf8');
  const appClientSource = readFileSync(appClientPath, 'utf8');

  assert.match(surfaceSource, /OmniStudioPanel/, 'WorkspaceComposerSurface should mount the Omni panel');
  assert.match(surfaceSource, /selectedEngine\.id === 'gemini-omni-flash'/, 'Omni mount should be engine-gated');
  assert.doesNotMatch(appClientSource, /OmniStudioPanel/, 'AppClient must not import provider-specific Omni UI');
});

test('Gemini Omni Studio owns Omni assets and hides duplicate generic controls', () => {
  const source = readFileSync(composerSurfacePath, 'utf8');
  assert.match(source, /OMNI_CUSTOM_FIELD_IDS/, 'custom Omni field ids should be centralized');
  assert.match(source, /showOmniStudioPanel/, 'surface should compute an Omni panel gate');
  assert.match(source, /filter\(\(entry\) =>/, 'Composer asset fields should be filterable');
  assert.match(source, /if \(showOmniStudioPanel\) return false/, 'Omni asset fields should not be duplicated in Composer');
  assert.match(source, /OMNI_CUSTOM_FIELD_IDS\.has\(field\.id\)/, 'generic advanced settings should hide Omni custom fields');
});

test('Gemini Omni Studio exposes expected controls and uses shared asset primitives', () => {
  const source = readFileSync(omniPanelPath, 'utf8');
  assert.match(source, /AssetDropzone/, 'Omni media slots should reuse AssetDropzone');
  assert.match(source, /WandSparkles|Images|Film|RotateCcw/, 'task controls should use lucide icons');
  assert.match(source, /getGeminiOmniModeDisabledReason/, 'Omni mode buttons should gray incompatible workflows');
  assert.match(source, /getGeminiOmniAssetFieldDisabledReason/, 'Omni media slots should gray incompatible inputs');
  assert.match(source, /prompt_audio_direction/);
  assert.match(source, /prompt_camera_direction/);
  assert.match(source, /prompt_edit_instruction/);
  assert.match(source, /previous_interaction_id/);
  assert.match(source, /store_interaction/);
});

test('Gemini Omni unified workflow routes from media assets and refine state', () => {
  const engine = getGeminiOmniEngine();

  assert.equal(resolveGeminiOmniUnifiedMode({ engine, inputAssets: {} }), 't2v');
  assert.equal(
    resolveGeminiOmniUnifiedMode({ engine, inputAssets: { image_url: [asset('image_url', 'image')] } }),
    'i2v'
  );
  assert.equal(
    resolveGeminiOmniUnifiedMode({
      engine,
      inputAssets: { reference_images: [asset('reference_images', 'image')] },
    }),
    'ref2v'
  );
  assert.equal(
    resolveGeminiOmniUnifiedMode({ engine, inputAssets: { video_url: [asset('video_url', 'video')] } }),
    'v2v'
  );
  assert.equal(
    resolveGeminiOmniUnifiedMode({ engine, inputAssets: {}, previousInteractionId: 'interactions/abc123' }),
    'retake'
  );
});

test('Gemini Omni unified schema keeps media slots visible from text and refine modes', () => {
  const engine = getGeminiOmniEngine();
  const base = {
    selectedEngine: engine,
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    isUnifiedGeminiOmni: true,
    uiLocale: 'en',
  };

  const textSchema = summarizeWorkspaceInputSchema({ ...base, activeMode: 't2v' });
  assert.deepEqual(
    textSchema.assetFields.map(({ field }) => field.id),
    ['image_url', 'reference_images', 'video_url']
  );

  const refineSchema = summarizeWorkspaceInputSchema({ ...base, activeMode: 'retake' });
  assert.deepEqual(
    refineSchema.assetFields.map(({ field }) => field.id),
    ['image_url', 'reference_images', 'video_url']
  );
  assert.ok(refineSchema.secondaryFields.some(({ field }) => field.id === 'previous_interaction_id'));
});

test('Gemini Omni incompatible modes and asset fields return disabled reasons', () => {
  const videoState = {
    hasSourceImage: false,
    hasReferenceImages: false,
    hasSourceVideo: true,
    hasPreviousInteraction: false,
  };
  assert.equal(getGeminiOmniModeDisabledReason('v2v', videoState), null);
  assert.match(getGeminiOmniModeDisabledReason('i2v', videoState) ?? '', /Source video controls/);
  assert.equal(getGeminiOmniAssetFieldDisabledReason('video_url', videoState), null);
  assert.match(getGeminiOmniAssetFieldDisabledReason('image_url', videoState) ?? '', /Source video controls/);

  const refineState = {
    hasSourceImage: false,
    hasReferenceImages: false,
    hasSourceVideo: false,
    hasPreviousInteraction: true,
  };
  assert.equal(getGeminiOmniModeDisabledReason('retake', refineState), null);
  assert.match(getGeminiOmniModeDisabledReason('t2v', refineState) ?? '', /previous interaction id/i);
  assert.match(getGeminiOmniAssetFieldDisabledReason('reference_images', refineState) ?? '', /previous interaction id/i);
});
