import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareAudioRun } from '../frontend/src/server/audio/prepare-audio';
import { buildAudioRunReservation } from '../frontend/src/server/audio/audio-run-reservation';
import { audioDispatchExecutionHash } from '../frontend/src/server/audio/dispatch-integrity';
import { runAudioGenerationWorkerOnce, type AudioGenerationWorkerDependencies } from '../frontend/src/server/audio/dispatch-worker';
import type { AudioDispatchRecord, AudioDispatchJob } from '../frontend/src/server/audio/dispatch-repository';
import { normalizeAudioGenerationRequest, audioRequestToGenerationBody, hashCanonicalAudioRequest } from '../frontend/src/server/agent-api/audio-normalization';
import { buildAudioQuotePricingSnapshot, type ResolvedAudioReference } from '../frontend/src/server/agent-api/audio-quote-snapshot';
import type { McpGenerationQuote } from '../frontend/src/server/agent-api/quote-repository';

async function fixture(withReference = false) {
  const reference: ResolvedAudioReference = { role: 'voice_sample',
    asset: { type: 'asset', assetId: 'voice-reference-1', kind: 'audio' },
    originalUrl: 'https://media.maxvideoai.com/original-sample.mp3', mimeType: 'audio/mpeg',
    durationSec: 4, width: null, height: null, sizeBytes: 1000 };
  const request = normalizeAudioGenerationRequest(withReference ? {
    schemaVersion: 1, surface: 'audio', engineId: 'audio-voice-only', mode: 'voice_only', prompt: '',
    settings: { script: 'The quick brown fox jumps over the lazy dog.', voiceModel: 'seed' },
    references: [{ role: reference.role, asset: reference.asset }], outputCount: 1,
  } : { schemaVersion: 1, surface: 'audio', engineId: 'audio-sfx-only', mode: 'sfx_only', prompt: 'Quiet wooden door closing',
    settings: { durationSec: 8 }, references: [], outputCount: 1 });
  const references = withReference ? [reference] : [];
  const prepared = await prepareAudioRun(audioRequestToGenerationBody(request, withReference ? { voiceSampleUrl: reference.originalUrl } : {}), 'dispatch-user', {
    env: { FAL_KEY: 'fixture' }, pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }) },
  });
  const reservation = buildAudioRunReservation(prepared, 'dispatch-user');
  const requestHash = hashCanonicalAudioRequest(request);
  const quote: McpGenerationQuote<typeof request> = {
    quoteId: '00000000-0000-4000-8000-000000000001', userId: 'dispatch-user', oauthClientId: 'dispatch-client',
    authOrigin: 'oauth', studioProjectId: null, request, requestHash, catalogRevision: 'fixture-revision',
    pricingSnapshot: buildAudioQuotePricingSnapshot({ requestHash, references, prepared }),
    priceCents: prepared.pricingSnapshot.totalCents, currency: prepared.pricingSnapshot.currency, fundingMode: 'wallet', trialFunding: null,
    state: 'claimed', jobId: reservation.execution.jobId, expiresAt: new Date(), claimedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  };
  const execution = JSON.parse(JSON.stringify(reservation.execution));
  const record: AudioDispatchRecord = { quoteId: quote.quoteId, jobId: reservation.execution.jobId, userId: quote.userId,
    oauthClientId: quote.oauthClientId, authOrigin: 'oauth', studioProjectId: null, requestHash,
    execution, executionHash: audioDispatchExecutionHash(execution), state: 'processing',
    claimId: '00000000-0000-4000-8000-000000000002', observedAt: '2026-11-12T10:00:00.000Z' };
  const job: AudioDispatchJob = { jobId: record.jobId, userId: record.userId, status: 'pending', paymentStatus: 'paid_wallet',
    priceCents: quote.priceCents, currency: quote.currency, engineId: request.engineId,
    billingProductKey: prepared.packConfig.billingProductKey, pricingSnapshot: prepared.pricingSnapshot };
  let providerCalls = 0, refundedCents = 0, promoted = false, claimed = false;
  const dependencies: AudioGenerationWorkerDependencies = {
    claim: async () => { if (claimed) return null; claimed = true; return record; },
    loadContext: async () => ({ quote, job }), readJob: async () => job,
    getAccountRestriction: async () => null, assertProviderConfigured: () => undefined,
    resolveReference: async () => reference,
    executeRun: async () => { providerCalls++; job.status = 'completed'; },
    failJob: async () => { if (job.status !== 'pending') return false; job.status = 'failed'; return true; },
    refundCharge: async () => {
      if (job.paymentStatus !== 'refunded_wallet') refundedCents += job.priceCents;
      job.paymentStatus = 'refunded_wallet'; return { receiptId: 'refund-1', created: true };
    },
    markQuoteAccepted: async () => { quote.state = 'accepted'; }, markQuoteFailed: async () => { quote.state = 'failed'; },
    promoteOutputs: async () => { promoted = true; },
    settle: async (_record, state) => { record.state = state; },
  };
  return { quote, job, record, dependencies, execution, run: () => runAudioGenerationWorkerOnce(dependencies),
    totals: () => ({ providerCalls, refundedCents, promoted }) };
}

test('worker rejects corrupt execution, canonical request, input key and price snapshots before provider calls', async () => {
  const mutations: Array<(item: Awaited<ReturnType<typeof fixture>>) => void> = [
    item => { item.record.executionHash = '0'.repeat(64); },
    item => { item.execution.prepared.normalized.prompt = 'Different provider prompt'; },
    item => { item.execution.prepared.inputKey = 'another-input-key'; },
    item => { item.execution.prepared.pricingSnapshot.totalCents += 1; },
    item => { item.execution.pricingSnapshotJson = '{}'; },
    item => { item.execution.initialSettingsSnapshot.prompt = 'Hidden modified prompt'; },
    item => { item.quote.request.prompt = 'Changed canonical request'; },
    item => { item.quote.pricingSnapshot.mcpAudio = {}; },
    item => { item.record.quoteId = '00000000-0000-4000-8000-000000000999'; },
  ];
  for (const mutate of mutations) {
    const item = await fixture();
    mutate(item);
    // Even tampering that recomputes the payload checksum must fail its quote binding.
    if (item.record.executionHash !== '0'.repeat(64)) item.record.executionHash = audioDispatchExecutionHash(item.execution);
    await item.run();
    assert.equal(item.totals().providerCalls, 0);
    assert.equal(item.record.state, 'failed');
    assert.equal(item.totals().refundedCents, item.quote.priceCents);
    assert.equal(item.quote.state, 'failed');
  }
});

test('deleted or changed owned reference evidence prevents dispatch and refunds exactly once', async () => {
  for (const missing of [false, true]) {
    const item = await fixture(true);
    item.dependencies.resolveReference = async () => {
      if (missing) throw new Error('Private source deleted');
      return { ...(item.quote.pricingSnapshot.mcpAudio as { references: ResolvedAudioReference[] }).references[0],
        originalUrl: 'https://media.maxvideoai.com/replaced.mp3' };
    };
    await Promise.all([item.run(), item.run()]);
    assert.equal(item.totals().providerCalls, 0);
    assert.equal(item.record.state, 'failed');
    assert.equal(item.totals().refundedCents, item.quote.priceCents);
  }
});

test('publication closure does not cancel accepted work', async () => {
  const previous = process.env.MCP_AUDIO_EXTENDED_ENABLED;
  process.env.MCP_AUDIO_EXTENDED_ENABLED = 'false';
  try {
    const item = await fixture();
    await item.run();
    assert.equal(item.record.state, 'completed');
    assert.deepEqual(item.totals(), { providerCalls: 1, refundedCents: 0, promoted: true });
  } finally { if (previous === undefined) delete process.env.MCP_AUDIO_EXTENDED_ENABLED; else process.env.MCP_AUDIO_EXTENDED_ENABLED = previous; }
});

test('status or queue persistence outage after provider execution cannot trigger a second execution or refund', async () => {
  for (const mode of ['status', 'settle']) {
    const item = await fixture();
    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args) => { warnings.push(args); };
    if (mode === 'status') item.dependencies.readJob = async () => { throw new Error('https://private.invalid/secret'); };
    item.dependencies.settle = async () => { throw new Error('private execution message'); };
    try {
      await item.run(); await item.run();
      assert.equal(item.record.state, 'processing');
      assert.equal(item.job.status, 'completed');
      assert.equal(item.totals().providerCalls, 1);
      assert.equal(item.totals().refundedCents, 0);
      assert.doesNotMatch(JSON.stringify(warnings), /private\.invalid|private execution message|secret/);
    } finally { console.warn = originalWarn; }
  }
});
