import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('shared authentication hook keeps login copy and complete locale dictionaries out of its runtime dependency graph', async (t) => {
  const frontend = path.join(process.cwd(), 'frontend');
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, platform: 'browser', format: 'esm', write: false,
    packages: 'external', metafile: true, tsconfig: path.join(frontend, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: frontend, loader: 'ts', contents: `export { useRequireAuth } from './src/hooks/useRequireAuth';` },
  });
  const inputs = Object.keys(bundle.metafile!.inputs);
  assert.deepEqual(inputs.filter((file) => /messages\/(?:en|fr|es)\.json$/.test(file)), []);
  assert.equal(inputs.some((file) => file.endsWith('/login-copy.ts')), false);
  assert.ok(inputs.some((file) => file.endsWith('i18n/locales.ts')), 'auth helpers use the shared bounded locale list');
  t.diagnostic(`Shared auth graph: ${inputs.length} local inputs; zero complete message dictionaries.`);
});
