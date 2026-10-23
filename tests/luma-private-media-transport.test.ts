import assert from 'node:assert/strict';
import test from 'node:test';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import type { LumaAgentsVideoPayload } from '../frontend/src/server/video-providers/luma-agents/payload';

process.env.S3_BUCKET = 'luma-private-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'fixture-access';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://luma-private-fixture.s3.us-east-1.amazonaws.com';
const base = process.env.S3_PUBLIC_BASE_URL;
const owned = (name: string) => `${base}/user-assets/owner/${name}`;
const accepted = { providerJobId: 'gen_private', status: 'queued' as const, rawStatus: 'queued', videoUrl: null, message: null, usage: null, raw: { id: 'gen_private' } };

async function submit(payload: GeneratePayload, createGeneration: (payload: LumaAgentsVideoPayload) => Promise<typeof accepted>, records: unknown[] = []) {
  const { submitLumaAgentsGenerateTask } = await import('../frontend/app/api/generate/_lib/luma-agents-submission');
  return submitLumaAgentsGenerateTask({
    jobId: 'job_private', userId: 'owner', engineId: 'luma-ray-3-2', engineLabel: 'Luma Ray 3.2',
    mode: payload.mode!, prompt: payload.prompt, durationSec: 5, aspectRatio: '16:9', audioEnabled: false,
    effectiveResolution: '720p', imageUrl: payload.imageUrl, placeholderThumb: '/thumb.svg',
    pricing: { totalCents: 141, currency: 'usd' } as never, paymentStatus: 'paid', pendingReceipt: null,
    paymentMode: 'wallet', walletChargeReserved: false, fallbackToFalEnabled: true, advancedDirectOnlyEnabled: true,
    falPayload: payload, falInputSummary: { hasImage: false } as never, isLumaRay2: false,
    batchId: null, groupId: null, iterationIndex: null, iterationCount: null, renderIds: null, heroRenderId: null, localKey: null,
    logMetricFn: (kind, event) => { records.push({ kind, event }); },
    deps: {
      queryFn: async <T>(sql: string, params: unknown[] = []) => {
        records.push({ sql, params });
        return (/INSERT INTO provider_attempts/.test(sql) ? [{ id: 1, attempt_index: 1 }] : []) as T[];
      },
      getLumaAgentsClientFn: () => ({ createGeneration, getGeneration: async () => accepted }),
      submitFalGenerateTaskFn: async () => { throw new Error('Unexpected fallback'); },
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

test('Luma submits private source and edit keyframes through transient grants without persisting provider echoes', async t => {
  const records: unknown[] = [];
  t.mock.method(console, 'warn', (...args) => { records.push(args); });
  const input: GeneratePayload = {
    engineId: 'luma-ray-3-2', mode: 'v2v', prompt: 'Replace the background', durationSec: 5,
    videoUrl: owned('excerpt.mp4'),
    extraInputValues: { edit_keyframe_indexes: [1] },
    inputs: [{ kind: 'image', slotId: 'edit_keyframe_urls', url: owned('keyframe.png'), name: 'keyframe.png', type: 'image/png', size: 10 }],
  };
  const canonical = structuredClone(input);
  let sent: LumaAgentsVideoPayload | undefined;
  const result = await submit(input, async payload => {
    sent = payload;
    return { ...accepted, raw: { ...accepted.raw, echoed: payload } };
  }, records);
  assert.equal(result.ok, true);
  assert.ok(sent?.source && 'url' in sent.source);
  assertGrant(sent.source.url, input.videoUrl!);
  for (const frame of sent.video.edit?.keyframes ?? []) assertGrant(frame.url, frame.url.split('?')[0]);
  assert.ok(sent.video.edit?.keyframes?.some(frame => frame.url.startsWith(owned('keyframe.png'))));
  assert.deepEqual(input, canonical);
  assert.doesNotMatch(JSON.stringify({ records, result, input }), /X-Amz-|fixture-secret/);
});

test('Luma signs both ordinary image frames and preserves external references', async () => {
  const input: GeneratePayload = { engineId: 'luma-ray-3-2', mode: 'i2v', prompt: 'Animate', durationSec: 5,
    imageUrl: owned('start.png'), endImageUrl: owned('end.png') };
  let sent: LumaAgentsVideoPayload | undefined;
  assert.equal((await submit(input, async payload => { sent = payload; return accepted; })).ok, true);
  assertGrant(sent?.video.start_frame?.url, input.imageUrl!);
  assertGrant(sent?.video.end_frame?.url, input.endImageUrl!);
  const external = 'https://provider.example.test/frame.png';
  assert.equal((await submit({ ...input, imageUrl: external }, async payload => {
    assert.equal(payload.video.start_frame?.url, external); return accepted;
  })).ok, true);
});

test('foreign and owner-prefix lookalike media fail before Luma or fallback submission', async t => {
  t.mock.method(console, 'warn', () => {});
  for (const foreign of [`${base}/user-assets/other/source.mp4`, `${base}/user-assets/owner-extra/source.mp4`]) {
    for (const attachment of ['source', 'start', 'end', 'keyframe']) {
      let calls = 0;
      const input: GeneratePayload = { engineId: 'luma-ray-3-2', mode: attachment === 'end' ? 'i2v' : 'v2v', prompt: 'Animate', durationSec: 5,
        videoUrl: attachment === 'source' ? foreign : owned('source.mp4'), imageUrl: attachment === 'keyframe' ? undefined : attachment === 'start' ? foreign : owned('start.png'),
        ...(attachment === 'end' ? { endImageUrl: foreign } : {}),
        ...(attachment === 'keyframe' ? { extraInputValues: { edit_keyframe_indexes: [1] }, inputs: [{ kind: 'image' as const, slotId: 'edit_keyframe_urls', url: foreign, name: 'frame.png', type: 'image/png', size: 10 }] } : {}),
      };
      const result = await submit(input, async () => { calls++; return accepted; });
      assert.equal(calls, 0, attachment);
      assert.equal(result.ok, false, attachment);
      assert.equal(result.status, 400);
      assert.equal(result.body.error, 'REFERENCE_INVALID');
    }
  }
});

test('Luma provider validation echoes cannot retain signed input credentials in diagnostics', async t => {
  const records: unknown[] = [];
  t.mock.method(console, 'warn', (...args) => { records.push(args); });
  const { LumaAgentsError } = await import('../frontend/src/server/video-providers/luma-agents/errors');
  const result = await submit({ engineId: 'luma-ray-3-2', mode: 'v2v', prompt: 'Animate', videoUrl: owned('source.mp4') }, async payload => {
    assert.ok(payload.source && 'url' in payload.source);
    throw new LumaAgentsError('Rejected media', { status: 422, code: 'INVALID_MEDIA', errorClass: 'invalid_request',
      body: { echoed: payload, detail: encodeURIComponent(payload.source.url) } });
  }, records);
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify({ records, result }), /X-Amz-|fixture-secret/);
});
