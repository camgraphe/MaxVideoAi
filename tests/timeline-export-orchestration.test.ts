import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

const frontend = resolve('frontend');
const secret = 'offline-export-orchestration-secret-at-least-32-bytes';
const userId = 'export-owner';
const requestOrigin = 'https://maxvideoai.com';
const requestFixture = () => ({
  version: 1, source: 'maxvideoai-editor', projectId: 'project-owned',
  idempotencyKey: 'orchestration-export-fixture', createdAt: '2026-10-03T00:00:00Z', status: 'ready',
  manifest: {
    version: 1, source: 'maxvideoai-editor', projectName: 'Owned film', sequenceId: 'main', sequenceName: 'Main',
    projectSettings: { aspectRatio: '16:9', resolution: '1080p', fps: 30 },
    createdAt: '2026-10-03T00:00:00Z', status: 'ready', durationSec: 30,
    exportRange: { mode: 'sequence', startSec: 0, endSec: 30, durationSec: 30 }, issues: [],
    tracks: [{ id: 'video', durationSec: 30, clips: [{
      id: 'clip', outputNodeId: 'output', assetId: 'asset', title: 'Clip', track: 'video', mediaKind: 'video',
      mediaUrl: 'https://cdn.maxvideoai.com/renders/export-owner/clip.mp4',
      startSec: 0, endSec: 30, durationSec: 30, sourceStartSec: 0, sourceEndSec: 30, sourceDurationSec: 30,
    }] }],
  },
  exportSettings: { format: 'mp4-h264', qualityPreset: 'standard', includeAudio: true, serverRenderMode: 'server' },
});

type Fixture = ReturnType<typeof fixtureState>;
function fixtureState(usedFreeExports = 0) {
  return { usedFreeExports, now: 1_800_000_000, walletCents: 1000,
    jobs: [] as any[], receipts: [] as { userId: string; type: string; amountCents: number; exportId: string }[],
    events: [] as string[], ownership: [] as any[], resolverError: '', launchError: '', configError: '',
    canonicalRequest: null as ReturnType<typeof requestFixture> | null, lockDelaySeconds: 0,
  };
}

// Only external persistence and worker boundaries are doubled. The real parser,
// pricing, HMAC, reservation transaction, repository and owned projection execute.
async function load(fixture: Fixture) {
  const query = async (sql: string, values: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('SELECT COUNT(*)')) {
      fixture.events.push(`quota:${values[0]}`);
      return [{ count: fixture.usedFreeExports + fixture.jobs.filter(job => job.user_id === values[0]
        && ['free_reserved', 'free_completed'].includes(job.billing_status)).length }];
    }
    if (normalized.startsWith('SELECT *') && normalized.includes('idempotency_key = $2')) {
      return fixture.jobs.filter(job => job.user_id === values[0] && job.idempotency_key === values[1]);
    }
    if (normalized.startsWith('SELECT *') && normalized.includes('id = $1 AND user_id = $2')) {
      fixture.events.push(`status:${values[1]}`);
      return fixture.jobs.filter(job => job.id === values[0] && job.user_id === values[1]);
    }
    if (normalized.startsWith('SELECT GREATEST')) return [{ balance_cents: fixture.walletCents }];
    if (normalized.startsWith('INSERT INTO app_receipts')) {
      const type = normalized.includes("'refund'") ? 'refund' : 'charge';
      const exportId = type === 'refund' ? values[2] : values[3];
      fixture.receipts.push({ userId: values[0], type, amountCents: values[1], exportId });
      fixture.events.push(type);
      return [];
    }
    if (normalized.startsWith('INSERT INTO app_timeline_exports')) {
      const job = { id: values[0], user_id: values[1], idempotency_key: values[2], project_name: values[3],
        duration_sec: values[4], resolution: values[5], fps: values[6], quality_preset: values[7],
        amount_cents: values[8], currency: values[9], billing_kind: values[10], billing_status: values[11],
        render_manifest: JSON.parse(values[12]), export_settings: JSON.parse(values[13]),
        status: 'queued', progress: 0, message: null, output_url: null, output_asset_id: null,
        output_size_bytes: null, output_mime_type: null,
      };
      fixture.jobs.push(job); fixture.events.push('insert-job'); return [job];
    }
    if (normalized.startsWith('UPDATE app_timeline_exports') && normalized.includes("status = 'failed'")) {
      Object.assign(fixture.jobs.find(job => job.id === values[0]), { status: 'failed', message: values[1], billing_status: values[2] });
      fixture.events.push('fail-job'); return [];
    }
    throw new Error(`Unexpected offline database operation: ${normalized}`);
  };
  const stubs: Record<string, string> = {
    'server-only': '',
    '@/lib/db': 'export const query = (...args) => fixture.query(...args); export const withDbTransaction = async fn => {fixture.events.push("transaction");return fn({query});};',
    '@/lib/schema': 'export const ensureBillingSchema = async () => {}; export const ensureAssetSchema = async () => {throw Error("Unexpected media schema write");};',
    '@/lib/wallet': 'export const lockUserWalletInExecutor = async (_,userId) => {fixture.events.push("wallet-lock:"+userId);fixture.now += fixture.lockDelaySeconds;};',
    './schema': 'export const ensureTimelineExportSchema = async () => {};',
    '@/server/timeline-exports/manifest-resolver': 'export const resolveOwnedTimelineExportRequest = async input => {fixture.ownership.push(input);if(fixture.resolverError)throw Error(fixture.resolverError);return fixture.canonicalRequest ?? input.request;};',
    '@/server/timeline-exports/ecs-runner': 'export const assertTimelineExportWorkerLauncherConfigured = () => {fixture.events.push("preflight");if(fixture.configError)throw Error(fixture.configError);}; export const launchTimelineExportWorkerTask = async input => {fixture.events.push("launch:"+input.exportId);if(fixture.launchError)throw Error(fixture.launchError);return {status:"launched",taskArns:["offline-task"]};};',
  };
  const result = await build({ absWorkingDir: frontend,
    stdin: { contents: "export * from './src/server/timeline-exports/orchestration';", resolveDir: frontend, loader: 'ts' },
    tsconfig: resolve(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external',
    plugins: [{ name: 'offline-export-service', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const module = { exports: {} as any };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, fixture: Object.assign(fixture, { query }),
    require: createRequire(resolve(frontend, 'package.json')), process: { env: { NODE_ENV: 'test' }, cwd: () => frontend },
    Date: class extends Date { static now() { return fixture.now * 1000; } },
    URL, Response, AbortController, Buffer, setTimeout, clearTimeout, console });
  return { service: module.exports, deps: { resolveTimelineExportEstimateSecret: () => secret, now: () => fixture.now } };
}

async function estimate(fixture: Fixture, rawRequest: unknown = requestFixture()) {
  const loaded = await load(fixture);
  const quote = await loaded.service.estimateOwnedTimelineExport({ userId, requestOrigin, rawRequest }, loaded.deps);
  assert.equal(quote.status, 200, JSON.stringify(quote));
  return { ...loaded, quote };
}

test('estimate and submit use the canonical owned manifest, current quota and the exact quoted amount', async () => {
  for (const usedFreeExports of [0, 2]) {
    const fixture = fixtureState(usedFreeExports);
    fixture.canonicalRequest = requestFixture();
    fixture.canonicalRequest.manifest.projectName = 'Server owned title';
    const { service, deps, quote } = await estimate(fixture);
    assert.equal(quote.body.quota.freeExportsRemaining, usedFreeExports === 0 ? 2 : 0);
    assert.equal(quote.body.estimate.amountCents, usedFreeExports === 0 ? 0 : 180);
    assert.equal(quote.body.estimateExpiresAt, fixture.now + 300);
    const result = await service.submitOwnedTimelineExport({ userId, requestOrigin,
      rawRequest: requestFixture(), estimateToken: quote.body.estimateToken }, deps);
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.body.export.billing.amountCents, quote.body.estimate.amountCents);
    assert.equal(result.body.billing.billingStatus, usedFreeExports === 0 ? 'free_reserved' : 'paid_reserved');
    assert.equal(fixture.jobs[0].project_name, 'Server owned title');
    assert.equal(fixture.ownership.length, 2);
    assert.ok(fixture.ownership.every(input => input.userId === userId && input.requestOrigin === requestOrigin));
    assert.ok(fixture.events.indexOf('preflight') < fixture.events.indexOf('transaction'));
    assert.equal(fixture.events.filter(event => event.startsWith('launch:')).length, 1);
    assert.equal(fixture.receipts.length, usedFreeExports === 0 ? 0 : 1);
  }
});

test('missing, expired, invalid and changed estimates reject before reservation or launch', async () => {
  for (const failure of ['required', 'expired', 'invalid', 'quota', 'manifest', 'user', 'preset', 'idempotency']) {
    const fixture = fixtureState();
    const { service, deps, quote } = await estimate(fixture);
    if (failure === 'expired') fixture.now += 301;
    if (failure === 'quota') fixture.usedFreeExports = 2;
    const rawRequest = requestFixture();
    if (failure === 'manifest') rawRequest.manifest.projectName = 'Changed title';
    if (failure === 'preset') rawRequest.exportSettings.qualityPreset = 'high';
    if (failure === 'idempotency') rawRequest.idempotencyKey = 'different-orchestration-key';
    const token = failure === 'required' ? undefined : failure === 'invalid' ? 'tampered.token' : quote.body.estimateToken;
    const result = await service.submitOwnedTimelineExport({ userId: failure === 'user' ? 'foreign-user' : userId,
      requestOrigin, rawRequest, estimateToken: token }, deps);
    const expected = failure === 'required' ? 'EXPORT_ESTIMATE_REQUIRED'
      : failure === 'expired' ? 'EXPORT_ESTIMATE_EXPIRED'
      : failure === 'invalid' ? 'EXPORT_ESTIMATE_INVALID' : 'EXPORT_ESTIMATE_CHANGED';
    assert.equal(result.status, 409, failure);
    assert.equal(result.body.error, expected, failure);
    assert.equal(result.body.reestimate, true);
    assert.equal(fixture.jobs.length, 0);
    assert.equal(fixture.receipts.length, 0);
    assert.equal(fixture.events.filter(event => event.startsWith('launch:')).length, 0);
  }
});

test('stale owned state has matching estimate and submit errors and never reserves', async () => {
  const fixture = fixtureState();
  fixture.resolverError = 'EXPORT_PROJECT_STATE_STALE';
  const { service, deps } = await load(fixture);
  for (const result of [
    await service.estimateOwnedTimelineExport({ userId, requestOrigin, rawRequest: requestFixture() }, deps),
    await service.submitOwnedTimelineExport({ userId, requestOrigin, rawRequest: requestFixture(), estimateToken: 'present' }, deps),
  ]) {
    assert.equal(result.status, 409);
    assert.equal(result.body.error, 'EXPORT_PROJECT_STATE_STALE');
    assert.equal(result.body.reestimate, true);
  }
  assert.equal(fixture.jobs.length, 0);
  assert.equal(fixture.events.length, 0);
});

test('the default clock validates quote expiry after acquiring the reservation lock', async () => {
  const fixture = fixtureState(2);
  const { service } = await load(fixture);
  const deps = { resolveTimelineExportEstimateSecret: () => secret };
  const quote = await service.estimateOwnedTimelineExport({ userId, requestOrigin, rawRequest: requestFixture() }, deps);
  assert.equal(quote.status, 200);
  fixture.lockDelaySeconds = 301;
  const result = await service.submitOwnedTimelineExport({ userId, requestOrigin,
    rawRequest: requestFixture(), estimateToken: quote.body.estimateToken }, deps);
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'EXPORT_ESTIMATE_EXPIRED');
  assert.equal(fixture.jobs.length, 0);
  assert.equal(fixture.receipts.length, 0);
});

test('failed launch releases the free slot or refunds the stored paid reservation before failing the job', async () => {
  for (const usedFreeExports of [0, 2]) {
    const fixture = fixtureState(usedFreeExports);
    const { service, deps, quote } = await estimate(fixture);
    fixture.launchError = 'Offline launch failed';
    const result = await service.submitOwnedTimelineExport({ userId, requestOrigin,
      rawRequest: requestFixture(), estimateToken: quote.body.estimateToken }, deps);
    assert.equal(result.status, 503, JSON.stringify(result));
    assert.equal(result.body.error, 'TIMELINE_EXPORT_WORKER_LAUNCH_FAILED');
    assert.equal(result.body.export.status, 'failed');
    const status = usedFreeExports === 0 ? 'free_released' : 'refunded';
    assert.equal(fixture.jobs[0].billing_status, status);
    assert.equal(result.body.billing.billingStatus, status);
    if (usedFreeExports === 2) {
      assert.equal(fixture.receipts[1].type, 'refund');
      assert.equal(fixture.receipts[1].amountCents, fixture.jobs[0].amount_cents);
      assert.equal(fixture.receipts[1].exportId, fixture.jobs[0].id);
      assert.ok(fixture.events.indexOf('refund') < fixture.events.indexOf('fail-job'));
    } else {
      assert.equal(fixture.receipts.length, 0);
      assert.equal((await service.estimateOwnedTimelineExport({ userId, requestOrigin, rawRequest: requestFixture() }, deps)).body.quota.freeExportsRemaining, 2);
    }
  }
});

test('replayed submit retains stored pricing, skips worker preflight and does not reserve or launch again', async () => {
  const fixture = fixtureState(2);
  const { service, deps, quote } = await estimate(fixture);
  const input = { userId, requestOrigin, rawRequest: requestFixture(), estimateToken: quote.body.estimateToken };
  const first = await service.submitOwnedTimelineExport(input, deps);
  assert.equal(first.status, 200);
  fixture.now += 301; fixture.configError = 'Worker unavailable'; fixture.usedFreeExports = 0;
  const replay = await service.submitOwnedTimelineExport(input, deps);
  assert.equal(replay.status, 200, JSON.stringify(replay));
  assert.equal(replay.body.reused, true);
  assert.equal(replay.body.billing, null);
  assert.equal(replay.body.export.billing.amountCents, 180);
  assert.equal(replay.body.workerLaunch.status, 'reused');
  assert.equal(fixture.jobs.length, 1);
  assert.equal(fixture.receipts.length, 1);
  assert.equal(fixture.events.filter(event => event === 'preflight').length, 1);
  assert.equal(fixture.events.filter(event => event.startsWith('launch:')).length, 1);
  const changed = requestFixture(); changed.exportSettings.includeAudio = false;
  const conflict = await service.submitOwnedTimelineExport({ ...input, rawRequest: changed }, deps);
  assert.equal(conflict.status, 400);
  assert.equal(conflict.body.error, 'EXPORT_IDEMPOTENCY_CONFLICT');
});

test('worker configuration and insufficient wallet errors keep existing HTTP status and never launch', async () => {
  for (const failure of ['config', 'wallet']) {
    const fixture = fixtureState(2);
    const { service, deps, quote } = await estimate(fixture);
    if (failure === 'config') fixture.configError = 'MISSING_OFFLINE_CONFIG';
    else fixture.walletCents = 100;
    const result = await service.submitOwnedTimelineExport({ userId, requestOrigin,
      rawRequest: requestFixture(), estimateToken: quote.body.estimateToken }, deps);
    assert.equal(result.status, failure === 'config' ? 503 : 402);
    assert.equal(result.body.error, failure === 'config' ? 'TIMELINE_EXPORT_WORKER_NOT_CONFIGURED' : 'INSUFFICIENT_WALLET_BALANCE');
    assert.equal(fixture.jobs.length, 0); assert.equal(fixture.receipts.length, 0);
    assert.equal(fixture.events.filter(event => event.startsWith('launch:')).length, 0);
    if (failure === 'config') assert.ok(!fixture.events.includes('transaction'));
  }
});

test('status recovers the stored amount through the owner and denies a foreign export without mutations', async () => {
  const fixture = fixtureState(2);
  const { service, deps, quote } = await estimate(fixture);
  const created = await service.submitOwnedTimelineExport({ userId, requestOrigin,
    rawRequest: requestFixture(), estimateToken: quote.body.estimateToken }, deps);
  fixture.jobs[0].status = 'rendering'; fixture.jobs[0].progress = 35; fixture.usedFreeExports = 0;
  const before = JSON.stringify({ jobs: fixture.jobs, receipts: fixture.receipts });
  const owned = await service.readOwnedTimelineExportStatus({ userId, exportId: created.body.export.id }, deps);
  assert.equal(owned.status, 200);
  assert.equal(owned.body.export.status, 'rendering');
  assert.equal(owned.body.export.progress, 35);
  assert.equal(owned.body.export.billing.amountCents, 180);
  const foreign = await service.readOwnedTimelineExportStatus({ userId: 'foreign-user', exportId: created.body.export.id }, deps);
  assert.equal(foreign.status, 404); assert.equal(foreign.body.error, 'EXPORT_NOT_FOUND');
  assert.equal(JSON.stringify({ jobs: fixture.jobs, receipts: fixture.receipts }), before);
});
