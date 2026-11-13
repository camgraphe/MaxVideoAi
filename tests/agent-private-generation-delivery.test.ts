import assert from 'node:assert/strict';
import test from 'node:test';
import type {AgentGenerationStatus} from '../frontend/src/server/generations/generation-status';

process.env.S3_BUCKET = 'agent-private-fixture';
process.env.S3_REGION = 'eu-central-1';
process.env.S3_PUBLIC_BASE_URL = 'https://agent-private-fixture.s3.eu-central-1.amazonaws.com';
process.env.S3_ACCESS_KEY_ID = 'fixture-key';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
const base = process.env.S3_PUBLIC_BASE_URL;
const principal = {userId: 'owner', clientId: 'client', emailVerified: true, authMethod: 'oauth' as const};
const api = import('../frontend/src/server/agent-api/generation-status');
const stored: AgentGenerationStatus = {jobId: 'job-1',surface: 'video',status: 'completed',progress: 100,message: null,priceCents: 24,currency: 'USD',paymentStatus: 'paid_wallet',retryAfterSeconds: null,result: {surface: 'video',videoUrl: `${base}/renders/owner/video.mp4`,playbackVideoUrl: `${base}/renders/previews/owner/video.mp4`,lastFrameUrl: `${base}/renders/keyframes/owner/last.jpg`,previewUrl: null,thumbnailUrl: null,audioUrl: null}};

function assertSigned(value: string | null | undefined, path: string) {
  assert.ok(value);
  const url = new URL(value);
  assert.equal(url.origin, base);
  assert.equal(url.pathname, path);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
  assert.ok(url.searchParams.has('X-Amz-Signature'));
}

test('agent status and recent reads sign owned private originals and artifacts without mutating canonical records', async () => {
  const {getAgentGenerationStatus,listAgentRecentGenerations} = await api;
  const snapshot = JSON.stringify(stored);
  const status = await getAgentGenerationStatus({jobId: 'job-1'},principal,{readStatus: async () => stored});
  const page = await listAgentRecentGenerations({},principal,{listRecent: async () => ({items: [stored],nextCursor: null})});
  for (const item of [status,...page.items]) {
    assert.equal(item.status, 'completed');
    assert.equal(item.priceCents,24);
    assert.equal(item.savedToLibrary,true);
    assert.equal(item.result?.surface,'video');
    if (item.result?.surface !== 'video') assert.fail('Video result missing');
    assertSigned(item.result.videoUrl,'/renders/owner/video.mp4');
    assertSigned(item.result.playbackVideoUrl,'/renders/previews/owner/video.mp4');
    assertSigned(item.result.lastFrameUrl,'/renders/keyframes/owner/last.jpg');
  }
  assert.equal(JSON.stringify(stored),snapshot);
});

test('agent delivery cannot grant private access to another account object', async () => {
  const {getAgentGenerationStatus} = await api;
  await assert.rejects(() => getAgentGenerationStatus({jobId:'job-1'},principal,{readStatus:async () => ({...stored,result:{surface:'image',imageUrls:[`${base}/renders/images/other/private.png`],thumbnailUrls:[]}})}),/MEDIA_NOT_AVAILABLE/);
});

test('Markdown delivery uses a first-party link while native media retains its original signed URL', async () => {
  const previous = process.env.MCP_ACQUISITION_SIGNING_SECRET;
  process.env.MCP_ACQUISITION_SIGNING_SECRET = 'offline-media-link-secret-at-least-32-bytes';
  try {
    const {getAgentGenerationStatus} = await api;
    const status = await getAgentGenerationStatus({jobId:'job-1'},principal,{
      readStatus:async () => stored, accountUrl:'https://openai-review.maxvideoai.com/account/connections',
    });
    assert.ok(status.openUrl, 'A model-visible link must not expose the S3 signature to host-added UTM parameters.');
    const link = new URL(status.openUrl);
    assert.equal(link.origin, 'https://openai-review.maxvideoai.com');
    assert.equal(link.pathname, '/api/mcp/media');
    assert.ok(link.searchParams.get('token'));
    assert.equal(link.searchParams.has('X-Amz-Signature'), false);
    assert.equal(status.result?.surface, 'video');
    if(status.result?.surface==='video') assertSigned(status.result.videoUrl, '/renders/owner/video.mp4');
  } finally {
    if(previous===undefined) delete process.env.MCP_ACQUISITION_SIGNING_SECRET;
    else process.env.MCP_ACQUISITION_SIGNING_SECRET=previous;
  }
});

test('private image and audio delivery retains original type and measured duration', async () => {
  const {getAgentGenerationStatus} = await api;
  for (const result of [
    {surface:'image' as const,imageUrls:[`${base}/renders/images/owner/image.png`],thumbnailUrls:[]},
    {surface:'audio' as const,audioUrl:`${base}/renders/owner/voice.mp3`,videoUrl:null,thumbnailUrl:null,mimeType:'audio/mpeg',durationSec:6.922},
  ]) {
    const status = await getAgentGenerationStatus({jobId:'job-1'},principal,{readStatus:async () => ({...stored,surface:result.surface,result})});
    assert.equal(status.result?.surface,result.surface);
    if(status.result?.surface==='image')assertSigned(status.result.imageUrls[0],'/renders/images/owner/image.png');
    if(status.result?.surface==='audio'){assertSigned(status.result.audioUrl,'/renders/owner/voice.mp3');assert.equal(status.result.durationSec,6.922);assert.equal(status.result.mimeType,'audio/mpeg');}
  }
});
