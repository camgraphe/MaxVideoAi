import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { resolveFalVideoResolutionInput } from '../frontend/src/lib/fal.ts';

const currentKlingEngineIds = ['kling-2-5-turbo', 'kling-2-6-pro', 'kling-3-pro', 'kling-3-standard', 'kling-3-4k'];

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
  const settingsControlsSource = fs.readFileSync(path.join(process.cwd(), 'frontend/components/SettingsControls.tsx'), 'utf8');

  assert.match(coreSettingsSource, /const showResolutionControl = resolutionOptions\.length > 0;/);
  assert.match(settingsControlsSource, /const showResolutionControl = resolutionOptions\.length > 0;/);
});

test('Kling Fal requests omit resolution because current Fal schemas use fixed-resolution endpoints', () => {
  currentKlingEngineIds.forEach((engineId) => {
    assert.equal(resolveFalVideoResolutionInput(engineId, '1080p'), undefined, `${engineId} should omit 1080p`);
    assert.equal(resolveFalVideoResolutionInput(engineId, '4k'), undefined, `${engineId} should omit 4k`);
  });
});
