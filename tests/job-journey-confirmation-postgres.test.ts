import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { GenerationActor } from '../frontend/src/server/agent-api/generation-actor';
import { createCreatorGenerationService } from '../frontend/src/server/tools/creator-generation-service';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { addTopup, ProviderHarness } from './helpers/mcp-paid-e2e-harness';

test('C11–C14: same account, both media, all actors, duplicate confirmation and release recovery', async t => {
  const pg = await startDisposablePostgres('journey-confirmation');
  const previous = { url: process.env.DATABASE_URL, sha: process.env.VERCEL_GIT_COMMIT_SHA };
  process.env.DATABASE_URL = pg.databaseUrl;
  process.env.VERCEL_GIT_COMMIT_SHA = 'a'.repeat(40);
  t.after(async () => {
    await getDb().end();
    for (const [key, value] of [['DATABASE_URL', previous.url], ['VERCEL_GIT_COMMIT_SHA', previous.sha]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/69_toolbox_generation_scope.sql', 'utf8'));
  await addTopup(pg.pool, 'fixture-owner', 100000);
  const provider = new ProviderHarness(pg.pool);
  const row = async (id: string) => (await pg.pool.query(`SELECT entry_surface,entry_source,journey_version,entry_release_sha
    FROM app_jobs WHERE job_id=$1`, [id])).rows[0];
  for (const media of ['video', 'image'] as const) {
    const entry = getFalEngineById(media === 'video' ? 'seedance-2-0-mini' : 'gpt-image-2')!;
    const mode = media === 'video' ? 't2v' : 't2i';
    const catalog = [{ engine: entry.engine, surface: media, publicModes: [mode], modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) }];
    const available = () => ({ executable: true as const, reason: 'available' as const });
    const options = { enabled: true,
      prepareDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: available },
      confirmDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: available, submitPaidGeneration: provider.submit } };
    const input = { surface: media, engineId: entry.id, mode, prompt: 'Synthetic reservation context test', references: [], outputCount: 1,
      settings: media === 'video' ? { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true }
        : { resolution: '1024x1024', aspectRatio: '1:1', quality: 'high' } };
    for (const [authMethod, surface] of [['oauth', 'mcp'], ['studio-session', 'studio'], ['toolbox-session', 'tool']] as const) {
      process.env.VERCEL_GIT_COMMIT_SHA = 'a'.repeat(40);
      const actor = { authMethod, userId: 'fixture-owner', clientId: authMethod === 'oauth' ? 'fixture-client' : null,
        ...(authMethod === 'studio-session' ? { projectId: 'fixture-project' } : {}) } as GenerationActor;
      const service = createCreatorGenerationService(actor, options);
      const prepared = await service.prepare(input);
      const confirmation = { quoteId: prepared.quoteId, confirmed: true as const };
      const denied = [{ ...actor, userId: 'other-owner' },
        ...(authMethod === 'studio-session' ? [{ ...actor, projectId: 'other-project' }] : []),
        ...(authMethod === 'oauth' ? [{ ...actor, clientId: 'other-client' }] : [])];
      for (const foreign of denied) await assert.rejects(createCreatorGenerationService(foreign, options).confirm(confirmation));
      const incompatible = { authMethod: authMethod === 'toolbox-session' ? 'oauth' : 'toolbox-session', userId: actor.userId, clientId: null } as GenerationActor;
      await assert.rejects(createCreatorGenerationService(incompatible, options).confirm(confirmation));
      assert.equal(await row(prepared.quoteId), undefined);
      assert.equal((await pg.pool.query('SELECT count(*) FROM app_receipts WHERE job_id=$1', [prepared.quoteId])).rows[0].count, '0');
      if (authMethod === 'oauth') {
        await pg.pool.query(`ALTER TABLE app_jobs ADD CONSTRAINT fixture_confirm_insert_failure CHECK (job_id <> '${prepared.quoteId}')`);
        const priorProviderCalls = provider.captures.length;
        await assert.rejects(service.confirm(confirmation));
        assert.equal(provider.captures.length, priorProviderCalls);
        assert.equal((await pg.pool.query('SELECT count(*) FROM app_receipts WHERE job_id=$1', [prepared.quoteId])).rows[0].count, '0');
        assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [prepared.quoteId])).rows[0].state, 'prepared');
        await pg.pool.query('ALTER TABLE app_jobs DROP CONSTRAINT fixture_confirm_insert_failure');
      }
      const beforeCalls = provider.captures.length;
      const results = await Promise.all([service.confirm(confirmation), service.confirm(confirmation)]);
      assert.ok(results.every(result => result.jobId === prepared.quoteId));
      const expected = { entry_surface: surface, entry_source: 'confirmed_actor', journey_version: 1, entry_release_sha: 'a'.repeat(40) };
      assert.deepEqual(await row(prepared.quoteId), expected);
      process.env.VERCEL_GIT_COMMIT_SHA = 'b'.repeat(40);
      await service.confirm(confirmation);
      assert.deepEqual(await row(prepared.quoteId), expected);
      assert.equal(provider.captures.length, beforeCalls + 1);
      assert.equal((await pg.pool.query("SELECT count(*) FROM app_receipts WHERE job_id=$1 AND type='charge'", [prepared.quoteId])).rows[0].count, '1');

    }
  }
});
