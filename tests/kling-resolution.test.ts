import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { resolveFalVideoResolutionInput } from '../frontend/src/lib/fal.ts';
import { resolveRuntimeResolutionPolicy } from '../frontend/src/server/video-generation/runtime-resolution';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate';
import { getExactVideoPresetInput, getPresetQuote, VIDEO_PRICE_PRESETS } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';

const currentKlingEngineIds = [
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'kling-3-pro',
  'kling-3-standard',
  'kling-3-4k',
  'kling-o3-standard',
  'kling-o3-pro',
  'kling-o3-4k',
];

test('Kling fixed-resolution modes expose a visible locked resolution choice', () => {
  const entries = listFalEngines().filter((entry) => currentKlingEngineIds.includes(entry.id));
  assert.equal(entries.length, currentKlingEngineIds.length);

  entries.forEach((entry) => {
    entry.modes.forEach((mode) => {
      assert.equal(
        mode.ui.resolution?.length,
        1,
        `${entry.id} ${mode.mode} should expose its single Fal output resolution`
      );
      assert.equal(mode.ui.resolutionLocked, true, `${entry.id} ${mode.mode} should show resolution as locked`);
    });
  });
});

test('workspace controls render locked resolution controls instead of hiding them', () => {
  const coreSettingsSource = fs.readFileSync(path.join(process.cwd(), 'frontend/components/CoreSettingsBar.tsx'), 'utf8');
  const settingsControlStateSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/settings-controls/useSettingsControlState.ts'),
    'utf8'
  );

  assert.match(coreSettingsSource, /const showResolutionControl = resolutionOptions\.length > 0;/);
  assert.match(settingsControlStateSource, /const showResolutionControl = resolutionOptions\.length > 0;/);
});

test('Kling Fal requests omit resolution because current Fal schemas use fixed-resolution endpoints', () => {
  currentKlingEngineIds.forEach((engineId) => {
    assert.equal(resolveFalVideoResolutionInput(engineId, '1080p'), undefined, `${engineId} should omit 1080p`);
    assert.equal(resolveFalVideoResolutionInput(engineId, '4k'), undefined, `${engineId} should omit 4k`);
  });
});

test('Kling Modify advertises the measured endpoint resolution and retains native Pro 1080p', () => {
  for (const [id, resolution] of [['kling-o3-standard', '720p'], ['kling-o3-pro', '1080p']] as const) {
    const entry = listFalEngines().find(entry => entry.id === id)!;
    assert.deepEqual(entry.engine.modeCaps?.v2v?.resolution, [resolution]);
    assert.deepEqual(entry.modes.find(mode => mode.mode === 'v2v')?.ui.resolution, [resolution]);
    assert.deepEqual(entry.engine.resolutions, ['1080p'], 'preserve generation and public pricing defaults');
    assert.equal(resolveRuntimeResolutionPolicy(entry.engine, 'v2v').defaultResolution, resolution);
    const invalid = validateRequest(id, 'v2v', { prompt: 'Change the room', duration: 6, resolution: resolution === '720p' ? '1080p' : '720p',
      aspect_ratio: '9:16', video_url: 'https://example.com/source.mov' });
    assert.equal(invalid.ok, false);
    assert.deepEqual(entry.engine.modeCaps?.t2v?.resolution, ['1080p'], 'do not extrapolate Modify evidence to other endpoints');
    assert.deepEqual(entry.engine.modeCaps?.v2v?.duration, { options: [3,4,5,6,7,8,9,10,11,12,13,14,15], default: 5 });
  }
});

test('Kling Modify does not change existing public generation price presets', () => {
  const entry = listFalEngines().find(entry => entry.id === 'kling-o3-standard')!;
  const entryPreset = VIDEO_PRICE_PRESETS.find(preset => preset.id === 'entry-route')!;
  const draftPreset = VIDEO_PRICE_PRESETS.find(preset => preset.id === '5s-720p')!;
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.equal(getExactVideoPresetInput(entry, entryPreset, locale)?.resolution, '1080p');
    assert.equal(getPresetQuote(entry, draftPreset, locale).status, 'unsupported');
  }
});
