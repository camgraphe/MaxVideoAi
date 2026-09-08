import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { TOOLBOX, TOOLBOX_CANDIDATES, toolsForMedia } from '../frontend/src/lib/toolbox/catalogue';
import { toolAssetRefSchema, validateToolBlock } from '../frontend/src/lib/toolbox/contract';
import { FINISHING_TOOL_IDS } from '../frontend/src/lib/toolbox/finishing';
import { getAppMenuItems, NAV_ITEMS } from '../frontend/components/app/app-navigation';

const block = { toolId: 'upscale', version: 1, inputs: [{ type: 'asset', assetId: 'actual-library-id', kind: 'image' }], settings: { mode: 'factor', factor: 2, targetResolution: '1080p', outputFormat: 'png' } };
test('toolbox exposes implemented capabilities and keeps later candidates closed', () => {
  assert.deepEqual(toolsForMedia('audio'), []);
  assert.deepEqual(toolsForMedia('video').map(tool => tool.id), ['upscale', 'background-removal', 'restore-video', 'denoise', 'fix-blur', 'smooth-motion']);
  assert.equal(new Set(TOOLBOX.map(tool => tool.id)).size, TOOLBOX.length);
  assert.ok(TOOLBOX.every(tool => !tool.mcpExecution));
  for (const candidate of TOOLBOX_CANDIDATES) assert.throws(() => validateToolBlock({ ...block, toolId: candidate.id }));
});

test('toolbox catalogue exposes every implemented tool', () => {
  const catalogueSource = readFileSync(
    join(process.cwd(), 'frontend/src/components/tools/ToolboxCatalogue.tsx'),
    'utf8'
  );
  const catalogueStyles = readFileSync(
    join(process.cwd(), 'frontend/src/components/tools/tools-catalogue.module.css'),
    'utf8'
  );
  const finishingCopySource = readFileSync(
    join(process.cwd(), 'frontend/src/components/tools/finishing-copy.ts'),
    'utf8'
  );
  assert.doesNotMatch(catalogueSource, /qualificationRequired/);
  assert.doesNotMatch(catalogueSource, /finishingCopy\(locale\)\.validation/);
  assert.doesNotMatch(finishingCopySource, /being tested|cours de test|probando|in validation|en validation|en validación/i);
  assert.match(catalogueSource, /text\.body/);
  assert.match(catalogueSource, /text\.tag/);
  assert.match(catalogueSource, /copy\.available/);
  assert.match(catalogueStyles, /@media\(max-width: 700px\)/);
  assert.match(catalogueStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('all released finishing tools are discoverable from Toolbox, the app menu, Media and Studio', () => {
  const finishingDefinitions = TOOLBOX.filter((tool) => FINISHING_TOOL_IDS.includes(tool.id as typeof FINISHING_TOOL_IDS[number]));
  assert.deepEqual(finishingDefinitions.map((tool) => tool.id), FINISHING_TOOL_IDS);
  assert.ok(finishingDefinitions.every((tool) => tool.group === 'quick' && tool.href === `/app/tools/${tool.id}`));

  const menuHrefs = new Set(getAppMenuItems(true, true).map((item) => item.href));
  for (const tool of finishingDefinitions) assert.ok(menuHrefs.has(tool.href), `${tool.id} should be in the app tool menu`);
  assert.ok(NAV_ITEMS.some((item) => item.id === 'tools' && item.href === '/app/tools'), 'Studio account navigation should expose Toolbox');

  const mediaSource = readFileSync(
    join(process.cwd(), 'frontend/app/(core)/(workspace)/app/library/_components/LibraryPageClient.tsx'),
    'utf8'
  );
  const browserSource = readFileSync(
    join(process.cwd(), 'frontend/components/library/AssetLibraryBrowser.tsx'),
    'utf8'
  );
  const studioNavigationSource = readFileSync(
    join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/StudioHeaderSession.tsx'),
    'utf8'
  );
  for (const tool of finishingDefinitions) assert.match(mediaSource, new RegExp(tool.href.replaceAll('/', '\\/')));
  assert.match(browserSource, /assetType !== 'audio'/);
  assert.doesNotMatch(browserSource, /hasToolLinks && !isPageLayout/);
  assert.match(studioNavigationSource, /NAV_ITEMS\.map/);
});
test('versioned blocks preserve exact typed IDs and reject ambiguous references and provider settings', () => {
  assert.deepEqual(validateToolBlock(block), block);
  assert.throws(() => validateToolBlock({ ...block, version: 2 }));
  assert.throws(() => validateToolBlock({ ...block, inputs: [{ type: 'asset', assetId: 'audio-id', kind: 'audio' }] }));
  assert.throws(() => validateToolBlock({ ...block, settings: { ...block.settings, provider: 'vendor' } }));
  assert.throws(() => validateToolBlock({ ...block, settings: { ...block.settings, outputFormat: 'mp4' } }));
  assert.throws(() => toolAssetRefSchema.parse({ type: 'job-output', jobId: 'job', kind: 'image' }));
  assert.throws(() => toolAssetRefSchema.parse({ type: 'asset', assetId: 'id', kind: 'image', url: 'https://untrusted.invalid' }));
  assert.deepEqual(toolAssetRefSchema.parse({ type: 'job-output', jobId: 'job', outputId: 'job:image:0', kind: 'image' }), { type: 'job-output', jobId: 'job', outputId: 'job:image:0', kind: 'image' });
});

test('result bridge preserves exact lineage and URLs and refuses to fabricate missing output IDs', async () => {
  const { normalizeQuickToolResult } = await import('../frontend/src/lib/toolbox/result');
  const response = { ok: true, jobId: 'job-1', mediaType: 'video', output: { assetId: 'output-exact', url: 'https://media.example/original.mp4?signature=exact', thumbUrl: 'https://media.example/thumb.webp' } } as import('../frontend/types/tools-upscale').UpscaleToolResponse;
  const source = { type: 'job-output', jobId: 'source-job', outputId: 'exact-output-17', kind: 'video' } as const;
  const result = normalizeQuickToolResult('upscale', [source], response);
  assert.equal(result?.outputs[0].originalUrl, response.output!.url);
  assert.deepEqual(result?.sourceAssets, [source]);
  assert.equal(normalizeQuickToolResult('upscale', [source], { ...response, output: { url: response.output!.url } }), null);
  assert.throws(() => normalizeQuickToolResult('upscale', [{ ...source, kind: 'image' }], response));
});
