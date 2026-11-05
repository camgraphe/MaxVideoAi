import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('marketing header and footer browser bundles do not initialize model publication to render links', async () => {
  const bundle = await build({
    entryPoints: ['frontend/components/marketing/MarketingNav.tsx', 'frontend/components/marketing/MarketingFooter.tsx'],
    bundle: true, platform: 'browser', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    outdir: 'out', write: false, metafile: true, logLevel: 'silent',
  });
  const publication = Object.keys(bundle.metafile.inputs)
    .filter(input => /frontend\/config\/(navigation\.ts|model-runtime\.json|marketing-footer\.ts)$/.test(input));
  assert.deepEqual(publication, [], 'the browser should receive the resolved links instead of executing the catalog and menu builders');
});
