import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  pickRelatedWatchPages,
  toWatchPageRelatedCandidate,
} from '../frontend/server/watch-page-signals/related.ts';

test('approved related watch pages link directly to their canonical slug', () => {
  const candidate = toWatchPageRelatedCandidate({
    entry: { id: 'job_related' } as any,
    video: { id: 'job_related', thumbUrl: '/thumb.jpg' } as any,
    signals: {
      canonicalSlug: 'veo-product-ad-example-related',
      title: 'Related Veo product ad',
      intro: 'A related approved example.',
      engineLabel: 'Veo 3.1',
      engineSlug: 'veo-3-1',
      exampleFamily: 'veo',
      mode: 't2v',
      primaryIntent: 'product-ad',
      capabilityTags: ['text-to-video'],
      styleTags: ['cinematic'],
    } as any,
  });

  const related = pickRelatedWatchPages({
    currentId: 'job_current',
    currentSignals: {
      exampleFamily: 'veo',
      primaryIntent: 'product-ad',
      capabilityTags: ['text-to-video'],
      engineSlug: 'veo-3-1',
      mode: 't2v',
      styleTags: ['cinematic'],
    } as any,
    candidates: [candidate],
  });

  assert.equal(related.length, 1);
  assert.equal(related[0]?.href, '/video/veo-product-ad-example-related');
  assert.doesNotMatch(related[0]?.href ?? '', /job_related/);
});

test('canonical watch-page requests exclude the current video by its resolved job id', () => {
  const videoSeoSource = readFileSync('frontend/server/video-seo.ts', 'utf8');

  assert.match(videoSeoSource, /pickRelatedWatchPages\(\{[\s\S]*currentId:\s*resolvedId/);
  assert.doesNotMatch(videoSeoSource, /pickRelatedWatchPages\(\{[\s\S]*currentId:\s*id,/);
});
