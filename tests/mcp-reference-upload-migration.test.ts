import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'neon/migrations/32_mcp_reference_uploads.sql';
const mediaKindMigrationPath = 'neon/migrations/34_mcp_reference_upload_media_kind.sql';
const hardeningMigrationPath = 'neon/migrations/35_mcp_reference_upload_hardening.sql';
const replaySafetyMigrationPath = 'neon/migrations/36_mcp_reference_upload_replay_safety.sql';
const recoveryMigrationPath = 'neon/migrations/37_mcp_reference_upload_recovery_state.sql';

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

test('the next Neon migration binds an immutable exact media kind to every upload session', () => {
  assert.equal(existsSync(mediaKindMigrationPath), true, `${mediaKindMigrationPath} should exist`);
  const source = readFileSync(mediaKindMigrationPath, 'utf8');

  assert.match(source, /ALTER TABLE\s+mcp_reference_upload_sessions/i);
  assert.match(source, /ADD COLUMN IF NOT EXISTS\s+media_kind\s+TEXT/i);
  assert.match(source, /media_kind\s+IN\s*\(\s*'image'\s*,\s*'video'\s*,\s*'audio'\s*\)/i);
  assert.match(source, /media_kind\s+IS DISTINCT FROM\s+OLD\.media_kind/i);
  assert.doesNotMatch(source, /ALTER COLUMN\s+media_kind\s+DROP DEFAULT/i);
  assert.doesNotMatch(source, /supabase/i);
});

test('upload hardening migration adds opaque public IDs and durable session-bound attempts with expand-contract checks', () => {
  assert.equal(existsSync(hardeningMigrationPath), true, `${hardeningMigrationPath} should exist`);
  const source = readFileSync(hardeningMigrationPath, 'utf8');

  assert.match(source, /ALTER TABLE\s+media_assets[\s\S]*ADD COLUMN IF NOT EXISTS\s+public_id\s+TEXT/i);
  assert.match(source, /UPDATE\s+media_assets[\s\S]*public_id\s*=\s*['"]?ma_/i);
  assert.match(source, /CREATE UNIQUE INDEX[\s\S]*media_assets_public_id/i);
  assert.match(source, /CREATE TABLE IF NOT EXISTS\s+mcp_reference_upload_attempts/i);
  assert.match(source, /session_id\s+UUID[\s\S]*REFERENCES\s+mcp_reference_upload_sessions/i);
  assert.match(source, /upload_id\s+UUID[\s\S]*UNIQUE/i);
  assert.match(source, /storage_key\s+TEXT/i);
  assert.match(source, /declared_size\s+BIGINT/i);
  assert.match(source, /content_sha256\s+TEXT/i);
  assert.match(source, /staged_asset_id\s+TEXT/i);
  assert.match(source, /FOREIGN KEY\s*\(session_id,\s*user_id,\s*media_kind\)/i);
  assert.match(source, /mcp_reference_upload_attempts identity is immutable/i);
  assert.doesNotMatch(source, /supabase/i);
});

test('replay safety migration adds immutable parts and versioned completion lease state', () => {
  assert.equal(existsSync(replaySafetyMigrationPath), true, `${replaySafetyMigrationPath} should exist`);
  const source = readFileSync(replaySafetyMigrationPath, 'utf8');
  assert.match(source, /ALTER TABLE\s+mcp_reference_upload_attempts/i);
  assert.match(source, /state\s+TEXT[\s\S]*pending[\s\S]*processing[\s\S]*staged[\s\S]*completed[\s\S]*aborted/i);
  assert.match(source, /lease_id\s+UUID/i);
  assert.match(source, /lease_expires_at\s+TIMESTAMPTZ/i);
  assert.match(source, /version\s+(?:BIG)?INT/i);
  assert.match(source, /file_sha256\s+TEXT/i);
  assert.match(source, /total_parts\s+INTEGER/i);
  assert.match(source, /CREATE TABLE IF NOT EXISTS\s+mcp_reference_upload_parts/i);
  assert.match(source, /part_number\s+INTEGER/i);
  assert.match(source, /content_sha256\s+TEXT/i);
  assert.match(source, /UNIQUE\s*\(upload_id,\s*part_number\)/i);
  assert.doesNotMatch(source, /supabase/i);
});

test('recovery migration versions rolling uploads and owns a durable scoped cleanup ledger', () => {
  assert.equal(existsSync(recoveryMigrationPath), true, `${recoveryMigrationPath} should exist`);
  const source = readFileSync(recoveryMigrationPath, 'utf8');
  assert.match(source, /protocol_version\s+SMALLINT[\s\S]*DEFAULT\s+1/iu);
  assert.match(source, /CREATE TABLE IF NOT EXISTS\s+mcp_reference_upload_cleanup_objects/iu);
  assert.match(source, /object_role[\s\S]*part[\s\S]*final[\s\S]*thumbnail/iu);
  assert.match(source, /legacy_staging[\s\S]*AFTER INSERT[\s\S]*register_mcp_reference_upload_v1_cleanup/iu);
  assert.match(source, /object_key\s+TEXT/iu);
  assert.match(source, /state[\s\S]*pending[\s\S]*retained[\s\S]*deleted/iu);
  assert.match(source, /FOREIGN KEY\s*\(session_id,\s*upload_id,\s*user_id,\s*media_kind\)/iu);
  assert.match(source, /UNIQUE\s*\(session_id,\s*upload_id,\s*user_id,\s*media_kind,\s*object_key\)/iu);
  assert.doesNotMatch(source, /object_key\s+TEXT\s+NOT\s+NULL\s+UNIQUE/iu);
  assert.doesNotMatch(source, /ALTER COLUMN\s+protocol_version\s+DROP DEFAULT/iu);
});
