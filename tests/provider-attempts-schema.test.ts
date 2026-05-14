import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationPath = join(root, 'neon/migrations/21_provider_attempts.sql');
const runtimeSchemaPath = join(root, 'frontend/src/lib/schema/billing-provider-schema.ts');

test('provider_attempts migration defines the provider-agnostic audit table', () => {
  assert.ok(existsSync(migrationPath), 'provider_attempts must have a real Neon migration');
  const source = readFileSync(migrationPath, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS provider_attempts/);
  assert.match(source, /job_id BIGINT NOT NULL REFERENCES app_jobs\(id\) ON DELETE CASCADE/);
  for (const column of [
    'attempt_index',
    'provider',
    'provider_model',
    'status',
    'provider_job_id',
    'started_at',
    'accepted_at',
    'finished_at',
    'error_code',
    'error_class',
    'fallback_eligible',
    'fallback_to_attempt_id',
    'request_snapshot',
    'response_snapshot',
    'provider_cost_usd',
    'provider_cost_units',
    'created_at',
    'updated_at',
  ]) {
    assert.match(source, new RegExp(`\\b${column}\\b`), `missing provider_attempts.${column}`);
  }
  assert.match(source, /UNIQUE \(job_id, attempt_index\)/);
  assert.match(source, /provider_attempts_job_attempt_idx/);
  assert.match(source, /provider_attempts_provider_job_idx/);
  assert.match(source, /provider_attempts_status_updated_idx/);
  assert.match(source, /provider_attempts_provider_created_idx/);
});

test('runtime schema bootstrap keeps provider_attempts in sync for local/dev setup', () => {
  const source = readFileSync(runtimeSchemaPath, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS provider_attempts/);
  assert.match(source, /REFERENCES app_jobs\(id\) ON DELETE CASCADE/);
  assert.match(source, /provider_attempts_provider_job_idx/);
});
