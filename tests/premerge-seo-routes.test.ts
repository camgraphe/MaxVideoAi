import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js');

test('removed vertical-shorts best-for URLs redirect to active UGC guide', async () => {
  const redirects = await nextConfig.redirects();

  const expectedRedirects = [
    ['/ai-video-engines/best-for/vertical-shorts', '/ai-video-engines/best-for/ugc-ads'],
    ['/fr/comparatif/best-for/vertical-shorts', '/fr/comparatif/best-for/ugc-ads'],
    ['/es/comparativa/best-for/vertical-shorts', '/es/comparativa/best-for/ugc-ads'],
  ];

  for (const [source, destination] of expectedRedirects) {
    assert.ok(
      redirects.some((redirect: { source: string; destination: string; permanent?: boolean }) => {
        return redirect.source === source && redirect.destination === destination && redirect.permanent === true;
      }),
      `${source} should permanently redirect to ${destination}`,
    );
  }
});
