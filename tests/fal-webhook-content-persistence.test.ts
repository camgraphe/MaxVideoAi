import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

test('real webhook persists the same content refusal in job, output, refund and audit log', async () => {
  const frontend = path.join(process.cwd(), 'frontend');
  const stubs: Record<string, string> = {
    '@/lib/db': 'export const query = (...args) => fixture.query(...args);',
    './fal-webhook-refunds': 'export const maybeAutoRefundWalletCharge = async (...args) => fixture.refunds.push(args);',
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
  const detail = [{ type: 'content_policy_violation', loc: ['body', 'image_url'], input: 'PRIVATE_REFERENCE', msg: 'Flagged by content checker.' }];
  for (const nativePayload of [true, false]) {
    const updates: unknown[][] = [];
    const logs: unknown[][] = [];
    const fixture = {
      reads: 0, refunds: [] as unknown[][], outputs: [] as { status: string }[],
      readError: Object.assign(new Error('Unprocessable Entity'), { status: 422, body: { detail } }),
      query: async (sql: string, params: unknown[]) => {
        if (sql.startsWith('SELECT')) return [{
          job_id: 'job_fixture', engine_id: 'minimax-h3', engine_label: 'MiniMax H3',
          status: 'running', progress: 30, payment_status: 'paid_wallet', user_id: 'fixture-owner',
          video_url: null, render_ids: [], created_at: '2026-09-11T12:00:00Z',
        }];
        if (sql.startsWith('UPDATE')) { updates.push(params); return [{ job_id: 'job_fixture' }]; }
        if (sql.startsWith('INSERT INTO fal_queue_log')) { logs.push(params); return []; }
        throw new Error('Unexpected SQL boundary');
      },
    };
    const module = { exports: {} as { updateJobFromFalWebhook(payload: unknown): Promise<void> } };
    runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, fixture, URL, process: { env: {} }, console: { info() {}, warn() {}, error() {} } });
    await module.exports.updateJobFromFalWebhook({
      request_id: 'provider-fixture', status: 'ERROR', error: 'Unexpected status code: 422',
      ...(nativePayload ? { payload: { detail } } : {}),
    });
    assert.equal(updates.length, 1);
    assert.equal(updates[0][1], 'failed');
    const message = updates[0][6] as string;
    assert.match(message, /blocked by safety checks/);
    assert.match(message, /reference images, video, or audio/);
    assert.doesNotMatch(message, /422|PRIVATE_REFERENCE/);
    assert.equal(fixture.reads, nativePayload ? 0 : 1);
    assert.equal(fixture.outputs[0].status, 'failed');
    assert.equal(fixture.refunds.length, 1);
    assert.equal((fixture.refunds[0][1] as { failureMessage: string }).failureMessage, message);
    assert.equal(JSON.parse(logs[0][5] as string).message, message);
  }
});
