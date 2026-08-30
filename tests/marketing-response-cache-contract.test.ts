import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js') as {
  headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
};

test('unconditional route headers stay limited to established locale-safe cache paths', async () => {
  const rules = await nextConfig.headers();
  const expectedHeaders = [
    { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
    { key: 'Vercel-CDN-Cache-Control', value: 'max-age=300, stale-while-revalidate=60' },
  ];

  for (const source of [
    '/',
    '/fr',
    '/es',
    '/fr/tarifs',
    '/es/precios',
    '/fr/modeles/:path*',
    '/es/modelos/:path*',
  ]) {
    const rule = rules.find((candidate) => candidate.source === source);
    assert.ok(rule, `missing cache rule for ${source}`);
    assert.deepEqual(
      rule.headers.filter((header) => expectedHeaders.some(({ key }) => key === header.key)),
      expectedHeaders
    );
  }

  for (const gatedSource of ['/pricing', '/models/:path*']) {
    assert.equal(
      rules.some((rule) => rule.source === gatedSource),
      false,
      `${gatedSource} must rely on request-aware middleware caching`
    );
  }
});
