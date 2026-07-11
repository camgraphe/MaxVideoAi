import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getMcpApiRewritePath, isMcpApiHost } from '../frontend/src/lib/mcp-host-routing';

test('only the configured API host is recognized, with optional port normalization', () => {
  assert.equal(isMcpApiHost('api.maxvideoai.com', 'api.maxvideoai.com'), true);
  assert.equal(isMcpApiHost('API.MAXVIDEOAI.COM:443', 'api.maxvideoai.com'), true);
  assert.equal(isMcpApiHost('localhost:4000', 'localhost:3000'), false);
  assert.equal(isMcpApiHost('maxvideoai.com', 'api.maxvideoai.com'), false);
  assert.equal(isMcpApiHost('api.maxvideoai.com.attacker.test', 'api.maxvideoai.com'), false);
});

test('API subdomain /mcp rewrites internally while main-domain /mcp remains marketing-owned', () => {
  assert.equal(getMcpApiRewritePath('api.maxvideoai.com', '/mcp', 'api.maxvideoai.com'), '/api/mcp');
  assert.equal(getMcpApiRewritePath('api.maxvideoai.com', '/mcp/', 'api.maxvideoai.com'), null);
  assert.equal(getMcpApiRewritePath('maxvideoai.com', '/mcp', 'api.maxvideoai.com'), null);
  assert.equal(getMcpApiRewritePath('api.maxvideoai.com', '/fr/mcp', 'api.maxvideoai.com'), null);
});

test('middleware applies MCP host routing before locale and auth-code handling', () => {
  const source = readFileSync(join(process.cwd(), 'frontend/middleware.ts'), 'utf8');
  const mcpRouting = source.indexOf('getMcpApiRewritePath(');
  const authCode = source.indexOf("searchParams.get('code')");
  const localeHandling = source.indexOf('containsLocalePlaceholder(');

  assert.ok(mcpRouting >= 0);
  assert.ok(mcpRouting < authCode);
  assert.ok(mcpRouting < localeHandling);
  assert.match(source, /target\.pathname\s*=\s*mcpRewritePath/);
});
