import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/account/connections/page.tsx');
const clientPath = join(
  root,
  'frontend/app/(core)/account/connections/_components/McpConnectionsClient.tsx'
);

test('connections page is authenticated, flag-gated, private, and lists Supabase OAuth grants', () => {
  const source = readFileSync(pagePath, 'utf8');

  assert.match(source, /FEATURES\.mcp\.oauth/);
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /redirect\(/);
  assert.match(source, /supabase\.auth\.oauth\.listGrants\(\)/);
  assert.match(source, /robots:\s*\{\s*index:\s*false/);
  assert.doesNotMatch(source, /user\.email|email:/);
});

test('connections client revokes by OAuth client ID and never handles tokens', () => {
  const source = readFileSync(clientPath, 'utf8');

  assert.match(source, /supabase\.auth\.oauth\.revokeGrant\(\{\s*clientId/);
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /Disconnect/);
  assert.doesNotMatch(source, /access_token|refresh_token|client_secret/);
});

test('/account routes are protected and excluded from indexing', () => {
  const protectedSource = readFileSync(
    join(root, 'frontend/lib/middleware/routing-response.ts'),
    'utf8'
  );
  const noindexSource = readFileSync(
    join(root, 'frontend/lib/middleware/routing-query.ts'),
    'utf8'
  );

  assert.match(protectedSource, /PROTECTED_PREFIXES[^\n]+['"]\/account['"]/);
  assert.match(noindexSource, /APP_NOINDEX_PREFIXES[^\n]+['"]\/account['"]/);
});
