import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import test from 'node:test';
import type { GeneratePayload, GenerateResult } from '../frontend/src/lib/fal-types';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { S3Client, PutObjectCommand } = requireFrontend('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
const sharp = requireFrontend('sharp') as typeof import('sharp');
process.env.S3_BUCKET = 'fal-read-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'fixture-access-key';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://fal-read-fixture.s3.us-east-1.amazonaws.com';
process.env.S3_UPLOAD_ACL = '';
process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = '';
process.env.VIDEO_RENDER_STORAGE_PREFIX = '';
const base = process.env.S3_PUBLIC_BASE_URL;
const owned = `${base}/media-assets/owner/source.png`;
const external = 'https://provider.example.test/reference.png';
const accepted: GenerateResult = { provider: 'fal', thumbUrl: '/thumb.svg', status: 'queued', providerJobId: 'provider-fixture' };

async function submit(payload: GeneratePayload, generateVideoFn: (payload: GeneratePayload, hooks?: import('../frontend/src/lib/fal-types').GenerateHooks) => Promise<GenerateResult>, records: unknown[] = [], userId = 'owner') {
  const { submitFalGenerateTask } = await import('../frontend/app/api/generate/_lib/fal-submission');
  return submitFalGenerateTask({
    userId, falPayload: payload, jobId: 'job-fixture', engineId: payload.engineId,
    engineLabel: 'Fixture video', isLumaRay2: false, batchId: null, durationSec: 5,
    pendingReceipt: null, paymentMode: 'wallet', walletChargeReserved: true,
    getLastProviderJobId: () => null, setLastProviderJobId: () => undefined,
    persistProviderJobId: async id => { records.push({ providerJobId: id }); },
    logMetricFn: (kind, event) => { records.push({ kind, event }); },
    deps: {
      generateVideoFn, withFalTimeoutFn: async promise => promise,
      queryFn: async (sql, params) => { records.push({ sql, params }); return []; },
      rollbackPendingPaymentFn: async () => { records.push('rollback'); },
    },
  });
}

function assertGrant(value: string | undefined, original: string) {
  assert.ok(value);
  const url = new URL(value);
  assert.equal(url.pathname, new URL(original).pathname);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '3600');
  assert.ok(url.searchParams.get('X-Amz-Signature'));
}

test('real Fal submission signs an uploaded private Wan start frame only in the transport copy', async t => {
  const storage = await import('../frontend/server/storage');
  t.mock.method(S3Client.prototype, 'send', async command => {
    assert.ok(command instanceof PutObjectCommand);
    return {};
  });
  const upload = await storage.uploadFileBuffer({ data: Buffer.from('private source bytes'), mime: 'image/png', userId: 'owner', prefix: 'media-assets', contentAddressed: true });
  const payload: GeneratePayload = {
    engineId: 'wan-3', prompt: 'Animate this image', mode: 'i2v', submissionMode: 'enqueue',
    durationSec: 5, resolution: '480p', audio: false, imageUrl: upload.url,
    inputs: [{ name: 'source.png', type: 'image/png', size: 20, kind: 'image', slotId: 'start_image_url', url: upload.url, assetId: 'asset-fixture' }],
  };
  const canonical = structuredClone(payload);
  const records: unknown[] = [];
  t.mock.method(console, 'info', (...args) => { records.push(args); });
  const { createProviderJobTracker } = await import('../frontend/app/api/generate/_lib/provider-job-tracker');
  const tracker = createProviderJobTracker({
    jobId: 'job-fixture', providerKey: 'fal', engineId: 'wan-3', prompt: payload.prompt,
    inputSummary: { primaryImageUrl: upload.url, primaryAudioUrl: null, referenceImageCount: 0, referenceVideoCount: 0, referenceAudioCount: 0, hasFirstFrame: true, hasLastFrame: false, inputSlots: [{ slotId: 'start_image_url', kind: 'image', hasUrl: true }] },
    queryFn: async (sql, params) => { records.push({ sql, params }); },
  });
  const result = await submit(payload, async (transport, hooks) => {
    assertGrant(transport.imageUrl, upload.url);
    assert.equal(transport.inputs?.[0].url, transport.imageUrl);
    const { buildFalGenerationRequest } = await import('../frontend/src/lib/fal-request-body');
    const { requestBody } = buildFalGenerationRequest(transport, 'fal-ai/wan/v3.0/image-to-video');
    assert.equal(requestBody.start_image_url, transport.imageUrl);
    await tracker.persistProviderJobId('provider-fixture');
    await hooks?.onRequestId?.('provider-fixture');
    return accepted;
  }, records);
  assert.equal(result.ok, true);
  assert.deepEqual(payload, canonical);
  assert.doesNotMatch(JSON.stringify({ payload, records, result }), /X-Amz-|fixture-secret/);
  assert.match(JSON.stringify(records), /inputSummary/);
  assert.match(JSON.stringify(records), /by-content/);
});

test('authenticated inline image uploads remain usable as private Fal references', async t => {
  const storage = await import('../frontend/server/storage');
  t.mock.method(S3Client.prototype, 'send', async command => {
    assert.ok(command instanceof PutObjectCommand);
    return {};
  });
  t.mock.method(console, 'error', () => undefined);
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#abc123' } }).png().toBuffer();
  const uploads = [
    await storage.uploadImageToStorage({ data: image, mime: 'image/png', userId: 'owner', fileName: 'inline.png', prefix: 'inline' }),
    await storage.uploadFileBuffer({ data: image, mime: 'image/png', userId: 'owner', prefix: 'inline', contentAddressed: true }),
  ];
  for (const uploaded of uploads) {
    assert.match(uploaded.url, /\/inline\/(?:owner\/|by-content\/)/);
    let received: string | undefined;
    const payload: GeneratePayload = { engineId: 'wan-3', prompt: 'Animate the uploaded frame', mode: 'i2v', imageUrl: uploaded.url, inputs: [{ name: 'inline.png', type: 'image/png', size: image.length, kind: 'image', slotId: 'start_image_url', url: uploaded.url }] };
    const result = await submit(payload, async transport => { received = transport.imageUrl; return accepted; });
    assert.equal(result.ok, true);
    assertGrant(received, uploaded.url);
    assert.equal(payload.imageUrl, uploaded.url);
    let foreignCalls = 0;
    const denied = await submit(payload, async () => { foreignCalls++; return accepted; }, [], 'other');
    assert.equal(foreignCalls, 0);
    assert.equal(denied.ok, false);
  }
});

test('foreign, ownerless and unapproved internal references fail before provider submission', async t => {
  t.mock.method(console, 'error', () => undefined);
  for (const url of [
    `${base}/media-assets/other/source.png`, `${base}/media-assets/owner-extra/source.png`,
    `${base}/internal/owner/source.png`, `${base}/renders/images/anonymous/source.png`,
    `${base}/inline/other/source.png`, `${base}/inline/owner-extra/source.png`, `${base}/inline/anonymous/source.png`,
  ]) {
    let providerCalls = 0;
    const result = await submit({ engineId: 'wan-3', prompt: 'test', mode: 'i2v', submissionMode: 'enqueue', inputs: [{ name: 'image', type: 'image/png', size: 1, kind: 'image', slotId: 'start_image_url', url }] }, async () => {
      providerCalls++;
      return accepted;
    });
    assert.equal(providerCalls, 0);
    assert.equal(result.ok, false);
    if (!result.ok) assert.notEqual(result.status, 202, 'local denial cannot be treated as an accepted ambiguous submission');
  }
});

test('all typed Fal media inputs receive grants while external and descriptive text stay unchanged', async () => {
  const payload: GeneratePayload = {
    engineId: 'fixture', prompt: `Prompt mentioning ${owned}`, mode: 'ref2v', imageUrl: owned,
    videoUrl: `${base}/renders/owner/source.mp4`, audioUrl: `${base}/user-assets/owner/source.wav`,
    endImageUrl: `${base}/media-assets/owner/end.png`, referenceImages: [owned, external],
    inputs: [{ name: 'audio', type: 'audio/wav', size: 1, kind: 'audio', slotId: 'audio_url', url: `${base}/user-assets/owner/input.wav` }],
    elements: [{ id: 'character', frontalImageUrl: owned, referenceImageUrls: [external, `${base}/media-assets/owner/side.png`], videoUrl: `${base}/renders/owner/element.mp4` }],
    soraRequest: { variant: 'sora2', mode: 'i2v', prompt: 'test', duration: 4, resolution: '720p', aspect_ratio: '16:9', image_url: owned },
    extraInputValues: { negative_prompt: `Do not change ${owned}`, start_image_url: owned, reference_video_urls: [`${base}/renders/owner/extra.mp4`, external] },
  };
  const canonical = structuredClone(payload);
  const result = await submit(payload, async transport => {
    for (const [actual, original] of [
      [transport.imageUrl, owned], [transport.videoUrl, payload.videoUrl], [transport.audioUrl, payload.audioUrl],
      [transport.endImageUrl, payload.endImageUrl], [transport.referenceImages?.[0], owned],
      [transport.inputs?.[0].url, payload.inputs?.[0].url], [transport.elements?.[0].frontalImageUrl, owned],
      [transport.elements?.[0].referenceImageUrls?.[1], payload.elements?.[0].referenceImageUrls?.[1]],
      [transport.elements?.[0].videoUrl, payload.elements?.[0].videoUrl],
      [transport.soraRequest?.mode === 'i2v' ? transport.soraRequest.image_url : undefined, owned],
      [transport.extraInputValues?.start_image_url as string, owned],
      [(transport.extraInputValues?.reference_video_urls as string[])[0], (payload.extraInputValues?.reference_video_urls as string[])[0]],
    ]) assertGrant(actual, original!);
    assert.equal(transport.referenceImages?.[1], external);
    assert.equal(transport.elements?.[0].referenceImageUrls?.[0], external);
    assert.equal((transport.extraInputValues?.reference_video_urls as string[])[1], external);
    assert.equal(transport.prompt, canonical.prompt);
    assert.equal(transport.extraInputValues?.negative_prompt, canonical.extraInputValues?.negative_prompt);
    return accepted;
  });
  assert.equal(result.ok, true);
  assert.deepEqual(payload, canonical);
});

test('echoed private grants in Fal errors cannot reach logs, persistence or client responses', async t => {
  const recorded: unknown[] = [];
  for (const method of ['error', 'warn', 'info'] as const) t.mock.method(console, method, (...args) => { recorded.push(args); });
  const { FalGenerationError } = await import('../frontend/src/lib/fal-error');
  const payload: GeneratePayload = { engineId: 'wan-3', prompt: 'test', mode: 'i2v', imageUrl: owned };
  let providerUrl: string | undefined;
  const result = await submit(payload, async transport => {
    const grant = transport.imageUrl!;
    providerUrl = grant;
    throw new FalGenerationError(`Failed to download ${grant}`, { status: 422, body: { detail: [{ type: 'file_download_error', loc: ['body', 'input.start_image_url'], input: grant, msg: `Cannot read ${grant}` }], echoed: JSON.stringify(transport) }, cause: Object.assign(new Error(`Request to ${grant} rejected`), { request: { image_url: grant } }) });
  }, recorded);
  assert.equal(result.ok, false);
  assertGrant(providerUrl, owned);
  assert.doesNotMatch(inspect({ recorded, result }, { depth: 20 }), /X-Amz-|fixture-access-key|fixture-secret/);
  assert.ok(recorded.length > 0);
  assert.equal(payload.imageUrl, owned);
});

test('every shared Fal submission caller supplies the authenticated owner', async () => {
  for (const file of ['video-provider-submission', 'alibaba-model-studio-submission', 'luma-agents-submission', 'kling-direct-submission', 'google-vertex-veo-submission']) {
    const source = await readFile(`frontend/app/api/generate/_lib/${file}.ts`, 'utf8');
    const calls = [...source.matchAll(/(?:params\.)?submitFalGenerateTask(?:Fn)?\(\{([\s\S]*?)\n\s*\}\)/g)];
    assert.ok(calls.length > 0, file);
    for (const call of calls) assert.match(call[1], /userId: params\.userId/, file);
  }
});
