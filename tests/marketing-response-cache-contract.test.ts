import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const nextConfigPath = join(root, 'frontend/next.config.js');

test('critical marketing pages use CDN caching without browser staleness', () => {
  const source = readFileSync(nextConfigPath, 'utf8');

  assert.match(source, /const MARKETING_CDN_CACHE_HEADERS = \[/);
  assert.match(source, /key: 'Cache-Control',\s*value: 'public, max-age=0, must-revalidate'/s);
  assert.match(source, /key: 'Vercel-CDN-Cache-Control',\s*value: 'max-age=300, stale-while-revalidate=60'/s);

  for (const path of [
    '/',
    '/fr',
    '/es',
    '/pricing',
    '/fr/tarifs',
    '/es/precios',
    '/models/:path*',
    '/fr/modeles/:path*',
    '/es/modelos/:path*',
  ]) {
    assert.match(source, new RegExp(`'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
});
