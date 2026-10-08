import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const frontend = path.join(process.cwd(), 'frontend');

for (const entry of ['config/navigation.ts', 'config/model-families.ts']) {
  test(`${entry}: family menu projection does not initialize the engine resolver`, async (t) => {
    const bundle = await build({
      absWorkingDir: frontend,
      entryPoints: [entry],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      write: false,
      packages: 'external',
      metafile: true,
      tsconfig: path.join(frontend, 'tsconfig.json'),
    });
    const inputs = Object.keys(bundle.metafile!.inputs);
    assert.ok(inputs.includes(entry), 'the graph must include the real consuming entry');
    assert.ok(inputs.includes('config/model-families.ts'), 'family publication remains owned by the materialized configuration');
    t.diagnostic(`${entry}: ${inputs.length} local inputs; ${bundle.outputFiles[0].contents.byteLength} bundled bytes (unminified).`);
    assert.deepEqual(inputs.filter((file) =>
      file === 'lib/model-families.ts' ||
      file === 'lib/engine-alias.ts' ||
      file === 'src/lib/engine-alias.ts' ||
      file === 'src/config/falEngines.ts' ||
      file.startsWith('src/config/fal-engines/') ||
      file === 'src/config/fal-engine-materialization.ts'
    ), [], 'menu families must not load the complete resolver, engine aliases or Fal registry');
  });
}
