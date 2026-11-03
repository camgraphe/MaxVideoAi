import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('library routes authenticate before database access, fail closed and keep GET read-only', async () => {
  const fixture = { userId: null as string | null, configured: true, queries: [] as string[], fail: false };
  const globals = globalThis as typeof globalThis & { __studioRoutes?: typeof fixture };
  globals.__studioRoutes = fixture;
  const mocks: Record<string, string> = {
    '@/lib/supabase-ssr':
      'export const getRouteAuthContext=async()=>({userId:globalThis.__studioRoutes.userId});',
    '@/content/feature-flags': 'export const FEATURES={workflows:{toolsSection:true}};',
    '@/lib/db': `export const isDatabaseConfigured=()=>globalThis.__studioRoutes.configured;
      export const query=async sql=>{const f=globalThis.__studioRoutes;f.queries.push(sql);if(f.fail) throw new Error('private database internals');return []};
      export const withDbTransaction=async fn=>fn({query});`,
  };
  try {
    const bundle = await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: 'ts',
        contents: `
      export { GET as list, POST as save } from './frontend/app/api/character-studio/characters/route';
      export { GET as detail, PATCH as rename } from './frontend/app/api/character-studio/characters/[characterId]/route';`,
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      write: false,
      tsconfig: 'frontend/tsconfig.json',
      plugins: [
        {
          name: 'auth-and-db',
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) =>
              a.path in mocks ? { path: a.path, namespace: 'fixture' } : undefined,
            );
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({
              contents: mocks[a.path],
              loader: 'ts',
            }));
          },
        },
      ],
    });
    const requireFrontend = createRequire(resolve('frontend/package.json'));
    const { NextRequest } = requireFrontend('next/server');
    const module = { exports: {} as any };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
      requireFrontend,
      module,
      module.exports,
    );
    const route = module.exports;
    const req = (method = 'GET', body?: string, search = '') =>
      new NextRequest(`http://localhost/api/character-studio/characters${search}`, {
        method,
        ...(body === undefined ? {} : { body }),
      });
    const context = { params: Promise.resolve({ characterId: '1' }) };
    for (const [call, request] of [
      [route.list, req()],
      [route.detail, req()],
      [route.save, req('POST', '{}')],
      [route.rename, req('PATCH', '{}')],
    ]) {
      const response = await call(request, context);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
    assert.deepEqual(fixture.queries, []);
    fixture.userId = 'owned';
    assert.deepEqual(await (await route.list(req())).json(), { ok: true, characters: [], nextCursor: null });
    assert.equal((await route.detail(req(), context)).status, 404);
    assert.ok(fixture.queries.every((sql) => /^SELECT/.test(sql.trim())));
    assert.equal((await route.list(req('GET', undefined, '?before=invalid'))).status, 400);
    for (const payload of ['{', '[]', 'null'])
      assert.equal((await route.save(req('POST', payload))).status, 400);
    assert.equal((await route.save(req('POST', 'x'.repeat(12_001)))).status, 413);
    assert.equal((await route.rename(req('PATCH', '{"name":" "}'), context)).status, 400);
    fixture.fail = true;
    const failed = await route.list(req());
    assert.equal(failed.status, 503);
    assert.doesNotMatch(JSON.stringify(await failed.json()), /private database internals/);
    fixture.configured = false;
    const before = fixture.queries.length;
    assert.equal((await route.list(req())).status, 503);
    assert.equal(fixture.queries.length, before);
  } finally {
    delete globals.__studioRoutes;
  }
});
