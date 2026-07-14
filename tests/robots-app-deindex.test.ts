import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { shouldMarkAppNoindex } from '../frontend/lib/middleware/routing-query.ts';
import { buildRobotsText } from '../frontend/lib/seo/robots-text.ts';

const robotsSource = buildRobotsText('public');
const workspaceLayoutSource = readFileSync('frontend/app/(core)/(workspace)/app/layout.tsx', 'utf8');
const routingResponseSource = readFileSync('frontend/lib/middleware/routing-response.ts', 'utf8');

test('robots blocks private app URLs for both named and general crawlers', () => {
  assert.match(robotsSource, /^Disallow:\s*\/app\s*$/m);
  assert.match(robotsSource, /^Disallow:\s*\/fr\/app\s*$/m);
  assert.match(robotsSource, /^Disallow:\s*\/es\/app\s*$/m);
  assert.match(robotsSource, /^Disallow:\s*\/admin\s*$/m);
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
