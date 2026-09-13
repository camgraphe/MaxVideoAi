import assert from 'node:assert/strict';
import test from 'node:test';

import { getDb } from '../frontend/src/lib/db';
import { ensureBillingSchema } from '../frontend/src/lib/schema';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { computeConfiguredPreflight, getConfiguredEngine, getConfiguredEngines } from '../frontend/src/server/engines';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import {
  getReadOnlyConfiguredEngine,
  getReadOnlyConfiguredEngineIncludingRuntimePrivate,
} from '../frontend/src/server/agent-api/read-only-engine-catalog';
import type { EngineCaps, PreflightRequest, PreflightResponse } from '../frontend/types/engines';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('read-only preflight matches generation seed prices and capabilities while preserving admin settings', { timeout: 30_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const postgres = await startDisposablePostgres('pf-seed');
  const previousUrl = process.env.DATABASE_URL;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await postgres.cleanup();
  });
  process.env.DATABASE_URL = postgres.databaseUrl;
  await ensureBillingSchema();
  const stalePricing = { currency: 'USD', perSecondCents: { default: 1 } };
  for (const [id, options, updatedBy] of [
    ['sora-2', {}, null],
    ['minimax-h3', { maxDurationSec: 1, resolutions: ['768P'] }, null],
    ['sora-2-pro', { maxDurationSec: 4, resolutions: ['720p'] }, '00000000-0000-4000-8000-000000000001'],
  ] as const) {
    await postgres.pool.query(
      `INSERT INTO engine_settings (engine_id, options, pricing, updated_by)
       VALUES ($1, $2, $3, $4)`,
      [id, JSON.stringify(options), JSON.stringify(stalePricing), updatedBy],
    );
  }
  await postgres.pool.query("INSERT INTO engine_overrides (engine_id, active) VALUES ('flux-3', false)");
  const beforeRows = (await postgres.pool.query('SELECT * FROM engine_settings ORDER BY engine_id')).rows;
  const readOnlyUrl = new URL(postgres.databaseUrl);
  readOnlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
  process.env.DATABASE_URL = readOnlyUrl.toString();
  assert.equal((await getDb().query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only, 'on');

  const requests: PreflightRequest[] = [
    { engine: 'sora-2', mode: 't2v', durationSec: 5, resolution: '720p', fps: 24 },
    { engine: 'minimax-h3', mode: 't2v', durationSec: 5, resolution: '2K', fps: 24 },
    { engine: 'sora-2-pro', mode: 't2v', durationSec: 4, resolution: '720p', fps: 24 },
  ];
  const readOnlyEngines = new Map<string, EngineCaps>();
  for (const base of getBaseEngines()) {
    const engine = await getReadOnlyConfiguredEngine(base.id, true);
    assert.ok(engine);
    readOnlyEngines.set(base.id, engine);
    assert.deepEqual(await getReadOnlyConfiguredEngineIncludingRuntimePrivate(base.id, true), engine);
  }
  const preflightResults: PreflightResponse[] = [];
  const fallbackResults: PreflightResponse[] = [];
  for (const request of requests) {
    preflightResults.push(await resolveMediaAwarePreflight({ request }));
    fallbackResults.push(await computeConfiguredPreflight(request, { bootstrap: false }));
  }
  const disabled = await resolveMediaAwarePreflight({ request: { ...requests[0], engine: 'flux-3' } });
  assert.equal(disabled.error?.code, 'ENGINE_DISABLED');
  const unknown = await resolveMediaAwarePreflight({ request: { ...requests[0], engine: 'unknown-engine' } });
  assert.equal(unknown.error?.code, 'ENGINE_NOT_FOUND');
  assert.deepEqual((await postgres.pool.query('SELECT * FROM engine_settings ORDER BY engine_id')).rows, beforeRows);

  // Execute the actual generation resolver and seed on the same disposable DB.
  process.env.DATABASE_URL = postgres.databaseUrl;
  for (const generationEngine of await getConfiguredEngines(true)) {
    assert.deepEqual(readOnlyEngines.get(generationEngine.id), generationEngine,
      `${generationEngine.id} must expose the same capabilities, including missing system rows`);
  }
  for (const [index, request] of requests.entries()) {
    const generationEngine = await getConfiguredEngine(request.engine);
    assert.ok(generationEngine);
    const generationPreflight = await resolveMediaAwarePreflight({ request }, {
      getConfiguredEngineFn: async () => generationEngine,
    });
    assert.deepEqual(preflightResults[index], generationPreflight, `${request.engine} must quote identically before/after persisted seed`);
    assert.deepEqual(fallbackResults[index], await computeConfiguredPreflight(request, { resolvedEngine: generationEngine }),
      `${request.engine} fallback must use the same effective system settings`);
  }
  const h3 = getBaseEngines().find((engine) => engine.id === 'minimax-h3')!;
  assert.equal(readOnlyEngines.get(h3.id)?.maxDurationSec, h3.maxDurationSec);
  assert.deepEqual(readOnlyEngines.get(h3.id)?.resolutions, h3.resolutions);
  const adminAfter = (await postgres.pool.query("SELECT * FROM engine_settings WHERE engine_id = 'sora-2-pro'")).rows[0];
  assert.deepEqual(adminAfter, beforeRows.find((row) => row.engine_id === 'sora-2-pro'));
});
