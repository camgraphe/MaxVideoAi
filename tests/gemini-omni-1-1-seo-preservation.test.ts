import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveRuntimePublicSlug } from '../frontend/config/model-runtime.ts';
import { loadEngineScores } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-data-loaders.ts';
import { loadAppEngineScoreMap } from '../frontend/src/server/engine-scores.ts';
import { loadHubEngineScoreMap } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-scores.ts';
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';

const EXISTING_CANONICALS = [
  '/models/gemini-omni-flash',
  '/ai-video-engines/gemini-omni-flash-vs-veo-3-1',
  '/ai-video-engines/gemini-omni-flash-vs-veo-3-1-fast',
  '/ai-video-engines/gemini-omni-flash-vs-sora-2',
  '/ai-video-engines/gemini-omni-flash-vs-seedance-2-0',
] as const;

test('Gemini Omni Flash 1.1 preserves the existing canonical owner and aliases', () => {
  assert.equal(resolveRuntimePublicSlug('gemini-omni-flash')?.slug, 'gemini-omni-flash');
  assert.equal(resolveRuntimePublicSlug('gemini-omni-flash-1-1')?.slug, 'gemini-omni-flash');
  assert.equal(resolveRuntimePublicSlug('gemini-omni-flash-preview')?.slug, 'gemini-omni-flash');
  assert.equal(EXISTING_CANONICALS.some((path) => path.includes('/models/gemini-omni-flash-1-1')), false);
});

test('Omni 1.2 upgrades the same localized owners while retaining explicitly historical 1.1 proof', () => {
  for (const alias of ['gemini-omni-1-2-flash', 'gemini-omni-flash-1-2']) {
    assert.equal(resolveRuntimePublicSlug(alias)?.slug, 'gemini-omni-flash');
  }
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = JSON.parse(readFileSync(`content/models/${locale}/gemini-omni-flash.json`, 'utf8'));
    assert.equal(content.marketingName, 'Gemini Omni Flash 1.2');
    assert.match(content.seo.title, /1\.2/);
    assert.match(content.decision.hero.title, /1\.2/);
    assert.match(content.decision.media.caption, /1\.1/);
    assert.match(content.prompting.section.title, /1\.1/);
    assert.match(content.examples.section.title, /1\.1/);
    for (const opponent of ['veo-3-1', 'veo-3-1-fast']) {
      const compare = getComparePageOverride(locale, `gemini-omni-flash-vs-${opponent}`)!;
      assert.match(compare.meta!.title!, /1\.2/);
      assert.ok(compare.faq?.items.some(item => /1\.1/.test(item.question) && /1\.2/.test(String(item.answer))));
    }
  }
});

test('historical Omni 1.1 ratings cannot become a score for the upgraded engine', async () => {
  const scores = JSON.parse(readFileSync('data/benchmarks/engine-scores.v1.json', 'utf8'));
  const historical = scores.historicalScores?.find((row: { modelSlug: string; modelVersion: string }) => row.modelSlug === 'gemini-omni-flash' && row.modelVersion === '1.1');
  assert.equal(historical?.last_updated, '2026-09-03');
  assert.equal(historical?.controllability, 9.2);
  assert.equal((await loadEngineScores()).has('gemini-omni-flash'), false);
  assert.equal((await loadHubEngineScoreMap()).has('gemini-omni-flash'), false);
  assert.equal((await loadAppEngineScoreMap())['gemini-omni-flash'], undefined);
});

test('localized Gemini model copy upgrades in place without the former 720p-only contract', () => {
  for (const locale of ['en', 'fr', 'es']) {
    const raw = readFileSync(`content/models/${locale}/gemini-omni-flash.json`, 'utf8');
    assert.match(raw, /Gemini Omni Flash 1\.1/);
    assert.match(raw, /4K/);
    assert.doesNotMatch(raw, /gemini-omni-flash-preview|720p-only|720p only/i);
  }
});
