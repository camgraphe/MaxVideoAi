import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const servicePath = join(root, 'frontend/src/server/video-generation/execute-video-generation.ts');
const adaptersPath = join(root, 'frontend/app/api/generate/_lib/video-generation-adapters.ts');

test('video generation has a thin HTTP adapter and an injected server orchestration owner', () => {
  assert.equal(existsSync(servicePath), true, 'video execution service should exist');
  assert.equal(existsSync(adaptersPath), true, 'route-local provider adapters should exist');
  const route = readFileSync(routePath, 'utf8');
  const service = readFileSync(servicePath, 'utf8');
  const adapters = readFileSync(adaptersPath, 'utf8');

  assert.match(route, /executeVideoGeneration/);
  assert.match(route, /videoGenerationAdapters/);
  assert.match(route, /walletReservation:\s*'reserve'/);
  assert.doesNotMatch(route, /createAtomicInitialVideoJob|reserveWalletChargeInExecutor|withDbTransaction/);
  assert.doesNotMatch(route, /submitBytePlusGenerateTask|submitGenerateProviderTask|resolveProviderMediaState/);
  assert.ok(route.split('\n').length < 250, `video route must stay below 250 lines, got ${route.split('\n').length}`);

  assert.match(service, /export type ExecuteVideoGenerationOptions/);
  assert.match(service, /walletReservation: WalletReservation/);
  assert.match(service, /export async function executeVideoGeneration/);
  const prepared = readFileSync(join(root, 'frontend/src/server/video-generation/execute-prepared-video-generation.ts'), 'utf8');
  assert.match(prepared, /adapters\.submitBytePlusGenerateTask/);
  assert.match(prepared, /adapters\.submitGenerateProviderTask/);
  assert.match(prepared, /adapters\.resolveProviderMediaState/);
  assert.match(prepared, /createAtomicInitialVideoJob/);
  assert.match(prepared, /persistWalletFailureRefundReceipt/);
  assert.match(prepared, /rollbackPendingPayment/);
  assert.match(prepared, /buildFinalGenerateResponse/);
  assert.match(prepared, /trustedInitialState:\s*params\.preReservedInitialState/);
  assert.match(adapters, /satisfies VideoGenerationAdapters/);
  assert.ok(service.split('\n').length < 500, `video preparation owner must stay below 500 lines`);
  assert.ok(prepared.split('\n').length < 500, `prepared execution owner must stay below 500 lines`);
  assert.doesNotMatch(service, /createAtomicInitialVideoJob|submitGenerateProviderTask|persistFinalVideoJobUpdate/);
  assert.doesNotMatch(prepared, /NextRequest|NextResponse|processGenerationAttachments|resolveGenerateBillingPreflight/);
});

test('pre-reserved video execution skips a second reservation and submits once after caller commit', async () => {
  const { executePreparedVideoGeneration } = await import('../frontend/src/server/video-generation/execute-prepared-video-generation');
  let transactionOpen = true;
  let providerCalls = 0;
  transactionOpen = false;

  const result = await executePreparedVideoGeneration({
    body: {},
    routeContext: {
      engine: { id: 'test-video', label: 'Test Video', upscale4k: false },
      isBytePlusV1a: false,
      jobId: 'job-pre-reserved',
      mode: 't2v',
      payment: { mode: 'wallet' },
      providerKey: 'fal',
      providerRoutingPlan: {
        kind: 'fal_only',
        primaryProvider: 'fal',
        fallbackEnabled: false,
      },
    } as never,
    requestOptions: {
      prompt: 'private prompt',
      audioEnabled: false,
      aspectRatio: '16:9',
      batchId: null,
      groupId: null,
      iterationIndex: null,
      iterationCount: null,
      renderIds: null,
      heroRenderId: null,
      etaSeconds: null,
      etaLabel: null,
      isLumaRay2: false,
      loop: false,
      effectiveResolution: '720p',
      message: null,
    } as never,
    userId: 'user-1',
    localKey: null,
    requestStartedAt: Date.now(),
    logMetric: () => undefined,
    walletReservation: 'already_reserved',
    preReservedInitialState: {
      kind: 'created',
      jobId: 'job-pre-reserved',
      walletChargeReserved: true,
    },
    adapters: {
      async submitGenerateProviderTask() {
        assert.equal(transactionOpen, false);
        providerCalls += 1;
        return {
          kind: 'accepted_response',
          body: { ok: true, status: 'pending' },
        };
      },
      async submitBytePlusGenerateTask() {
        throw new Error('unexpected BytePlus submission');
      },
      buildInitialProviderMediaState() {
        throw new Error('unexpected direct completion');
      },
      async resolveProviderMediaState() {
        throw new Error('unexpected media resolution');
      },
      async buildMissingProviderJobIdResponse() {
        throw new Error('unexpected missing provider id');
      },
    } as never,
    billing: {
      preferredCurrency: 'usd',
      resolvedCurrencyLower: 'usd',
      resolvedCurrencyUpper: 'USD',
      pricing: { totalCents: 100, currency: 'USD' },
      priceOnlyReceipts: true,
      costBreakdownUsd: null,
      receiptSnapshot: {},
      pricingSnapshotJson: '{}',
      costBreakdownJson: null,
      vendorAccountId: null,
      applicationFeeCents: 0,
      visibility: 'private',
      indexable: false,
      paymentMode: 'wallet',
      pendingReceipt: null,
      paymentStatus: 'paid_wallet',
      stripePaymentIntentId: null,
      stripeChargeId: null,
    } as never,
    effectiveDurationSec: 5,
    effectiveDurationLabel: '5s',
    initialImageUrl: null,
    resolvedFirstFrameUrl: null,
    endImageUrl: null,
    normalizedReferenceImages: [],
    videoUrls: [],
    resolvedAudioUrl: null,
    audioUrls: [],
    placeholderThumb: '/thumb.svg',
    falPayload: {} as never,
    falInputSummary: {} as never,
    settingsSnapshot: {},
  });
  assert.deepEqual(result, { body: { ok: true, status: 'pending' } });
  assert.equal(providerCalls, 1);
});

test('walletReservation is not controllable from video HTTP or agent/MCP request input', () => {
  const route = readFileSync(routePath, 'utf8');
  assert.doesNotMatch(route, /body(?:\?|\.)walletReservation|body\[['"]walletReservation['"]\]/);

  const agentTypes = readFileSync(join(root, 'frontend/src/server/agent-api/generation-types.ts'), 'utf8');
  assert.doesNotMatch(agentTypes, /walletReservation/);
  const toolDirectory = join(root, 'frontend/src/server/mcp/tools');
  for (const file of readdirSync(toolDirectory).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(join(toolDirectory, file), 'utf8');
    assert.doesNotMatch(source, /video-providers|fal-client|provider-client|byteplus-modelark/, `${file} must not import provider owners`);
  }
});

test('shared P6 execution constraints remain the canonical validation owner', () => {
  const constraintsPath = join(root, 'frontend/src/server/video-generation/execution-constraints.ts');
  const validatePath = join(root, 'frontend/app/api/generate/_lib/validate.ts');
  assert.equal(existsSync(constraintsPath), true);
  const validate = readFileSync(validatePath, 'utf8');
  assert.match(validate, /server\/video-generation\/execution-constraints/);
  assert.doesNotMatch(readFileSync(routePath, 'utf8'), /function validateProviderSpecificConstraints|function validateProviderControls/);
});

test('video lifecycle adapters preserve existing, async, direct, and error response parity after reservation', async () => {
  const { executeVideoGenerationLifecycle } = await import('../frontend/src/server/video-generation/execute-video-generation');

  let providerCalls = 0;
  const existing = await executeVideoGenerationLifecycle({
    reserveInitialState: async () => ({
      kind: 'existing_job' as const,
      job: { job_id: 'existing-1' },
    }),
    mapExisting: (job: { job_id: string }) => ({
      body: { ok: true, jobId: job.job_id },
    }),
    submitProvider: async () => {
      providerCalls += 1;
      return { kind: 'accepted_response' as const, body: { ok: true } };
    },
    completeDirect: async () => ({ body: { ok: true } }),
    onReservationError: async () => ({ body: { ok: false }, status: 500 }),
  });
  assert.deepEqual(existing, { body: { ok: true, jobId: 'existing-1' } });
  assert.equal(providerCalls, 0);

  let transactionOpen = false;
  const accepted = await executeVideoGenerationLifecycle({
    reserveInitialState: async () => {
      transactionOpen = true;
      await Promise.resolve();
      transactionOpen = false;
      return { kind: 'created' as const, walletChargeReserved: true };
    },
    mapExisting: () => ({ body: { ok: true } }),
    submitProvider: async () => {
      assert.equal(transactionOpen, false, 'provider must run after the transaction promise resolves');
      return {
        kind: 'accepted_response' as const,
        body: { ok: true, status: 'pending' },
      };
    },
    completeDirect: async () => ({ body: { ok: false } }),
    onReservationError: async () => ({ body: { ok: false }, status: 500 }),
  });
  assert.deepEqual(accepted, { body: { ok: true, status: 'pending' } });

  let completedCalls = 0;
  const completed = await executeVideoGenerationLifecycle({
    reserveInitialState: async () => ({
      kind: 'created' as const,
      walletChargeReserved: true,
    }),
    mapExisting: () => ({ body: { ok: true } }),
    submitProvider: async () => ({
      kind: 'generation_result' as const,
      generationResult: { id: 'direct-1' },
    }),
    completeDirect: async (generationResult: { id: string }) => {
      completedCalls += 1;
      return { body: { ok: true, providerJobId: generationResult.id } };
    },
    onReservationError: async () => ({ body: { ok: false }, status: 500 }),
  });
  assert.equal(completedCalls, 1);
  assert.deepEqual(completed, {
    body: { ok: true, providerJobId: 'direct-1' },
  });

  const providerError = await executeVideoGenerationLifecycle({
    reserveInitialState: async () => ({
      kind: 'created' as const,
      walletChargeReserved: true,
    }),
    mapExisting: () => ({ body: { ok: true } }),
    submitProvider: async () => ({
      kind: 'error_response' as const,
      status: 502,
      body: {
        ok: false,
        error: 'safe provider failure',
        paymentStatus: 'refunded_wallet',
      },
    }),
    completeDirect: async () => ({ body: { ok: true } }),
    onReservationError: async () => ({ body: { ok: false }, status: 500 }),
  });
  assert.deepEqual(providerError, {
    status: 502,
    body: {
      ok: false,
      error: 'safe provider failure',
      paymentStatus: 'refunded_wallet',
    },
  });
});

test('video lifecycle delegates reservation failures to the rollback/error adapter exactly once', async () => {
  const { executeVideoGenerationLifecycle } = await import('../frontend/src/server/video-generation/execute-video-generation');
  let rollbackCalls = 0;
  const failure = new Error('reservation failed');
  const result = await executeVideoGenerationLifecycle({
    reserveInitialState: async () => {
      throw failure;
    },
    mapExisting: () => ({ body: { ok: true } }),
    submitProvider: async () => {
      assert.fail('provider must not run after reservation failure');
    },
    completeDirect: async () => ({ body: { ok: true } }),
    onReservationError: async (error: unknown) => {
      assert.equal(error, failure);
      rollbackCalls += 1;
      return {
        body: { ok: false, error: 'Failed to persist job record' },
        status: 500,
      };
    },
  });
  assert.equal(rollbackCalls, 1);
  assert.deepEqual(result, {
    body: { ok: false, error: 'Failed to persist job record' },
    status: 500,
  });
});
