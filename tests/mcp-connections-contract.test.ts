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
const controlsPath = join(
  root,
  'frontend/app/(core)/account/connections/_components/McpSpendingControls.tsx'
);

test('connections page is authenticated, flag-gated, private, and lists Supabase OAuth grants', () => {
  const source = readFileSync(pagePath, 'utf8');

  assert.match(source, /isMcpFoundationFeatureEnabled\('oauth'/);
  assert.match(source, /getMcpRequestHost\(requestHeaders\)/);
  assert.match(source, /isMcpFoundationFeatureEnabled\('oauth', process\.env, requestHost\)/);
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

test('connections page remains a server orchestrator and loads controls/activity independently of grants', () => {
  const source = readFileSync(pagePath, 'utf8');
  assert.doesNotMatch(source, /['"]use client['"]/);
  assert.match(source, /getMcpSpendingSettings/);
  assert.match(source, /listMcpActivityHistory/);
  assert.match(source, /McpSpendingControls/);
  assert.match(source, /clientLabels/);
  assert.match(source, /McpConnectionsClient/);
  assert.match(source, /settingsUnavailable|activityUnavailable/);
});

test('MCP spending controls expose accessible exact-money controls, safe activity, and server-confirmed saves', () => {
  const source = readFileSync(controlsPath, 'utf8');
  assert.match(source, /['"]use client['"]/);
  assert.match(source, /Paid generations/);
  assert.match(source, /Maximum per generation/);
  assert.match(source, /Daily maximum/);
  assert.match(source, /Require a MaxVideoAI web review above/);
  assert.match(source, /No limit/);
  assert.match(source, /Codex/);
  assert.match(source, /Claude/);
  assert.match(source, /automatic tool approval/i);
  assert.match(source, /always enforced by MaxVideoAI/i);
  assert.match(source, /\/api\/account\/mcp-settings/);
  assert.match(source, /method:\s*['"]PATCH['"]/);
  assert.match(source, /paidGenerationEnabled/);
  assert.match(source, /perGenerationCents/);
  assert.match(source, /dailyCents/);
  assert.match(source, /webApprovalAboveCents/);
  assert.match(source, /response\.json/);
  assert.match(source, /aria-live/);
  assert.match(source, /disabled=\{saving/);
  assert.match(source, /prepare_generation|Prepare generation/);
  assert.match(source, /confirm_generation|Confirm generation/);
  assert.doesNotMatch(source, /prompt|videoUrl|imageUrl|providerJob|oauthClientId|access_token|client_secret/);
});
