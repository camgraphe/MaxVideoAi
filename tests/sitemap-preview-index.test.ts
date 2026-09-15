import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test, { mock } from 'node:test';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));

test('development discovers all routes despite a nonempty incremental manifest; production retains manifest ownership', async () => {
  const react = frontendRequire('react') as { cache?: (fn: unknown) => unknown };
  react.cache ??= (fn) => fn;
  const previousEnvironment = process.env.NODE_ENV;
  const exists = fs.existsSync;
  const read = fs.readFileSync;
  const partialManifest = JSON.stringify({
    '/(localized)/[locale]/(marketing)/(home)/page': 'app/(localized)/[locale]/(marketing)/(home)/page.js',
  });
  const manifestExists = mock.method(fs, 'existsSync', (file) =>
    String(file).endsWith('app-paths-manifest.json') || exists(file));
  const manifestRead = mock.method(fs, 'readFileSync', (...args: Parameters<typeof fs.readFileSync>) =>
    String(args[0]).endsWith('app-paths-manifest.json') ? partialManifest : read(...args));
  const warnings = mock.method(console, 'warn', () => {});
  try {
    process.env.NODE_ENV = 'development';
    const { getCanonicalPathEntries } = await import('../frontend/lib/sitemap/route-discovery.ts');
    const development = (await getCanonicalPathEntries()).map((entry) => entry.englishPath);
    for (const route of ['/integrations/claude', '/integrations/chatgpt', '/integrations/codex', '/integrations/openclaw', '/integrations/n8n', '/tools', '/tools/background-removal', '/examples', '/blog']) {
      assert.ok(development.includes(route), route);
    }
    assert.ok(development.length > 100, 'a development sitemap cannot collapse to the visited home route');
    process.env.NODE_ENV = 'production';
    const production = (await getCanonicalPathEntries()).map((entry) => entry.englishPath);
    assert.ok(production.includes('/'));
    assert.equal(production.includes('/tools'), false, 'production uses the supplied build manifest');
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    manifestRead.mock.restore();
    manifestExists.mock.restore();
    warnings.mock.restore();
  }
});

