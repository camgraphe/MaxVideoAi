import assert from 'node:assert/strict';
import test from 'node:test';
import type { GscPerformanceRow } from '../frontend/lib/seo/gsc-analysis';
import {
  classifySeoIntent,
  detectStrategicModelFamily,
  getBusinessPriorityWeight,
  getSeoFamilyDictionary,
  getSeoFamilyStatus,
  normalizeSeoQuery,
} from '../frontend/lib/seo/seo-intents';
import {
  buildStrategicSeoOpportunities,
  clusterGscQueries,
} from '../frontend/lib/seo/seo-opportunity-engine';
import { buildModelFamilyTracker } from '../frontend/lib/seo/model-family-tracker';
import {
  buildCodexActionQueue,
  formatCodexActionMarkdown,
} from '../frontend/lib/seo/codex-action-queue';

function gscRow(
  query: string,
  page: string,
  clicks: number,
  impressions: number,
  ctr: number,
  position: number
): GscPerformanceRow {
  return {
    query,
    page,
    country: 'usa',
    device: 'DESKTOP',
    searchAppearance: null,
    date: null,
    searchType: 'web',
    clicks,
    impressions,
    ctr,
    position,
  };
}

test('normalizes SEO queries deterministically', () => {
  assert.equal(normalizeSeoQuery('  LTX 2.3 Prompt Examples!!  '), 'ltx 2.3 prompt examples');
  assert.equal(normalizeSeoQuery('Seedance 2.0 Fast vs Normal'), 'seedance 2.0 fast vs normal');
});

test('classifies strategic SEO intents and model families', () => {
  assert.equal(classifySeoIntent('ltx 2.3 prompts'), 'prompt_examples');
  assert.equal(classifySeoIntent('seedance 2.0 prompt guide'), 'prompt_guide');
  assert.equal(classifySeoIntent('kling ai vs veo 3'), 'comparison');
  assert.equal(classifySeoIntent('ai video generator no subscription pay as you go'), 'pay_as_you_go');
  assert.equal(classifySeoIntent('veo 3 max length duration'), 'max_length');
  assert.equal(classifySeoIntent('best ai video generator for product ads'), 'product_advertisement');
  assert.equal(classifySeoIntent('first and last frame video generator'), 'first_last_frame');
  assert.equal(classifySeoIntent('realistic human ai video generator'), 'realistic_humans');
  assert.equal(detectStrategicModelFamily('minimax hailuo 02 examples'), 'Hailuo / Minimax');
  assert.equal(detectStrategicModelFamily('ai video generator no subscription', 'https://maxvideoai.com/pricing'), 'Other');
  assert.equal(detectStrategicModelFamily('maxvedio ai', 'https://maxvideoai.com/'), 'Brand');
});

test('builds family dictionary from real app model families', () => {
  const dictionary = getSeoFamilyDictionary();
  const labels = dictionary.map((family) => family.label);

  assert.ok(labels.includes('Seedance'));
  assert.ok(labels.includes('Kling'));
  assert.ok(labels.includes('Veo'));
  assert.ok(labels.includes('LTX'));
  assert.ok(labels.includes('Happy Horse'));
  assert.ok(dictionary.find((family) => family.label === 'Happy Horse')?.modelSlugs.includes('happy-horse-1-0'));
});

test('matches real app family aliases including Happy Horse', () => {
  assert.equal(detectStrategicModelFamily('happy horse 1.0 examples'), 'Happy Horse');
  assert.equal(detectStrategicModelFamily('happyhorse reference to video'), 'Happy Horse');
  assert.equal(detectStrategicModelFamily('alibaba happy horse vs seedance'), 'Happy Horse');
  assert.equal(detectStrategicModelFamily('luma ray 2 flash examples'), 'Luma Ray');
  assert.equal(detectStrategicModelFamily('unknown moon video model'), 'Other');
});

test('separates family existence from business priority scoring', () => {
  assert.equal(getSeoFamilyStatus('Seedance'), 'strategic');
  assert.equal(getSeoFamilyStatus('Kling'), 'strategic');
  assert.equal(getSeoFamilyStatus('Happy Horse'), 'emerging');
  assert.equal(getSeoFamilyStatus('Sora'), 'deprioritized');
  assert.equal(getSeoFamilyStatus('Other'), 'unknown');
  assert.ok(getBusinessPriorityWeight('Seedance') > getBusinessPriorityWeight('Happy Horse'));
  assert.ok(getBusinessPriorityWeight('Happy Horse') > getBusinessPriorityWeight('Sora'));
});

test('clusters repeated query patterns by family and intent', () => {
  const clusters = clusterGscQueries([
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/models/ltx-2-3-pro', 2, 300, 0.0067, 5.3),
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/models/ltx-2-3-pro', 1, 240, 0.0042, 4.8),
    gscRow('how to prompt ltx 2.3', 'https://maxvideoai.com/models/ltx-2-3-pro', 1, 210, 0.0048, 5.1),
    gscRow('seedance 2.0 fast vs normal', 'https://maxvideoai.com/models/seedance-2-0-fast', 0, 180, 0, 6.1),
    gscRow('seedance 2.0 vs seedance 2.0 fast', 'https://maxvideoai.com/models/seedance-2-0-fast', 0, 160, 0, 5.8),
    gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/models/veo-3-1-lite', 0, 100, 0, 7.2),
    gscRow('veo lite vs fast', 'https://maxvideoai.com/models/veo-3-1-lite', 0, 90, 0, 7.6),
    gscRow('kling ai video examples', 'https://maxvideoai.com/examples/kling', 1, 150, 0.0067, 8.2),
    gscRow('kling ai image to video examples', 'https://maxvideoai.com/examples/kling', 0, 120, 0, 8.4),
    gscRow('ai video generator no subscription', 'https://maxvideoai.com/pricing', 1, 130, 0.0077, 8.2),
    gscRow('pay as you go ai video generator', 'https://maxvideoai.com/pricing', 1, 125, 0.008, 8.4),
  ]);

  const ltxPrompts = clusters.find((cluster) => cluster.label === 'ltx 2.3 prompts');
  const seedanceCompare = clusters.find((cluster) => cluster.label === 'seedance 2.0 fast vs normal');
  const veoCompare = clusters.find((cluster) => cluster.label === 'veo 3.1 lite vs fast');
  const klingExamples = clusters.find((cluster) => cluster.label === 'kling ai video examples');
  const payAsYouGo = clusters.find((cluster) => cluster.intent === 'pay_as_you_go');

  assert.equal(ltxPrompts?.representativeQueries.length, 3);
  assert.equal(seedanceCompare?.representativeQueries.length, 2);
  assert.equal(veoCompare?.representativeQueries.length, 2);
  assert.equal(klingExamples?.representativeQueries.length, 2);
  assert.equal(payAsYouGo?.representativeQueries.length, 2);
  assert.equal(payAsYouGo?.modelFamily, 'Other');
});

test('scores strategic opportunities with required action fields', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/models/ltx-2-3-pro', 2, 720, 0.0028, 5.1),
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/models/ltx-2-3-pro', 0, 260, 0, 3.2),
    gscRow('kling ai video examples', 'https://maxvideoai.com/examples/kling', 1, 450, 0.0022, 7.4),
  ]);

  const ltx = opportunities.find((opportunity) => opportunity.queryCluster === 'ltx 2.3 prompts');
  assert.ok(ltx);
  assert.match(ltx.id, /prompt/);
  assert.equal(ltx.targetUrl, 'https://maxvideoai.com/models/ltx-2-3-pro');
  assert.equal(ltx.modelFamily, 'LTX');
  assert.equal(ltx.intent, 'prompt_examples');
  assert.ok(['critical', 'high'].includes(ltx.priority));
  assert.ok(ltx.score > 80);
  assert.ok(ltx.sourceMetrics.impressions >= 900);
  assert.ok(ltx.businessPriorityWeight > 1);
  assert.match(ltx.observedIssue, /prompt/i);
  assert.match(ltx.suggestedAction, /prompt/i);
  assert.match(ltx.expectedImpact, /click|ranking|CTR/i);
  assert.match(ltx.codexTaskDraft, /Acceptance criteria/);
});

test('filters noisy low-value one-off generic queries', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('random video thing', 'https://maxvideoai.com/tools/video-generator', 0, 14, 0, 38),
  ]);

  assert.equal(opportunities.length, 0);
});

test('builds business-priority family tracker', () => {
  const currentRows = [
    gscRow('seedance 2.0 fast vs normal', 'https://maxvideoai.com/models/seedance-2-0-fast', 1, 420, 0.0024, 5),
    gscRow('sora video generator', 'https://maxvideoai.com/models/sora-2-pro', 6, 900, 0.0067, 3),
  ];
  const previousRows = [
    gscRow('seedance 2.0 fast vs normal', 'https://maxvideoai.com/models/seedance-2-0-fast', 1, 250, 0.004, 7),
    gscRow('sora video generator', 'https://maxvideoai.com/models/sora-2-pro', 9, 1000, 0.009, 2.8),
  ];
  const opportunities = buildStrategicSeoOpportunities(currentRows);
  const tracker = buildModelFamilyTracker(currentRows, opportunities, previousRows);

  assert.equal(tracker[0].family, 'Seedance');
  const seedance = tracker.find((item) => item.family === 'Seedance');
  const sora = tracker.find((item) => item.family === 'Sora');
  assert.ok(seedance);
  assert.ok(sora);
  assert.equal(seedance.businessPriorityLabel, 'Strategic priority 1');
  assert.equal(seedance.momentum, 'gaining');
  assert.equal(sora.businessPriorityLabel, 'De-prioritized');
});

test('family tracker includes real emerging families without hiding lower-priority demand', () => {
  const currentRows = [
    gscRow('happy horse 1.0 examples', 'https://maxvideoai.com/models/happy-horse-1-0', 1, 140, 0.0071, 8.8),
    gscRow('unknown moon video model', 'https://maxvideoai.com/models', 0, 70, 0, 15),
    gscRow('sora video generator', 'https://maxvideoai.com/models/sora-2-pro', 4, 900, 0.0044, 3.1),
  ];
  const opportunities = buildStrategicSeoOpportunities(currentRows);
  const tracker = buildModelFamilyTracker(currentRows, opportunities);

  const happyHorse = tracker.find((item) => item.family === 'Happy Horse');
  const sora = tracker.find((item) => item.family === 'Sora');
  const other = tracker.find((item) => item.family === 'Other');

  assert.ok(happyHorse);
  assert.equal(happyHorse.familyStatus, 'emerging');
  assert.equal(happyHorse.businessPriorityLabel, 'Emerging / niche');
  assert.ok(sora);
  assert.equal(sora.familyStatus, 'deprioritized');
  assert.ok(other);
  assert.equal(other.familyStatus, 'unknown');
});

test('generates copy-ready Codex action markdown', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/models/ltx-2-3-pro', 1, 500, 0.002, 5.5),
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/models/ltx-2-3-pro', 0, 260, 0, 4.2),
  ]);
  const actions = buildCodexActionQueue(opportunities);

  assert.ok(actions.length >= 1);
  assert.match(actions[0].title, /LTX/i);
  assert.ok(actions[0].likelyFilesToInspect.some((file) => file.includes('content/models/en/ltx-2-3-pro.json')));

  const markdown = formatCodexActionMarkdown(actions[0]);
  assert.match(markdown, /Title:/);
  assert.match(markdown, /Source:/);
  assert.match(markdown, /Problem:/);
  assert.match(markdown, /Recommended implementation:/);
  assert.match(markdown, /Acceptance criteria:/);
});

test('dedupes Codex actions for the same underlying cluster', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/models/ltx-2-3-pro', 1, 520, 0.0019, 5.2),
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/models/ltx-2-3-pro', 0, 310, 0, 4.6),
    gscRow('how to prompt ltx 2.3', 'https://maxvideoai.com/models/ltx-2-3-pro', 0, 220, 0, 4.9),
  ]);
  const actions = buildCodexActionQueue(opportunities);
  const ltxActions = actions.filter((action) => action.queryCluster === 'ltx 2.3 prompts');

  assert.equal(ltxActions.length, 1);
});

test('brand typo opportunities do not spawn duplicate generic actions', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('maxvedio ai', 'https://maxvideoai.com/', 0, 180, 0, 2.4),
    gscRow('maxvideos ai', 'https://maxvideoai.com/', 0, 120, 0, 2.8),
  ]);
  const actions = buildCodexActionQueue(opportunities);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].intent, 'brand_typo');
  assert.notEqual(actions[0].priority, 'critical');
});

test('Codex action queue uses real family names for emerging app models', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('happy horse 1.0 examples', 'https://maxvideoai.com/models/happy-horse-1-0', 1, 180, 0.0056, 8.5),
    gscRow('happyhorse video examples', 'https://maxvideoai.com/models/happy-horse-1-0', 0, 90, 0, 9.1),
  ]);
  const actions = buildCodexActionQueue(opportunities);

  assert.ok(actions.length >= 1);
  assert.equal(actions[0].family, 'Happy Horse');
  assert.match(actions[0].markdown, /Happy Horse/);
  assert.ok(actions.every((action) => action.family !== 'Other'));
});

test('high CTR comparison clusters with good position are growth work, not critical fixes', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow(
      'seedance 2.0 vs fast',
      'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
      10,
      47,
      0.2128,
      4.6
    ),
    gscRow(
      'seedance 2.0 vs seedance 2.0 fast',
      'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
      0,
      12,
      0,
      4.5
    ),
  ]);
  const comparison = opportunities.find((opportunity) => opportunity.queryCluster === 'seedance 2.0 vs fast');

  assert.ok(comparison);
  assert.equal(comparison.intent, 'comparison');
  assert.notEqual(comparison.priority, 'critical');
  assert.ok(['high', 'medium'].includes(comparison.priority));
  assert.match(comparison.observedIssue, /expand|defend|already/i);
});

test('strong prompt examples cluster remains a top-priority growth opportunity', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 50, 220, 0.2273, 5.4),
    gscRow('ltx 2.3 prompt', 'https://maxvideoai.com/examples/ltx', 18, 90, 0.2, 5.8),
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/examples/ltx', 11, 68, 0.1618, 5.2),
  ]);
  const ltx = opportunities.find((opportunity) => opportunity.queryCluster === 'ltx 2.3 prompt examples');

  assert.ok(ltx);
  assert.equal(ltx.modelFamily, 'LTX');
  assert.equal(ltx.intent, 'prompt_examples');
  assert.ok(['critical', 'high'].includes(ltx.priority));
  assert.ok(ltx.score >= 86);
});

test('position 30 plus pricing specs clusters are downgraded unless signal is exceptional', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('ai video generator pricing', 'https://maxvideoai.com/pricing', 1, 58, 0.0172, 34.3),
    gscRow('ai video api pricing', 'https://maxvideoai.com/pricing', 0, 20, 0, 36),
  ]);
  const pricing = opportunities.find((opportunity) => opportunity.queryCluster === 'ai video generator pricing');

  assert.ok(pricing);
  assert.equal(pricing.intent, 'pricing_specs');
  assert.equal(pricing.priority, 'low');
});

test('strategic opportunities are deduped to one issue per target and query cluster', () => {
  const opportunities = buildStrategicSeoOpportunities([
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 50, 220, 0.2273, 5.4),
    gscRow('ltx 2.3 prompt', 'https://maxvideoai.com/examples/ltx', 18, 90, 0.2, 5.8),
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/examples/ltx', 11, 68, 0.1618, 5.2),
  ]);
  const clusterMatches = opportunities.filter(
    (opportunity) => opportunity.targetUrl === 'https://maxvideoai.com/examples/ltx' && opportunity.queryCluster === 'ltx 2.3 prompt examples'
  );

  assert.equal(clusterMatches.length, 1);
});

test('family tracker top query clusters are unique for stable card rendering', () => {
  const rows = [
    gscRow('veo 3.1 lite', 'https://maxvideoai.com/models/veo-3-1-lite', 2, 80, 0.025, 6),
    gscRow('veo 3.1 lite examples', 'https://maxvideoai.com/examples/veo', 1, 70, 0.0143, 8),
    gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 1, 65, 0.0154, 7),
  ];
  const tracker = buildModelFamilyTracker(rows, buildStrategicSeoOpportunities(rows));
  const veo = tracker.find((item) => item.family === 'Veo');

  assert.ok(veo);
  assert.equal(new Set(veo.topQueryClusters).size, veo.topQueryClusters.length);
});
