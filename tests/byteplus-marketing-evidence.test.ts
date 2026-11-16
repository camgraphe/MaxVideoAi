import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from '../frontend/node_modules/sharp';
import { byteplusFixture, digest, ownerId } from './helpers/byteplus-marketing-fixture';
import { parseBytePlusMarketingImport } from '../frontend/server/marketing-media/byteplus/contract';
import { recoverBytePlusMarketingTask, verifyBytePlusMarketingMedia } from '../frontend/server/marketing-media/byteplus/evidence';
import { decodeImageUpload } from '../frontend/src/server/uploads/store-image-upload';

test('BytePlus recovery is a bounded exact-task GET and refuses a redirect', async () => {
  const parsed = parseBytePlusMarketingImport(byteplusFixture());
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return Response.json(parsed.result);
  };
  assert.deepEqual(await recoverBytePlusMarketingTask(parsed.input.providerTaskId, 'fixture-key', fetcher), parsed.result);
  assert.equal(seen[0].url, 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/cgt-20261116000000-fixture');
  assert.equal(seen[0].init?.method, 'GET'); assert.equal(seen[0].init?.redirect, 'error');
  await assert.rejects(() => recoverBytePlusMarketingTask('../other', 'fixture-key', fetcher), /TASK/);
  await assert.rejects(() => recoverBytePlusMarketingTask(parsed.input.providerTaskId, 'fixture-key', async () => new Response('', { status: 302 })), /RECOVERY/);
});

test('evidence compares provider original and owned bytes, decodes the poster and rejects different results', async () => {
  const input = byteplusFixture();
  const poster = await sharp({ create: { width: 16, height: 9, channels: 3, background: 'red' } }).webp().toBuffer();
  input.poster = { sha256: digest(poster), sizeBytes: poster.length, mime: 'image/webp' };
  const parsed = parseBytePlusMarketingImport(input);
  const original = Buffer.from('fixture-original');
  const videoUrl = `https://media.maxvideoai.com/uploads/${ownerId}/video.mp4`;
  const posterUrl = `https://media.maxvideoai.com/uploads/${ownerId}/poster.webp`;
  const assets = [{ public_id: 'ma_video', user_id: ownerId, kind: 'video', url: videoUrl, thumb_url: posterUrl,
    mime_type: 'video/mp4', size_bytes: original.length, status: 'ready', deleted_at: null }];
  const dependencies = {
    apiKey: 'fixture', fetcher: async () => Response.json(parsed.result),
    readUrl: async ({ url }: { url: string }) => url,
    open: async (url: string) => ({ statusCode: 200,
      headers: { 'content-type': url === posterUrl ? 'image/webp' : 'video/mp4' },
      body: (async function* () { yield url === posterUrl ? poster : original; })(),
    }),
    probe: async (_bytes: Buffer, original: { url: string; sha256: string; sizeBytes: number }) => ({
      width: 1280, height: 720, hasAudio: true, mediaFacts: {
        source: 'probe' as const, version: 1 as const, probe: 'ffprobe' as const, original,
        durationSec: 8.064, videoDurationSec: 8.041667, audioDurationSec: 8.064, containerDurationSec: 8.064,
      },
    }),
  };
  const result = await verifyBytePlusMarketingMedia(parsed, assets, dependencies);
  assert.equal(result.files.length, 2); assert.equal(result.video.width, 1280);
  assert.equal(result.files[0].url, videoUrl); assert.equal(result.files[0].sha256, input.videoSha256);
  await assert.rejects(() => verifyBytePlusMarketingMedia(parsed, assets, {
    ...dependencies, fetcher: async () => Response.json({ ...parsed.result, id: 'other-task' }),
  }), /RESULT/);
  await assert.rejects(() => verifyBytePlusMarketingMedia(parsed, assets, {
    ...dependencies, open: async (url: string) => ({ ...await dependencies.open(url), body: (async function* () { yield Buffer.from('changed'); })() }),
  }), /BYTES/);
  const normalized = await decodeImageUpload({ bytes: poster, declaredMime: 'image/webp', fileName: 'poster.webp' });
  const withSource = { ...input, poster: { ...input.poster, sha256: digest(normalized.bytes), sizeBytes: normalized.bytes.length,
    source: { encoding: 'base64', data: poster.toString('base64'), sha256: digest(poster), sizeBytes: poster.length,
      mime: 'image/webp', transform: 'canonical-image-upload-v1' } } };
  const normalizedParsed = parseBytePlusMarketingImport(withSource);
  const normalizedDependencies = { ...dependencies, open: async (url: string) => ({ ...await dependencies.open(url),
    body: (async function* () { yield url === posterUrl ? normalized.bytes : original; })() }) };
  assert.equal((await verifyBytePlusMarketingMedia(normalizedParsed, assets, normalizedDependencies)).files[1].sha256, digest(normalized.bytes));
  const tampered = structuredClone(withSource); tampered.poster.source.data = original.toString('base64');
  await assert.rejects(async () => verifyBytePlusMarketingMedia(parseBytePlusMarketingImport(tampered), assets, normalizedDependencies), /POSTER_SOURCE/);
});
