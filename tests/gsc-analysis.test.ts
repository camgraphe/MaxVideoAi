import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGscDateWindows,
  classifyGscIntent,
  classifyGscModelFamily,
  findGscOpportunities,
  parseGscRows,
  summarizeGscPerformance,
} from '../frontend/lib/seo/gsc-analysis.ts';

test('buildGscDateWindows creates comparable finalized date windows', () => {
  const windows = buildGscDateWindows(new Date('2026-04-30T12:00:00Z'), '7d');

  assert.equal(windows.current.startDate, '2026-04-23');
  assert.equal(windows.current.endDate, '2026-04-29');
  assert.equal(windows.previous.startDate, '2026-04-16');
  assert.equal(windows.previous.endDate, '2026-04-22');
});

test('parseGscRows maps row keys into named dimensions', () => {
  const rows = parseGscRows(
    [
      {
        keys: ['seedance 2.0 fast', 'https://maxvideoai.com/models/seedance-2-0-fast', 'usa', 'DESKTOP'],
        clicks: 2,
        impressions: 500,
        ctr: 0.004,
        position: 7.4,
      },
    ],
    ['query', 'page', 'country', 'device'],
    'web'
  );

  assert.deepEqual(rows[0], {
    query: 'seedance 2.0 fast',
    page: 'https://maxvideoai.com/models/seedance-2-0-fast',
    country: 'usa',
    device: 'DESKTOP',
    searchAppearance: null,
    date: null,
    searchType: 'web',
    clicks: 2,
    impressions: 500,
    ctr: 0.004,
    position: 7.4,
  });
});

test('classifiers identify MaxVideoAI model-family and intent clusters', () => {
  assert.equal(classifyGscModelFamily('maxvedio seedance vs kling pricing', '/models/seedance-2-0'), 'Seedance');
  assert.equal(classifyGscModelFamily('hailuo minimax examples', '/examples/minimax-hailuo-02-text'), 'Hailuo / Minimax');
  assert.equal(classifyGscIntent('kling vs veo video generator'), 'compare');
  assert.equal(classifyGscIntent('ai video pay as you go no subscription'), 'pay-as-you-go');
  assert.equal(classifyGscIntent('sora prompt examples'), 'prompt examples');
});

test('summarizeGscPerformance aggregates weighted CTR and position', () => {
  const summary = summarizeGscPerformance([
    {
      query: 'seedance',
      page: '/models/seedance-2-0',
      country: 'usa',
      device: 'DESKTOP',
      searchAppearance: null,
      date: null,
      searchType: 'web',
      clicks: 4,
      impressions: 100,
      ctr: 0.04,
      position: 3,
    },
    {
      query: 'kling',
      page: '/models/kling-3-pro',
      country: 'usa',
      device: 'MOBILE',
      searchAppearance: null,
      date: null,
      searchType: 'web',
      clicks: 1,
      impressions: 300,
      ctr: 0.0033333333,
      position: 9,
    },
  ]);

  assert.equal(summary.clicks, 5);
  assert.equal(summary.impressions, 400);
  assert.equal(Number(summary.ctr.toFixed(4)), 0.0125);
  assert.equal(Number(summary.position.toFixed(2)), 7.5);
});

test('findGscOpportunities prioritizes CTR, push-distance, and zero-click issues', () => {
  const opportunities = findGscOpportunities([
    {
      query: 'seedance 2.0 fast vs normal',
      page: 'https://maxvideoai.com/models/seedance-2-0-fast',
      country: 'usa',
      device: 'DESKTOP',
      searchAppearance: null,
      date: null,
      searchType: 'web',
      clicks: 1,
      impressions: 1000,
      ctr: 0.001,
      position: 4.8,
    },
    {
      query: 'ai video no subscription',
      page: 'https://maxvideoai.com/pricing',
      country: 'usa',
      device: 'MOBILE',
      searchAppearance: null,
      date: null,
      searchType: 'web',
      clicks: 0,
      impressions: 240,
      ctr: 0,
      position: 2.6,
    },
  ]);

  assert.equal(opportunities[0]?.priority, 'P1');
  assert.equal(opportunities[0]?.issueType, 'high_impressions_low_ctr');
  assert.equal(opportunities[0]?.family, 'Seedance');
  assert.equal(opportunities[0]?.intent, 'compare');
  assert.match(opportunities[0]?.suggestedAction ?? '', /title\/meta/i);

  assert.ok(opportunities.some((item) => item.issueType === 'top_position_zero_clicks'));
  assert.ok(opportunities.some((item) => item.intent === 'pay-as-you-go'));
});
