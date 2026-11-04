import assert from 'node:assert/strict';
import test from 'node:test';
import { recastHarness } from './helpers/character-recast-harness';
import { MCP_QUOTE_LIFETIME_SECONDS } from '../frontend/src/server/agent-api/quote-repository';
import { confirmRecast } from '../frontend/server/character-studio/recast';
import { runAlibabaModelStudioPoll } from '../frontend/server/alibaba-model-studio-poll';
import { allowGenerationPoll } from './helpers/generation-poll-claim';

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
  await t.test('expired quote and changed tariff revision debit nothing', async () => {
    f.setPrepareNow(() => new Date(Date.now() - (MCP_QUOTE_LIFETIME_SECONDS + 60) * 1000));
    const expired = await f.prepare();
    f.setPrepareNow();
    await assert.rejects(f.confirm(expired), { code: 'QUOTE_EXPIRED' });
    await empty(expired.quoteId);
    const stale = await f.prepare();
    await f.pg.pool.query('UPDATE app_customer_tariff_state SET revision=revision+1');
    await assert.rejects(f.confirm(stale), { code: 'QUOTE_EXPIRED' });
    await empty(stale.quoteId);
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
    'concurrent double click and a lost response recover the same job even after expiration',
    async () => {
      f.setPrepareNow(() => new Date(Date.now() - MCP_QUOTE_LIFETIME_SECONDS * 1000 + 1000));
      const q = await f.prepare({ video: f.video, audio: f.audio });
      f.setPrepareNow();
      const block = f.provider.block(q.quoteId);
      const first = f.confirm(q);
      await block.started;
      const second = await f.confirm(q);
      block.signalRelease();
      await first;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, Date.parse(q.expiresAt) - Date.now() + 20)),
      );
      const recovered = await f.confirm(q);
      assert.equal(second.jobId, q.quoteId);
      assert.equal(recovered.jobId, q.quoteId);
      assert.equal(f.provider.calls(q.quoteId), 1);
      assert.equal((await f.receipts(q.quoteId)).length, 1);
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
