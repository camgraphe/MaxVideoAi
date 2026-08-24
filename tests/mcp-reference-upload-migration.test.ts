import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'neon/migrations/32_mcp_reference_uploads.sql';

test('migration 32 owns short-lived single-use reference upload sessions', () => {
  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);
  const source = readFileSync(migrationPath, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS mcp_reference_upload_sessions/i);
  assert.match(source, /session_id\s+UUID\s+PRIMARY KEY/i);
  assert.match(source, /token_hash\s+TEXT\s+NOT NULL\s+UNIQUE/i);
  assert.doesNotMatch(source, /\btoken\s+TEXT/i);
  assert.match(source, /token_hash\s*~\s*'\^\[a-f0-9\]\{64\}\$'/i);
  assert.match(source, /user_id\s+TEXT\s+NOT NULL/i);
  assert.match(source, /oauth_client_id\s+TEXT/i);
  assert.match(source, /state\s+TEXT\s+NOT NULL/i);
  assert.match(source, /created[\s\S]*uploaded[\s\S]*expired[\s\S]*revoked/i);
  assert.match(source, /expires_at\s*=\s*created_at\s*\+\s*INTERVAL\s*'15 minutes'/i);
  assert.match(source, /claim_id\s+UUID/i);
  assert.match(source, /claimed_at\s+TIMESTAMPTZ/i);
  assert.match(source, /asset_id\s+TEXT/i);
  assert.match(source, /uploaded_at\s+TIMESTAMPTZ/i);
});

test('reserved MCP migrations now contain the missing migration 32 in order', () => {
  const numbered = readdirSync('neon/migrations')
    .filter((name) => /^3[0-3]_.+\.sql$/u.test(name))
    .sort();

  assert.deepEqual(numbered, [
    '30_mcp_paid_generation.sql',
    '31_mcp_trial_entitlements.sql',
    '32_mcp_reference_uploads.sql',
    '33_mcp_acquisition_funnel.sql',
  ]);
});
