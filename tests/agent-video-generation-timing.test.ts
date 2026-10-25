import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import {
  reservePaidGenerationInitialJob,
  reserveIncludedTrialGenerationInitialJob,
  submitReservedPaidGeneration,
  submitReservedIncludedTrialGeneration,
  type ReservePaidGenerationInput,
} from '../frontend/src/server/agent-api/paid-generation-execution';
import type { McpGenerationQuote } from '../frontend/src/server/agent-api/quote-repository';

function input(trial = false, studio = false): ReservePaidGenerationInput {
  const entry = getFalEngineById(trial ? 'seedance-2-0-mini' : 'wan-3-prime');
  assert.ok(entry);
  const pricing = { totalCents: 125, currency: 'USD', membershipTier: 'member', base: { amountCents: 55 }, platformRevenueCents: 70 };
  const pricingSnapshot = {
    canonicalPricing: pricing,
    ...(trial ? { funding: { kind: 'included_trial', customerChargeCents: 0, normalPriceCents: 125, providerCostCents: 18 } } : {}),
  };
  const now = new Date('2026-10-25T15:00:00Z');
  const quote: McpGenerationQuote = {
    quoteId: '123e4567-e89b-42d3-a456-426614174000', userId: 'timing-user', oauthClientId: 'timing-client',
    authOrigin: studio ? 'studio-session' : 'oauth',
    request: {
      schemaVersion: 1, surface: 'video', engineId: entry.id, mode: trial ? 't2v' : 'v2v',
      prompt: 'Keep the source performance.',
      settings: { durationSec: trial ? 5 : 8, resolution: '480p', aspectRatio: '16:9', audio: true },
      references: trial ? [] : [{ kind: 'https', mediaKind: 'video', role: 'source', url: 'https://media.example.test/source.mp4' }],
      outputCount: 1,
    },
    requestHash: 'fixture', catalogRevision: 'fixture', pricingSnapshot,
    priceCents: trial ? 0 : 125, currency: 'USD', fundingMode: trial ? 'trial' : 'wallet',
    ...(trial ? { trialFunding: { kind: 'included_trial', customerChargeCents: 0, normalPriceCents: 125, providerCostCents: 18 } as const } : {}),
    state: 'prepared', jobId: null, expiresAt: now, claimedAt: null, createdAt: now, updatedAt: now,
  };
  return { quote, candidate: { engine: entry.engine, surface: 'video', publicModes: [quote.request.mode], modeCaps: {} }, pricingSnapshot };
}

function database(fixture: ReservePaidGenerationInput, observations = true) {
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const executor = {
    async query(sql: string, params?: ReadonlyArray<unknown>) {
      calls.push({ sql, params });
      if (/FROM generation_timing_samples/.test(sql)) {
        if (!observations) return [];
        const row = { engine_id: fixture.quote.request.engineId, sample_count: 10, recent_count: 10, stddev_ms: 0, recent_stddev_ms: 0 };
        return [
          { ...row, mode: null, duration_sec: null, resolution: null, avg_ms: 300_000, recent_avg_ms: 300_000 },
          { ...row, mode: fixture.quote.request.mode, duration_sec: fixture.quote.request.settings.durationSec,
            resolution: '480p', avg_ms: 95_000, recent_avg_ms: 95_000 },
        ];
      }
      // A previously reserved, matching charge avoids exercising wallet SQL here.
      if (/FROM app_receipts/.test(sql) && /type = 'charge'/.test(sql)) {
        return [{ id: 1, user_id: fixture.quote.userId, amount_cents: 125, currency: 'USD', surface: 'video', billing_product_key: null }];
      }
      return [];
    },
  } as TransactionQueryExecutor;
  return { executor, calls };
}

function insertedTiming(calls: ReturnType<typeof database>['calls']) {
  const insert = calls.find(({ sql }) => /INSERT INTO app_jobs/.test(sql));
  assert.ok(insert, 'the reserved job must be persisted');
  return { etaSeconds: insert.params?.[21], etaLabel: insert.params?.[22] };
}

for (const studio of [false, true]) {
  test(`${studio ? 'Studio' : 'MCP'} paid video persists its matching estimate and preserves it through provider request parsing`, async () => {
    const fixture = input(false, studio);
    const db = database(fixture);
    const reservation = await reservePaidGenerationInitialJob(fixture, { executor: db.executor });
    assert.deepEqual(insertedTiming(db.calls), { etaSeconds: 95, etaLabel: '≈ 1 min 35s' });
    const reads = db.calls.length;
    let submissions = 0;
    const outcome = await submitReservedPaidGeneration(reservation.execution, {
      async executeVideo(options) {
        submissions += 1;
        const parsed = buildGenerateRequestOptions({ body: options.body, engine: options.engine, mode: 'v2v', isBytePlusV1a: false });
        assert.equal(parsed.ok, true);
        if (!parsed.ok) assert.fail('valid video continuation');
        assert.equal(parsed.options.etaSeconds, 95);
        assert.equal(parsed.options.etaLabel, '≈ 1 min 35s');
        assert.equal(options.preReservedInitialState.jobId, fixture.quote.quoteId);
        return { body: { ok: true, status: 'pending' } };
      },
      async executeImage() { assert.fail('video must not invoke image generation'); },
    });
    assert.deepEqual(outcome, { kind: 'accepted' });
    assert.equal(submissions, 1);
    assert.equal(db.calls.length, reads, 'the running estimate stays fixed');
  });
}

test('included trial video persists and submits its estimate without creating a charge', async () => {
  const fixture = input(true);
  const db = database(fixture);
  const reservation = await reserveIncludedTrialGenerationInitialJob(fixture, { executor: db.executor });
  assert.deepEqual(insertedTiming(db.calls), { etaSeconds: 95, etaLabel: '≈ 1 min 35s' });
  assert.equal(db.calls.some(({ sql }) => /INSERT INTO app_receipts/.test(sql)), false);
  const outcome = await submitReservedIncludedTrialGeneration(reservation.execution, {
    async executeVideo(options) {
      assert.equal(options.body.etaSeconds, 95);
      assert.equal(options.body.etaLabel, '≈ 1 min 35s');
      assert.equal(options.body.payment, undefined);
      return { body: { ok: true, status: 'pending' } };
    },
    async executeImage() { assert.fail('trial must remain video-only'); },
  });
  assert.deepEqual(outcome, { kind: 'accepted' });
});

test('a video without observations still receives the existing approximate fallback', async () => {
  const fixture = input();
  const db = database(fixture, false);
  await reservePaidGenerationInitialJob(fixture, { executor: db.executor });
  assert.deepEqual(insertedTiming(db.calls), { etaSeconds: 28, etaLabel: '≈ 28s' });
});
