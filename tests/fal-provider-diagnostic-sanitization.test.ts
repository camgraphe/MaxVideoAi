import assert from 'node:assert/strict';
import path from 'node:path';
import { inspect } from 'node:util';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';
import { allowGenerationPoll } from './helpers/generation-poll-claim';

const grant = 'https://private.example.test/media-assets/owner/input.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=private-fixture&X-Amz-Signature=private-grant';
const encodedGrant = encodeURIComponent(grant);
const rejection = { detail: [{ type: 'file_download_error', loc: ['body', 'input.start_image_url'], input: grant, msg: `Failed to download the file ${grant}; encoded ${encodedGrant}` }] };

test('asynchronous diagnostics without a transport map remove bounded URL-encoded grants', async () => {
  const { sanitizeProviderMediaDiagnostics } = await import('../frontend/server/provider-media-diagnostics');
  const inputs: string[] = [grant];
  for (let depth = 0; depth < 3; depth++) inputs.push(encodeURIComponent(inputs[inputs.length - 1]));
  const diagnostic = Object.assign(new Error(`Inputs: ${inputs.join(' ')}`), { body: { inputs, harmless: 'ordinary URL https://external.example.test/source.png?size=4' } });
  const safe = sanitizeProviderMediaDiagnostics(diagnostic);
  assert.doesNotMatch(inspect(safe, { depth: 20 }), /X-Amz-|private-grant|private-fixture/);
  assert.match(inspect(safe, { depth: 20 }), /external\.example\.test\/source\.png\?size=4/);
  assert.match(inspect(safe, { depth: 20 }), /media-assets/);
});

async function webhookBundle() {
  const frontend = path.join(process.cwd(), 'frontend');
  const stubs: Record<string, string> = {
    '@/lib/db': 'export const query = (...args) => fixture.query(...args);',
    './fal-webhook-refunds': 'export const maybeAutoRefundWalletCharge = async (...args) => fixture.refunds.push(args);',
    './fal-webhook-provisional': 'export const createProvisionalJobFromWebhook = async () => { throw Error("Unexpected provisional"); };',
    '@/lib/fal-client': 'export const getFalClient = () => ({ queue: { result: async () => { if (fixture.readError) throw fixture.readError; return { data: fixture.result }; } } });',
    '@/lib/fal-catalog': 'export const resolveFalModelId = async () => "fixture/model";',
    '@/config/falEngines': 'export const getFalEngineById = () => ({ category: "video" });',
    './fal-webhook-engine': 'export const inferEngineFromPayload = async () => ({}); export const getUpscaleToolMediaType = () => null;',
    '@/server/thumbnails': 'export const ensureJobThumbnail = async () => null; export const isPlaceholderThumbnail = () => true;',
    '@/server/video-faststart': 'export const ensureFastStartVideo = async source => { fixture.copySources.push(source.videoUrl); return fixture.copied; };',
    '@/server/video-keyframes': 'export const generateAndPersistJobKeyframes = async () => {};',
    '@/server/video-preview': 'export const generateAndPersistJobPreviewVideo = async () => {};',
    '@/server/fal-job-sync': 'export const fetchFalJobMedia = async () => ({});',
    '@/server/media/detect-has-audio': 'export const detectHasAudioStream = async () => false; export const detectVideoDimensions = async () => null;',
    '@/server/media-library': 'export const upsertLegacyJobOutputs = async value => fixture.outputs.push(value);',
    './upscale-duration-integrity': 'export const checkUpscaleDuration = async () => "complete"; export const rejectTruncatedUpscale = async () => {};',
    './fal-webhook-image-output': 'export const persistFalWebhookImageOutputs = async () => { throw Error("Unexpected image persistence"); };',
  };
  const bundle = await build({ absWorkingDir: frontend, bundle: true, format: 'cjs', platform: 'node', write: false,
    tsconfig: path.join(frontend, 'tsconfig.json'), entryPoints: ['server/fal-webhook-handler.ts'],
    plugins: [{ name: 'offline-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  return bundle.outputFiles[0].text;
}

test('real Fal webhook logs sanitize native and SDK input grants without changing lifecycle or output reads', async () => {
  const bundle = await webhookBundle();
  for (const scenario of ['native_rejection', 'sdk_read_error', 'successful_output']) {
    const logs: unknown[] = [];
    const updates: unknown[][] = [];
    const audit: unknown[] = [];
    const output = 'https://provider.example.test/output.mp4?X-Amz-Signature=output-read-grant';
    const fixture = {
      readError: scenario === 'sdk_read_error' ? Object.assign(new Error(`Result read failed for ${grant} (${encodedGrant})`), { status: 500, body: rejection, cause: new Error(encodedGrant) }) : null,
      result: scenario === 'successful_output' ? { video: { url: output } } : null,
      copied: scenario === 'successful_output' ? 'https://durable.example.test/renders/owner/output.mp4' : null,
      copySources: [] as string[], refunds: [] as unknown[], outputs: [] as { status: string }[],
      query: async (sql: string, params: unknown[]) => {
        if (sql.startsWith('SELECT')) return [{ job_id: 'job-fixture', engine_id: 'wan-3', engine_label: 'Wan3', status: 'running', progress: 30, payment_status: 'paid_wallet', user_id: 'owner', video_url: null, render_ids: [], settings_snapshot: {}, created_at: new Date().toISOString() }];
        if (sql.startsWith('UPDATE')) { updates.push(params); return [{ job_id: 'job-fixture' }]; }
        if (sql.startsWith('INSERT INTO fal_queue_log')) { audit.push(params); return []; }
        throw new Error('Unexpected SQL');
      },
    };
    const module = { exports: {} as { updateJobFromFalWebhook(payload: unknown): Promise<void> } };
    const log = (...args: unknown[]) => { logs.push(args); };
    runInNewContext(bundle, { module, exports: module.exports, fixture, URL, process: { env: {} }, console: { info: log, warn: log, error: log } });
    await module.exports.updateJobFromFalWebhook({ request_id: 'provider-fixture', status: scenario === 'native_rejection' ? 'ERROR' : 'COMPLETED',
      ...(scenario === 'native_rejection' ? { error: 'Unexpected status code: 422', payload: rejection } : scenario === 'successful_output' ? { payload: fixture.result } : {}),
    });
    assert.doesNotMatch(inspect({ logs, audit }, { depth: 20 }), /X-Amz-|private-grant|private-fixture/, scenario);
    assert.equal(updates[0][1], scenario === 'successful_output' ? 'completed' : 'failed');
    assert.equal(fixture.refunds.length, scenario === 'native_rejection' ? 1 : 0);
    assert.deepEqual(fixture.copySources, scenario === 'successful_output' ? [output] : []);
  }
});

test('real Fal poll sanitizes SDK diagnostics and terminal error audit contexts', async t => {
  const { runFalPoll } = await import('../frontend/server/fal-poll');
  const logs: unknown[] = [];
  for (const method of ['warn', 'error', 'info'] as const) t.mock.method(console, method, (...args) => { logs.push(args); });
  for (const terminal of [false, true]) {
    const writes: unknown[] = [];
    const lifecycle: Record<string, unknown>[] = [];
    await runFalPoll({
      claimGenerationPoll: allowGenerationPoll,
      query: async <T>(sql: string, params?: readonly unknown[]): Promise<T[]> => {
        if (sql.includes('SELECT job_id, surface, engine_id')) return [{ job_id: 'job-fixture', engine_id: 'seedvr-video', surface: 'video', provider_job_id: 'provider-fixture', status: 'running', created_at: '2026-01-01', updated_at: '2026-01-01' }] as T[];
        if (sql.includes('COUNT(*)::int')) return [{ attempts: 0, last_attempt_at: null }] as T[];
        writes.push({ sql, params });
        return [];
      },
      getFalClient: () => ({ queue: {
        status: async () => ({ status: 'COMPLETED' }),
        result: async () => { throw Object.assign(new Error(`Result read failed: ${grant} (${encodedGrant})`), { status: terminal ? 422 : 500, body: rejection }); },
      } }) as never,
      updateJobFromFalWebhook: async payload => { lifecycle.push(payload as Record<string, unknown>); },
      reconcileStaleFalProvisionals: async () => ({ failed: 0 }),
      reconcileFinishingJobs: async () => ({ checked: 0, reconciled: 0, failures: 0 }),
      backfillCompletedMcpJobOutputs: async () => ({ promoted: 0, failed: 0 }),
    });
    assert.doesNotMatch(inspect({ logs, writes, lifecycle }, { depth: 20 }), /X-Amz-|private-grant|private-fixture/);
    assert.equal(lifecycle.length, terminal ? 1 : 0);
    if (terminal) assert.equal(lifecycle[0].auto_refund_eligible, true);
  }
});
