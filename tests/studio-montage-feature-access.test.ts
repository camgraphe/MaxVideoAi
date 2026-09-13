import assert from 'node:assert/strict';
import test from 'node:test';

import { isStudioMontageCreationEnabled } from '../frontend/src/server/studio/feature-access';

const local = {
  NODE_ENV: 'development',
  STUDIO_MONTAGE_LOCAL_ENABLED: 'true',
  MCP_API_HOST: 'localhost:4711',
  MCP_RESOURCE_URL: 'http://localhost:4711/mcp',
};

test('the Studio montage gate stays closed by default and production ignores local overrides', () => {
  assert.equal(isStudioMontageCreationEnabled({}, 'localhost:4711', false), false);
  assert.equal(isStudioMontageCreationEnabled({ ...local, NODE_ENV: 'production' }, 'localhost:4711', false), false);
  assert.equal(isStudioMontageCreationEnabled({ ...local, STUDIO_MONTAGE_LOCAL_ENABLED: 'false' }, 'localhost:4711', false), false);
});

test('the explicit local override requires a coherent loopback request host and MCP config', () => {
  assert.equal(isStudioMontageCreationEnabled(local, 'localhost:4711', false), true);
  assert.equal(isStudioMontageCreationEnabled(local, '127.0.0.1:4711', false), false);
  assert.equal(isStudioMontageCreationEnabled(local, 'localhost:4712', false), false);
  assert.equal(isStudioMontageCreationEnabled({ ...local, MCP_API_HOST: 'example.com' }, 'example.com', false), false);
});

test('publication enables the command without a local override', () => {
  assert.equal(isStudioMontageCreationEnabled({ NODE_ENV: 'production' }, 'api.maxvideoai.com', true), true);
});
