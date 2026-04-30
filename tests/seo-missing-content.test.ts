import assert from 'node:assert/strict';
import test from 'node:test';
import type { GscPerformanceRow } from '../frontend/lib/seo/gsc-analysis';
import {
  buildMissingContentItems,
  classifyMissingContentIntent,
} from '../frontend/lib/seo/missing-content';
import { formatCodexActionQueueMarkdown } from '../frontend/lib/seo/codex-action-queue';

function gscRow(
  query: string,
  page: string | null,
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

test('repeated prompt examples cluster recommends an examples block instead of a new page', () => {
  const items = buildMissingContentItems([
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5),
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/examples/ltx', 12, 70, 0.171, 5.8),
    gscRow('how to prompt ltx 2.3', 'https://maxvideoai.com/examples/ltx', 4, 42, 0.095, 6.1),
  ]);
  const item = items.find((candidate) => candidate.queryCluster === 'ltx 2.3 prompt examples');

  assert.ok(item);
  assert.equal(item.recommendationType, 'add_examples_block');
  assert.notEqual(item.recommendationType, 'create_page');
  assert.equal(item.family, 'LTX');
  assert.match(item.recommendedAction, /examples|prompt/i);
  assert.match(item.whyNotCreatePage ?? '', /ranking target|duplicate|existing/i);
});

test('existing comparison page recommends strengthening the comparison page', () => {
  const items = buildMissingContentItems([
    gscRow(
      'seedance 2.0 vs seedance 2.0 fast',
      'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
      10,
      47,
      0.2128,
      4.6
    ),
    gscRow(
      'seedance fast vs normal',
      'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
      4,
      35,
      0.114,
      5.2
    ),
  ]);
  const item = items[0];

  assert.ok(item);
  assert.equal(item.recommendationType, 'add_comparison_block');
  assert.notEqual(item.recommendationType, 'create_page');
  assert.match(item.targetUrl ?? '', /seedance-2-0-vs-seedance-2-0-fast/);
  assert.match(item.recommendedAction, /comparison|differences/i);
});

test('far-position pricing cluster becomes a watchlist item', () => {
  const items = buildMissingContentItems([
    gscRow('ai video generator pricing', 'https://maxvideoai.com/pricing', 1, 58, 0.0172, 34.3),
    gscRow('ai video api pricing', 'https://maxvideoai.com/pricing', 0, 20, 0, 36),
  ]);
  const item = items.find((candidate) => candidate.queryCluster === 'ai video generator pricing');

  assert.ok(item);
  assert.equal(item.recommendationType, 'watchlist');
  assert.equal(item.priority, 'low');
  assert.match(item.whyNotCreatePage ?? '', /not close|not large|new URL/i);
});

test('Pika max length intent maps to specs candidates without fabricating a target URL', () => {
  const items = buildMissingContentItems([
    gscRow('pika labs maximum video length', null, 0, 90, 0, 12.4),
    gscRow('pika duration limit', null, 0, 65, 0, 11.8),
  ]);
  const item = items[0];

  assert.ok(item);
  assert.equal(item.family, 'Pika');
  assert.equal(item.recommendationType, 'add_specs_block');
  assert.equal(item.targetUrl, null);
  assert.ok(item.likelyPageCandidates.includes('/models/pika-text-to-video'));
});

test('one-off low-volume query does not trigger create page', () => {
  const items = buildMissingContentItems([
    gscRow('random moon video prompt thing', null, 0, 1, 0, 8),
  ]);

  assert.equal(items.length, 0);
});

test('adult or junk queries are suppressed', () => {
  assert.equal(classifyMissingContentIntent('nsfw ai video generator'), 'irrelevant_junk');
  const items = buildMissingContentItems([
    gscRow('nsfw ai video generator', 'https://maxvideoai.com/', 0, 900, 0, 3),
    gscRow('ai video generator crack', 'https://maxvideoai.com/', 0, 200, 0, 2),
  ]);

  assert.equal(items.length, 0);
});

test('Missing Content export markdown and JSON shape include missingContentItems', () => {
  const items = buildMissingContentItems([
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 4, 120, 0.033, 8.1),
    gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/examples/ltx', 2, 80, 0.025, 8.2),
  ]);
  const markdown = formatCodexActionQueueMarkdown([], [], items);
  const jsonPayload = { actions: [], opportunities: [], ctrDoctorItems: [], missingContentItems: items };

  assert.match(markdown, /# Missing Content/);
  assert.match(markdown, /ltx 2\.3 prompt examples/i);
  assert.equal(Array.isArray(jsonPayload.missingContentItems), true);
  assert.ok(jsonPayload.missingContentItems.length > 0);
});
