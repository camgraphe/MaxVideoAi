import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentGenerationStatus } from '../frontend/src/server/generations/generation-status';

// Signing is local with deliberately fake credentials. Quote readers below are
// injected; this suite must never need a database, trial lookup or provider.
process.env.S3_BUCKET = 'character-quote-private-fixture';
process.env.S3_REGION = 'eu-central-1';
process.env.S3_PUBLIC_BASE_URL = 'https://character-quote-private-fixture.s3.eu-central-1.amazonaws.com';
process.env.S3_ACCESS_KEY_ID = 'offline-fixture-key';
process.env.S3_SECRET_ACCESS_KEY = 'offline-fixture-secret';
process.env.MCP_ACQUISITION_SIGNING_SECRET = 'offline-character-quote-media-secret-over-32-bytes';

const base = process.env.S3_PUBLIC_BASE_URL;
const principal = { userId: 'owner', clientId: 'quote-client', emailVerified: true, authMethod: 'oauth' as const };
const accountUrl = 'https://openai-review.maxvideoai.com/account/connections';
const quoteId = '00000000-0000-4000-8000-000000000001';
const original = `${base}/renders/images/owner/identity.png`;
const thumbnail = `${base}/renders/thumbs/owner/identity.webp`;
const image: AgentGenerationStatus = {
  jobId: 'builder-job', surface: 'image', status: 'completed', progress: 100,
  message: null, priceCents: 11, currency: 'USD', paymentStatus: 'paid_wallet', retryAfterSeconds: null,
  result: { surface: 'image', imageUrls: [original], thumbnailUrls: [thumbnail] },
};
const video: AgentGenerationStatus = {
  ...image, jobId: 'recast-job', surface: 'video', priceCents: 364,
  result: { surface: 'video', videoUrl: `${base}/renders/owner/recast.mp4`,
    playbackVideoUrl: `${base}/renders/previews/owner/recast.mp4`,
    lastFrameUrl: `${base}/renders/keyframes/owner/recast.jpg`,
    previewUrl: null, thumbnailUrl: thumbnail, audioUrl: null },
};
const builderApi = import('../frontend/src/server/agent-api/character-builder');
const recastApi = import('../frontend/src/server/agent-api/character-studio');
const mediaApi = import('../frontend/src/server/mcp/media-link');

async function builder(status: AgentGenerationStatus | null) {
  return (await builderApi).createAgentCharacterBuilderService(principal, { executionEnabled: false, accountUrl },
    (() => ({
      confirm: async (input: { quoteId: string }) => { assert.equal(input.quoteId, quoteId); return status; },
      recover: async (input: { quoteId: string }) => { assert.equal(input.quoteId, quoteId); return status; },
    })) as never);
}
async function recast(status: AgentGenerationStatus | null) {
  return (await recastApi).createAgentCharacterStudioService(principal, { executionEnabled: false, accountUrl },
    (() => ({
      confirmRecast: async (input: { quoteId: string }) => { assert.equal(input.quoteId, quoteId); return status; },
      recoverRecast: async (input: { quoteId: string }) => { assert.equal(input.quoteId, quoteId); return status; },
    })) as never);
}
function signed(url: string, canonical: string) {
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, canonical);
  assert.equal(parsed.searchParams.get('X-Amz-Expires'), '300');
  assert.ok(parsed.searchParams.get('X-Amz-Signature'));
}
async function openLink(url: string | undefined, jobId: string) {
  assert.ok(url);
  const link = new URL(url);
  assert.equal(link.origin, new URL(accountUrl).origin);
  assert.equal(link.pathname, '/api/mcp/media');
  assert.equal(link.searchParams.has('X-Amz-Signature'), false);
  const claims = (await mediaApi).verifyMcpMediaToken(link.searchParams.get('token')!, link.origin);
  assert.equal(claims?.userId, principal.userId);
  assert.equal(claims?.clientId, principal.clientId);
  assert.deepEqual(claims?.source, { type: 'generation', jobId });
}

test('Builder confirmation and recovery separate signed presentation from the exact save source', async () => {
  const before = JSON.stringify(image);
  const service = await builder(image);
  for (const recovered of [
    await service.confirm({ quoteId, confirmed: true, amountCents: 11, currency: 'USD' }),
    await service.recover({ quoteId }),
  ]) {
    assert.equal(recovered.quoteId, quoteId);
    assert.equal(recovered.status, 'completed');
    assert.equal(recovered.retry, null);
    assert.ok('result' in recovered && recovered.result?.surface === 'image');
    signed(recovered.result.imageUrls[0], original);
    signed(recovered.result.thumbnailUrls[0], thumbnail);
    assert.ok('saveSource' in recovered);
    assert.deepEqual(recovered.saveSource, { jobId: image.jobId, imageUrl: original });
    assert.notEqual(recovered.saveSource.imageUrl, recovered.result.imageUrls[0]);
    assert.equal(recovered.priceCents, 11);
    await openLink(recovered.openUrl, image.jobId);
    const links = (await builderApi).buildCharacterBuilderResourceLinks(recovered);
    assert.equal(links.length, 2);
    signed(links[0].uri, original);
  }
  assert.equal(JSON.stringify(image), before);
});

test('Recast confirmation and recovery retain private video artifacts and quote-scoped media links', async () => {
  const before = JSON.stringify(video);
  const service = await recast(video);
  for (const recovered of [
    await service.confirmRecast({ quoteId, confirmed: true, amountCents: 364, currency: 'USD' }),
    await service.recoverRecast({ quoteId }),
  ]) {
    assert.equal(recovered.quoteId, quoteId);
    assert.ok('result' in recovered && recovered.result?.surface === 'video');
    signed(recovered.result.videoUrl, `${base}/renders/owner/recast.mp4`);
    signed(recovered.result.playbackVideoUrl!, `${base}/renders/previews/owner/recast.mp4`);
    signed(recovered.result.lastFrameUrl!, `${base}/renders/keyframes/owner/recast.jpg`);
    signed(recovered.result.thumbnailUrl!, thumbnail);
    assert.equal(recovered.priceCents, 364);
    assert.equal(recovered.retry, null);
    await openLink(recovered.openUrl, video.jobId);
    const links = (await recastApi).buildRecastResourceLinks(recovered);
    assert.equal(links.length, 4);
    assert.ok(links.every(link => new URL(link.uri).searchParams.has('X-Amz-Signature')));
  }
  assert.equal(JSON.stringify(video), before);
});

test('foreign private storage objects fail before either character tool can expose media', async () => {
  const foreignImage = { ...image, result: { surface: 'image' as const,
    imageUrls: [`${base}/renders/images/another-owner/image.png`], thumbnailUrls: [] } };
  const foreignVideo = { ...video, result: { surface: 'video' as const,
    videoUrl: `${base}/renders/another-owner/video.mp4`, previewUrl: null, thumbnailUrl: null, audioUrl: null } };
  await assert.rejects(() => builder(foreignImage).then(service => service.recover({ quoteId })), /MEDIA_NOT_AVAILABLE/);
  await assert.rejects(() => recast(foreignVideo).then(service => service.recoverRecast({ quoteId })), /MEDIA_NOT_AVAILABLE/);
});

test('pending and no-job recovery retain the original quote polling contract without a save source', async () => {
  assert.deepEqual(await (await builder(null)).recover({ quoteId }), { quoteId, jobId: null, status: 'no_job', retry: null });
  assert.deepEqual(await (await recast(null)).recoverRecast({ quoteId }), { quoteId, jobId: null, status: 'no_job', retry: null });
  for (const needsAttention of [false, true]) {
    const pending = { ...image, status: 'running' as const, result: null, retryAfterSeconds: 17, needsAttention };
    const built = await (await builder(pending)).recover({ quoteId });
    const recastResult = await (await recast(pending)).recoverRecast({ quoteId });
    for (const [result, tool] of [[built, 'get_character_builder_status'], [recastResult, 'get_recast_status']] as const) {
      assert.equal(result.status, 'running');
      assert.ok('needsAttention' in result);
      assert.equal(result.needsAttention, needsAttention);
      assert.deepEqual(result.retry, needsAttention ? null : { tool, arguments: { quoteId }, afterSeconds: 17 });
      assert.equal('saveSource' in result, false);
      assert.equal('openUrl' in result, false);
    }
  }
});

test('missing handoff signing configuration preserves native signed media without inventing openUrl', async () => {
  const secret = process.env.MCP_ACQUISITION_SIGNING_SECRET;
  try {
    delete process.env.MCP_ACQUISITION_SIGNING_SECRET;
    const recovered = await (await builder(image)).recover({ quoteId });
    assert.ok('result' in recovered && recovered.result?.surface === 'image');
    signed(recovered.result.imageUrls[0], original);
    assert.equal('openUrl' in recovered, false);
    assert.ok('saveSource' in recovered);
    assert.equal(recovered.saveSource.imageUrl, original);
  } finally { process.env.MCP_ACQUISITION_SIGNING_SECRET = secret; }
});
