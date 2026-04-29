import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { isCrawlerUserAgent } from '../frontend/lib/crawler-user-agent.ts';

test('examples hero video detects Googlebot-style crawlers', () => {
  assert.equal(
    isCrawlerUserAgent(
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    ),
    true
  );
  assert.equal(isCrawlerUserAgent('Mozilla/5.0 AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'), false);
});

test('examples hero video disables autoplay loading for crawlers', () => {
  const source = readFileSync('frontend/components/examples/ExamplesHeroVideo.client.tsx', 'utf8');

  assert.match(source, /isCrawlerUserAgent/);
  assert.match(source, /navigator\.userAgent/);
  assert.match(source, /shouldDisableHeroAutoplay/);
});
