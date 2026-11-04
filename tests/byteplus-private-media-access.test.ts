import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import test from 'node:test';
import type { BytePlusSeedancePayload } from '../frontend/src/server/video-providers/byteplus-modelark-payload';

// Synthetic credentials only: signing is local and every provider request is intercepted.
Object.assign(process.env, {
  S3_BUCKET: 'seedance-reference-fixture', S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'fixture-access', S3_SECRET_ACCESS_KEY: 'fixture-secret',
  S3_PUBLIC_BASE_URL: 'https://media.seedance-fixture.test',
  MCP_STAGING_REFERENCE_STORAGE_PREFIX: '', VIDEO_RENDER_STORAGE_PREFIX: '',
  BYTEPLUS_ARK_API_KEY: 'fixture-provider-key', BYTEPLUS_ARK_BASE_URL: 'https://seedance-provider.test/api/v3',
  SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_PROVIDER: 'byteplus_modelark',
});
const owner = 'owner';
const hash = createHash('sha256').update(owner).digest('hex').slice(0, 32);
const base = process.env.S3_PUBLIC_BASE_URL!;
const preparedAudio = `${base}/user-assets/by-content/${hash}/video-excerpts-private-v3-prepared-existing.wav`;

async function submission(overrides: Record<string, unknown> = {}, records: unknown[] = []) {
  const { submitBytePlusGenerateTask } = await import('../frontend/app/api/generate/_lib/byteplus-submission');
  return submitBytePlusGenerateTask({
    jobId: 'job-fixture', userId: owner, engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5',
    prompt: 'Use the reference soundtrack. Documentation: https://example.test/music', durationSec: 5,
    mode: 'ref2v', initialImageUrl: null, endImageUrl: null,
    normalizedReferenceImages: ['https://external.test/image.png'], videoUrls: [],
    resolvedAudioUrl: preparedAudio, audioUrls: [preparedAudio],
    effectiveResolution: '720p', aspectRatio: '16:9', audioEnabled: true,
    placeholderThumb: '/thumb.svg', pricing: { totalCents: 300, currency: 'USD' } as never,
    paymentStatus: 'paid_wallet', pendingReceipt: null, paymentMode: 'wallet', walletChargeReserved: true,
    batchId: null, groupId: null, iterationIndex: null, iterationCount: null, renderIds: null,
    heroRenderId: null, localKey: null,
    deps: { queryFn: async (sql, params) => { records.push({ sql, params }); return []; },
      logMetricFn: (kind, options) => { records.push({ kind, options }); } },
    ...overrides,
  } as Parameters<typeof submitBytePlusGenerateTask>[0]);
}

test('existing private prepared audio gets an owned GET grant only in the actual Seedance request', async t => {
  const records: unknown[] = [];
  t.mock.method(console, 'warn', (...args) => { records.push(args); });
  const requests: Array<{ url: string; payload: BytePlusSeedancePayload }> = [];
  const original = { resolvedAudioUrl: preparedAudio, audioUrls: [preparedAudio] };
  const snapshot = structuredClone(original);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), payload: JSON.parse(String(options?.body)) });
    return Response.json({ id: 'accepted-fixture', status: 'queued' });
  });
  const result = await submission(original, records);
  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://seedance-provider.test/api/v3/contents/generations/tasks');
  const payload = requests[0].payload;
  const audio = payload.content.filter(item => item.type === 'audio_url');
  assert.equal(audio.length, 1);
  const grant = new URL(audio[0].audio_url.url);
  assert.equal(grant.pathname, new URL(preparedAudio).pathname);
  assert.equal(grant.searchParams.get('X-Amz-Expires'), '3600');
  assert.ok(grant.searchParams.get('X-Amz-Signature'));
  assert.equal(payload.content[0].text, 'Use the reference soundtrack. Documentation: https://example.test/music');
  assert.equal(payload.content[1].image_url.url, 'https://external.test/image.png');
  assert.deepEqual(original, snapshot);
  assert.doesNotMatch(inspect({ records, result }), /X-Amz-|fixture-secret|fixture-access/);
});

test('foreign and unowned private references stop before any Seedance request', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; return Response.json({ id: 'unexpected', status: 'queued' }); });
  t.mock.method(console, 'warn', () => {});
  for (const url of [preparedAudio.replace(hash, `${hash}-extra`), `${base}/user-assets/by-content/foreign/video-excerpts-private-v3-prepared.wav`, `${base}/unowned/audio.wav`]) {
    const result = await submission({ resolvedAudioUrl: url, audioUrls: [url] });
    assert.equal(result.ok, false);
    assert.equal(result.body.failureCode, 'seedance_reference_media_unavailable');
    assert.match(String(result.body.message), /could not read.*reference media/i);
    assert.doesNotMatch(String(result.body.message), /recognizable|person|safety|https?:/i);
  }
  assert.equal(requests, 0);
});

test('inaccessible audio diagnostics are classified separately from real-person moderation and stay safe in receipts', async () => {
  const { getBytePlusTaskFailureCode, getBytePlusUserSafeErrorMessage } = await import('../frontend/src/server/video-providers/byteplus-modelark-response');
  const { getSeedanceFailureMessage } = await import('../frontend/lib/seedance-failure-messages');
  const { toUserFacingFailureMessage, toUserFacingRefundReason } = await import('../frontend/server/user-facing-failure-messages');
  const raw = 'The parameter `content[2].audio_url.url` specified in the request is not valid: resource inaccessible. Request id: fixture';
  assert.equal(getBytePlusTaskFailureCode(raw, 'BYTEPLUS_PROVIDER_ERROR'), 'seedance_reference_media_unavailable');
  const message = getBytePlusUserSafeErrorMessage(raw);
  assert.match(message, /could not read.*reference media/i);
  assert.equal(toUserFacingFailureMessage(message), message);
  assert.equal(toUserFacingRefundReason(message), 'Reference media could not be read.');
  for (const locale of ['en', 'fr', 'es']) {
    const translated = getSeedanceFailureMessage({ failureCode: 'seedance_reference_media_unavailable', locale });
    assert.ok(translated);
    assert.doesNotMatch(translated, /recognizable|personne|personas|safety|sécurité|seguridad|content\[|https?:/i);
  }
  const moderation = "The request failed because the input video 'content[2]' may contain real person.";
  assert.equal(getBytePlusTaskFailureCode(moderation), 'seedance_reference_video_blocked');
  assert.match(getBytePlusUserSafeErrorMessage(moderation), /reference video.*recognizable person/i);
  assert.equal(getBytePlusTaskFailureCode(moderation, 'REFERENCE_INVALID'), 'seedance_reference_video_blocked');
  for (const kind of ['image', 'video', 'audio']) {
    assert.equal(getBytePlusTaskFailureCode(`The parameter content[3].${kind}_url.url is not valid: resource inaccessible.`),
      'seedance_reference_media_unavailable');
  }
  assert.equal(getBytePlusTaskFailureCode('The selected model resource is inaccessible.'), null);
  assert.doesNotMatch(getBytePlusUserSafeErrorMessage('Unspecified submission failure'), /recognizable|person|safety/i);
});

test('signed input echoes are removed from synchronous and asynchronous BytePlus diagnostics', async () => {
  const { scrubBytePlusError } = await import('../frontend/src/server/video-providers/byteplus-modelark-response');
  const grant = `${preparedAudio}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=fixture-access&X-Amz-Signature=fixture-secret&X-Amz-Expires=3600`;
  for (let depth = 0, encoded = grant; depth < 4; depth++, encoded = encodeURIComponent(encoded)) {
    for (const diagnostic of [new Error(`Could not read ${encoded}`), { error: { message: `Could not read ${encoded}` } }]) {
      const safe = scrubBytePlusError(diagnostic);
      assert.doesNotMatch(safe, /X-Amz-|fixture-access|fixture-secret|X-Amz%/i);
      assert.match(safe, /Could not read/);
    }
  }
});

test('an accepted Edit replay returns its existing task without re-signing or re-submitting references', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw new Error('no network on replay'); });
  const queries: unknown[] = [];
  const result = await submission({ mode: 'v2v', userId: 'another-owner', deps: {
    queryFn: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      return [{ job_id: 'job-fixture', user_id: 'another-owner', provider_job_id: 'accepted-before', status: 'queued',
        payment_status: 'paid_wallet', settings_snapshot: { byteplusSubmission: { phase: 'accepted' } } }];
    },
  } });
  assert.equal(result.ok, true);
  assert.equal(result.body.providerJobId, 'accepted-before');
  assert.equal(requests, 0);
  assert.equal(queries.length, 1);
});

test('typed image, video and audio references share one owner-checked grant without changing canonical inputs', async () => {
  const { createBytePlusMediaTransport } = await import('../frontend/src/server/video-providers/byteplus-modelark-media-access');
  const { createOwnedMediaReadUrl } = await import('../frontend/server/owned-media-read-access');
  const payload: BytePlusSeedancePayload = { model: 'fixture', duration: 5, resolution: '720p', generate_audio: true,
    watermark: false, content: [
      { type: 'text', text: `Use ${preparedAudio} as a soundtrack reference.` },
      { type: 'image_url', image_url: { url: preparedAudio }, role: 'first_frame' },
      { type: 'image_url', image_url: { url: preparedAudio }, role: 'last_frame' },
      { type: 'image_url', image_url: { url: preparedAudio }, role: 'reference_image' },
      { type: 'video_url', video_url: { url: preparedAudio }, role: 'reference_video' },
      { type: 'audio_url', audio_url: { url: preparedAudio }, role: 'reference_audio' },
    ] };
  const snapshot = structuredClone(payload);
  const reads: unknown[] = [];
  const grant = `${preparedAudio}?X-Amz-Signature=fixture-secret&X-Amz-Expires=3600`;
  const transport = await createBytePlusMediaTransport({ payload, userId: owner }, {
    read: async input => { reads.push(input); return createOwnedMediaReadUrl(input, { sign: async () => grant }); },
  });
  assert.deepEqual(reads, [{ url: preparedAudio, userId: owner, expiresInSeconds: 3600 }]);
  assert.deepEqual(payload, snapshot);
  assert.equal(transport.payload.content[0].type, 'text');
  assert.deepEqual(transport.payload.content[0], payload.content[0]);
  for (const item of transport.payload.content.slice(1)) {
    assert.equal(item.type === 'image_url' ? item.image_url.url : item.type === 'video_url' ? item.video_url.url
      : item.type === 'audio_url' ? item.audio_url.url : null, grant);
  }
  assert.deepEqual(transport.sanitize({ message: `Rejected ${grant}`, nested: [encodeURIComponent(grant)] }),
    { message: `Rejected ${preparedAudio}`, nested: [encodeURIComponent(preparedAudio)] });
});

test('signing outages expose a safe local error instead of forwarding the private original', async () => {
  const { createBytePlusMediaTransport } = await import('../frontend/src/server/video-providers/byteplus-modelark-media-access');
  const { buildBytePlusSeedancePayload } = await import('../frontend/src/server/video-providers/byteplus-modelark-payload');
  const payload = buildBytePlusSeedancePayload({ modelId: 'fixture', prompt: 'Use the soundtrack', mode: 'ref2v',
    durationSec: 5, resolution: '720p', referenceImageUrls: ['https://external.test/image.png'], referenceAudioUrls: [preparedAudio] });
  await assert.rejects(createBytePlusMediaTransport({ payload, userId: owner }, {
    read: async () => { throw new Error('fixture-secret signer outage'); },
  }), (error: unknown) => {
    const failure = error as Error & { code: string; status: number };
    assert.equal(failure.code, 'REFERENCE_ACCESS_FAILED');
    assert.equal(failure.status, 503);
    assert.equal(failure.message, 'Reference media could not be read.');
    assert.doesNotMatch(inspect(error), /fixture-secret|https?:/);
    return true;
  });
});

test('a provider audio-access rejection cannot leak its signed input or claim moderation', async t => {
  const records: unknown[] = [];
  t.mock.method(console, 'warn', (...args) => { records.push(args); });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const payload = JSON.parse(String(options?.body)) as BytePlusSeedancePayload;
    const audio = payload.content.find(item => item.type === 'audio_url');
    assert.equal(audio?.type, 'audio_url');
    return Response.json({ error: { message: `The parameter content[2].audio_url.url is not valid: resource inaccessible. ${audio.audio_url.url}` } }, { status: 400 });
  });
  const result = await submission({}, records);
  assert.equal(result.ok, false);
  assert.equal(result.body.failureCode, 'seedance_reference_media_unavailable');
  assert.match(String(result.body.message), /could not read.*reference media/i);
  assert.doesNotMatch(inspect({ records, result }), /X-Amz-|fixture-secret|fixture-access|recognizable|safety/i);
});

test('Final draft-task identity passes through without any URL access request', async () => {
  const { createBytePlusMediaTransport } = await import('../frontend/src/server/video-providers/byteplus-modelark-media-access');
  const { buildSeedance25FinalRequest } = await import('../frontend/src/server/video-providers/byteplus-modelark-draft');
  const payload = buildSeedance25FinalRequest({ modelId: 'fixture', draftProviderTaskId: 'owned-draft-task' });
  const transport = await createBytePlusMediaTransport({ payload, userId: owner }, {
    read: async () => { throw new Error('Final has no media URLs'); },
  });
  assert.deepEqual(transport.payload, payload);
});
