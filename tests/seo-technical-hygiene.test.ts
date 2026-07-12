import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { shouldMarkTrackingNoindex } from '../frontend/lib/middleware/routing-query.ts';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js');
const nextConfigSource = readFileSync('frontend/next.config.js', 'utf8');

test('all marketing tracking sources receive noindex treatment', () => {
  const request = new NextRequest('https://maxvideoai.com/?utm_source=startupfa.me');

  assert.equal(shouldMarkTrackingNoindex(request, '/', false), true);
});

test('legacy Google Veo URL redirects directly to the current canonical model', async () => {
  const redirects = await nextConfig.redirects();
  const redirect = redirects.find((rule: { source: string }) => rule.source === '/models/google-veo-3');

  assert.deepEqual(redirect, {
    source: '/models/google-veo-3',
    destination: '/models/veo-3-1',
    statusCode: 301,
  });
  assert.equal(
    redirects.some((rule: { source: string }) => rule.source === redirect.destination),
    false,
    'legacy Google Veo redirect should reach its canonical model in one hop'
  );
});

test('Next image optimization uses a conservative seven-day floor until mutable assets are versioned', () => {
  const ttlMatch = nextConfigSource.match(/minimumCacheTTL:\s*(\d+)/);

  assert.ok(ttlMatch, 'images.minimumCacheTTL should be configured');
  assert.equal(Number(ttlMatch[1]), 60 * 60 * 24 * 7);
});
