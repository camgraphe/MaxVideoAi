import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareAudioGeneration } from '../frontend/src/server/agent-api/prepare-audio-generation';
import { confirmAudioGeneration } from '../frontend/src/server/agent-api/confirm-audio-generation';
import { buildAudioQuotePricingSnapshot } from '../frontend/src/server/agent-api/audio-quote-snapshot';
import { hashCanonicalAudioRequest, normalizeAudioGenerationRequest } from '../frontend/src/server/agent-api/audio-normalization';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';

const principal: AgentPrincipal = {
  userId: 'audio-user',
  clientId: 'audio-client',
  emailVerified: true,
  authMethod: 'oauth',
};

const request = {
  schemaVersion: 1 as const,
  surface: 'audio' as const,
  engineId: 'audio-sfx-only',
  mode: 'sfx_only' as const,
  prompt: 'A wooden door closes in a quiet room',
  settings: { durationSec: 8 },
  references: [],
  outputCount: 1 as const,
};

test('prepare_audio_generation returns an exact owned quote without charging or executing', async () => {
  let debitCalls = 0;
  let providerCalls = 0;
  const result = await prepareAudioGeneration(request, principal, {
    paidGenerationEnabled: () => true,
    getAccountRestriction: async () => null,
    listCapabilities: () => ({
      revision: 'audio-catalogue-v1',
      modes: [{
        mode: 'sfx_only', engineId: 'audio-sfx-only', available: true,
        variants: [{ settings: {}, available: true }],
      }],
    }) as never,
    resolveReference: async () => { throw new Error('unused'); },
    prepareRun: async () => ({
      normalized: {
        pack: 'sfx_only', prompt: request.prompt, durationSec: 8,
        mood: null, intensity: 'standard', script: null, lyrics: null,
        sourceVideoUrl: null, sourceJobId: null, voiceSampleUrl: null,
        voiceModel: null, minimaxVoiceId: null, voiceGender: null,
        voiceProfile: null, voiceDelivery: null, language: null,
        seedAudioVoice: null, seedAudioOutputFormat: null,
        seedAudioSampleRate: null, seedAudioSpeed: null,
        seedAudioVolume: null, seedAudioPitch: null, musicModel: null,
        musicBpm: null, musicEnabled: false, exportAudioFile: false,
        locale: null, voiceMode: null, outputKind: 'audio',
      },
      packConfig: {
        engineId: 'audio-sfx-only', billingProductKey: 'audio-sfx-only',
        label: 'SFX Only', description: 'fixture', includesVoice: false,
        audioOnly: true, requiresVideo: false, requiresMood: false,
        requiresScript: false, supportsMusicToggle: false,
        supportsAudioExport: false, defaultMusicEnabled: false,
      },
      sourceJob: null,
      sourceVideoUrl: null,
      sourceProbe: null,
      durationSec: 8,
      aspectRatio: null,
      pricingSnapshot: {
        totalCents: 45, currency: 'USD', platformFeeCents: 9,
        margin: { amountCents: 9 },
      },
      inputKey: 'prepared-input-key',
    }) as never,
    getWalletSummary: async () => ({
      balanceCents: 70, currency: 'USD', pendingCents: 0, hasCompletedTopUp: true,
    }),
    withTransaction: async callback => callback({ query: async () => [] } as never),
    checkSpendingLimits: async () => ({
      allowed: true, acceptedTodayCents: 0, projectedTodayCents: 45,
      limits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
    }),
    insertPreparedQuote: async input => ({
      ...input, quoteId: '00000000-0000-4000-8000-000000000071',
      state: 'prepared', jobId: null,
      expiresAt: new Date('2026-09-08T13:45:00.000Z'), claimedAt: null,
      createdAt: new Date('2026-09-08T13:00:00.000Z'),
      updatedAt: new Date('2026-09-08T13:00:00.000Z'), trialFunding: null,
    }) as never,
    debitWallet: async () => { debitCalls += 1; },
    executeRun: async () => { providerCalls += 1; },
    accountUrl: 'https://maxvideoai.com',
  } as never);

  assert.equal(result.quoteId, '00000000-0000-4000-8000-000000000071');
  assert.deepEqual(result.price, { amountCents: 45, currency: 'USD' });
  assert.deepEqual(result.balance, { beforeCents: 70, afterCents: 25 });
  assert.equal(result.topupRequired, false);
  assert.equal(result.confirmationRequired, true);
  assert.equal(debitCalls, 0);
  assert.equal(providerCalls, 0);
});

test('prepare_audio_generation requires an OAuth client-bound principal', async () => {
  for (const invalid of [null, { ...principal, clientId: null }, { ...principal, authMethod: 'session' }]) {
    await assert.rejects(
      prepareAudioGeneration(request, invalid as never, {} as never),
      (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error
        && (error as { code: unknown }).code === 'AUTH_REQUIRED'),
    );
  }
});

test('confirm_audio_generation accepts only the exact explicit approval shape', async () => {
  const quoteId = '00000000-0000-4000-8000-000000000072';
  const symbolInput = { quoteId, confirmed: true, [Symbol('hidden')]: 'unexpected' };
  for (const invalid of [
    { quoteId, confirmed: false },
    { quoteId, confirmed: true, retry: true },
    symbolInput,
  ]) {
    await assert.rejects(
      confirmAudioGeneration(invalid as never, principal, {} as never),
      (error: unknown) => (error as { code?: string }).code === 'PARAMETER_INVALID',
    );
  }
});

test('confirm_audio_generation reserves once, executes outside the transaction, and replays stored status', async () => {
  const canonical = normalizeAudioGenerationRequest(request);
  const prepared = {
    normalized: {
      pack: 'sfx_only', prompt: request.prompt, durationSec: 8,
      mood: null, intensity: 'standard', script: null, lyrics: null,
      sourceVideoUrl: null, sourceJobId: null, voiceSampleUrl: null,
      voiceModel: null, minimaxVoiceId: null, voiceGender: null,
      voiceProfile: null, voiceDelivery: null, language: null,
      seedAudioVoice: null, seedAudioOutputFormat: null,
      seedAudioSampleRate: null, seedAudioSpeed: null,
      seedAudioVolume: null, seedAudioPitch: null, musicModel: null,
      musicBpm: null, musicEnabled: false, exportAudioFile: false,
      locale: null, voiceMode: null, outputKind: 'audio',
    },
    packConfig: {
      engineId: 'audio-sfx-only', billingProductKey: 'audio-sfx-only',
      label: 'SFX Only', description: 'fixture', includesVoice: false,
      audioOnly: true, requiresVideo: false, requiresMood: false,
      requiresScript: false, supportsMusicToggle: false,
      supportsAudioExport: false, defaultMusicEnabled: false,
    },
    sourceJob: null, sourceVideoUrl: null, sourceProbe: null,
    durationSec: 8, aspectRatio: null,
    pricingSnapshot: {
      totalCents: 45, currency: 'USD', subtotalBeforeDiscountCents: 36,
      base: { seconds: 8, rate: 0.1, unit: 'second', amountCents: 1 },
      addons: [], margin: { amountCents: 9 }, platformFeeCents: 9,
    },
    inputKey: 'prepared-input-key',
  } as never;
  const pricingSnapshot = buildAudioQuotePricingSnapshot({
    requestHash: hashCanonicalAudioRequest(canonical), references: [], prepared,
  });
  const quote = {
    quoteId: '00000000-0000-4000-8000-000000000072',
    userId: principal.userId, oauthClientId: principal.clientId,
    request: canonical, requestHash: hashCanonicalAudioRequest(canonical),
    catalogRevision: 'audio-catalogue-v1', pricingSnapshot,
    priceCents: 45, currency: 'USD', fundingMode: 'wallet' as const,
    trialFunding: null, state: 'prepared' as const, jobId: null,
    expiresAt: new Date('2026-09-08T13:45:00.000Z'), claimedAt: null,
    createdAt: new Date('2026-09-08T13:00:00.000Z'),
    updatedAt: new Date('2026-09-08T13:00:00.000Z'),
  };
  let state: 'prepared' | 'claimed' | 'accepted' = 'prepared';
  let jobId: string | null = null;
  let transactionActive = false;
  let reservations = 0;
  let executions = 0;
  let failAcceptedMutation = false;
  let failedMarks = 0;
  const status = () => ({
    jobId: jobId!, surface: 'audio' as const, status: 'completed' as const,
    progress: 100, message: 'Audio render complete.', priceCents: 45,
    currency: 'USD', paymentStatus: 'paid_wallet', retryAfterSeconds: null,
  });
  const dependencies = {
    paidGenerationEnabled: () => true,
    withTransaction: async (callback: (executor: never) => Promise<unknown>) => {
      transactionActive = true;
      try { return await callback({ query: async () => [] } as never); }
      finally { transactionActive = false; }
    },
    lockOwnedQuote: async () => ({
      quote: { ...quote, state, jobId, claimedAt: state === 'prepared' ? null : new Date('2026-09-08T13:01:00.000Z') },
      databaseNow: new Date('2026-09-08T13:01:00.000Z'),
    }),
    markQuoteExpired: async () => null,
    getAccountRestriction: async () => null,
    listCapabilities: () => ({
      revision: 'audio-catalogue-v1',
      modes: [{ mode: 'sfx_only', engineId: 'audio-sfx-only', available: true, variants: [{ settings: {}, available: true }] }],
    }),
    resolveReference: async () => { throw new Error('unused'); },
    priceCurrentRun: async (_request: never, _evidence: never, _references: never, context: { userId: string }) => {
      assert.equal(context.userId, principal.userId);
      return prepared;
    },
    checkSpendingLimits: async () => ({ allowed: true }),
    buildReservation: (currentPrepared: never, userId: string) => ({
      initialJob: { jobId: 'aud_fixture_job', userId },
      execution: { jobId: 'aud_fixture_job', userId, prepared: currentPrepared },
    }),
    reserveInitialJob: async () => {
      assert.equal(transactionActive, true);
      reservations += 1;
    },
    claimPreparedQuote: async (input: { jobId: string }) => {
      state = 'claimed'; jobId = input.jobId;
      return { ...quote, state, jobId, claimedAt: new Date('2026-09-08T13:01:00.000Z') };
    },
    executeRun: async () => {
      assert.equal(transactionActive, false);
      executions += 1;
      return { ok: true, jobId, status: 'completed' };
    },
    markQuoteAccepted: async () => {
      if (failAcceptedMutation) throw new Error('accepted mutation unavailable');
      state = 'accepted'; return { ...quote, state, jobId };
    },
    markQuoteFailed: async () => { failedMarks += 1; return null; },
    readAudioStatus: async () => status(),
    accountUrl: 'https://maxvideoai.com',
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
  } as never;

  const first = await confirmAudioGeneration({ quoteId: quote.quoteId, confirmed: true }, principal, dependencies);
  const replay = await confirmAudioGeneration({ quoteId: quote.quoteId, confirmed: true }, principal, dependencies);
  assert.equal(first.jobId, replay.jobId);
  assert.equal(first.status, 'completed');
  assert.equal(reservations, 1);
  assert.equal(executions, 1);

  state = 'prepared';
  jobId = null;
  failAcceptedMutation = true;
  const completedDespiteQuoteMutation = await confirmAudioGeneration(
    { quoteId: quote.quoteId, confirmed: true }, principal, dependencies,
  );
  assert.equal(completedDespiteQuoteMutation.status, 'completed');
  assert.equal(failedMarks, 0);
});
