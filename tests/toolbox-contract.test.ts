import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOLBOX, TOOLBOX_CANDIDATES, toolsForMedia } from '../frontend/src/lib/toolbox/catalogue';
import { toolAssetRefSchema, validateToolBlock } from '../frontend/src/lib/toolbox/contract';

const block = { toolId: 'upscale', version: 1, inputs: [{ type: 'asset', assetId: 'actual-library-id', kind: 'image' }], settings: { mode: 'factor', factor: 2, targetResolution: '1080p', outputFormat: 'png' } };
test('toolbox exposes only existing media capabilities and keeps candidates closed', () => {
  assert.deepEqual(toolsForMedia('audio'), []);
  assert.deepEqual(toolsForMedia('video').map(tool => tool.id), ['upscale', 'background-removal']);
  assert.equal(new Set(TOOLBOX.map(tool => tool.id)).size, TOOLBOX.length);
  assert.ok(TOOLBOX.every(tool => !tool.mcpExecution));
  for (const candidate of TOOLBOX_CANDIDATES) assert.throws(() => validateToolBlock({ ...block, toolId: candidate.id }));
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
