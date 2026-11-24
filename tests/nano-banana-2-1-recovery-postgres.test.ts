import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';
import { createQueryExecutor, getDb } from '../frontend/src/lib/db';
import type { PricingSnapshot } from '../frontend/types/engines';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==';
const IMAGE = { responseId: 'synthetic-accepted-response', candidates: [{ finishReason: 'STOP', content: {
  parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }],
} }] };
const EMPTY = { responseId: 'synthetic-empty-response', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'No image' }] } }] };
const SAFETY = { responseId: 'synthetic-safety-response', promptFeedback: { blockReason: 'SAFETY' }, candidates: [] };
const OUTPUT_REFUSAL = { responseId: 'synthetic-output-refusal', candidates: [{ finishReason: 'IMAGE_PROHIBITED_CONTENT', finishMessage: 'Private provider diagnostics' }] };
const OUTPUT_SAFETY = { responseId: 'synthetic-image-safety', candidates: [{ finishReason: 'IMAGE_SAFETY' }] };
const GENERAL_REFUSAL = { responseId: 'synthetic-general-refusal', candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] };
const OUTPUT_REFUSAL_MESSAGE = 'Google blocked the generated image during its moderation checks.';
const GENERAL_REFUSAL_MESSAGE = 'Google stopped image generation during its moderation checks.';

test('reserved direct Vertex jobs preserve the real POST boundary, original charge and owned recovery', async t => {
  const db = await startDisposablePostgres('nano21-direct-recovery');
  // These are isolated process fixtures. No env file, account or shared configuration is changed.
  const names = ['DATABASE_URL', 'NODE_ENV', 'GOOGLE_VERTEX_PROJECT_ID', 'GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON',
    'GOOGLE_VERTEX_INPUT_GCS_URI', 'GOOGLE_VERTEX_LOCATION', 'GOOGLE_VERTEX_API_BASE_URL',
    'S3_PUBLIC_BASE_URL', 'S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
  const previous = new Map(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'test', GOOGLE_VERTEX_PROJECT_ID: 'synthetic-existing-project',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'fixture@example.com', private_key: 'unused' }),
    GOOGLE_VERTEX_INPUT_GCS_URI: 'gs://synthetic-owned-inputs', GOOGLE_VERTEX_LOCATION: 'europe-west4',
    GOOGLE_VERTEX_API_BASE_URL: 'https://europe-west4-aiplatform.googleapis.com', S3_PUBLIC_BASE_URL: 'https://nano21-owned.invalid',
    S3_BUCKET: '', S3_REGION: '', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '' });
  const expectedErrors: string[] = [], unexpectedWarnings: string[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => expectedErrors.push(String(args[0])));
  t.mock.method(console, 'warn', (...args: unknown[]) => unexpectedWarnings.push(String(args[0])));
  let posts = 0, referenceReads = 0, authCalls = 0;
  let nativeResponse: () => Response = () => new Response(JSON.stringify(IMAGE));
  let referenceError: Error | null = null, authError: Error | null = null, authToken = 'synthetic-token';
  const nativeUrls: string[] = [];
  const nativeBodies: Array<{generationConfig:{thinkingConfig?:{thinkingLevel:string};maxOutputTokens?:number}}> = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://nano21-owned.invalid/')) {
      referenceReads += 1;
      if (referenceError) throw referenceError;
      return new Response(Buffer.from(PNG, 'base64'), { headers: { 'content-type': 'image/png' } });
    }
    if (/^https:\/\/(?:europe-west4-)?aiplatform\.googleapis\.com\/.*:generateContent$/.test(url)) {
      new Headers(init?.headers); // Native fetch validates headers before it can send an HTTP request.
      posts += 1; nativeUrls.push(url); nativeBodies.push(JSON.parse(String(init?.body))); return nativeResponse();
    }
    throw new Error('Unexpected network boundary; all external transport is blocked by this fixture.');
  });
  try {
    // Dynamic imports ensure storage reads only the synthetic, unconfigured fixture above.
    const { GoogleVertexImageClient } = await import('../frontend/src/server/images/google-vertex-image-client');
    t.mock.method(GoogleVertexImageClient.prototype, 'accessToken', async () => {
      authCalls += 1;
      if (authError) throw authError;
      return authToken;
    });
    const { getFalEngineById } = await import('../frontend/src/config/falEngines');
    const { executeDirectImageProviderIfAvailable } = await import('../frontend/src/server/images/image-direct-provider-execution');
    const { createAtomicInitialImageJob } = await import('../frontend/src/server/images/image-initial-job');
    const { executeAfterInitialJobReservation } = await import('../frontend/src/server/generations/initial-job-reservation');
    const { executeImageGeneration } = await import('../frontend/src/server/images/execute-image-generation');
    const { mapGenerationStatusRecordToAgent } = await import('../frontend/src/server/generations/agent-generation-policy');
    const { resolveOwnedReferenceAssetForActor } = await import('../frontend/src/server/agent-api/reference-assets');
    const { isStorageConfigured } = await import('../frontend/server/storage');
    assert.equal(isStorageConfigured(), false, 'no real storage upload can occur');
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN);
      INSERT INTO app_customer_tariff_state VALUES (TRUE, 7, TRUE);
      INSERT INTO app_receipts (user_id,type,amount_cents,currency) VALUES ('fixture-owner','topup',10000,'USD');
      CREATE FUNCTION skip_test_refund() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$;
      CREATE TRIGGER skip_test_refund BEFORE INSERT ON app_receipts FOR EACH ROW
        WHEN (NEW.type = 'refund' AND NEW.job_id = 'moderation-without-refund') EXECUTE FUNCTION skip_test_refund();
      CREATE TABLE fal_queue_log (id BIGSERIAL PRIMARY KEY, job_id TEXT, provider TEXT, provider_job_id TEXT, engine_id TEXT, status TEXT, payload JSONB);
      CREATE TABLE media_assets (id TEXT, public_id TEXT, user_id TEXT, kind TEXT, url TEXT, mime_type TEXT, size_bytes BIGINT,
        width INTEGER, height INTEGER, status TEXT, deleted_at TIMESTAMPTZ, metadata JSONB);
      INSERT INTO media_assets VALUES ('synthetic-row','ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','fixture-owner','image',
        'https://nano21-owned.invalid/media-assets/fixture-owner/input.png','image/png',68,1,1,'ready',NULL,'{}');`);
    const owned = await resolveOwnedReferenceAssetForActor({ authMethod: 'toolbox-session', userId: 'fixture-owner', clientId: null },
      'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { executor: createQueryExecutor(db.pool) });
    const nano = getFalEngineById('nano-banana-2-1')!;
    const legacy = getFalEngineById('nano-banana-2')!;
    const pro = getFalEngineById('nano-banana-pro')!;
    const scenarios = [
      { name: 'owned reference download rejection is unsubmitted and refunded', id: 'reference-failed', kind: 'reference', expectedPosts: 0, pending: false },
      { name: 'auth preparation rejection is unsubmitted and refunded', id: 'auth-failed', kind: 'auth', expectedPosts: 0, pending: false },
      { name: 'auth header preparation rejection is unsubmitted and refunded', id: 'auth-header-failed', kind: 'auth-header', expectedPosts: 0, pending: false },
      { name: 'payload rejection is unsubmitted and refunded', id: 'payload-failed', kind: 'payload', expectedPosts: 0, pending: false },
      { name: 'accepted image followed by storage failure is durably paid and never resubmitted', id: 'storage-failed', kind: 'image', expectedPosts: 1, pending: true, responseId: IMAGE.responseId },
      { name: 'truncated HTTP200 JSON is uncertain rather than a definite empty refund', id: 'truncated-json', kind: 'truncated', expectedPosts: 1, pending: true },
      { name: 'interrupted HTTP200 body is uncertain rather than a definite empty refund', id: 'interrupted-body', kind: 'interrupted', expectedPosts: 1, pending: true },
      { name: 'unrecognized HTTP200 object retains its known response ID on the uncertain job', id: 'invalid-envelope', kind: 'invalid', expectedPosts: 1, pending: true, responseId: 'synthetic-protocol-response' },
      { name: 'non-string response ID is refused while the invalid envelope remains uncertain', id: 'invalid-response-id', kind: 'invalid-id', expectedPosts: 1, pending: true },
      { name: 'validated definitive empty response keeps the original refund policy', id: 'definite-empty', kind: 'empty', expectedPosts: 1, pending: false, responseId: EMPTY.responseId },
      { name: 'validated safety response keeps the original refund policy', id: 'definite-safety', kind: 'safety', expectedPosts: 1, pending: false, responseId: SAFETY.responseId },
      { name: 'Nano Banana Pro identifies blocked output in the response, job and refund receipt', id: 'output-refusal', kind: 'moderation', payload: OUTPUT_REFUSAL, expectedPosts: 1, pending: false, responseId: OUTPUT_REFUSAL.responseId, reason: OUTPUT_REFUSAL_MESSAGE, pro: true },
      { name: 'Vertex IMAGE_SAFETY also identifies a blocked output', id: 'image-safety', kind: 'moderation', payload: OUTPUT_SAFETY, expectedPosts: 1, pending: false, responseId: OUTPUT_SAFETY.responseId, reason: OUTPUT_REFUSAL_MESSAGE },
      { name: 'Nano Banana 2.1 reports general moderation when Google supplies no image-specific reason', id: 'general-refusal', kind: 'moderation', payload: GENERAL_REFUSAL, expectedPosts: 1, pending: false, responseId: GENERAL_REFUSAL.responseId, reason: GENERAL_REFUSAL_MESSAGE },
      { name: 'the refusal message confirms a refund only when a receipt is written', id: 'moderation-without-refund', kind: 'moderation', payload: OUTPUT_REFUSAL, expectedPosts: 1, pending: false, responseId: OUTPUT_REFUSAL.responseId, reason: OUTPUT_REFUSAL_MESSAGE, pro: true, skipRefund: true },
      { name: 'legacy Nano2 storage failure still uses its existing refund policy', id: 'legacy-storage', kind: 'image', expectedPosts: 1, pending: false, old: true, responseId: IMAGE.responseId },
      { name: 'legacy Nano2 malformed bodies retain two attempts and the existing empty refund policy', id: 'legacy-truncated', kind: 'truncated', expectedPosts: 2, pending: false, old: true },
    ];
    for (const scenario of scenarios) await t.test(scenario.name, async () => {
      posts = 0; referenceReads = 0; authCalls = 0; nativeUrls.length = 0; nativeBodies.length = 0;
      referenceError = scenario.kind === 'reference' ? new TypeError('synthetic owned reference fetch failed') : null;
      authError = scenario.kind === 'auth' ? new TypeError('synthetic auth transport fetch failed') : null;
      authToken = scenario.kind === 'auth-header' ? 'synthetic\ninvalid-token' : 'synthetic-token';
      nativeResponse = () => scenario.kind === 'truncated' ? new Response('{"responseId":"unfinished"', { status: 200 })
        : scenario.kind === 'interrupted' ? new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new TextEncoder().encode('{"candidates":[')); controller.error(new Error('synthetic interrupted body'));
        } }), { status: 200 })
        : new Response(JSON.stringify(scenario.payload ?? (scenario.kind === 'empty' ? EMPTY : scenario.kind === 'safety' ? SAFETY
          : scenario.kind === 'invalid' ? { responseId: scenario.responseId, candidates: [] }
            : scenario.kind === 'invalid-id' ? { responseId: { untrusted: 'object' }, candidates: [] } : IMAGE)));
      const entry = scenario.old ? legacy : scenario.pro ? pro : nano;
      const pricing = { totalCents: 79, currency: 'USD', membershipTier: 'member',
        meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7, syntheticFixture: true } } as PricingSnapshot;
      const receipt = { userId: 'fixture-owner', amountCents: 79, currency: 'USD', description: 'Synthetic original image quote',
        jobId: scenario.id, surface: 'image' as const, billingProductKey: null, snapshot: pricing, applicationFeeCents: null, vendorAccountId: null };
      await db.pool.query('UPDATE app_customer_tariff_state SET revision=7');
      const expectedPaymentStatus = scenario.pending || scenario.skipRefund ? 'paid_wallet' : 'refunded_wallet';
      await assert.rejects(executeAfterInitialJobReservation({
        reserveInitialState: () => createAtomicInitialImageJob({ ...receipt, engineId: entry.id, engineLabel: entry.marketingName,
          auditPricingSnapshot: pricing, mode: 't2i', durationSec: 1, prompt: 'Synthetic still', aspectRatio: '1:1', canUpscale: false,
          finalPriceCents: 79, pricingSnapshotJson: JSON.stringify(pricing), costBreakdownJson: null, settingsSnapshotJson: '{"core":{"resolution":"1k"}}',
          visibility: 'private', indexable: false, preferredCurrency: 'usd', walletReservation: 'reserve' }),
        mapExisting: () => { throw new Error('Fixture unexpectedly reused a job before its first submission.'); },
        submitProvider: async () => {
          await db.pool.query('UPDATE app_customer_tariff_state SET revision=88');
          return executeDirectImageProviderIfAvailable({ billingProductKey: null, characterReferenceCount: 0,
            combinedImageUrls: scenario.kind === 'reference' ? [owned.storageUrl] : [], costBreakdownJson: null,
            effectivePrompt: scenario.kind === 'payload' ? '' : 'Synthetic still', enableWebSearch: false,
            engine: entry.engine, engineEntry: entry, indexable: false, jobId: scenario.id, jobSurface: 'image',
            limitGenerations: false, maskUrl: null, mode: scenario.kind === 'reference' ? 'i2i' : 't2i', normalizedSeed: null,
            numImages: 1, outputFormat: null, pendingReceipt: receipt, priceOnlyReceipts: false, pricing,
            pricingSnapshotJson: JSON.stringify(pricing), quality: null, refundDescription: `Refund ${entry.marketingName} - 1 images`,
            resolvedAspectRatio: '1:1', resolution: '1k', thinkingLevel: 'high', userId: 'fixture-owner', vendorAccountId: null,
            visibility: 'private', watermark: false });
        },
      }), error => {
        const value = error as { code?: string; status?: number; message?: string; extras?: { paymentStatus?: string } };
        assert.equal(value.extras?.paymentStatus, expectedPaymentStatus);
        if (scenario.pending) assert.equal(value.code, 'provider_outcome_ambiguous');
        if (scenario.reason) {
          assert.equal(value.code, 'google_vertex_image_safety_block');
          assert.equal(value.status, 422);
          assert.equal(value.message, scenario.skipRefund ? scenario.reason : `${scenario.reason} The amount was returned to your wallet.`);
        }
        return true;
      });
      assert.equal(posts, scenario.expectedPosts, 'actual generateContent POST count');
      if (scenario.kind === 'reference') { assert.equal(referenceReads, 1); assert.equal(authCalls, 0); }
      const [job] = (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [scenario.id])).rows;
      assert.equal(job.status, scenario.pending ? 'running' : 'failed');
      assert.equal(job.provisional, false);
      assert.equal(job.provider_job_id, scenario.responseId ?? null);
      assert.equal(job.payment_status, expectedPaymentStatus);
      t.diagnostic(`${scenario.id}: nativePOSTs=${posts}; referenceReads=${referenceReads}; authCalls=${authCalls}; status=${job.status}; payment=${job.payment_status}; providerId=${job.provider_job_id ?? 'unknown'}`);
      if (entry.id === nano.id && scenario.expectedPosts) {
        assert.equal(nativeBodies[0].generationConfig.thinkingConfig?.thinkingLevel,'HIGH');
        assert.equal(nativeBodies[0].generationConfig.maxOutputTokens,32768);
      }
      assert.deepEqual(job.pricing_snapshot, pricing);
      const receipts = (await db.pool.query('SELECT type,amount_cents,pricing_snapshot,description FROM app_receipts WHERE job_id=$1 ORDER BY id', [scenario.id])).rows;
      assert.deepEqual(receipts.map(row => [row.type, row.amount_cents]), scenario.pending || scenario.skipRefund ? [['charge', 79]] : [['charge', 79], ['refund', 79]]);
      assert.ok(receipts.every(row => JSON.stringify(row.pricing_snapshot) === JSON.stringify(job.pricing_snapshot)));
      if (scenario.reason) {
        assert.equal(job.message, scenario.reason);
        const status = mapGenerationStatusRecordToAgent(job);
        assert.ok(status?.message?.includes(scenario.reason));
        assert.equal(status.message.includes('returned to your wallet'), !scenario.skipRefund);
        if (!scenario.skipRefund) assert.equal(receipts[1].description, `Refund ${entry.marketingName} - 1 image - ${scenario.reason}`);
      }
      if (scenario.pending) {
        assert.equal(job.provider, 'google_vertex_image_direct');
        assert.match(job.message, /uncertain/i);
        for (let replay = 0; replay < 2; replay += 1) {
          const recovered = await executeImageGeneration({ userId: 'fixture-owner', walletReservation: 'reserve',
            body: { jobId: scenario.id, engineId: entry.id, mode: 'i2i', imageUrls: ['not-a-url'] } });
          assert.equal(recovered.jobId, scenario.id);
          assert.equal(recovered.providerJobId, scenario.responseId);
          assert.equal(recovered.paymentStatus, 'paid_wallet');
          assert.deepEqual(recovered.pricing, pricing);
          assert.equal(posts, scenario.expectedPosts, 'owned recovery must never submit another native POST');
        }
      }
      if (scenario.old && posts) assert.match(nativeUrls[0], /\/locations\/europe-west4\//);
    });
    assert.equal(expectedErrors.length, scenarios.length, 'expected synthetic failures are captured instead of emitted as unexplained noise');
    assert.deepEqual(unexpectedWarnings, ['[images] could not confirm Google moderation refund']);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    for (const [name, value] of previous) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
