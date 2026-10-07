import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js') as {
  headers: () => Promise<Array<{ source: string; missing?: Array<{ type: string; key: string; value?: string }>; headers: Array<{ key: string; value: string }> }>>;
};
const { matchHas } = require('../frontend/node_modules/next/dist/shared/lib/router/utils/prepare-destination.js');

test('public marketing CDN rules include English routes and exclude logout and authorization requests', async () => {
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
    '/pricing',
    '/models/:path*',
  ]) {
    const rule = rules.find((candidate) => candidate.source === source);
    assert.ok(rule, `missing cache rule for ${source}`);
    assert.deepEqual(
      rule.headers.filter((header) => expectedHeaders.some(({ key }) => key === header.key)),
      expectedHeaders
    );
    assert.ok(rule.missing, `${source} must use request-aware configuration`);
    for (const [headers, cookies, expected] of [
      [{}, {}, true],
      [{ cookie: 'consent=accepted' }, { consent: 'accepted' }, true],
      [{ cookie: 'mv_logout_intent=1' }, { mv_logout_intent: '1' }, false],
      [{ authorization: 'Bearer test-only' }, {}, false],
    ] as const) {
      assert.equal(Boolean(matchHas({ headers, cookies }, {}, [], rule.missing)), expected, source);
    }
  }
});
