import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { getDb } from '../frontend/src/lib/db';
import { withWalletFailureSettlement } from '../frontend/server/fal-webhook-refunds';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('real Fal webhook rolls failure back on refund outage and settles safely on replay', { timeout: 30_000 }, async () => {
  const frontend = path.join(process.cwd(), 'frontend');
  const stubs: Record<string, string> = {
  '@fal-ai/client': 'export class ApiError extends Error { constructor(value) { super(value.message); Object.assign(this, value); } }',
  '@/lib/env': 'export const ENV = { FAL_API_KEY: "offline-only" };',
    '@/lib/db': 'export const query = (...args) => fixture.query(...args);',
    './fal-webhook-draft-cache': 'export const captureCompletedFalDraftCache = async () => {};',
    './fal-webhook-refunds': 'export const withWalletFailureSettlement = (...args) => fixture.settle(...args);',
    '@/server/video-providers/provider-attempts': 'export const syncProviderAttemptTerminalStatus = async () => {};',
    './fal-webhook-provisional': 'export const createProvisionalJobFromWebhook = async () => { throw Error("Unexpected provisional"); };',
    '@/lib/fal-client': 'export const getFalClient = () => ({ queue: { result: async () => { fixture.reads++; throw fixture.readError; } } });',
    '@/lib/fal-catalog': 'export const resolveFalModelId = async () => "fixture/model";',
    '@/config/falEngines': 'export const getFalEngineById = () => ({ category: "video" });',
    './fal-webhook-engine': 'export const inferEngineFromPayload = async () => ({}); export const getUpscaleToolMediaType = () => null;',
    '@/server/thumbnails': 'export const ensureJobThumbnail = async () => null; export const isPlaceholderThumbnail = () => true;',
    '@/server/video-faststart': 'export const ensureFastStartVideo = async () => null;',
    '@/server/video-keyframes': 'export const generateAndPersistJobKeyframes = async () => {};',
    '@/server/video-preview': 'export const generateAndPersistJobPreviewVideo = async () => {};',
    '@/server/fal-job-sync': 'export const fetchFalJobMedia = async () => ({});',
    '@/server/media/detect-has-audio': 'export const detectHasAudioStream = async () => false; export const detectVideoDimensions = async () => null;',
    '@/server/media-library': 'export const upsertLegacyJobOutputs = async (value) => fixture.outputs.push(value);',
    './upscale-duration-integrity': 'export const checkUpscaleDuration = async () => "complete"; export const rejectTruncatedUpscale = async () => {};',
    './fal-webhook-image-output': 'export const persistFalWebhookImageOutputs = async () => { throw Error("Unexpected image persistence"); };',
  };
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, format: 'cjs', platform: 'node', write: false,
    tsconfig: path.join(frontend, 'tsconfig.json'),
    entryPoints: ['server/fal-webhook-handler.ts'],
    plugins: [{ name: 'external-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });

  const db = await startDisposablePostgres('fal-wallet-webhook');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`CREATE TABLE fal_queue_log (job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb);
      INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,status,progress,provider_job_id,payment_status,final_price_cents,currency,duration_sec)
      VALUES ('job','owner','minimax-h3','MiniMax H3','running',30,'request','paid_wallet',9999,'EUR',5);
      INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency,surface) VALUES ('owner','job','charge',123,'USD','video');
      CREATE FUNCTION reject_refund() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'injected refund outage'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER credit_outage BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_refund();`);
    const fixture = {
      outputs: [] as unknown[], reads: 0,
      query: async (sql: string, params: unknown[]) => (await db.pool.query(sql, params)).rows,
      settle: withWalletFailureSettlement,
    };
    const bundleModule = { exports: {} as { updateJobFromFalWebhook(payload: unknown): Promise<void> } };
    runInNewContext(bundle.outputFiles[0].text, { module: bundleModule, exports: bundleModule.exports, fixture, URL,
      process: { env: {} }, console: { info() {}, warn() {}, error() {} } });
    const event = { request_id: 'request', status: 'ERROR', error: 'Unexpected status code: 422',
      payload: { detail: [{ type: 'content_policy_violation', loc: ['body', 'image_url'], msg: 'Flagged by content checker.' }] } };
    const state = async () => (await db.pool.query("SELECT status,payment_status FROM app_jobs WHERE job_id='job'")).rows[0];
    const refunds = async () => (await db.pool.query("SELECT amount_cents,currency,user_id FROM app_receipts WHERE type='refund'")).rows;
    await assert.rejects(bundleModule.exports.updateJobFromFalWebhook(event), /injected refund outage/);
    assert.deepEqual(await state(), { status: 'running', payment_status: 'paid_wallet' });
    assert.deepEqual(await refunds(), []);
    assert.equal(fixture.outputs.length, 0, 'no failure output is published before settlement');
    await db.pool.query('DROP TRIGGER credit_outage ON app_receipts');
    await Promise.all([bundleModule.exports.updateJobFromFalWebhook(event), bundleModule.exports.updateJobFromFalWebhook(event)]);
    assert.deepEqual(await state(), { status: 'failed', payment_status: 'refunded_wallet' });
    assert.deepEqual(await refunds(), [{ amount_cents: 123, currency: 'USD', user_id: 'owner' }]);
    await db.pool.query("UPDATE app_jobs SET status='completed',video_url='https://cdn.example.test/ready.mp4'");
    await bundleModule.exports.updateJobFromFalWebhook(event);
    assert.deepEqual(await state(), { status: 'completed', payment_status: 'refunded_wallet' });
    assert.equal((await refunds()).length, 1);
    assert.equal(fixture.reads, 0, 'fixture makes no provider read or new submission');
  } finally {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await db.cleanup();
  }
});
