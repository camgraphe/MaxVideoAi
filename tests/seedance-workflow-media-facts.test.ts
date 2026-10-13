import assert from 'node:assert/strict';
import test from 'node:test';
import * as facts from '../frontend/server/seedance-workflow-facts';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { executeVideoGeneration } from '../frontend/src/server/video-generation/execute-video-generation';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { NextRequest } from 'next/server';
import { ENV } from '../frontend/src/lib/env';
import { getDb } from '../frontend/src/lib/db';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';

const attachment = { name: 'deleted.mp4', type: 'video/mp4', size: 1000, kind: 'video' as const,
  slotId: 'video_url', assetId: 'deleted-owned-video', url: 'https://cdn.example/deleted.mp4', width: 1920, height: 1080, durationSec: 5 };
const immutable = { schemaVersion: 1 as const, mode: 'v2v' as const, durationSec: 5, aspectRatio: '16:9', hasVideoInput: true,
  inputVideoDurationSec: 5, attachments: [attachment], trustedMediaReferences: [{ kind: 'video' as const, url: attachment.url, width: 1920, height: 1080, durationSec: 5 }] };

test('owned Final reconstructs original reference roles from its immutable Draft facts without live assets', async () => {
  const db = await startDisposablePostgres('draft-immutable-final');
  const previousDatabase = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const previousTransport = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,settings_snapshot,payment_status,final_price_cents)
      VALUES('final','owner','seedance-2-5','byteplus_modelark','pending','{}','paid_wallet',100)`);
    const requestBody = { engineId: engine.id, mode: 'v2v', prompt: 'Original motion', durationSec: 5, resolution: '1080p',
      aspectRatio: '16:9', inputs: [attachment], iterationCount: 1, audio: false, extraInputValues: {},
      seedanceWorkflow: { step: 'final', draftJobId: 'draft' } };
    const options = buildGenerateRequestOptions({ body: requestBody, engine, mode: 'v2v', isBytePlusV1a: true });
    assert.equal(options.ok, true);
    if (!options.ok) return;
    let submitted: any;
    const execution = { req: new NextRequest('http://localhost/api/generate'), body: requestBody,
      userId: 'owner', jobId: 'final', localKey: null, requestStartedAt: Date.now(), logMetric: () => {}, metricState: {},
      routeContext: { engine, isBytePlusV1a: true, jobId: 'final', mode: 'v2v', payment: { mode: 'wallet' }, providerKey: 'byteplus_modelark',
        providerRoutingPlan: { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false } },
      requestOptions: options.options, seedanceWorkflow: { body: requestBody, workflow: { step: 'final', draftJobId: 'draft' }, finalFacts: immutable },
      walletReservation: 'already_reserved', preReservedInitialState: { kind: 'created', jobId: 'final', walletChargeReserved: true },
      trustedQuotedBilling: { pricing: { totalCents: 100, currency: 'USD', membershipTier: 'member' }, membershipTier: 'member' }, trustedResolvedReferences: [],
      adapters: { submitBytePlusGenerateTask: async (value: unknown) => { submitted = value; return { ok: true, body: { ok: true, jobId: 'final' } }; } },
    };
    const result = await executeVideoGeneration(execution as never);
    assert.equal(result.body.ok, true, JSON.stringify(result));
    assert.deepEqual(submitted.videoUrls, ['https://cdn.example/deleted.mp4']);
    assert.equal(submitted.mode, 'v2v');
    assert.equal(submitted.effectiveResolution, '1080p');
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,settings_snapshot,payment_status,final_price_cents)
      VALUES('draft','owner','seedance-2-5','byteplus_modelark','pending','{}','paid_wallet',100)`);
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'las';
    const sourceUrl = 'https://cdn.maxvideoai.com/owned.mp4';
    const draftBody = { ...requestBody, resolution: '480p', durationOption: 'auto',
      inputs: [{ ...attachment, url: sourceUrl, durationSec: 29, width: 1400, height: 1000 }], seedanceWorkflow: { step: 'draft' } };
    const draftOptions = buildGenerateRequestOptions({ body: draftBody, engine, mode: 'v2v', isBytePlusV1a: true });
    assert.equal(draftOptions.ok, true);
    if (!draftOptions.ok) return;
    const draftResult = await executeVideoGeneration({ ...execution, body: draftBody, requestOptions: draftOptions.options,
      routeContext: { ...execution.routeContext, jobId: 'draft' },
      preReservedInitialState: { kind: 'created', jobId: 'draft', walletChargeReserved: true },
      seedanceWorkflow: { body: draftBody, workflow: { step: 'draft' } },
      trustedResolvedReferences: [{ assetId: attachment.assetId, mediaKind: 'video', role: 'input_video', storageUrl: sourceUrl,
        width: 1920, height: 1080, durationSec: 5.2, mimeType: 'video/mp4', sizeBytes: 1000, originalName: 'owned.mp4' }],
    } as never);
    assert.equal(draftResult.body.ok, true, JSON.stringify(draftResult));
    const stored = (await db.pool.query("SELECT settings_snapshot FROM app_jobs WHERE job_id='draft'")).rows[0].settings_snapshot.seedanceWorkflow.mediaFacts;
    assert.equal(stored.durationSec, 6, 'ModelArk Draft Edit retains verified source timing even when normal Edit uses LAS');
    assert.equal(stored.inputVideoDurationSec, 5.2);
    assert.equal(stored.attachments[0].durationSec, 5.2);
    assert.equal(stored.attachments[0].width, 1920, 'caller dimensions do not become Final facts');
    assert.equal(stored.seedanceEditSource.pricingAspectRatio, '16:9');
  } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = previousTransport;
    await getDb().end().catch(() => {}); await db.cleanup();
    if (previousDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabase;
  }
});

test('stored workflow media facts fail closed when media billing quantities or roles are missing', () => {
  assert.equal(facts.readSeedanceWorkflowMediaFacts({ ...immutable, inputVideoDurationSec: undefined }), null);
  assert.equal(facts.readSeedanceWorkflowMediaFacts({ ...immutable, attachments: [] }), null);
  assert.equal(facts.readSeedanceWorkflowMediaFacts({ ...immutable, mode: 'fl2v' }), null);
});

test('Draft stores a detached copy of verified media facts for Final pricing after deletion', () => {
  const original = structuredClone(immutable);
  const captured = facts.captureSeedanceWorkflowMediaFacts(original);
  original.attachments[0].durationSec = 1;
  original.trustedMediaReferences[0].durationSec = 1;
  assert.equal(captured.attachments[0].durationSec, 5);
  assert.equal(captured.trustedMediaReferences[0].durationSec, 5);
  assert.equal(captured.inputVideoDurationSec, 5);
});

test('only a server-resolved workflow can use ModelArk Final while normal Edit remains unavailable on LAS', async () => {
  const flags = { BYTEPLUS_ARK_ENABLED: 'true', BYTEPLUS_ARK_API_KEY: 'test-modelark', SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true',
    SEEDANCE_2_5_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY: 'false', SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend',
    SEEDANCE_2_5_EDIT_TRANSPORT: 'las', SEEDANCE_2_5_LAS_ENABLED: 'false' };
  const previous = Object.fromEntries(Object.keys(flags).map(key => [key, ENV[key as keyof typeof ENV]]));
  Object.assign(ENV, flags);
  const body = { engineId: 'seedance-2-5', mode: 'v2v', prompt: 'Original motion', durationSec: 5, resolution: '1080p',
    seedanceWorkflow: { step: 'final', draftJobId: 'draft' }, payment: { mode: 'wallet' } };
  const boundaryOverrides = { getConfiguredEngine: async () => getFalEngineById('seedance-2-5')!.engine,
    isDatabaseConfigured: () => true, ensureBillingSchema: async () => {} };
  try {
    const raw = await resolveGenerateRouteContext({ body, req: new NextRequest('http://localhost/api/generate'), boundaryOverrides });
    assert.equal(raw.ok, false, 'a client workflow claim cannot borrow a transport gate');
    const trusted = await resolveGenerateRouteContext({ body, req: new NextRequest('http://localhost/api/generate'), boundaryOverrides,
      seedanceWorkflow: { body, workflow: { step: 'final', draftJobId: 'draft' }, finalFacts: immutable } });
    assert.equal(trusted.ok, true, JSON.stringify(trusted));
  } finally { Object.assign(ENV, previous); }
});

test('source pricing rejects an arbitrary I2V first frame even when the caller requests a reviewed fixed ratio', () => {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const result = facts.resolveSeedanceWorkflowSourceFacts({ engine, mode: 'i2v', aspectRatio: '16:9', initialImageUrl: 'https://cdn.example/source.png',
    trustedMediaReferences: [{ kind: 'image', url: 'https://cdn.example/source.png', width: 1400, height: 1000 },
      { kind: 'image', url: 'https://cdn.example/end.png', width: 1920, height: 1080 }] });
  assert.equal(result.ok, false);
});
