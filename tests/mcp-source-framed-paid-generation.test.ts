import assert from 'node:assert/strict';
import test from 'node:test';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import {
  ProviderHarness,
  addTopup,
  callConfirmed,
  callPrepared,
  connect,
  createServices,
  errorCode,
  principal,
  structured,
} from './helpers/mcp-paid-e2e-harness';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from './helpers/disposable-postgres';

function registryCapability(engineId: string): AgentPublicGenerationEngine {
  const entry = getFalEngineById(engineId);
  assert.ok(entry, `missing real catalog fixture ${engineId}`);
  const publicModes = entry.modes
    .map((mode) => mode.mode)
    .filter((mode): mode is AgentPublicGenerationEngine['publicModes'][number] =>
      ['t2v', 'i2v', 'ref2v', 't2i', 'i2i'].includes(mode));
  return {
    engine: entry.engine,
    surface: entry.category === 'image' ? 'image' : 'video',
    publicModes,
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
}

test('real H3 source-framed i2v prepares and confirms with a nullable stored ratio', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }

  const postgres = await startDisposablePostgres('mcp-source-framed-i2v');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = postgres.databaseUrl;
  t.after(async () => {
    await getDb().end().catch(() => undefined);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await postgres.cleanup();
  });
  await createPaidGenerationTestSchema(postgres.pool);

  const identity = principal('source-framed-i2v-user');
  await addTopup(postgres.pool, identity.userId, 100_000);
  const provider = new ProviderHarness(postgres.pool);
  const h3 = registryCapability('minimax-h3');
  const session = await connect(identity, createServices({
    publicEngines: [h3],
    submitPaidGeneration: provider.submit,
  }));
  t.after(() => session.close());

  const invalidT2v: Omit<CanonicalGenerationRequest, 'schemaVersion'> = {
    surface: 'video',
    engineId: 'minimax-h3',
    mode: 't2v',
    prompt: 'A text-only H3 shot without required framing',
    settings: { durationSec: 5, resolution: '2K' },
    references: [],
    outputCount: 1,
  };
  const rejected = await session.client.callTool({
    name: 'prepare_generation',
    arguments: invalidT2v,
  }) as CallToolResult;
  assert.equal(errorCode(rejected), 'PARAMETER_INVALID');
  assert.equal((await postgres.pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM mcp_generation_quotes',
  )).rows[0]?.count, '0');
  assert.equal(provider.captures.length, 0);

  const sourceUrl = 'https://fixtures.maxvideoai.com/h3/source-frame.png';
  const sourceFramedI2v: Omit<CanonicalGenerationRequest, 'schemaVersion'> = {
    surface: 'video',
    engineId: 'minimax-h3',
    mode: 'i2v',
    prompt: 'Animate the source image while preserving its framing',
    settings: { durationSec: 5, resolution: '2K' },
    references: [{ kind: 'https', url: sourceUrl, role: 'source', mediaKind: 'image' }],
    outputCount: 1,
  };
  const prepared = await callPrepared(session.client, sourceFramedI2v);
  assert.deepEqual(prepared.summary, normalizeGenerationRequest(sourceFramedI2v));
  const quoteId = String(prepared.quoteId);

  const confirmed = await callConfirmed(session.client, quoteId);
  assert.notEqual(confirmed.isError, true, JSON.stringify(confirmed.structuredContent));
  assert.equal(structured(confirmed).status, 'accepted');
  assert.equal(provider.calls(quoteId), 1);

  const persisted = await postgres.pool.query<{
    aspect_ratio: string | null;
    settings_snapshot: CanonicalGenerationRequest;
    charges: string;
  }>(`
    SELECT j.aspect_ratio, j.settings_snapshot,
           (SELECT count(*)::text FROM app_receipts r
             WHERE r.job_id = j.job_id AND r.type = 'charge') AS charges
      FROM app_jobs j
     WHERE j.job_id = $1
  `, [quoteId]);
  assert.equal(persisted.rows[0]?.aspect_ratio, null);
  assert.deepEqual(persisted.rows[0]?.settings_snapshot, normalizeGenerationRequest(sourceFramedI2v));
  assert.equal(persisted.rows[0]?.charges, '1');

  const capture = provider.captures.find((entry) => entry.quoteId === quoteId);
  assert.equal(capture?.body.imageUrl, sourceUrl);
  assert.equal(Object.hasOwn(capture?.body ?? {}, 'aspectRatio'), false);
});
