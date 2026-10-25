import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { S3Client, PutObjectCommand } = requireFrontend('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
const sharp = requireFrontend('sharp') as typeof import('sharp');
process.env.S3_BUCKET = 'excerpt-prefix-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'fixture-access';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://excerpt-prefix-fixture.s3.us-east-1.amazonaws.com';
process.env.S3_UPLOAD_ACL = 'public-read';
process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = 'mcp-reference-staging';
const base = process.env.S3_PUBLIC_BASE_URL;
const ownerHash = createHash('sha256').update('owner').digest('hex').slice(0, 32);

test('private excerpt file and thumbnail PUTs use reserved leaves despite public defaults and MCP staging', async t => {
  const { createUploadImageThumbnail } = await import('../frontend/server/upload-thumbnails');
  const { uploadFileBuffer } = await import('../frontend/server/storage');
  const puts: Array<InstanceType<typeof PutObjectCommand>['input']> = [];
  t.mock.method(S3Client.prototype, 'send', async command => { assert.ok(command instanceof PutObjectCommand); puts.push(command.input); return {}; });
  const data = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } }).png().toBuffer();
  const url = await createUploadImageThumbnail({ data, userId: 'owner', privateStorageScope: 'video-excerpt', acl: 'public-read', cacheControl: 'public, max-age=3600' });
  assert.ok(url);
  await uploadFileBuffer({ data: Buffer.from('video bytes'), mime: 'video/mp4', userId: 'owner', prefix: 'user-assets', contentAddressed: true,
    privateStorageScope: 'video-excerpt', contentAddressedNamespace: 'video-excerpt-private-v3-fixture', acl: 'public-read', cacheControl: 'public' });
  assert.equal(puts.length, 2);
  assert.match(puts[0].Key!, /^mcp-reference-staging\/user-asset-thumbs\/owner\/video-excerpts-private-v3-/);
  assert.match(puts[1].Key!, new RegExp(`^mcp-reference-staging/user-assets/by-content/${ownerHash}/video-excerpts-private-v3-prepared-`));
  for (const put of puts) { assert.equal(put.ACL, undefined); assert.equal(put.CacheControl, 'private, no-store'); }
  await uploadFileBuffer({ data: Buffer.from('ordinary'), mime: 'video/mp4', userId: 'owner', prefix: 'user-assets', contentAddressed: true });
  assert.doesNotMatch(puts[2].Key!, /video-excerpts-private/);
  assert.equal(puts[2].ACL, 'public-read');
});

test('private excerpt leaves retain exact owner checks under existing roots', async () => {
  const { createOwnedMediaReadUrl } = await import('../frontend/server/owned-media-read-access');
  const signed: string[] = [];
  const sign = async (key: string) => { signed.push(key); return 'https://fixture.test/grant'; };
  for (const key of [`mcp-reference-staging/user-assets/by-content/${ownerHash}/video-excerpts-private-v3-prepared.mp4`, 'mcp-reference-staging/user-asset-thumbs/owner/video-excerpts-private-v3-thumb.jpg']) {
    assert.equal(await createOwnedMediaReadUrl({ url: `${base}/${key}`, userId: 'owner' }, { sign }), 'https://fixture.test/grant');
    assert.equal(signed.at(-1), key);
    await assert.rejects(createOwnedMediaReadUrl({ url: `${base}/${key}`, userId: 'other' }, { sign }), /MEDIA_NOT_AVAILABLE/);
  }
  for (const key of [
    `mcp-reference-staging/user-assets/by-content/${ownerHash}-extra/video-excerpts-private-v3-prepared.mp4`,
    'mcp-reference-staging/user-asset-thumbs/owner-extra/video-excerpts-private-v3-thumb.jpg',
    'video-excerpts-private/owner/source.mp4', 'user-assets-extra/owner/source.mp4',
  ]) await assert.rejects(createOwnedMediaReadUrl({ url: `${base}/${key}`, userId: 'owner' }, { sign }), /MEDIA_NOT_AVAILABLE/);
  assert.equal(signed.length, 2);
});

test('private scope fails before PUT if configuration or caller places the leaf outside the four protected patterns', async t => {
  const { uploadFileBuffer, uploadImageToStorage } = await import('../frontend/server/storage');
  let puts = 0;
  t.mock.method(S3Client.prototype, 'send', async () => { puts++; return {}; });
  const oldPrefix = process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;
  t.after(() => { if (oldPrefix === undefined) delete process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX; else process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = oldPrefix; });
  process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = 'another-staging-root';
  await assert.rejects(uploadFileBuffer({ data: Buffer.from('bytes'), mime: 'video/mp4', userId: 'owner', prefix: 'user-assets', contentAddressed: true, privateStorageScope: 'video-excerpt' }), /private media storage path/);
  await assert.rejects(uploadImageToStorage({ data: Buffer.from('bytes'), mime: 'image/jpeg', userId: 'owner', prefix: 'user-asset-thumbs', privateStorageScope: 'video-excerpt' }), /private media storage path/);
  delete process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;
  await assert.rejects(uploadFileBuffer({ data: Buffer.from('bytes'), mime: 'video/mp4', userId: 'owner', prefix: 'media-assets', contentAddressed: true, privateStorageScope: 'video-excerpt' }), /private media storage path/);
  assert.equal(puts, 0);
});

test('reserved excerpt leaves remain compatible with existing producer fences', async () => {
  const { claimStorageObjectProducer } = await import('../frontend/src/server/storage-object-producer-claims');
  const objectKey = `user-assets/by-content/${ownerHash}/video-excerpts-private-v3-prepared.mp4`;
  const claimId = '00000000-0000-4000-8000-000000000099';
  let calls = 0;
  const executor = { query: async <T>(_sql: string, params?: unknown[]) => { calls++; return [{ object_key: params?.[0], producer_claim_id: claimId, producer_lease_expires_at: new Date('2030-01-01') }] as T[]; } };
  assert.equal((await claimStorageObjectProducer({ objectKey }, { claimId, executor })).objectKey, objectKey);
  for (const key of ['user-asset-thumbs/owner/video-excerpts-private-v3-a.jpg', `user-assets-extra/by-content/${ownerHash}/video-excerpts-private-v3-a.mp4`]) {
    await assert.rejects(claimStorageObjectProducer({ objectKey: key }, { claimId, executor }), /Invalid content-addressed storage key/);
  }
  assert.equal(calls, 1);
});

test('later thumbnail recovery reads the owned private source and writes a private reserved video thumbnail', async t => {
  const { createRemoteVideoAssetThumbnail } = await import('../frontend/server/media-library/asset-media');
  const { ensureExecutableFfmpegPath } = await import('../frontend/server/ffmpeg-runtime');
  const ffmpeg = requireFrontend('@ffmpeg-installer/ffmpeg');
  const directory = await mkdtemp(resolve(tmpdir(), 'excerpt-private-thumb-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fixture = resolve(directory, 'source.mp4');
  await promisify(execFile)(await ensureExecutableFfmpegPath(ffmpeg.path), [
    '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=24:d=1', '-c:v', 'libx264', '-threads', '1', '-an', '-y', fixture,
  ], { timeout: 15000 });
  const bytes = await readFile(fixture);
  const puts: Array<InstanceType<typeof PutObjectCommand>['input']> = [];
  const requests: string[] = [];
  t.mock.method(S3Client.prototype, 'send', async command => { assert.ok(command instanceof PutObjectCommand); puts.push(command.input); return {}; });
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(String(input)); requests.push(url.pathname);
    assert.ok(url.searchParams.get('X-Amz-Signature'));
    return new Response(bytes, { headers: { 'Content-Type': 'video/mp4' } });
  });
  t.mock.method(console, 'warn', () => {});
  for (const prefix of ['', 'mcp-reference-staging/']) {
    if (prefix) process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = 'mcp-reference-staging';
    else delete process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;
    const source = `${base}/${prefix}user-assets/by-content/${ownerHash}/video-excerpts-private-v3-prepared-fixture.mp4`;
    const thumbnail = await createRemoteVideoAssetThumbnail({ userId: 'owner', url: source });
    assert.ok(thumbnail);
    assert.equal(requests.at(-1), new URL(source).pathname);
    const put = puts.at(-1)!;
    assert.ok(put.Key?.startsWith(`${prefix}user-asset-thumbs/owner/video-excerpts-private-v3-`));
    assert.equal(put.CacheControl, 'private, no-store');
    assert.equal(put.ACL, undefined);
    assert.ok(Buffer.isBuffer(put.Body) && put.Body.length > 0);
    assert.equal(await createRemoteVideoAssetThumbnail({ userId: 'foreign', url: source }), null);
  }
  assert.equal(requests.length, 2);
  assert.equal(puts.length, 2);
  // Ordinary existing sources keep their original thumbnail behavior.
  const ordinary = `${base}/mcp-reference-staging/user-assets/by-content/${ownerHash}/ordinary.mp4`;
  assert.ok(await createRemoteVideoAssetThumbnail({ userId: 'owner', url: ordinary }));
  assert.doesNotMatch(puts.at(-1)!.Key!, /video-excerpts-private/);
  assert.equal(puts.at(-1)!.ACL, 'public-read');
});
