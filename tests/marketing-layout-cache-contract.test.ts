import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../frontend/middleware.ts';

const root = process.cwd();
const marketingLayoutPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/layout.tsx');

test('marketing layout keeps account lookup out of the cacheable public shell', () => {
  const source = readFileSync(marketingLayoutPath, 'utf8');

  assert.doesNotMatch(source, /getMarketingAuthSnapshot/);
  assert.doesNotMatch(source, /@\/server\/marketing-auth/);
  assert.match(source, /<MarketingNav\s*\/>/);
});

test('canonical localized marketing pages do not set locale cookies in middleware', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/fr'));

  assert.equal(response.headers.get('set-cookie'), null);
});
