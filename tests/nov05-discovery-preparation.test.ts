import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { buildModelFamilyDefinitions } from '../frontend/config/model-families';
import { MODEL_LAUNCH_READY_MODELS } from '../frontend/config/model-launch-readiness';
import { getLocalizedModelData } from '../frontend/lib/examples/modelLandingData';
import { buildMarketingCompareMenu, buildMarketingModelMenu } from '../frontend/config/navigation';
import { buildPublishedComparisonSlugsFromModels } from '../frontend/lib/compare-hub/pairs';
import { getPublishedComparisonSlugs, getHubComparisonSlugsForSitemap, isPublishedComparisonSlug } from '../frontend/lib/compare-hub/data';
import { parseComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides';
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import compareConfig from '../frontend/config/compare-config.json';
import evidence from '../data/benchmarks/kling-v4-flash-evidence.v1.json';

const flashId = 'kling-v4-flash';
const pair = 'kling-v4-vs-kling-v4-flash';

test('Flash comparison is ready in three locales but remains absent from public discovery while closed', () => {
  const file = `content/comparisons/${pair}.json`;
  const content = parseComparePageContentDocument(readFileSync(file, 'utf8'), pair, file);
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.match(content[locale].quickVerdict!.body!, /Modify/);
    assert.match(content[locale].quickVerdict!.body!, /Extend/);
    assert.equal(content[locale].primaryLinks?.length, 2);
  }
  assert.ok(compareConfig.scoreboardOnlyComparisons.includes(pair));
  assert.equal(isPublishedComparisonSlug(pair), false);
  assert.ok(!getPublishedComparisonSlugs().includes(pair));
  assert.ok(!getHubComparisonSlugsForSitemap().includes(pair));
  const models = listRuntimeModels().map(model => structuredClone(model));
  assert.ok(!buildPublishedComparisonSlugsFromModels(models, () => true).includes(pair));
  const originalMenu = buildMarketingModelMenu(models);
  const originalCompareMenu = buildMarketingCompareMenu(models);
  const flash = models.find(model => model.id === flashId)!;
  flash.publication.model = { published: true, indexable: true };
  flash.publication.compare.published = true;
  flash.publication.compare.indexed = true;
  assert.deepEqual(buildMarketingModelMenu(models).map(item => item.slug), [flashId, ...originalMenu.map(item => item.slug)]);
  assert.deepEqual(buildMarketingCompareMenu(models).map(item => item.slug), [pair, ...originalCompareMenu.map(item => item.slug)]);
  assert.ok(buildPublishedComparisonSlugsFromModels(models, () => true).includes(pair));
});

test('Flash family copy requires publication and accepted exact-model media without changing the historical owner', () => {
  const models = listRuntimeModels().map(model => structuredClone(model));
  const baselineFamilies = buildModelFamilyDefinitions(models);
  const baselineKling = baselineFamilies.find(family => family.id === 'kling')!;
  const flash = models.find(model => model.id === flashId)!;
  flash.publication.model = { published: true, indexable: true };
  flash.publication.examples = { published: true, current: true, includeInFamilyCopy: true };
  const withoutMedia = buildModelFamilyDefinitions(models, MODEL_LAUNCH_READY_MODELS.filter(row => row.modelId !== flashId));
  const complete = buildModelFamilyDefinitions(models);
  assert.equal(complete.find(family => family.id === 'kling')!.defaultModelSlug, baselineKling.defaultModelSlug);
  for (const locale of ['en', 'fr', 'es'] as const) {
    const baseline = getLocalizedModelData(locale, baselineFamilies);
    assert.deepEqual(getLocalizedModelData(locale, withoutMedia, models), baseline);
    const ready = getLocalizedModelData(locale, complete, models);
    assert.match(ready.kling!.summary!, /Kling 4\.0 Flash/);
    assert.equal(ready.kling!.metaTitle, baseline.kling!.metaTitle);
    assert.deepEqual(ready.kling!.faq.slice(0, baseline.kling!.faq.length), baseline.kling!.faq);
    assert.equal(ready.kling!.faq.length, baseline.kling!.faq.length + 1);
  }
});

test('Flash capability facts do not manufacture numeric scores from marketing selections', async () => {
  const data = await loadBenchmarkLabStaticData();
  const spec = data.specs.find(row => row.modelSlug === flashId);
  assert.ok(spec);
  assert.equal(spec.keySpecs?.maxResolution, '720p');
  assert.equal(spec.keySpecs?.videoToVideo, 'Not supported');
  assert.ok(!data.scores.some(row => row.modelSlug === flashId));
  assert.deepEqual(evidence.criterionAssessments.map(row => row.criterion), data.methodology.criteria.map(row => row.id));
  assert.ok(evidence.criterionAssessments.every(row => row.score === null && row.requiredEvidence));
  assert.equal(evidence.editorialReview.promptPackExecuted, false);
});
