import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { submitFalGenerateTask } from '../frontend/app/api/generate/_lib/fal-submission';
import { createProviderJobTracker } from '../frontend/app/api/generate/_lib/provider-job-tracker';
import { submitReservedPaidGeneration } from '../frontend/src/server/agent-api/paid-generation-execution';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { addTopup, callConfirmed, callPrepared, connect, createServices, principal, structured } from './helpers/mcp-paid-e2e-harness';

test('MCP FLUX quotes keep one debit and their owner through Fal acceptance and authenticated UUID callbacks', async (t) => {
  const database = await startDisposablePostgres('mcp-fal-correlation');
  const previousDb = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    await database.cleanup();
  });
  await createPaidGenerationTestSchema(database.pool);
  await database.pool.query(`CREATE TABLE fal_queue_log (
    id bigserial PRIMARY KEY, job_id text, provider text, provider_job_id text,
    engine_id text, status text, payload jsonb, created_at timestamptz DEFAULT now()
  )`);
  const owner = principal('fal-correlation-owner');
  await addTopup(database.pool, owner.userId, 10_000);
  const query = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => (await database.pool.query(sql, values)).rows;
  let submissions = 0;
  const acceptance = new Map<string, { provider: string; provider_job_id: string; enqueues: number }>();
  const engine = getFalEngineById('flux-3');
  assert.ok(engine);
  const services = createServices({
    publicEngines: [{ engine: engine.engine, surface: 'video', publicModes: ['t2v'],
      modeCaps: { t2v: engine.modes.find(mode => mode.mode === 't2v')!.ui } }],
    submitPaidGeneration: execution => submitReservedPaidGeneration(execution, {
      executeVideo: async options => {
        assert.equal(options.walletReservation, 'already_reserved');
        const jobId = execution.quoteId;
        assert.equal(options.preReservedInitialState.jobId, jobId);
        const tracker = createProviderJobTracker({ jobId, providerKey: 'fal', engineId: 'flux-3',
          prompt: 'Offline regression', queryFn: query,
          inputSummary: { primaryImageUrl: null, primaryAudioUrl: null, referenceImageCount: 0,
            referenceVideoCount: 0, referenceAudioCount: 0, hasFirstFrame: false, hasLastFrame: false, inputSlots: [] },
        });
        const result = await submitFalGenerateTask({
          userId: owner.userId, jobId, engineId: 'flux-3', engineLabel: 'FLUX 3', isLumaRay2: false,
          falPayload: { engineId: 'flux-3', mode: 't2v', prompt: 'Offline regression', submissionMode: 'enqueue' },
          batchId: null, durationSec: 5, paymentMode: 'wallet', walletChargeReserved: true,
          pendingReceipt: null, ...tracker, logMetricFn() {},
          deps: { queryFn: query, generateVideoFn: async (_payload, hooks) => {
            submissions++;
            const requestId = `provider-${jobId}`;
            await hooks?.onRequestId?.(requestId);
            // Check durability inside the real callback, before any later result/error path can repair it.
            const stored = (await database.pool.query('SELECT provider,provider_job_id FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
            await hooks?.onRequestId?.(requestId);
            const enqueues = await database.pool.query("SELECT count(*)::int AS count FROM fal_queue_log WHERE job_id=$1 AND status='enqueue'", [jobId]);
            acceptance.set(jobId, { ...stored, enqueues: enqueues.rows[0].count });
            return { provider: 'fal', providerJobId: requestId, status: 'queued', thumbUrl: '' };
          } },
        });
        assert.equal(result.ok, true);
        return { status: 202, body: { ok: true, jobId } };
      },
      executeImage: async () => { throw Error('Unexpected image submission'); },
    }),
  });
  const session = await connect(owner, services);
  t.after(session.close);
  const outputRows: Array<Record<string, unknown>> = [];
  const fixture = { query, outputs: outputRows, copy: (input: { userId: string; jobId: string }) => {
    assert.equal(input.userId, owner.userId, 'storage receives the actual customer, never anonymous');
    return `https://media.maxvideoai.com/renders/${input.userId}/${input.jobId}.mp4`;
  } };
  const frontend = resolve('frontend');
  // Only external media/provider operations and unrelated enrichment are doubled.
  // The HTTP route, payload mapping, job lookup and lifecycle UPDATE are real.
  const stubs: Record<string, string> = {
    '@/lib/db': 'export const query = (...args) => fixture.query(...args); export const withDbTransaction = () => {throw Error("Unexpected failure settlement");};',
    'next/server': 'export const NextResponse = {json: Response.json};',
    './fal-webhook-draft-cache': 'export const captureCompletedFalDraftCache = async () => {};',
    '@/server/video-providers/provider-attempts': 'export const syncProviderAttemptTerminalStatus = async () => {};',
    './fal-webhook-provisional': 'export const createProvisionalJobFromWebhook = async () => {throw Error("Must not create an anonymous orphan");};',
    '@/lib/fal-client': 'export const getFalClient = () => ({queue:{result:async()=>({})}});',
    '@/lib/fal-catalog': 'export const resolveFalModelId = async () => "fixture/model"; export const resolveEngineIdFromModelSlug = () => null;',
    '@/server/thumbnails': 'export const ensureJobThumbnail = async () => null; export const isPlaceholderThumbnail = () => false;',
    '@/server/video-faststart': 'export const ensureFastStartVideo = async input => fixture.copy(input);',
    '@/server/video-keyframes': 'export const generateAndPersistJobKeyframes = async () => {};',
    '@/server/video-preview': 'export const generateAndPersistJobPreviewVideo = async () => {};',
    '@/server/fal-job-sync': 'export const fetchFalJobMedia = async () => ({});',
    '@/server/media/detect-has-audio': 'export const detectHasAudioStream = async () => false; export const detectVideoDimensions = async () => ({width:1440,height:1440});',
    '@/server/media-library': 'export const upsertLegacyJobOutputs = async row => fixture.outputs.push(row);',
    './fal-webhook-image-output': 'export const persistFalWebhookImageOutputs = async () => {throw Error("Unexpected image");};',
    './upscale-duration-integrity': 'export const checkUpscaleDuration = async () => "complete"; export const rejectTruncatedUpscale = () => {throw Error("Unexpected upscale");};',
  };
  const built = await build({ absWorkingDir: frontend, entryPoints: ['app/api/fal/webhook/route.ts'],
    tsconfig: resolve(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    plugins: [{ name: 'offline-fal-callback', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const module = { exports: {} as { POST(req: Request): Promise<Response> } };
  runInNewContext(built.outputFiles[0].text, { module, exports: module.exports, fixture,
    require: createRequire(resolve(frontend, 'package.json')), process: { env: { FAL_WEBHOOK_TOKEN: 'offline-token' } },
    URL, Response, Buffer, Date, console, setTimeout, clearTimeout,
    fetch: () => { throw Error('Live provider/storage network is forbidden'); },
  });

  for (const loseIdentity of [false, true]) await t.test(loseIdentity ? 'authenticated UUID rescues a missing association' : 'persisted provider association delivers to its owner', async () => {
    const before = submissions;
    const prepared = await callPrepared(session.client, { surface: 'video', engineId: 'flux-3', mode: 't2v',
      prompt: `Offline callback regression ${loseIdentity}`, settings: { durationSec: 5, resolution: '720p', aspectRatio: '1:1', audio: false },
      references: [], outputCount: 1 });
    const jobId = String(prepared.quoteId);
    const accepted = await callConfirmed(session.client, jobId);
    assert.notEqual(accepted.isError, true, JSON.stringify(accepted.structuredContent));
    // Assert outside production error handlers, which deliberately convert failures to recoverable outcomes.
    assert.deepEqual(acceptance.get(jobId), { provider: 'fal', provider_job_id: `provider-${jobId}`, enqueues: 1 });
    assert.equal((await database.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [jobId])).rows[0].state, 'accepted');
    await callConfirmed(session.client, jobId);
    if (loseIdentity) {
      await database.pool.query("UPDATE app_jobs SET provider_job_id=NULL,provider='Black Forest Labs' WHERE job_id=$1", [jobId]);
      await database.pool.query('DELETE FROM fal_queue_log WHERE job_id=$1', [jobId]);
    }
    const callback = () => module.exports.POST(new Request(`https://example.test/api/fal/webhook?token=offline-token&jobId=${jobId}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request_id: `provider-${jobId}`, status: 'OK', payload: { video: { url: 'https://v3b.fal.media/offline.mp4' } } }),
    }));
    for (let replay = 0; replay < 2; replay++) {
      const response = await callback();
      assert.equal(response.status, 200, await response.text());
    }
    const recovered = structured(await callConfirmed(session.client, jobId));
    assert.equal(recovered.status, 'completed');
    assert.equal(submissions, before + 1, 'confirmation and webhook replays never resubmit');
    const row = (await database.pool.query('SELECT user_id,status,provider,provider_job_id,payment_status FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
    assert.deepEqual(row, { user_id: owner.userId, status: 'completed', provider: 'fal', provider_job_id: `provider-${jobId}`, payment_status: 'paid_wallet' });
    const receipts = (await database.pool.query('SELECT type,amount_cents FROM app_receipts WHERE job_id=$1', [jobId])).rows;
    assert.deepEqual(receipts, [{ type: 'charge', amount_cents: (prepared.price as { amountCents: number }).amountCents }]);
    assert.ok(outputRows.some(output => output.job_id === jobId && output.user_id === owner.userId && output.status === 'completed'));
    assert.equal((await database.pool.query('SELECT count(*)::int AS count FROM app_jobs WHERE user_id IS NULL')).rows[0].count, 0);
  });
});
