import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { shouldMarkAppNoindex } from '../frontend/lib/middleware/routing-query.ts';

const robotsSource = readFileSync('frontend/public/robots.txt', 'utf8');
const [namedAiCrawlerRules, generalCrawlerRules = ''] = robotsSource.split('User-agent: *');
const workspaceLayoutSource = readFileSync('frontend/app/(core)/(workspace)/app/layout.tsx', 'utf8');
const routingResponseSource = readFileSync('frontend/lib/middleware/routing-response.ts', 'utf8');

test('robots allows crawlers to read the noindex directive on app URLs', () => {
  assert.doesNotMatch(generalCrawlerRules, /^Disallow:\s*\/app\s*$/m);
  assert.doesNotMatch(generalCrawlerRules, /^Disallow:\s*\/fr\/app\s*$/m);
  assert.doesNotMatch(generalCrawlerRules, /^Disallow:\s*\/es\/app\s*$/m);

  assert.match(namedAiCrawlerRules, /^Disallow:\s*\/app\s*$/m);
  assert.match(namedAiCrawlerRules, /^Disallow:\s*\/fr\/app\s*$/m);
  assert.match(namedAiCrawlerRules, /^Disallow:\s*\/es\/app\s*$/m);

  assert.match(namedAiCrawlerRules, /^Disallow:\s*\/admin\s*$/m);
  assert.match(generalCrawlerRules, /^Disallow:\s*\/admin\s*$/m);
  assert.match(robotsSource, /^Disallow:\s*\/api\/\s*$/m);
  assert.match(robotsSource, /^Disallow:\s*\/private\/\s*$/m);
});

test('app routes remain noindex in metadata and middleware for every query variant', () => {
  assert.equal(shouldMarkAppNoindex('/app'), true);
  assert.equal(shouldMarkAppNoindex('/app/studio/projects'), true);
  assert.equal(shouldMarkAppNoindex('/models/veo-3-1'), false);

  assert.match(workspaceLayoutSource, /robots:\s*\{[\s\S]*index:\s*false/);
  assert.match(routingResponseSource, /X-Robots-Tag/);
  assert.match(routingResponseSource, /noindex, follow/);
});
