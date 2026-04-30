import assert from 'node:assert/strict';
import test from 'node:test';
import type { GscPerformanceRow } from '../frontend/lib/seo/gsc-analysis';
import {
  buildContentMomentumItems,
  formatContentMomentumSectionMarkdown,
} from '../frontend/lib/seo/content-momentum';
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

test('detects gaining pages and protect-winner momentum', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5),
    ],
    previousRows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 32, 170, 0.188, 7.2),
    ],
  });

  const page = items.find((item) => item.type === 'protect_winner' && item.pageUrl?.includes('/examples/ltx'));
  assert.ok(page);
  assert.equal(page.family, 'LTX');
  assert.equal(page.current.impressions, 378);
  assert.equal(page.previous.impressions, 170);
  assert.ok(page.impressionDelta > 150);
  assert.match(page.recommendedAction, /protect|expand|refresh/i);
});

test('detects declining pages and refresh candidates', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('seedance 2.0 vs seedance 2.0 fast', 'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast', 4, 70, 0.057, 8.9),
    ],
    previousRows: [
      gscRow('seedance 2.0 vs seedance 2.0 fast', 'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast', 18, 240, 0.075, 4.2),
    ],
  });

  const item = items.find((candidate) => candidate.type === 'refresh_candidate');
  assert.ok(item);
  assert.equal(item.family, 'Seedance');
  assert.equal(item.clickDelta, -14);
  assert.equal(item.impressionDelta, -170);
  assert.match(item.recommendedAction, /refresh|comparison|current/i);
});

test('detects gaining and declining query clusters', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 12, 130, 0.092, 6.4),
      gscRow('veo lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 4, 60, 0.067, 7.2),
      gscRow('pika max length', 'https://maxvideoai.com/models/pika-text-to-video', 1, 35, 0.029, 18),
    ],
    previousRows: [
      gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 2, 45, 0.044, 10.1),
      gscRow('pika max length', 'https://maxvideoai.com/models/pika-text-to-video', 10, 160, 0.063, 7.4),
    ],
  });

  assert.ok(items.some((item) => item.queryCluster?.includes('veo') && (item.type === 'gaining_cluster' || item.type === 'gaining_page' || item.type === 'protect_winner')));
  assert.ok(items.some((item) => item.queryCluster?.includes('pika') && (item.type === 'declining_cluster' || item.type === 'declining_page' || item.type === 'refresh_candidate')));
});

test('detects family momentum without over-promoting Sora', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('kling ai video examples', 'https://maxvideoai.com/examples/kling', 30, 260, 0.115, 6.2),
      gscRow('sora ai video examples', 'https://maxvideoai.com/examples/sora', 10, 180, 0.056, 8.2),
    ],
    previousRows: [
      gscRow('kling ai video examples', 'https://maxvideoai.com/examples/kling', 8, 90, 0.089, 9.5),
      gscRow('sora ai video examples', 'https://maxvideoai.com/examples/sora', 2, 40, 0.05, 12),
    ],
  });

  const kling = items.find((item) => item.type === 'rising_family' && item.family === 'Kling');
  const sora = items.find((item) => item.family === 'Sora');
  assert.ok(kling);
  assert.ok(sora);
  assert.equal(sora.priority, 'low');
});

test('suppresses tiny volume changes', () => {
  const items = buildContentMomentumItems({
    currentRows: [gscRow('random model query', '/models/ltx-2-3-pro', 0, 2, 0, 40)],
    previousRows: [gscRow('random model query', '/models/ltx-2-3-pro', 0, 1, 0, 42)],
  });

  assert.equal(items.length, 0);
});

test('outdated or deprioritized model attention remains low priority for Sora', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('sora 2 prompts', 'https://maxvideoai.com/models/sora-2-pro', 6, 120, 0.05, 8),
    ],
    previousRows: [
      gscRow('sora 2 prompts', 'https://maxvideoai.com/models/sora-2-pro', 4, 100, 0.04, 9),
    ],
  });

  const item = items.find((candidate) => candidate.type === 'outdated_model_attention');
  assert.ok(item);
  assert.equal(item.family, 'Sora');
  assert.equal(item.priority, 'low');
  assert.match(item.recommendedAction, /older|de-prioritized|current/i);
});

test('emerging model momentum stays watchlist without stronger signal', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('happy horse 1.0 examples', 'https://maxvideoai.com/examples/happy-horse', 2, 42, 0.048, 14),
    ],
    previousRows: [
      gscRow('happy horse examples', 'https://maxvideoai.com/examples/happy-horse', 1, 18, 0.056, 18),
    ],
  });

  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.family === 'Happy Horse'));
  assert.ok(items.every((item) => item.priority === 'low' || item.type === 'watchlist'));
});

test('adult or junk momentum queries are suppressed', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('nsfw ai video generator', 'https://maxvideoai.com/examples/ltx', 12, 900, 0.013, 5),
    ],
    previousRows: [
      gscRow('nsfw ai video generator', 'https://maxvideoai.com/examples/ltx', 2, 80, 0.025, 12),
    ],
  });

  assert.equal(items.length, 0);
});

test('Content Momentum export shape is stable', () => {
  const items = buildContentMomentumItems({
    currentRows: [gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5)],
    previousRows: [gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 32, 170, 0.188, 7.2)],
  });
  const section = formatContentMomentumSectionMarkdown(items);
  const markdown = formatCodexActionQueueMarkdown([], [], [], [], items);
  const jsonPayload = { momentumItems: items };

  assert.match(section, /# Content Momentum/);
  assert.match(markdown, /# Content Momentum/);
  assert.equal(Array.isArray(jsonPayload.momentumItems), true);
  assert.ok(jsonPayload.momentumItems.length > 0);
});

test('brand homepage momentum is capped below critical', () => {
  const items = buildContentMomentumItems({
    currentRows: [gscRow('maxvideo', 'https://maxvideoai.com/', 260, 1364, 0.191, 5.6)],
    previousRows: [gscRow('maxvideo', 'https://maxvideoai.com/', 183, 1131, 0.162, 10.7)],
  });

  const brand = items.find((item) => item.family === 'Brand' && item.pageUrl === '/');
  assert.ok(brand);
  assert.notEqual(brand.priority, 'critical');
  assert.match(brand.recommendedAction, /protect|defend/i);
});

test('brand typo momentum is capped and does not become critical', () => {
  const items = buildContentMomentumItems({
    currentRows: [gscRow('maxvedio', 'https://maxvideoai.com/', 17, 83, 0.205, 4.2)],
    previousRows: [gscRow('maxvedio', 'https://maxvideoai.com/', 5, 16, 0.313, 2.8)],
  });

  const typo = items.find((item) => item.queryCluster?.includes('maxvedio') || item.family === 'Brand');
  assert.ok(typo);
  assert.notEqual(typo.priority, 'critical');
});

test('critical priority requires meaningful absolute volume', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('seedance 1.5 vs 2.0', 'https://maxvideoai.com/ai-video-engines/seedance-1-5-pro-vs-seedance-2-0', 7, 38, 0.184, 3.9),
    ],
    previousRows: [
      gscRow('seedance 1.5 vs 2.0', 'https://maxvideoai.com/ai-video-engines/seedance-1-5-pro-vs-seedance-2-0', 2, 4, 0.5, 7),
    ],
  });

  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.priority !== 'critical'));
});

test('mixed family signals become mixed or watchlist instead of clean rising family', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 17, 35, 0.486, 20.7),
    ],
    previousRows: [
      gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/veo-3-1-lite-vs-veo-3-1-fast', 2, 117, 0.017, 14.4),
    ],
  });

  const family = items.find((item) => item.family === 'Veo' && !item.pageUrl && !item.queryCluster);
  assert.ok(family);
  assert.equal(family.type, 'mixed_family_momentum');
  assert.notEqual(family.priority, 'high');
  assert.notEqual(family.priority, 'critical');
});

test('dedupes page and cluster momentum for the same target context', () => {
  const items = buildContentMomentumItems({
    currentRows: [gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5)],
    previousRows: [gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 31, 103, 0.301, 7.5)],
  });

  const ltxItems = items.filter((item) => item.family === 'LTX' && item.pageUrl?.includes('/examples/ltx'));
  assert.equal(ltxItems.length, 1);
  assert.equal(ltxItems[0]?.type, 'protect_winner');
  assert.match(ltxItems[0]?.queryCluster ?? '', /ltx 2.3 prompt examples/i);
});

test('tiny declining momentum is downgraded to low or watchlist', () => {
  const items = buildContentMomentumItems({
    currentRows: [
      gscRow('ltx 2.5', 'https://maxvideoai.com/ai-video-engines/ltx-2-fast-vs-wan-2-5', 5, 15, 0.333, 11.5),
    ],
    previousRows: [
      gscRow('ltx 2.5', 'https://maxvideoai.com/ai-video-engines/ltx-2-fast-vs-wan-2-5', 9, 57, 0.158, 29.4),
    ],
  });

  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.priority === 'low' || item.type === 'watchlist'));
});
