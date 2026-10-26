import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
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

test('Kling evidence binds poster and short silent preview hashes and rejects a substituted or audible preview', async () => {
  const original = readFileSync('tests/fixtures/studio-media/pattern-a.mp4');
  const preview = execFileSync('ffmpeg', ['-v', 'error', '-i', 'tests/fixtures/studio-media/pattern-a.mp4', '-t', '2', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1']);
  const poster = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#123456' } }).webp().toBuffer();
  const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const requestId = '01a15b12-7619-7060-8be6-f69e46ed0cf1';
  const endpoint = 'kling/v4/text-to-video';
  const providerInput = { prompt: 'A film.', duration: 5, resolution: '1080p', aspect_ratio: '16:9' };
  const result = { requestId, data: { video: { url: 'https://fal.media/original.mp4' } } };
  const journal = Buffer.from([{ event: 'submission_started', endpoint, input: providerInput }, { event: 'accepted', requestId },
    { event: 'recovered', requestId, status: 'COMPLETED', result }].map(value => JSON.stringify(value)).join('\n'));
  const base = fixture();
  const input = parseExternalFalImport({ ...base.input, engineId: 'kling-v4', endpoint, providerInput, videoSha256: digest(original),
    evidenceSha256: digest(journal), media: { poster: { url: base.asset.thumb_url, sha256: digest(poster) },
      preview: { url: 'https://media.maxvideoai.com/preview.mp4', sha256: digest(preview) } } });
  const asset = { ...base.asset, preview_url: 'https://media.maxvideoai.com/preview.mp4' };
  const deps = { ...base.deps, journal,
    provider: { status: async () => ({ status: 'COMPLETED', request_id: requestId }), result: async () => result },
    fetcher: (async (url: unknown) => new Response(String(url).endsWith('.webp') ? poster : String(url).endsWith('/preview.mp4') ? preview : original)) as typeof fetch };
  // Strip audio from a real fixture for the card role; the original retains its audio.
  const verified = await verifyExternalFalEvidence(input, [asset], deps);
  assert.equal(verified.display?.poster.sha256, digest(poster));
  assert.equal(verified.display?.preview.sha256, digest(preview));
  assert.equal(verified.display?.preview.hasAudio, false);
  await assert.rejects(verifyExternalFalEvidence(input, [asset], { ...deps,
    fetcher: (async (url: unknown) => new Response(String(url).endsWith('.webp') ? Buffer.from('substituted') : original)) as typeof fetch }), /HASH/);
  if (input.engineId !== 'kling-v4') throw new Error('test fixture');
  await assert.rejects(verifyExternalFalEvidence({ ...input, media: { ...input.media, preview: { ...input.media.preview, sha256: digest(original) } } }, [asset], { ...deps,
    fetcher: (async (url: unknown) => new Response(String(url).endsWith('.webp') ? poster : original)) as typeof fetch }), /SHORT_AND_SILENT/);
  await assert.rejects(verifyExternalFalEvidence(input, [{ ...asset, preview_url: 'https://media.maxvideoai.com/other.mp4' }], deps), /PREVIEW/);
});

test('Kling imports accepted Edit sources within media tolerance without expanding the reference-video budget', async () => {
  const original = readFileSync('tests/fixtures/studio-media/pattern-a.mp4');
  const preview = execFileSync('ffmpeg', ['-v', 'error', '-i', 'tests/fixtures/studio-media/pattern-a.mp4', '-t', '2', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1']);
  const source = execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=720x720:r=30', '-frames:v', '901', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1']);
  const poster = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#123456' } }).webp().toBuffer();
  const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const base = fixture(), requestId = base.requestId;
  const sourceUrl = 'https://fal.media/source.mp4';
  for (const mode of ['v2v', 'ref2v'] as const) {
    const endpoint = mode === 'v2v' ? 'kling/v4/video-to-video/edit' : 'kling/v4/reference-to-video';
    const providerInput = { prompt: 'A film.', duration: 5, ...(mode === 'v2v' ? { video_url: sourceUrl } : { video_urls: [sourceUrl] }) };
    const result = { requestId, data: { video: { url: 'https://fal.media/original.mp4' } } };
    const journal = Buffer.from([{ event: 'submission_started', endpoint, input: providerInput }, { event: 'accepted', requestId },
      { event: 'recovered', requestId, status: 'COMPLETED', result }].map(value => JSON.stringify(value)).join('\n'));
    const sourceAsset = { ...base.asset, public_id: 'ma_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', url: 'https://media.maxvideoai.com/source.mp4', size_bytes: source.length };
    const input = parseExternalFalImport({ ...base.input, engineId: 'kling-v4', mode, endpoint, providerInput,
      videoSha256: digest(original), evidenceSha256: digest(journal), references: [{ slotId: mode === 'v2v' ? 'video_url' : 'video_urls.0', kind: 'video',
        providerUrl: sourceUrl, assetId: sourceAsset.public_id, sha256: digest(source) }],
      media: { poster: { url: base.asset.thumb_url, sha256: digest(poster) }, preview: { url: 'https://media.maxvideoai.com/preview.mp4', sha256: digest(preview) } } });
    const deps = { ...base.deps, journal, provider: { status: async () => ({ status: 'COMPLETED', request_id: requestId }), result: async () => result },
      fetcher: (async (url: unknown) => new Response(String(url).endsWith('/source.mp4') ? source : String(url).endsWith('.webp') ? poster : String(url).endsWith('/preview.mp4') ? preview : original)) as typeof fetch };
    const verify = () => verifyExternalFalEvidence(input, [{ ...base.asset, preview_url: 'https://media.maxvideoai.com/preview.mp4' }, sourceAsset], deps);
    if (mode === 'v2v') assert.ok((await verify()).referenceProofs.length === 1);
    else await assert.rejects(verify(), /REFERENCE_VIDEO_DURATION_LIMIT/);
  }
});
