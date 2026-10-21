import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { loadAppEngineScoreMap, loadAppEngineScoreReviewMap } from '../frontend/src/server/engine-scores.ts';
import { createEnginesGetHandler } from '../frontend/app/api/engines/_lib/engines-get-handler';

const root = process.cwd();
const apiEnginesHandlerPath = join(root, 'frontend/app/api/engines/_lib/engines-get-handler.ts');
const imageWorkspacePagePath = join(root, 'frontend/app/(core)/(workspace)/app/image/page.tsx');

test('workspace score review status follows canonical editorial data without changing numeric scores', async () => {
  const [scores, reviews] = await Promise.all([loadAppEngineScoreMap(), loadAppEngineScoreReviewMap()]);
  const source = JSON.parse(readFileSync(join(root, 'data/benchmarks/engine-scores.v1.json'), 'utf8'));
  const expected = source.scores.filter((row: { reviewStatus?: string }) => row.reviewStatus === 'editorial-estimated');
  assert.ok(expected.length > 0);
  for (const row of expected) {
    const engine = listFalEngines().find((entry) => entry.modelSlug === row.modelSlug);
    assert.ok(engine);
    assert.equal(reviews[engine.engine.id], 'editorial-estimated');
    assert.equal(typeof scores[engine.engine.id], 'number');
  }
  assert.equal(reviews['seedance-2-5'], undefined);
  assert.equal(reviews['luma-uni-1'], undefined);
});

test('engine API carries generic editorial status for video and skips score readers for images', async () => {
  let reads = 0;
  const handler = createEnginesGetHandler({
    getPublicConfiguredEnginesByCategory: async () => [],
    resolveLaunchCanaryRequestContext: async () => null,
    loadAppEngineScoreMap: async () => { reads++; return { 'future-editorial-model': 8.4 }; },
    loadAppEngineScoreReviewMap: async () => { reads++; return { 'future-editorial-model': 'editorial-estimated' }; },
  });
  const video = await (await handler(new NextRequest('https://example.test/api/engines'))).json();
  assert.deepEqual(video.engineScores, { 'future-editorial-model': 8.4 });
  assert.deepEqual(video.engineScoreReviews, { 'future-editorial-model': 'editorial-estimated' });
  assert.equal(reads, 2);
  const image = await (await handler(new NextRequest('https://example.test/api/engines?category=image'))).json();
  assert.deepEqual(image.engineScoreReviews, {});
  assert.equal(reads, 2);
});

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
  assert.equal(typeof scoreMap['seedance-2-5'], 'number');
  assert.equal(scoreMap['seedance-2-5'], 9.1);
});

test('image engine surfaces do not request selector scores', () => {
  const apiSource = readFileSync(apiEnginesHandlerPath, 'utf8');
  const imagePageSource = readFileSync(imageWorkspacePagePath, 'utf8');

  assert.match(apiSource, /const includeScores = category !== 'image'/);
  assert.match(apiSource, /includeScores \? dependencies\.loadAppEngineScoreMap\(\) : Promise\.resolve\(\{\}\)/);
  assert.doesNotMatch(imagePageSource, /loadAppEngineScoreMap/);
  assert.doesNotMatch(imagePageSource, /engineScores=\{engineScores\}/);
});
