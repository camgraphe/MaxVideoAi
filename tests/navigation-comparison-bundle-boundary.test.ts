import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const frontend = path.join(process.cwd(), 'frontend');
const catalogueData = ['config/engine-catalog.json', 'lib/compare-hub/data.ts'];
const entries = [
  {
    surface: 'shared navigation',
    entry: 'config/navigation.ts',
    forbidden: catalogueData,
  },
  {
    surface: 'client comparison picker',
    entry: 'app/(localized)/[locale]/(marketing)/ai-video-engines/CompareNowWidget.client.tsx',
    // Its family selector consumes catalogue metadata independently of pair links.
    forbidden: ['lib/compare-hub/data.ts'],
  },
  {
    surface: 'pure comparison helpers',
    entry: 'lib/compare-hub/pairs.ts',
    forbidden: catalogueData,
  },
] as const;

for (const { surface, entry, forbidden } of entries) {
  test(`${surface}: comparison links do not initialize hub data`, async (t) => {
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
    assert.ok(inputs.includes('lib/compare-hub/pairs.ts'), 'comparison links use the pure shared helpers');
    t.diagnostic(`${surface}: ${inputs.length} local inputs; ${bundle.outputFiles[0].contents.byteLength} bundled bytes (unminified).`);
    assert.deepEqual(
      inputs.filter((file) => forbidden.some((blocked) => file === blocked)),
      [],
      'comparison links must use the pure owner without catalogue-backed hub data',
    );
  });
}
