import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx');
const copyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-copy.ts');
const scoresPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-scores.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const scoresSource = readFileSync(scoresPath, 'utf8');

test('ai video engines hub keeps page.tsx focused on route orchestration', () => {
  assert.ok(existsSync(copyPath), 'localized hub copy should live in a route-local copy module');
  assert.ok(existsSync(scoresPath), 'score loading should live in a route-local server helper');
  assert.match(pageSource, /from '\.\/_lib\/ai-video-engines-copy'/);
  assert.match(pageSource, /from '\.\/_lib\/ai-video-engines-scores'/);

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 430, `ai-video-engines page.tsx should stay below 430 lines, got ${lineCount}`);

  for (const owner of ['const HUB_COPY', 'type HubCopy', 'type EngineScoreRow', 'function computeOverallFromScore']) {
    assert.doesNotMatch(pageSource, new RegExp(owner), `${owner} should not be owned by the hub page`);
  }
});

test('ai video engines route-local modules expose copy and score contracts', () => {
  assert.match(copySource, /export type HubCopy/);
  assert.match(copySource, /const HUB_COPY: Record<AppLocale, HubCopy>/);
  assert.match(copySource, /export function getHubCopy/);
  assert.match(copySource, /export function getBestForCta/);
  assert.match(scoresSource, /type EngineScoreRow/);
  assert.match(scoresSource, /function computeOverallFromScore/);
  assert.match(scoresSource, /export async function loadHubEngineScoreMap/);
});
