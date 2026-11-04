import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

// A deterministic local signing outage, with no credentials or storage/provider requests.
Object.assign(process.env, {
  S3_BUCKET: 'trial-access-fixture', S3_REGION: '', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '',
  S3_PUBLIC_BASE_URL: 'https://media.trial-access-fixture.test',
  MCP_STAGING_REFERENCE_STORAGE_PREFIX: '', VIDEO_RENDER_STORAGE_PREFIX: '',
  SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_PROVIDER: 'byteplus_modelark',
});

test('a pre-dispatch signer outage is definitive for the MCP trial while a dispatched 503 stays ambiguous', async t => {
  const { submitBytePlusGenerateTask } = await import('../frontend/app/api/generate/_lib/byteplus-submission');
  const { BytePlusModelArkError } = await import('../frontend/src/server/video-providers/byteplus-modelark-error');
  const owner = 'trial-owner';
  const hash = createHash('sha256').update(owner).digest('hex').slice(0, 32);
  const privateAudio = `${process.env.S3_PUBLIC_BASE_URL}/user-assets/by-content/${hash}/video-excerpts-private-v3-prepared.wav`;
  t.mock.method(console, 'warn', () => {});
  let networkRequests = 0;
  t.mock.method(globalThis, 'fetch', async () => { networkRequests++; throw new Error('No live network allowed'); });
  for (const localFailure of [true, false]) {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    let providerCalls = 0;
    const result = await submitBytePlusGenerateTask({
      jobId: 'trial-job', userId: owner, engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5',
      prompt: 'Follow the soundtrack', durationSec: 5, mode: 'ref2v',
      initialImageUrl: null, endImageUrl: null, normalizedReferenceImages: ['https://external.test/image.png'],
      videoUrls: [], resolvedAudioUrl: localFailure ? privateAudio : 'https://external.test/audio.wav', audioUrls: [],
      effectiveResolution: '720p', aspectRatio: '16:9', audioEnabled: true, placeholderThumb: '/thumb.svg',
      pricing: { totalCents: 0, currency: 'USD' } as never, paymentStatus: 'included_mcp_trial', pendingReceipt: null,
      paymentMode: 'mcp_trial', walletChargeReserved: false, batchId: null, groupId: null, iterationIndex: null,
      iterationCount: null, renderIds: null, heroRenderId: null, localKey: null,
      deps: {
        getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'fixture' }) as never,
        getBytePlusModelArkClientFn: () => ({ createSeedanceFastTask: async () => {
          providerCalls++;
          // An identical provider error after dispatch must never prove a local failure.
          throw new BytePlusModelArkError('Reference media could not be read.', { status: 503, code: 'REFERENCE_ACCESS_FAILED' });
        } }) as never,
        queryFn: async (sql, params) => { queries.push({ sql, params }); return []; },
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.status, 503);
    assert.equal(result.body.failureCode, 'seedance_reference_media_unavailable');
    assert.equal(providerCalls, localFailure ? 0 : 1);
    const failed = queries.find(item => item.sql.includes("SET status = 'failed'"));
    assert.ok(failed);
    assert.equal(failed.params?.[5], localFailure ? 'definitive_failure' : 'unknown');
  }
  assert.equal(networkRequests, 0);
});
