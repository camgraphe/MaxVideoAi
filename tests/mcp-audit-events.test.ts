import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import { recordMcpEvent } from '../frontend/src/server/agent-api/audit-events';

const migrationPath = join(process.cwd(), 'neon/migrations/29_mcp_audit_events.sql');

test('MCP audit storage uses an unclaimed Neon migration number', () => {
  const migrationNames = readdirSync(join(process.cwd(), 'neon/migrations'))
    .filter((name) => /^\d+_.+\.sql$/.test(name));
  const mcpMigrationName = migrationNames.find((name) => name.endsWith('_mcp_audit_events.sql'));
  assert.ok(mcpMigrationName);

  const migrationNumber = mcpMigrationName.slice(0, mcpMigrationName.indexOf('_'));
  const conflictingNames = migrationNames.filter(
    (name) => name !== mcpMigrationName && name.startsWith(`${migrationNumber}_`)
  );
  assert.deepEqual(conflictingNames, []);
});

test('MCP audit migration stores only coarse allowlisted event dimensions', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS mcp_audit_events/i);
  for (const column of [
    'event_type',
    'user_id',
    'oauth_client_id',
    'tool_name',
    'outcome',
    'surface',
    'engine_id',
    'error_code',
    'created_at',
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`, 'i'));
  }
  assert.doesNotMatch(migration, /\b(prompt|token|secret|reference_url|payment)\b/i);
});

test('recordMcpEvent inserts an allowlisted payload with positional parameters', async () => {
  let capturedSql = '';
  let capturedParams: ReadonlyArray<unknown> | undefined;
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [] as TRecord[];
    },
  };

  const recorded = await recordMcpEvent(
    {
      eventType: 'tool_discovery',
      userId: 'user-1',
      oauthClientId: 'client-1',
      tool: 'list_models',
      outcome: 'success',
      surface: 'video',
      engineId: null,
      errorCode: null,
    },
    { executor, ensureSchema: async () => undefined }
  );

  assert.equal(recorded, true);
  assert.match(capturedSql, /INSERT INTO mcp_audit_events/);
  assert.deepEqual(capturedParams, [
    'tool_discovery',
    'user-1',
    'client-1',
    'list_models',
    'success',
    'video',
    null,
    null,
  ]);
});

test('audit rejects sensitive or unknown keys before querying', async () => {
  let queryCount = 0;
  const executor: QueryExecutor = {
    async query<TRecord>() {
      queryCount += 1;
      return [] as TRecord[];
    },
  };
  const base = {
    eventType: 'connection_initialized' as const,
    userId: 'user-1',
    oauthClientId: null,
    tool: null,
    outcome: 'success' as const,
    surface: null,
    engineId: null,
    errorCode: null,
  };

  for (const forbidden of [
    'prompt',
    'accessToken',
    'secret',
    'referenceUrl',
    'rawUrl',
    'email',
    'providerBody',
    'paymentMethod',
    'fraudSignal',
  ]) {
    const recorded = await recordMcpEvent(
      { ...base, [forbidden]: 'sensitive' } as typeof base,
      { executor, ensureSchema: async () => undefined }
    );
    assert.equal(recorded, false, forbidden);
  }
  assert.equal(queryCount, 0);
});

test('audit storage failures never change the caller result', async () => {
  const recorded = await recordMcpEvent(
    {
      eventType: 'connection_initialized',
      userId: 'user-1',
      oauthClientId: null,
      tool: null,
      outcome: 'success',
      surface: null,
      engineId: null,
      errorCode: null,
    },
    {
      ensureSchema: async () => {
        throw new Error('database unavailable');
      },
      executor: { async query<TRecord>() { return [] as TRecord[]; } },
    }
  );

  assert.equal(recorded, false);
});

test('runtime schema exports MCP schema bootstrap', () => {
  const schemaIndex = readFileSync(join(process.cwd(), 'frontend/src/lib/schema.ts'), 'utf8');
  assert.match(schemaIndex, /ensureMcpSchema/);
});
