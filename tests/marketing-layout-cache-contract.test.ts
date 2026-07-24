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

test('canonical localized marketing pages receive cache headers on the middleware response', async () => {
  for (const url of [
    'https://maxvideoai.com/fr',
    'https://maxvideoai.com/fr/tarifs',
    'https://maxvideoai.com/fr/modeles/veo-3-1',
  ]) {
    const response = await middleware(new NextRequest(url));

    assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
    assert.equal(
      response.headers.get('vercel-cdn-cache-control'),
      'max-age=300, stale-while-revalidate=60'
    );
  }
});

test('default homepage receives cache headers on the middleware response', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/'));

  assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(
    response.headers.get('vercel-cdn-cache-control'),
    'max-age=300, stale-while-revalidate=60'
  );
});

test('unprefixed marketing routes stay outside the middleware CDN cache policy', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/pricing'));

  assert.equal(response.headers.get('vercel-cdn-cache-control'), null);
});
