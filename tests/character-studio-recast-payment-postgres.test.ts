import assert from 'node:assert/strict';
import test from 'node:test';
import { recastHarness } from './helpers/character-recast-harness';
import { MCP_QUOTE_LIFETIME_SECONDS } from '../frontend/src/server/agent-api/quote-repository';
import { confirmRecast } from '../frontend/server/character-studio/recast';
import { runAlibabaModelStudioPoll } from '../frontend/server/alibaba-model-studio-poll';
import { allowGenerationPoll } from './helpers/generation-poll-claim';
import { readRecastPublicPrice } from '../frontend/server/character-studio/recast-public-price';
import { createCreatorGenerationService } from '../frontend/src/server/tools/creator-generation-service';

test('Recast payment rejects invalid approvals and recovers accepted work without a second charge', async (t) => {
  const f = await recastHarness(t);
  const empty = async (id: string) => {
    assert.deepEqual(await f.receipts(id), []);
    assert.equal(
      (await f.pg.pool.query('SELECT count(*)::int AS n FROM app_jobs WHERE job_id=$1', [id])).rows[0].n,
      0,
    );
    assert.equal(f.provider.calls(id), 0);
  };
  await t.test('owner, amount, currency and explicit consent are bound to the quote', async () => {
    const q = await f.prepare();
    const approval = f.approval(q);
    for (const change of [{ amountCents: q.amountCents + 1 }, { currency: 'EUR' }, { confirmed: false }]) {
      await assert.rejects(confirmRecast(f.actor, { ...approval, ...change }, f.generation));
      await empty(q.quoteId);
    }
    await assert.rejects(confirmRecast({ ...f.actor, userId: 'different-owner' }, approval, f.generation));
    await empty(q.quoteId);
  });
  await t.test('expired quote and changed Recast multiplier debit nothing', async () => {
    f.setPrepareNow(() => new Date(Date.now() - (MCP_QUOTE_LIFETIME_SECONDS + 60) * 1000));
    const expired = await f.prepare();
    f.setPrepareNow();
    await assert.rejects(f.confirm(expired), { code: 'QUOTE_EXPIRED' });
    await empty(expired.quoteId);
    const stale = await f.prepare();
    await f.setRecastMargin(1.5);
    await assert.rejects(f.confirm(stale), { code: 'QUOTE_EXPIRED' });
    await empty(stale.quoteId);
    const refreshed = await f.prepare();
    assert.equal(stale.amountCents, 224);
    assert.equal(refreshed.amountCents, 280);
    await f.setRecastMargin(1);
  });
  await t.test('a model tariff revision cannot alter the independent Recast reservation', async () => {
    const q = await f.prepare();
    await f.pg.pool.query('UPDATE app_customer_tariff_state SET revision=revision+1');
    await f.confirm(q);
    assert.equal((await f.receipts(q.quoteId))[0].amount_cents, 224);
  });
  await t.test('missing scoped rule and database policy failure never fall back to model retail', async () => {
    const estimateInput = { modelId: 'wan-3-prime', mode: 'i2v' as const,
      resolution: '720p', durationSec: 8, aspectRatio: '9:16' };
    for (const failure of ['missing', 'unavailable']) {
      const q = await f.prepare();
      const quoteCount = (await f.pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n;
      if (failure === 'missing') await f.pg.pool.query("DELETE FROM app_pricing_rules WHERE id='recast-test-policy'");
      else await f.pg.pool.query('ALTER TABLE app_pricing_rules RENAME TO temporarily_unavailable_pricing_rules');
      try {
        assert.equal((await readRecastPublicPrice(estimateInput)).status, 'unavailable');
        await assert.rejects(f.prepare());
        await assert.rejects(f.confirm(q));
        await empty(q.quoteId);
        assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n, quoteCount);
      } finally {
        if (failure === 'unavailable') await f.pg.pool.query('ALTER TABLE temporarily_unavailable_pricing_rules RENAME TO app_pricing_rules');
        await f.setRecastMargin(1);
      }
    }
  });
  await t.test('raw generation settings cannot select Recast or another billing product', async () => {
    const service = createCreatorGenerationService(f.actor, { enabled: true,
      prepareDependencies: f.runtime, confirmDependencies: f.runtime });
    const request = { surface: 'video' as const, engineId: 'wan-3-prime', mode: 'i2v' as const,
      prompt: 'Character portrait', references: [{ kind: 'asset' as const, assetId: f.id(9), role: 'first_frame' as const }],
      settings: { durationSec: 8, resolution: '720p', aspectRatio: '9:16' } };
    const before = (await f.pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n;
    for (const key of ['billingProduct', 'customerProduct', 'toolId', 'creatorToolId']) {
      await assert.rejects(service.prepare({ ...request, settings: { ...request.settings, [key]: 'character-recast' } }),
        { code: 'PARAMETER_INVALID' });
    }
    assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n, before);
    const ordinary = await service.prepare(request);
    assert.notEqual(ordinary.price.amountCents, 224);
    const stored = (await f.pg.pool.query('SELECT pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [ordinary.quoteId])).rows[0].pricing_snapshot;
    assert.equal(stored.canonicalPricing.meta.customerProduct, undefined);
  });
  await t.test('an unaccepted legacy model quote expires without debit and must be requoted', async () => {
    f.setLegacyModelPricing(true);
    const legacy = await f.prepare({ video: f.video, audio: f.audio });
    f.setLegacyModelPricing(false);
    const original = (await f.pg.pool.query('SELECT request_hash, request_json, pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [legacy.quoteId])).rows[0];
    assert.equal(original.pricing_snapshot.canonicalPricing.meta.customerProduct, undefined);
    await assert.rejects(f.confirm(legacy), { code: 'QUOTE_EXPIRED' });
    await empty(legacy.quoteId);
    const refreshed = await f.prepare({ video: f.video, audio: f.audio });
    assert.equal(refreshed.amountCents, 434);
    const after = (await f.pg.pool.query('SELECT request_hash, request_json, pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [legacy.quoteId])).rows[0];
    assert.deepEqual(after, original, 'Requoting must not rewrite the historical request hash, references or price');
  });
  await t.test('accepted legacy work replays and refunds its original snapshot after a product rate change', async () => {
    f.setLegacyModelPricing(true);
    const legacy = await f.prepare({ video: f.video, audio: f.audio });
    try { await f.confirm(legacy); } finally { f.setLegacyModelPricing(false); }
    const original = (await f.pg.pool.query('SELECT request_hash, request_json, pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [legacy.quoteId])).rows[0];
    const [charge] = await f.receipts(legacy.quoteId);
    await f.setRecastMargin(1.5);
    try {
      assert.equal((await f.confirm(legacy)).jobId, legacy.quoteId);
      assert.equal(f.provider.calls(legacy.quoteId), 1);
      assert.notEqual((await f.prepare({ video: f.video, audio: f.audio })).amountCents, legacy.amountCents);
      await f.pg.pool.query("UPDATE app_jobs SET provider='alibaba_model_studio', status='running', updated_at=NOW()-INTERVAL '2 minutes' WHERE job_id=$1", [legacy.quoteId]);
      const failProvider = () => runAlibabaModelStudioPoll({ jobId: legacy.quoteId, deps: {
        claimPollFn: allowGenerationPoll,
        queryFn: async (sql, params) => /provider_attempts/.test(sql) ? [] : (await f.pg.pool.query(sql, params)).rows,
        getAlibabaModelStudioClientFn: () => ({ getTask: async () => ({ output: {
          task_id: `private-provider-${legacy.quoteId}`, task_status: 'FAILED', code: 'InvalidParameter',
          message: 'The provider could not complete this render.',
        } }) }),
      } });
      await failProvider();
      await failProvider();
      assert.deepEqual((await f.receipts(legacy.quoteId)).map((r) => [r.type, r.amount_cents, r.pricing_snapshot]), [
        ['charge', legacy.amountCents, charge.pricing_snapshot],
        ['refund', legacy.amountCents, charge.pricing_snapshot],
      ]);
      const after = (await f.pg.pool.query('SELECT request_hash, request_json, pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [legacy.quoteId])).rows[0];
      assert.deepEqual(after, original);
      assert.equal((await f.confirm(legacy)).jobId, legacy.quoteId);
      assert.equal(f.provider.calls(legacy.quoteId), 1);
    } finally { await f.setRecastMargin(1); }
  });
  await t.test(
    'funds disappearing after review roll back the job and receipt; topup allows the same quote',
    async () => {
      const q = await f.prepare();
      await f.pg.pool.query("DELETE FROM app_receipts WHERE user_id=$1 AND type='topup'", [f.actor.userId]);
      await assert.rejects(f.confirm(q), { code: 'INSUFFICIENT_FUNDS' });
      await empty(q.quoteId);
      await f.pg.pool.query(
        "INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',10000,'USD')",
        [f.actor.userId],
      );
      await f.confirm(q);
      assert.equal((await f.receipts(q.quoteId)).length, 1);
    },
  );
  await t.test(
    'concurrent double click and a lost response recover the original charge after expiration and a rate change',
    async () => {
      f.setPrepareNow(() => new Date(Date.now() - MCP_QUOTE_LIFETIME_SECONDS * 1000 + 1000));
      const q = await f.prepare({ video: f.video, audio: f.audio });
      f.setPrepareNow();
      const block = f.provider.block(q.quoteId);
      const first = f.confirm(q);
      await Promise.race([block.started, first.then(() => { throw new Error('The first submission must reach the blocked provider'); })]);
      const second = await f.confirm(q);
      block.signalRelease();
      await first;
      const [originalCharge] = await f.receipts(q.quoteId);
      await f.setRecastMargin(1.5);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, Date.parse(q.expiresAt) - Date.now() + 20)),
      );
      try {
        const recovered = await f.confirm(q);
        assert.equal(second.jobId, q.quoteId);
        assert.equal(recovered.jobId, q.quoteId);
        assert.equal(f.provider.calls(q.quoteId), 1);
        assert.deepEqual(await f.receipts(q.quoteId), [originalCharge]);
        assert.equal(originalCharge.amount_cents, 434);
        assert.equal(originalCharge.pricing_snapshot.meta.providerCostMultiplier, 2);
      } finally { await f.setRecastMargin(1); }
    },
  );
  await t.test('terminal provider rejection refunds exactly once', async () => {
    const q = await f.prepare();
    f.provider.plans.set(q.quoteId, 'reject');
    assert.equal((await f.confirm(q)).status, 'failed');
    await f.confirm(q);
    const receipts = await f.receipts(q.quoteId);
    assert.deepEqual(
      receipts.map((r) => [r.type, r.amount_cents]),
      [
        ['charge', q.amountCents],
        ['refund', q.amountCents],
      ],
    );
    assert.equal(f.provider.calls(q.quoteId), 1);
  });
  await t.test('unknown acceptance retains one charge, no refund and no blind provider retry', async () => {
    const q = await f.prepare();
    f.provider.plans.set(q.quoteId, 'ambiguous');
    await f.confirm(q);
    await f.confirm(q);
    assert.equal(f.provider.calls(q.quoteId), 1);
    assert.deepEqual(
      (await f.receipts(q.quoteId)).map((r) => r.type),
      ['charge'],
    );
    assert.equal(
      (await f.pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [q.quoteId]))
        .rows[0].state,
      'claimed',
    );
  });
  await t.test(
    'failed output copy retries storage for the existing provider job, without refund or resubmission',
    async () => {
      const q = await f.prepare({ video: f.video });
      await f.confirm(q);
      await f.pg.pool.query(
        "UPDATE app_jobs SET provider='alibaba_model_studio', status='running', updated_at=NOW()-INTERVAL '2 minutes' WHERE job_id=$1",
        [q.quoteId],
      );
      let copies = 0;
      let published = 0;
      const original = 'https://provider.example/result.mp4?signature=temporary';
      const stored = 'https://cdn.maxvideoai.com/recast-owned.mp4';
      const poll = () =>
        runAlibabaModelStudioPoll({
          jobId: q.quoteId,
          deps: {
            claimPollFn: allowGenerationPoll,
            queryFn: async (sql, params) =>
              /provider_attempts/.test(sql) ? [] : (await f.pg.pool.query(sql, params)).rows,
            getAlibabaModelStudioClientFn: () => ({
              getTask: async (id) => {
                assert.equal(id, `private-provider-${q.quoteId}`);
                return {
                  output: {
                    task_id: id,
                    task_status: 'SUCCEEDED',
                    video_url: original,
                  },
                };
              },
            }),
            ensureFastStartVideoFn: async (input) => {
              assert.equal(input.videoUrl, original);
              return ++copies === 1 ? null : stored;
            },
            detectVideoDimensionsFn: async () => ({ width: 720, height: 1280 }),
            ensureJobThumbnailFn: async () => null,
            upsertLegacyJobOutputsFn: async (input) => {
              assert.equal(input.video_url, stored);
              published++;
            },
            generateAndPersistJobPreviewVideoFn: async () => null,
            generateAndPersistJobKeyframesFn: async () => [],
          },
        });
      await poll();
      const job = (
        await f.pg.pool.query('SELECT status,video_url FROM app_jobs WHERE job_id=$1', [q.quoteId])
      ).rows[0];
      assert.equal(job.status, 'processing');
      assert.equal(job.video_url, null);
      assert.equal(published, 0);
      assert.deepEqual(
        (await f.receipts(q.quoteId)).map((r) => r.type),
        ['charge'],
      );
      // Move only the retry clock, leaving the owned job, quote and wallet intact.
      const clock = Date.now();
      const now = t.mock.method(Date, 'now', () => clock + 180000);
      try {
        await poll();
        await poll();
      } finally {
        now.mock.restore();
      }
      assert.equal(copies, 2);
      assert.equal(published, 1);
      assert.equal(f.provider.calls(q.quoteId), 1);
      assert.equal(
        (await f.pg.pool.query('SELECT status FROM app_jobs WHERE job_id=$1', [q.quoteId])).rows[0].status,
        'completed',
      );
      assert.deepEqual(
        (await f.receipts(q.quoteId)).map((r) => r.type),
        ['charge'],
      );
      assert.equal((await f.confirm(q)).jobId, q.quoteId);
    },
  );
});
