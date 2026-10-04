import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { STUDIO_ASSISTANCE_TARIFF, type StudioAssistanceMode } from '../frontend/src/lib/studio/assistance-contract';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { chooseStudioAssistance, readStudioAssistanceStatus } from '../frontend/src/server/studio/assistance-ledger';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import type { StudioDirectorResponse } from '../frontend/src/server/studio/conversation-director';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const policy = { enabled: true, solAllowanceNanoUsd: 1_000_000_000, lunaAllowanceNanoUsd: 250_000_000,
  campaignNanoUsd: 100_000_000_000, maxAdditionalBudgetCents: 2000 };
const restricted = (error: unknown) => error instanceof AgentApiError && error.code === 'ACCOUNT_RESTRICTED';

test('assistance restrictions stop new supplier work while recorded responses remain recoverable', async t => {
  const pg = await startDisposablePostgres('studio-restrict');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);
    CREATE TABLE studio_sequences(id text PRIMARY KEY)`);
  for (const file of ['50_studio_image_conversation.sql', '51_studio_image_model_usage.sql', '42_studio_connected_montages.sql', '52_studio_conversation_runs.sql', '54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql']) {
    await pg.pool.query(readFileSync('neon/migrations/' + file, 'utf8'));
  }
  await pg.pool.query(`CREATE FUNCTION reject_restricted_test_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.state='settled' THEN RAISE EXCEPTION 'settlement unavailable'; END IF; RETURN NEW; END; $$`);

  async function fixture(mode: StudioAssistanceMode) {
    const userId = randomUUID(), projectId = randomUUID();
    const actor = { userId, projectId, authMethod: 'studio-session' as const, clientId: null };
    await pg.pool.query('INSERT INTO studio_projects(id,user_id,name) VALUES($1,$2,$3)', [projectId, userId, 'Restriction test']);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',1000,'USD')", [userId]);
    if (mode === 'paid_sol') await chooseStudioAssistance(userId, { action: 'authorize_paid', budgetCents: 100, tariffVersion: STUDIO_ASSISTANCE_TARIFF.version, expectedRevision: 0 }, policy);
    if (mode === 'sponsored_luna') await chooseStudioAssistance(userId, { action: 'select_luna', expectedRevision: 0 }, policy);
    const input = { requestId: randomUUID(), message: 'Help plan the film', references: [] };
    const response: StudioDirectorResponse = { id: randomUUID(), model: mode === 'sponsored_luna' ? 'gpt-6-luna' : 'gpt-6.1-sol',
      status: 'completed', service_tier: 'default', usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 0 },
        output_tokens: 50, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 150 },
      output_text: JSON.stringify({ reply: 'A saved direction' }), output: [] };
    let counts = 0, dispatches = 0;
    const restrict = () => pg.pool.query(`INSERT INTO user_account_restrictions(user_id,reason,message)
      VALUES($1,'restriction-test','Private administrative reason') ON CONFLICT(user_id) DO UPDATE SET active=TRUE`, [userId]);
    const service = (afterCount?: () => Promise<unknown>) => createImageConversationService(actor, {
      enabled: true, actionsEnabled: true, assistancePolicy: policy,
      countInputTokens: async () => { counts++; await afterCount?.(); return 1000; },
      createActionResponse: async () => { dispatches++; return { ...response, id: randomUUID() }; },
    });
    const calls = async () => (await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE user_id=$1', [userId])).rows;
    const balance = async () => (await pg.pool.query("SELECT sum(CASE WHEN type='charge' THEN -amount_cents ELSE amount_cents END)::int balance FROM app_receipts WHERE user_id=$1", [userId])).rows[0].balance;
    const assertUnspent = async () => {
      assert.equal((await calls()).length, 0, 'No supplier allowance or wallet reservation may be recorded');
      assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_conversation_responses WHERE user_id=$1', [userId])).rows[0].n, 0, 'A denied reservation rolls back its dispatch checkpoint');
      assert.equal(await balance(), 1000);
    };
    return { actor, input, response, restrict, service, calls, balance, assertUnspent, counters: () => ({ counts, dispatches }) };
  }

  for (const mode of ['included_sol', 'sponsored_luna', 'paid_sol'] as const) {
    await t.test(`${mode}: restricted accounts stop before token counting, dispatch and reservation`, async () => {
      const current = await fixture(mode);
      await current.restrict();
      await assert.rejects(current.service().submit(current.input), restricted);
      assert.deepEqual(current.counters(), { counts: 0, dispatches: 0 });
      await current.assertUnspent();
    });

    await t.test(`${mode}: a restriction committed during preflight prevents the reservation`, async () => {
      const current = await fixture(mode);
      await assert.rejects(current.service(current.restrict).submit(current.input), restricted);
      assert.deepEqual(current.counters(), { counts: 1, dispatches: 0 });
      await current.assertUnspent();
    });

    await t.test(`${mode}: saved responses settle and replay after the account becomes restricted`, async () => {
      const current = await fixture(mode);
      await pg.pool.query('CREATE TRIGGER reject_restricted_settlement BEFORE UPDATE ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION reject_restricted_test_settlement()');
      try {
        await assert.rejects(current.service().submit(current.input), /settlement unavailable/);
      } finally {
        await pg.pool.query('DROP TRIGGER reject_restricted_settlement ON studio_assistance_calls');
      }
      assert.equal((await current.calls())[0].state, 'unknown');
      await current.restrict();
      const recovered = await current.service().submit(current.input);
      assert.equal(recovered.state, 'ready');
      assert.equal(recovered.reply, 'A saved direction');
      assert.equal((await current.service().submit(current.input)).reply, recovered.reply);
      assert.deepEqual(current.counters(), { counts: 1, dispatches: 1 });
      const calls = await current.calls();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].mode, mode);
      assert.equal(calls[0].state, 'settled');
      assert.equal(calls[0].charged_cents, mode === 'paid_sol' ? 1 : 0);
      assert.equal(await current.balance(), mode === 'paid_sol' ? 999 : 1000);
      const status = await readStudioAssistanceStatus(current.actor.userId, policy);
      assert.equal(status.unresolvedCalls, 0);
      assert.equal(status.paid.reservedCents, 0);
      await assert.rejects(current.service().submit({ ...current.input, requestId: randomUUID() }), restricted);
      assert.deepEqual(current.counters(), { counts: 1, dispatches: 1 });
    });
  }

  await t.test('an unavailable restriction lookup fails closed before the token-count endpoint', async () => {
    const current = await fixture('included_sol');
    await pg.pool.query('ALTER TABLE user_account_restrictions RENAME TO unavailable_restrictions');
    try {
      await assert.rejects(current.service().submit(current.input));
      assert.deepEqual(current.counters(), { counts: 0, dispatches: 0 });
      await current.assertUnspent();
    } finally {
      await pg.pool.query('ALTER TABLE unavailable_restrictions RENAME TO user_account_restrictions');
    }
  });
});
