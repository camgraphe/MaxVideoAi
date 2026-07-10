import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { shouldMarkTrackingNoindex } from '../frontend/lib/middleware/routing-query.ts';

const nextConfigSource = readFileSync('frontend/next.config.js', 'utf8');

test('all marketing tracking sources receive noindex treatment', () => {
  const request = new NextRequest('https://maxvideoai.com/?utm_source=startupfa.me');

  assert.equal(shouldMarkTrackingNoindex(request, '/', false), true);
});

test('legacy Google Veo URL redirects directly to the current canonical model', () => {
  const redirectBlock = nextConfigSource.match(
    /\{\s*source:\s*'\/models\/google-veo-3',[\s\S]*?permanent:\s*true,\s*\}/,
  )?.[0];

  assert.ok(redirectBlock, 'legacy Google Veo redirect should exist');
  assert.match(redirectBlock, /destination:\s*'\/models\/veo-3-1'/);
  assert.doesNotMatch(redirectBlock, /destination:\s*'\/models\/veo-3'/);
});

test('Next image optimization uses a conservative seven-day floor until mutable assets are versioned', () => {
  const ttlMatch = nextConfigSource.match(/minimumCacheTTL:\s*(\d+)/);

  assert.ok(ttlMatch, 'images.minimumCacheTTL should be configured');
  assert.equal(Number(ttlMatch[1]), 60 * 60 * 24 * 7);
});
