import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const composerSurfacePath = join(root, 'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx');
const appClientPath = join(root, 'frontend/app/(core)/(workspace)/app/AppClient.tsx');
const omniPanelPath = join(root, 'frontend/app/(core)/(workspace)/app/_components/omni/OmniStudioPanel.client.tsx');

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
  assert.match(source, /prompt_audio_direction/);
  assert.match(source, /prompt_camera_direction/);
  assert.match(source, /prompt_edit_instruction/);
  assert.match(source, /previous_interaction_id/);
  assert.match(source, /store_interaction/);
});
