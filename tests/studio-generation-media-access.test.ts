import assert from 'node:assert/strict';
import test from 'node:test';
import type {AgentGenerationResult, AgentGenerationStatus} from '../frontend/src/server/generations/generation-status';

process.env.S3_BUCKET = 'studio-private-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_PUBLIC_BASE_URL = 'https://studio-private-fixture.s3.us-east-1.amazonaws.com';
const base = 'https://studio-private-fixture.s3.us-east-1.amazonaws.com';
const original = `${base}/renders/images/owner/image.png`;
const thumbnail = `${base}/renders/thumbs/owner/image.webp`;
const pendingModule = import('../frontend/src/server/studio/generation-media-access').catch(() => null);
const status = (result: AgentGenerationResult | null): AgentGenerationStatus => ({jobId: 'accepted-job',surface: result?.surface ?? 'image',status: 'completed',progress: 100,message: null,priceCents: 5,currency: 'USD',paymentStatus: 'paid_wallet',result,retryAfterSeconds: null});
const sign = async (key: string) => `https://signed.test/${key}?expires=300`;

test('native image recovery grants temporary access to original and thumbnail without changing stored identity', async () => {
  const mediaAccess = await pendingModule;
  assert.ok(mediaAccess?.buildStudioGenerationMediaAccess);
  const stored = status({surface: 'image',imageUrls: [original],thumbnailUrls: [thumbnail]});
  const snapshot = JSON.stringify(stored);
  const readable = await mediaAccess.buildStudioGenerationMediaAccess('owner',stored,{sign});
  assert.deepEqual(readable?.result,{surface: 'image',imageUrls: ['https://signed.test/renders/images/owner/image.png?expires=300'],thumbnailUrls: ['https://signed.test/renders/thumbs/owner/image.webp?expires=300']});
  assert.equal(JSON.stringify(stored),snapshot);
  assert.equal(readable?.jobId,'accepted-job');
  assert.equal(readable?.priceCents,5);
});

test('a fresh native read renews access without generation or wallet operations', async () => {
  const mediaAccess = await pendingModule;
  assert.ok(mediaAccess?.buildStudioGenerationMediaAccess);
  let access = 0;
  const stored = status({surface: 'image',imageUrls: [original],thumbnailUrls: [original]});
  const dependencies = {sign: async (key: string, options: {expiresInSeconds: number}) => {
    assert.equal(options.expiresInSeconds,300);
    return `https://signed.test/${key}?access=${++access}`;
  }};
  const first = await mediaAccess.buildStudioGenerationMediaAccess('owner',stored,dependencies);
  const second = await mediaAccess.buildStudioGenerationMediaAccess('owner',stored,dependencies);
  assert.deepEqual(first?.result,{surface:'image',imageUrls:['https://signed.test/renders/images/owner/image.png?access=1'],thumbnailUrls:['https://signed.test/renders/images/owner/image.png?access=1']});
  assert.deepEqual(second?.result,{surface:'image',imageUrls:['https://signed.test/renders/images/owner/image.png?access=2'],thumbnailUrls:['https://signed.test/renders/images/owner/image.png?access=2']});
});

test('native video and audio readers retain exact originals, previews and measured facts', async () => {
  const mediaAccess = await pendingModule;
  assert.ok(mediaAccess?.buildStudioGenerationMediaAccess);
  const video = await mediaAccess.buildStudioGenerationMediaAccess('owner',status({surface:'video',videoUrl:`${base}/renders/owner/video.mp4`,previewUrl:`${base}/renders/previews/owner/video.mp4`,thumbnailUrl:thumbnail,audioUrl:null}),{sign});
  assert.deepEqual(video?.result,{surface:'video',videoUrl:'https://signed.test/renders/owner/video.mp4?expires=300',previewUrl:'https://signed.test/renders/previews/owner/video.mp4?expires=300',thumbnailUrl:'https://signed.test/renders/thumbs/owner/image.webp?expires=300',audioUrl:null});
  const audio = await mediaAccess.buildStudioGenerationMediaAccess('owner',status({surface:'audio',audioUrl:`${base}/renders/owner/voice.mp3`,videoUrl:null,thumbnailUrl:null,mimeType:'audio/mpeg',durationSec:12.375}),{sign});
  assert.deepEqual(audio?.result,{surface:'audio',audioUrl:'https://signed.test/renders/owner/voice.mp3?expires=300',videoUrl:null,thumbnailUrl:null,mimeType:'audio/mpeg',durationSec:12.375});
});

test('an owned job row cannot grant access to another account storage object', async () => {
  const mediaAccess = await pendingModule;
  assert.ok(mediaAccess?.buildStudioGenerationMediaAccess);
  const stored = status({surface:'image',imageUrls:[`${base}/renders/images/other/image.png`],thumbnailUrls:[]});
  await assert.rejects(() => mediaAccess.buildStudioGenerationMediaAccess('owner',stored,{sign}),/MEDIA_NOT_AVAILABLE/);
});

test('a signer failure never falls back to an inaccessible private URL', async () => {
  const mediaAccess = await pendingModule;
  assert.ok(mediaAccess?.buildStudioGenerationMediaAccess);
  await assert.rejects(() => mediaAccess.buildStudioGenerationMediaAccess('owner',status({surface:'image',imageUrls:[original],thumbnailUrls:[]}),{sign:async () => {throw new Error('STORAGE_UNAVAILABLE');}}),/STORAGE_UNAVAILABLE/);
});

test('public originals and pending jobs need no private access grant', async () => {
  const mediaAccess = await pendingModule;
  assert.ok(mediaAccess?.buildStudioGenerationMediaAccess);
  const publicResult = {surface:'image' as const,imageUrls:['https://cdn.maxvideoai.com/public.png'],thumbnailUrls:[]};
  const noSigning = {sign:async () => {throw new Error('UNEXPECTED_SIGNING');}};
  assert.deepEqual((await mediaAccess.buildStudioGenerationMediaAccess('owner',status(publicResult),noSigning))?.result,publicResult);
  assert.equal(await mediaAccess.buildStudioGenerationMediaAccess('owner',null,noSigning),null);
  assert.deepEqual(await mediaAccess.buildStudioGenerationMediaAccess('owner',status(null),noSigning),status(null));
});
