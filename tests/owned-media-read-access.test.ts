import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseImageThumbnailBackfillOptions, runImageThumbnailBackfill } from '../frontend/scripts/_lib/image-thumbnail-backfill';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { S3Client, PutObjectCommand } = requireFrontend('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
const sharp = requireFrontend('sharp') as typeof import('sharp');

process.env.S3_BUCKET='private-read-fixture';
process.env.S3_REGION='us-east-1';
process.env.S3_ACCESS_KEY_ID='fixture-access-key';
process.env.S3_SECRET_ACCESS_KEY='fixture-secret';
process.env.S3_PUBLIC_BASE_URL='https://private-read-fixture.s3.us-east-1.amazonaws.com';
const base='https://private-read-fixture.s3.us-east-1.amazonaws.com';
const pending=import('../frontend/server/owned-media-read-access').catch(()=>null);
const mediaPending=import('../frontend/server/media-library/asset-media');
const owned=`${base}/renders/images/owner/original.png`;
const anonymous = `${base}/renders/images/anonymous/original.png`;
const ownerContentHash = '4c1029697ee358715d3a14a2add817c4';
const contentLeaf = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.mp4';

test('server reads grant short-lived access only to the exact owned storage object',async()=>{
 const module=await pending;assert.ok(module?.createOwnedMediaReadUrl);
 const result=await module.createOwnedMediaReadUrl({url:owned,userId:'owner'}, {sign:async(key,options)=>{
  assert.equal(key,'renders/images/owner/original.png');assert.equal(options.expiresInSeconds,300);
  return 'https://private.test/authorized-original';
 }});
 assert.equal(result,'https://private.test/authorized-original');
 assert.equal(owned,`${base}/renders/images/owner/original.png`);
});

test('storage URLs cannot borrow another account or an unowned internal prefix',async()=>{
 const module=await pending;assert.ok(module?.createOwnedMediaReadUrl);
 const noGrant={sign:async()=>{throw Error('UNEXPECTED_GRANT');}};
 for(const [url,userId] of [[owned,'other'],[owned,null],[`${base}/renders/images/owner-extra/original.png`,'owner'],[`${base}/internal/owner/original.png`,'owner']] as const)
  await assert.rejects(()=>module.createOwnedMediaReadUrl({url,userId},noGrant),/MEDIA_NOT_AVAILABLE/);
});

test('external originals pass through without acquiring application credentials',async()=>{
 const module=await pending;assert.ok(module?.createOwnedMediaReadUrl);
 const url='https://v3b.fal.media/provider-original.png';
 assert.equal(await module.createOwnedMediaReadUrl({url,userId:'owner'},{sign:async()=>{throw Error('UNEXPECTED_GRANT');}}),url);
});

test('a signing failure cannot silently fall back to the private public-shaped URL',async()=>{
 const module=await pending;assert.ok(module?.createOwnedMediaReadUrl);
 await assert.rejects(()=>module.createOwnedMediaReadUrl({url:owned,userId:'owner'},{sign:async()=>{throw Error('STORAGE_UNAVAILABLE');}}),/STORAGE_UNAVAILABLE/);
});

test('a real content-addressed upload key receives private read signing for its exact owner', async (t) => {
  const storage = await import('../frontend/server/storage');
  const module = await pending;
  assert.ok(module?.createOwnedMediaReadUrl);
  const expectedKey = `user-assets/by-content/${ownerContentHash}/${contentLeaf}`;
  const uploadedKeys: string[] = [];
  t.mock.method(S3Client.prototype, 'send', async (command: InstanceType<typeof PutObjectCommand>) => {
    assert.ok(command instanceof PutObjectCommand);
    uploadedKeys.push(command.input.Key!);
    return {};
  });
  const upload = await storage.uploadFileBuffer({
    data: Buffer.from('hello'), mime: 'video/mp4', userId: 'owner', prefix: 'user-assets', contentAddressed: true,
  });
  assert.equal(upload.key, expectedKey);
  assert.deepEqual(uploadedKeys, [expectedKey]);
  const readable = new URL(await module.createOwnedMediaReadUrl({ url: upload.url, userId: 'owner' }));
  assert.equal(readable.pathname, `/${expectedKey}`);
  assert.equal(readable.searchParams.get('X-Amz-Expires'), '300');
  assert.ok(readable.searchParams.get('X-Amz-Signature'));
  assert.equal(upload.url, `${base}/${expectedKey}`);
});

test('content-addressed storage rejects foreign owners, near hashes and unapproved prefixes', async () => {
  const module = await pending;
  assert.ok(module?.createOwnedMediaReadUrl);
  const noGrant = { sign: async () => { throw new Error('UNEXPECTED_GRANT'); } };
  const url = `${base}/user-assets/by-content/${ownerContentHash}/${contentLeaf}`;
  for (const input of [
    { url, userId: 'other' },
    { url, userId: null },
    { url: `${base}/user-assets/by-content/${ownerContentHash}-extra/${contentLeaf}`, userId: 'owner' },
    { url: `${base}/user-assets/by-content/${ownerContentHash.slice(0, -1)}5/${contentLeaf}`, userId: 'owner' },
    { url: `${base}/internal/by-content/${ownerContentHash}/${contentLeaf}`, userId: 'owner' },
  ]) {
    await assert.rejects(() => module.createOwnedMediaReadUrl(input, noGrant), /MEDIA_NOT_AVAILABLE/);
  }
});

test('content-addressed ownership follows the configured reference and render namespaces', async (t) => {
  const storage = await import('../frontend/server/storage');
  const module = await pending;
  assert.ok(module?.createOwnedMediaReadUrl);
  const previousReference = process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;
  const previousRender = process.env.VIDEO_RENDER_STORAGE_PREFIX;
  process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = 'owned-read-reference-fixture';
  process.env.VIDEO_RENDER_STORAGE_PREFIX = 'owned-read-render-fixture';
  t.after(() => {
    if (previousReference === undefined) delete process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;
    else process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = previousReference;
    if (previousRender === undefined) delete process.env.VIDEO_RENDER_STORAGE_PREFIX;
    else process.env.VIDEO_RENDER_STORAGE_PREFIX = previousRender;
  });
  t.mock.method(S3Client.prototype, 'send', async (command: InstanceType<typeof PutObjectCommand>) => {
    assert.ok(command instanceof PutObjectCommand);
    return {};
  });
  for (const [prefix, expectedKey] of [
    ['user-assets', `owned-read-reference-fixture/user-assets/by-content/${ownerContentHash}/${contentLeaf}`],
    ['renders/images', `owned-read-render-fixture/images/by-content/${ownerContentHash}/${contentLeaf}`],
  ]) {
    const upload = await storage.uploadFileBuffer({
      data: Buffer.from('hello'), mime: 'video/mp4', userId: 'owner', prefix, contentAddressed: true,
    });
    assert.equal(upload.key, expectedKey);
    assert.equal(await module.createOwnedMediaReadUrl({ url: upload.url, userId: 'owner' }, {
      sign: async (key, options) => {
        assert.equal(key, expectedKey);
        assert.equal(options.expiresInSeconds, 300);
        return 'https://private.test/authorized-content';
      },
    }), 'https://private.test/authorized-content');
    await assert.rejects(() => module.createOwnedMediaReadUrl({ url: upload.url, userId: 'other' }), /MEDIA_NOT_AVAILABLE/);
  }
  await assert.rejects(() => module.createOwnedMediaReadUrl({
    url: `${base}/user-assets/by-content/${ownerContentHash}/${contentLeaf}`, userId: 'owner',
  }), /MEDIA_NOT_AVAILABLE/);
});

test('operator-only legacy anonymous reads remain unsigned and acquire no grant', async () => {
  const module = await pending;
  assert.ok(module?.createOwnedMediaReadUrl);
  const readable = await module.createOwnedMediaReadUrl({
    url: anonymous,
    userId: null,
    allowLegacyAnonymousPublicRead: true,
  }, { sign: async () => { throw new Error('UNEXPECTED_GRANT'); } });
  assert.equal(readable, anonymous);
});

test('legacy anonymous compatibility cannot authorize signed, foreign or account-facing reads', async () => {
  const module = await pending;
  assert.ok(module?.createOwnedMediaReadUrl);
  const noGrant = { sign: async () => { throw new Error('UNEXPECTED_GRANT'); } };
  const cases = [
    { url: anonymous, userId: null },
    { url: anonymous, userId: 'owner', allowLegacyAnonymousPublicRead: true },
    { url: anonymous, userId: 'anonymous', allowLegacyAnonymousPublicRead: true },
    { url: owned, userId: 'owner', allowLegacyAnonymousPublicRead: true },
    { url: owned, userId: null, allowLegacyAnonymousPublicRead: true },
    { url: `${base}/renders/images/anonymous-extra/original.png`, userId: null, allowLegacyAnonymousPublicRead: true },
    { url: `${base}/user-assets/anonymous/original.png`, userId: null, allowLegacyAnonymousPublicRead: true },
    { url: `${anonymous}?X-Amz-Signature=private-token`, userId: null, allowLegacyAnonymousPublicRead: true },
    { url: `${anonymous}?token=private-token`, userId: null, allowLegacyAnonymousPublicRead: true },
  ];
  for (const input of cases) {
    await assert.rejects(() => module.createOwnedMediaReadUrl(input, noGrant), /MEDIA_NOT_AVAILABLE/);
  }
});

test('the actual backfill reads a public anonymous original without signing and repairs its thumbnail', async (t) => {
  const { createImageThumbnailBatch } = await import('../frontend/server/image-thumbnails');
  const source = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#abcdef' } }).png().toBuffer();
  const fetched: string[] = [];
  const uploaded: string[] = [];
  const updates: ReadonlyArray<unknown>[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    fetched.push(String(input));
    return String(input) === anonymous
      ? new Response(source, { status: 200, headers: { 'content-type': 'image/png' } })
      : new Response('', { status: 403 });
  });
  t.mock.method(S3Client.prototype, 'send', async (command: InstanceType<typeof PutObjectCommand>) => {
    assert.ok(command instanceof PutObjectCommand);
    uploaded.push(command.input.Key!);
    return {};
  });
  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply', '--max=1'], {}),
    {
      async query<T>(sql: string, params: ReadonlyArray<unknown> = []): Promise<T[]> {
        if (/^\s*SELECT/i.test(sql)) return [{
          id: 1, job_id: 'legacy-anonymous', user_id: null, thumb_url: null,
          render_ids: [anonymous], updated_at: '2026-01-01T00:00:00Z',
        }] as T[];
        assert.match(sql, /^\s*UPDATE/i);
        updates.push(params);
        return [{ id: 1 }] as T[];
      },
      createThumbnails: createImageThumbnailBatch,
    },
  );
  assert.equal(summary.updated, 1);
  assert.equal(summary.failed, 0);
  assert.deepEqual(fetched, [anonymous]);
  assert.equal(uploaded.length, 1);
  assert.match(uploaded[0]!, /^renders\/thumbs\/anonymous\/[^/]+\.webp$/);
  const repaired = JSON.parse(String(updates[0]![1])) as Array<{ url: string; thumb_url: string }>;
  assert.equal(repaired[0]!.url, anonymous);
  assert.equal(repaired[0]!.thumb_url, `${base}/${uploaded[0]}`);
  assert.ok(!JSON.stringify(updates).includes('X-Amz-'));
});

test('library promotion fetches the authorized source and persists only the new durable original',async(t)=>{
 const {copyRemoteMedia}=await mediaPending;
 const buffer=Buffer.from('exact source image bytes');
 t.mock.method(globalThis,'fetch',async (input: RequestInfo | URL)=>{
  const parsed=new URL(String(input));
  return parsed.origin===base && parsed.pathname==='/renders/images/owner/original.png' && parsed.searchParams.has('X-Amz-Signature')
   ? new Response(buffer,{status:200,headers:{'content-type':'image/png'}})
   : new Response('',{status:403});
 });
 const copied=await copyRemoteMedia({userId:'owner',url:owned,kind:'image',mimeType:'image/png'}, {
  uploadImage:async input=>{
   assert.equal(input.userId,'owner');assert.deepEqual(input.data,buffer);
   return {key:'media-assets/owner/copy.png',url:`${base}/media-assets/owner/copy.png`,width:1088,height:608,size:buffer.length,mime:'image/png'};
  },
 });
 assert.deepEqual(copied,{url:`${base}/media-assets/owner/copy.png`,thumbUrl:null,mimeType:'image/png',width:1088,height:608,sizeBytes:buffer.length});
 assert.ok(!JSON.stringify(copied).includes('X-Amz-'));
});
