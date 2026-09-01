import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';

test('FLUX first/last fields are visible from the default workspace mode for automatic fl2v', () => {
  for (const engineId of ['flux-3', 'flux-3-draft']) {
    const entry = listFalEngines().find((candidate) => candidate.id === engineId);
    assert.ok(entry);
    const schema = summarizeWorkspaceInputSchema({
      selectedEngine: entry.engine,
      activeMode: 't2v',
      allowsUnifiedVeoFirstLast: true,
      isUnifiedHappyHorse: false,
      isUnifiedSeedance: false,
      isUnifiedGeminiOmni: false,
      uiLocale: 'en',
    });
    assert.deepEqual(
      schema.assetFields.map(({ field }) => field.id),
      ['image_url', 'start_image_url', 'end_image_url'],
      engineId,
    );
  }
});

test('workspace engine state recognizes schema-named FLUX frames and manual fl2v', () => {
  const source = readFileSync(
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts',
    'utf8',
  );
  assert.match(source, /\['last_frame_url', 'end_image_url'\]/);
  assert.match(source, /currentMode === 'fl2v'/);
  assert.match(source, /modes\.includes\('fl2v'\)/);
});
