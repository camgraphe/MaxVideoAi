import assert from 'node:assert/strict';
import test from 'node:test';
import type { GscPerformanceRow } from '../frontend/lib/seo/gsc-analysis';
import {
  buildInternalLinkSuggestions,
  formatInternalLinkSectionMarkdown,
} from '../frontend/lib/seo/internal-link-builder';
import {
  buildCodexActionQueue,
  formatCodexActionQueueMarkdown,
} from '../frontend/lib/seo/codex-action-queue';
import { buildStrategicSeoOpportunities } from '../frontend/lib/seo/seo-opportunity-engine';

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

test('examples page recommends a current canonical model target instead of an alias-only target', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5),
      gscRow('how to prompt ltx 2.3', 'https://maxvideoai.com/examples/ltx', 8, 74, 0.108, 6.2),
    ],
  });
  const link = suggestions.find((item) => item.sourceUrl === '/examples/ltx' && item.targetUrl === '/models/ltx-2-3-pro');

  assert.ok(link);
  assert.equal(link.recommendationType, 'examples_to_model');
  assert.equal(link.family, 'LTX');
  assert.match(link.suggestedAnchor, /LTX 2\.3 prompt examples and specs/i);
  assert.equal(link.verifyExistingLinkFirst, true);
  assert.equal(suggestions.some((item) => item.targetUrl === '/models/ltx-2-3'), false);
});

test('model page to examples links are downgraded as expected-existing maintenance checks', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('kling ai video examples', 'https://maxvideoai.com/models/kling-3-pro', 12, 140, 0.086, 8.4),
      gscRow('kling ai image to video examples', 'https://maxvideoai.com/models/kling-3-pro', 5, 90, 0.056, 9.1),
    ],
  });
  const link = suggestions.find((item) => item.sourceUrl === '/models/kling-3-pro' && item.targetUrl === '/examples/kling');

  assert.ok(link);
  assert.equal(link.recommendationType, 'model_to_examples');
  assert.equal(link.family, 'Kling');
  assert.match(link.suggestedAnchor, /Kling/i);
  assert.equal(link.priority, 'low');
});

test('comparison page model links are downgraded when the route pattern already implies exact links', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow(
        'seedance 2.0 vs seedance 2.0 fast',
        'https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
        10,
        47,
        0.213,
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
    ],
  });

  const left = suggestions.find((item) => item.sourceUrl.includes('seedance-2-0-vs-seedance-2-0-fast') && item.targetUrl === '/models/seedance-2-0');
  const right = suggestions.find((item) => item.sourceUrl.includes('seedance-2-0-vs-seedance-2-0-fast') && item.targetUrl === '/models/seedance-2-0-fast');
  assert.ok(left);
  assert.ok(right);
  assert.equal(left.priority, 'low');
  assert.equal(right.priority, 'low');
  assert.ok(suggestions.every((item) => item.verifyExistingLinkFirst));
});

test('internal link builder avoids noisy all-to-all model linking', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 10, 120, 0.083, 7),
      gscRow('ltx video examples', 'https://maxvideoai.com/examples/ltx', 3, 45, 0.067, 8),
    ],
  });

  assert.ok(suggestions.length <= 4);
  assert.ok(suggestions.every((item) => !item.targetUrl.includes('/models/seedance') && !item.targetUrl.includes('/models/sora')));
});

test('Sora suggestions remain visible but de-prioritized', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('sora 2 prompt examples', 'https://maxvideoai.com/examples/sora', 8, 120, 0.067, 9),
      gscRow('sora examples', 'https://maxvideoai.com/examples/sora', 4, 80, 0.05, 11),
    ],
  });

  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((item) => item.family === 'Sora'));
  assert.ok(suggestions.every((item) => item.priority === 'low'));
});

test('emerging Happy Horse queries are detected but kept low priority without strong signal', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('happy horse 1.0 examples', 'https://maxvideoai.com/examples/happy-horse', 1, 34, 0.029, 12),
      gscRow('happy horse prompt examples', 'https://maxvideoai.com/examples/happy-horse', 0, 22, 0, 13),
    ],
  });

  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((item) => item.family === 'Happy Horse'));
  assert.ok(suggestions.every((item) => item.priority === 'low'));
});

test('adult or junk queries do not generate internal link recommendations', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('nsfw ai video generator examples', 'https://maxvideoai.com/examples/ltx', 0, 900, 0, 3),
      gscRow('ai video generator crack', 'https://maxvideoai.com/models/ltx-2-3-pro', 0, 200, 0, 2),
    ],
  });

  assert.equal(suggestions.length, 0);
});

test('tiny 4 to 5 impression suggestions stay low priority', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('veo 3.1 lite vs fast', 'https://maxvideoai.com/ai-video-engines/ltx-2-fast-vs-veo-3-1-lite', 3, 4, 0.75, 6.3),
      gscRow('kling ai video', 'https://maxvideoai.com/examples/kling', 5, 5, 1, 27.4),
    ],
  });

  assert.ok(suggestions.every((item) => item.priority === 'low'));
});

test('internal link suggestions do not add duplicate Codex action queue items', () => {
  const rows = [
    gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 79, 378, 0.209, 5.5),
    gscRow('how to prompt ltx 2.3', 'https://maxvideoai.com/examples/ltx', 8, 74, 0.108, 6.2),
  ];
  const opportunities = buildStrategicSeoOpportunities(rows);
  const actions = buildCodexActionQueue(opportunities);
  const suggestions = buildInternalLinkSuggestions({ rows, opportunities });
  const markdown = formatCodexActionQueueMarkdown(actions, [], [], suggestions);

  assert.match(markdown, new RegExp(`Generated actions: ${actions.length}`));
  assert.match(markdown, /# Internal Link Suggestions/);
  assert.equal(actions.length, buildCodexActionQueue(opportunities).length);
});

test('Internal Link Builder export shape is stable', () => {
  const suggestions = buildInternalLinkSuggestions({
    rows: [
      gscRow('ltx 2.3 prompt examples', 'https://maxvideoai.com/examples/ltx', 4, 120, 0.033, 8.1),
      gscRow('ltx 2.3 prompts', 'https://maxvideoai.com/examples/ltx', 2, 80, 0.025, 8.2),
    ],
  });
  const section = formatInternalLinkSectionMarkdown(suggestions);
  const markdown = formatCodexActionQueueMarkdown([], [], [], suggestions);
  const jsonPayload = { actions: [], opportunities: [], ctrDoctorItems: [], missingContentItems: [], internalLinkSuggestions: suggestions };

  assert.match(section, /# Internal Link Suggestions/);
  assert.match(markdown, /# Internal Link Suggestions/);
  assert.equal(Array.isArray(jsonPayload.internalLinkSuggestions), true);
  assert.ok(jsonPayload.internalLinkSuggestions.length > 0);
});
