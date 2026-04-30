import assert from 'node:assert/strict';
import test from 'node:test';
import type { GscPerformanceRow } from '../frontend/lib/seo/gsc-analysis';
import {
  buildCtrDoctorItems,
  formatCtrDoctorMarkdown,
} from '../frontend/lib/seo/ctr-doctor';

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

test('CTR Doctor detects high impressions with weak CTR', () => {
  const items = buildCtrDoctorItems([
    gscRow('kling ai video examples', 'https://maxvideoai.com/examples/kling', 3, 600, 0.005, 7.2),
    gscRow('kling ai image to video examples', 'https://maxvideoai.com/examples/kling', 0, 160, 0, 7.9),
  ]);
  const item = items.find((candidate) => candidate.queryCluster === 'kling ai video examples');

  assert.ok(item);
  assert.equal(item.targetUrl, 'https://maxvideoai.com/examples/kling');
  assert.equal(item.detectedIntent, 'examples');
  assert.ok(['critical', 'high'].includes(item.priority));
  assert.match(item.likelyProblem, /CTR|click/i);
  assert.match(item.recommendedTitleDirection, /Kling/i);
  assert.match(item.codexTaskDraft, /Acceptance criteria:/);
});

test('CTR Doctor detects good-position zero-click snippets', () => {
  const items = buildCtrDoctorItems([
    gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 0, 120, 0, 3.2),
    gscRow('veo lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 0, 80, 0, 3.5),
  ]);
  const item = items[0];

  assert.ok(item);
  assert.equal(item.detectedIntent, 'comparison');
  assert.ok(['critical', 'high'].includes(item.priority));
  assert.match(item.likelyProblem, /zero|no clicks|click/i);
  assert.match(item.aboveTheFoldRecommendation, /comparison|above/i);
});

test('CTR Doctor does not mark high-CTR good performers as urgent fixes', () => {
  const items = buildCtrDoctorItems([
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5),
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/examples/ltx', 12, 70, 0.171, 5.8),
  ]);
  const item = items.find((candidate) => candidate.queryCluster === 'ltx 2.3 prompt examples');

  assert.ok(item);
  assert.equal(item.detectedIntent, 'prompt_examples');
  assert.notEqual(item.priority, 'critical');
  assert.match(item.likelyProblem, /expand|defend|room to grow/i);
  assert.match(item.recommendedTitleDirection, /ltx 2\.3 prompt examples/i);
  assert.match(item.recommendedH1SectionDirection, /ltx 2\.3 prompt examples/i);
});

test('CTR Doctor downgrades far-position pricing snippets to watchlist', () => {
  const items = buildCtrDoctorItems([
    gscRow('ai video generator pricing', 'https://maxvideoai.com/pricing', 1, 58, 0.0172, 34.3),
    gscRow('ai video api pricing', 'https://maxvideoai.com/pricing', 0, 20, 0, 36),
  ]);
  const item = items.find((candidate) => candidate.queryCluster === 'ai video generator pricing');

  assert.ok(item);
  assert.equal(item.detectedIntent, 'pricing_specs');
  assert.equal(item.priority, 'low');
  assert.match(item.likelyProblem, /watchlist|far/i);
  assert.match(item.recommendedMetaDescriptionDirection, /future|closer|not spend|watchlist/i);
  assert.match(item.aboveTheFoldRecommendation, /no urgent|revisit/i);
});

test('CTR Doctor does not fabricate current metadata when no snapshot is provided', () => {
  const items = buildCtrDoctorItems([
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 4, 260, 0.0154, 6.1),
  ]);
  const item = items[0];

  assert.ok(item);
  assert.equal(item.currentMetadata, null);
  assert.match(item.codexTaskDraft, /Review current title\/meta\/H1/i);
  assert.doesNotMatch(item.codexTaskDraft, /Current title:/i);
});

test('CTR Doctor markdown is Codex-ready', () => {
  const item = buildCtrDoctorItems([
    gscRow('seedance 2.0 vs seedance 2.0 fast', 'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast', 2, 180, 0.0111, 5.2),
  ])[0];

  assert.ok(item);
  const markdown = formatCtrDoctorMarkdown(item);
  assert.match(markdown, /Title:/);
  assert.match(markdown, /Target:/);
  assert.match(markdown, /Observed:/);
  assert.match(markdown, /Recommended implementation:/);
  assert.match(markdown, /Acceptance criteria:/);
});
