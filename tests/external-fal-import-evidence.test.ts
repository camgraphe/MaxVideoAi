import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createFalClient } from '@fal-ai/client';
import { verifyExternalFalEvidence, verifyImportJournal } from '../frontend/server/external-fal-import/evidence';
import { importDigest, parseExternalFalImport } from '../frontend/server/external-fal-import/contract';
import * as recoveryEvidence from '../frontend/server/external-fal-import/evidence';

function fixture() {
  const bytes = readFileSync('tests/fixtures/studio-media/pattern-a.mp4');
  const owner = '11111111-1111-4111-8111-111111111111';
  const requestId = '01a15b12-7619-7060-8be6-f69e46ed0cf1';
  const endpoint = 'blackforestlabs/flux-3-max/text-to-video';
  const providerInput = { prompt: 'Film', duration: 5, resolution: '720p', aspect_ratio: '16:9', generate_audio: true, reasoning_level: 'high' };
  const result = { requestId, data: { video: { url: 'https://fal.media/original.mp4' }, seed: 42 } };
  const journal = Buffer.from([ { event: 'submission_started', endpoint, input: providerInput }, { event: 'accepted', requestId },
    { event: 'recovered', requestId, status: 'COMPLETED', result } ].map(row => JSON.stringify(row)).join('\n'));
  const input = parseExternalFalImport({ schemaVersion: 1, ownerUserId: owner, engineId: 'flux-3-max', mode: 't2v', endpoint,
    providerRequestId: requestId, providerInput, videoAssetId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    videoSha256: createHash('sha256').update(bytes).digest('hex'), evidenceSha256: createHash('sha256').update(journal).digest('hex'), references: [] });
  const asset = { id: 'asset', public_id: input.videoAssetId, user_id: owner, kind: 'video', url: 'https://media.maxvideoai.com/original.mp4',
    thumb_url: 'https://media.maxvideoai.com/poster.webp', mime_type: 'video/mp4', width: 0, height: 0, size_bytes: bytes.length,
    source_job_id: null, source_output_id: null, status: 'ready', deleted_at: null };
  const calls: string[] = [];
  const deps = { journal, readUrl: async ({ url }: { url: string }) => url,
    provider: { status: async () => ({ status: 'COMPLETED', request_id: requestId, response_url: null }), result: async () => result },
    fetcher: (async (url, init) => { assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error'); calls.push(String(url)); return new Response(bytes); }) as typeof fetch };
  return { input, asset, deps, calls, result, requestId };
}

test('import verifies actual provider identity, journal, durable bytes and ffprobe facts with GET-only boundaries', async () => {
  const { input, asset, deps, calls, result, requestId } = fixture();
  const verified = await verifyExternalFalEvidence(input, [asset], deps);
  assert.equal(verified.resolvedSeed, 42);
  assert.equal(verified.video.mediaFacts.original.sha256, input.videoSha256);
  assert.ok(verified.video.mediaFacts.durationSec > 0); assert.ok(verified.video.width > 0);
  assert.equal(calls.length, 3);
  assert.throws(() => verifyImportJournal(input, Buffer.from('changed')), /HASH/);
  calls.length = 0;
  await assert.rejects(verifyExternalFalEvidence(input, [asset], { ...deps,
    provider: { ...deps.provider, result: async () => ({ requestId: 'wrong', data: { video: { url: 'https://fal.media/original.mp4' } } }) } }), /REQUEST_ID/);
  assert.equal(calls.length, 0);
  await assert.rejects(verifyExternalFalEvidence(input, [asset], { ...deps,
    provider: { ...deps.provider, result: async () => ({ ...result, data: { video: { url: 'http://localhost/private' }, seed: 42 } }) } }), /HOST|DATA/);
  await assert.rejects(verifyExternalFalEvidence({ ...input, videoSha256: '0'.repeat(64) }, [asset], deps), /HASH/);
});

test('missing result header is accepted only with exact status identity and unchanged recorded data', async () => {
  const { input, asset, deps, result } = fixture();
  let proof: unknown;
  const verified = await verifyExternalFalEvidence(input, [asset], { ...deps,
    provider: { ...deps.provider, result: async () => ({ ...result, requestId: '' }) },
    onProviderEvidence: value => { proof = value; },
  });
  assert.equal(verified.providerResultSha256, importDigest(result.data));
  assert.equal((proof as { resultRequestId: string }).resultRequestId, '');
  assert.equal((proof as { status: { response_url: null } }).status.response_url, null);
});

test('wrong or missing status identity fails even when the result header is absent', async () => {
  for (const request_id of ['wrong', undefined]) {
    const { input, asset, deps, result, calls } = fixture();
    let resultCalls = 0;
    await assert.rejects(verifyExternalFalEvidence(input, [asset], { ...deps, provider: {
      status: async () => ({ status: 'COMPLETED', request_id }),
      result: async () => { resultCalls++; return { ...result, requestId: '' }; },
    } }), /STATUS.*ID/);
    assert.equal(resultCalls, 0);
    assert.equal(calls.length, 0);
  }
});

test('a provided response URL must bind the exact queue app and accepted generation', async () => {
  const { input, asset, deps, requestId } = fixture();
  const expected = `https://queue.fal.run/blackforestlabs/flux-3-max/requests/${requestId}`;
  for (const response_url of [expected.replace(requestId, 'wrong'), expected + '?redirect=1', expected.replace('queue.fal.run', 'example.test')]) {
    await assert.rejects(verifyExternalFalEvidence(input, [asset], { ...deps,
      provider: { ...deps.provider, status: async () => ({ status: 'COMPLETED', request_id: requestId, response_url }) },
    }), /RESPONSE_URL/);
  }
});

test('missing header cannot authorize changed provider data or a contradicted original result', async () => {
  const { input, asset, deps, result, calls } = fixture();
  await assert.rejects(verifyExternalFalEvidence(input, [asset], { ...deps,
    provider: { ...deps.provider, result: async () => ({ requestId: '', data: { ...result.data, seed: 43 } }) },
  }), /RESULT_DATA/);
  assert.equal(calls.length, 0);
});

test('installed Fal SDK recovery uses only the two exact GET URLs and preserves raw header absence', async () => {
  const { input, requestId } = fixture();
  const resultUrl = `https://queue.fal.run/blackforestlabs/flux-3-max/requests/${requestId}`;
  const calls: string[] = [];
  const records: unknown[] = [];
  const transport = recoveryEvidence.createExternalFalRecoveryFetch(input, (async (url, init) => {
    assert.equal(init?.redirect, 'error');
    calls.push(String(url));
    return new Response(JSON.stringify(String(url).endsWith('/status?logs=0')
      ? { status: 'COMPLETED', request_id: requestId, response_url: null }
      : { video: { url: 'https://fal.media/result.mp4' } }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch, value => records.push(value));
  const client = createFalClient({ credentials: 'test-only-fal-key', fetch: transport });
  const status = await client.queue.status(input.endpoint, { requestId, logs: false });
  const result = await client.queue.result(input.endpoint, { requestId });
  assert.equal(status.request_id, requestId);
  assert.equal(result.requestId, '');
  for (const url of [resultUrl.replace(requestId, 'other'), resultUrl + '?other=1', resultUrl + '/cancel']) {
    await assert.rejects(transport(url, { method: 'GET' }), /RECOVERY_ROUTE/);
  }
  await assert.rejects(transport(resultUrl, { method: 'POST' }), /RECOVERY_ROUTE/);
  assert.equal(calls.length, 2);
  assert.equal((records[0] as { requestIdHeader: null }).requestIdHeader, null);
  assert.deepEqual(calls, [resultUrl + '/status?logs=0', resultUrl]);
});
