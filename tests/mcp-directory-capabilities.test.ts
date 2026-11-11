import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMcpRequestServerOptions } from '../frontend/src/server/mcp/directory-capabilities';

test('all nine dedicated capability switches remain independent and leave other resources intact', () => {
  const names = {
    paidGeneration: 'MCP_OPENAI_DIRECTORY_PAID_GENERATION_ENABLED',
    referenceUploads: 'MCP_OPENAI_DIRECTORY_REFERENCE_UPLOADS_ENABLED',
    montagePreparation: 'MCP_OPENAI_DIRECTORY_MONTAGE_PREPARATION_ENABLED',
    audioGeneration: 'MCP_OPENAI_DIRECTORY_AUDIO_GENERATION_ENABLED',
    studioMontageCreation: 'MCP_OPENAI_DIRECTORY_STUDIO_MONTAGE_CREATION_ENABLED',
    studioTimelineEditing: 'MCP_OPENAI_DIRECTORY_STUDIO_TIMELINE_EDITING_ENABLED',
    studioExports: 'MCP_OPENAI_DIRECTORY_STUDIO_EXPORTS_ENABLED',
    creatorTools: 'MCP_OPENAI_DIRECTORY_CREATOR_TOOLS_ENABLED',
    characterStudio: 'MCP_OPENAI_DIRECTORY_CHARACTER_STUDIO_ENABLED',
  } as const;
  const keys = Object.keys(names) as Array<keyof typeof names>;
  const base = { paidGeneration: true, referenceUploads: false, studioMontageCreation: false };
  for (let mask = 0; mask < 512; mask++) {
    const expected = Object.fromEntries(keys.map((key, index) => [key, Boolean(mask & (1 << index))]));
    const env = { MCP_OPENAI_DIRECTORY_ENABLED: 'true', ...Object.fromEntries(keys.map((key, index) => [names[key], String(Boolean(mask & (1 << index)))])) };
    assert.deepEqual(resolveMcpRequestServerOptions('openai-mcp.maxvideoai.com', 'openai-directory', env, base), { ...expected, distributionProfile: 'openai-directory' });
    for (const host of [null, 'api.maxvideoai.com', 'attacker.example', 'openai-mcp.maxvideoai.com:443']) {
      assert.deepEqual(resolveMcpRequestServerOptions(host, 'direct', env, base), { ...base, distributionProfile: 'direct' });
    }
    assert.deepEqual(base, { paidGeneration: true, referenceUploads: false, studioMontageCreation: false });
  }
  assert.deepEqual(resolveMcpRequestServerOptions('openai-mcp.maxvideoai.com', 'openai-directory', { MCP_OPENAI_DIRECTORY_ENABLED: 'true' }, base), { ...base, distributionProfile: 'openai-directory' });
  for (const key of keys) {
    assert.throws(() => resolveMcpRequestServerOptions('openai-mcp.maxvideoai.com', 'openai-directory', { MCP_OPENAI_DIRECTORY_ENABLED: 'true', [names[key]]: 'TRUE' }, base), /Invalid/);
  }
});
