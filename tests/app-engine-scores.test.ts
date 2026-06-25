import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { loadAppEngineScoreMap } from '../frontend/src/server/engine-scores.ts';

const root = process.cwd();
const apiEnginesRoutePath = join(root, 'frontend/app/api/engines/route.ts');
const imageWorkspacePagePath = join(root, 'frontend/app/(core)/(workspace)/app/image/page.tsx');

test('app engine score map excludes image-only models while keeping video models', async () => {
  const scoreMap = await loadAppEngineScoreMap();
  const imageEngineIds = listFalEngines()
    .filter((entry) => (entry.category ?? 'video') === 'image')
    .flatMap((entry) => [entry.id, entry.engine.id, entry.modelSlug]);

  assert.equal(scoreMap['luma-uni-1'], undefined);
  assert.equal(scoreMap['luma-uni-1-max'], undefined);
  imageEngineIds.forEach((engineId) => {
    assert.equal(scoreMap[engineId], undefined, `${engineId} should not expose an app selector score`);
  });
  assert.equal(typeof scoreMap['luma-ray-3-2'], 'number', 'Luma Ray is a video engine and should keep its selector score');
});

test('image engine surfaces do not request selector scores', () => {
  const apiSource = readFileSync(apiEnginesRoutePath, 'utf8');
  const imagePageSource = readFileSync(imageWorkspacePagePath, 'utf8');

  assert.match(apiSource, /const includeScores = category !== 'image'/);
  assert.match(apiSource, /includeScores \? loadAppEngineScoreMap\(\) : Promise\.resolve\(\{\}\)/);
  assert.doesNotMatch(imagePageSource, /loadAppEngineScoreMap/);
  assert.doesNotMatch(imagePageSource, /engineScores=\{engineScores\}/);
});
