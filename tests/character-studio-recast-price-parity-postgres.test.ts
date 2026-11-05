import assert from 'node:assert/strict';
import test from 'node:test';
import { recastHarness } from './helpers/character-recast-harness';
import { readRecastPublicPrice } from '../frontend/server/character-studio/recast-public-price';

test('Recast price, measured passages, reservation and receipt agree across all modes, sizes and lengths', async (t) => {
  const f = await recastHarness(t);
  for (const mode of ['i2v', 'ref2v', 'v2v'] as const) {
    for (const resolution of ['480p', '720p', '1080p'])
      for (const seconds of [2, 8, 15]) {
        await t.test(`${mode}/${resolution}/${seconds}s`, async () => {
          const quote = await f.prepare({
            resolution,
            seconds,
            ...(mode === 'ref2v'
              ? { audio: f.audio }
              : mode === 'v2v'
                ? { video: f.video, audio: f.audio }
                : {}),
          });
          const estimate = await readRecastPublicPrice({
            modelId: 'wan-3-prime',
            mode,
            resolution,
            durationSec: seconds,
            aspectRatio: '9:16',
            audio: mode !== 'i2v',
            ...(mode !== 'i2v' ? { inputVideoDurationSec: mode === 'v2v' ? 7.5 : 0 } : {}),
          });
          assert.equal(estimate.status, 'exact');
          if (estimate.status !== 'exact') throw new Error('Missing current price');
          const providerCentsPerSecond = { '480p': 6.8, '720p': 14, '1080p': 28 }[resolution]!;
          const providerCents = Math.round(providerCentsPerSecond * (seconds + (mode === 'v2v' ? 7.5 : 0)) * 1000) / 1000;
          // Standard policy preserves supplier cents, rounds margin upward, then total to nearest cent.
          assert.equal(quote.amountCents, Math.round(providerCents + Math.ceil(providerCents)));
          assert.equal(quote.amountCents, estimate.amountCents);
          assert.equal(quote.sourceSeconds, mode === 'v2v' ? 7.5 : 0);
          assert.equal(quote.audioSeconds, mode === 'i2v' ? 0 : 5.25);
          const stored = (await f.pg.pool.query(
            'SELECT pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [quote.quoteId],
          )).rows[0].pricing_snapshot.canonicalPricing;
          assert.equal(stored.meta.customerProduct, 'character-recast');
          assert.equal(stored.meta.providerCostMultiplier, 2);
          assert.equal(stored.meta.providerCostExactCents, providerCents);
          assert.equal(stored.meta.customerTariffRevision, undefined);
          assert.equal(stored.meta.ruleId, 'recast-test-policy');
          assert.equal(stored.meta.billable_duration_sec, seconds + (mode === 'v2v' ? 7.5 : 0));
          await f.confirm(quote);
          const [receipt] = await f.receipts(quote.quoteId);
          assert.equal(receipt.amount_cents, estimate.amountCents);
          assert.equal(receipt.pricing_snapshot.totalCents, estimate.amountCents);
          assert.deepEqual(receipt.pricing_snapshot, stored);
          const job = (await f.pg.pool.query(
            'SELECT final_price_cents, pricing_snapshot FROM app_jobs WHERE job_id=$1', [quote.quoteId],
          )).rows[0];
          assert.equal(job.final_price_cents, estimate.amountCents);
          assert.deepEqual(job.pricing_snapshot, stored);
          assert.equal(f.provider.calls(quote.quoteId), 1);
        });
      }
  }
  for (const aspectRatio of ['auto', '9:16', '16:9', '1:1', '3:4', '4:3']) {
    await t.test(`format ${aspectRatio}`, async () => {
      const quote = await f.prepare({ aspectRatio, video: f.video });
      await f.confirm(quote);
      assert.equal(f.provider.captures.at(-1)!.body.aspectRatio, aspectRatio);
    });
  }
  await t.test('15s source + 15s output accepted; 15 + 16 rejected without a charge', async () => {
    const video = { ...f.video, range: { startSec: 5, endSec: 20 } };
    const quote = await f.prepare({ video, seconds: 15 });
    assert.equal(quote.sourceSeconds, 15);
    await f.confirm(quote);
    const before = f.provider.captures.length;
    await assert.rejects(f.prepare({ video, seconds: 16 }));
    assert.equal(f.provider.captures.length, before);
  });
  for (const mode of ['ref2v', 'v2v'])
    await t.test(`${mode} preserves character then product, regardless of lexical asset order`, async () => {
      const quote = await f.prepare({
        product: f.id(1),
        ...(mode === 'v2v' ? { video: f.video } : {}),
      });
      await f.confirm(quote);
      const body = f.provider.captures.at(-1)!.body;
      const serialized = JSON.stringify(body);
      assert.ok(serialized.indexOf('/9.png') < serialized.indexOf('/1.png'), serialized);
      assert.match(String(body.prompt), /image 1.*character/i);
      assert.match(String(body.prompt), /image 2.*product/i);
    });
});
