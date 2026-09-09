import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  buildMontageEditPlan,
  createPrepareMontageService,
  type PrepareMontageInput,
} from '../frontend/src/server/agent-api/montage-plan';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { OwnedReferenceAsset } from '../frontend/src/server/agent-api/reference-assets';

const principal: AgentPrincipal = {
  userId: 'owner', clientId: 'test-client', emailVerified: true, authMethod: 'oauth',
};
const firstId = `ma_${'1'.repeat(32)}`;
const secondId = `ma_${'2'.repeat(32)}`;

function input(overrides: Partial<PrepareMontageInput> = {}): PrepareMontageInput {
  return {
    title: 'Launch montage',
    settings: { fps: 24, aspectRatio: '16:9', resolution: '1080p', audioMode: 'preserve' },
    clips: [
      { assetId: firstId, sourceInFrame: 0, durationFrames: 48 },
      { assetId: secondId, sourceInFrame: 12, durationFrames: 36 },
    ],
    ...overrides,
  };
}

function video(assetId: string, durationSec = 10, originalName?: string): OwnedReferenceAsset {
  return {
    assetId,
    mediaKind: 'video',
    storageUrl: `https://cdn.maxvideoai.com/private/${assetId}.mp4?secret=never-return`,
    width: 1920,
    height: 1080,
    durationSec,
    mimeType: 'video/mp4',
    ...(originalName ? { originalName } : {}),
  };
}

test('buildMontageEditPlan creates a stable contiguous frame plan with repeated media', () => {
  const repeated = input({
    clips: [
      { assetId: firstId, sourceInFrame: 0, durationFrames: 24 },
      { assetId: firstId, sourceInFrame: 24, durationFrames: 48 },
    ],
  });
  const result = buildMontageEditPlan(repeated, [video(firstId, 3, '  Opening\nshot.mp4  '), video(firstId, 3)]);
  assert.deepEqual(result.clips, [
    { clipId: 'clip_01', assetId: firstId, label: 'Opening shot.mp4', sourceInFrame: 0, timelineStartFrame: 0, durationFrames: 24 },
    { clipId: 'clip_02', assetId: firstId, label: 'Video clip 2', sourceInFrame: 24, timelineStartFrame: 24, durationFrames: 48 },
  ]);
  assert.equal(result.totalFrames, 72);
  assert.equal(result.totalSeconds, 3);
  assert.equal(result.status, 'edit_plan');
  assert.equal(result.persisted, false);
  assert.equal(result.orderingBasis, 'caller_supplied');
  assert.doesNotMatch(JSON.stringify(result), /cdn|maxvideoai\.com\/private|secret=/u);
});

test('frame bounds use the measured duration at the selected fps', () => {
  const exact = input({ clips: [
    { assetId: firstId, sourceInFrame: 1, durationFrames: 59 },
    { assetId: secondId, sourceInFrame: 0, durationFrames: 1 },
  ] });
  assert.equal(buildMontageEditPlan(exact, [video(firstId, 2.5), video(secondId, 1)]).totalFrames, 60);
  assert.throws(
    () => buildMontageEditPlan({ ...exact, clips: [{ ...exact.clips[0]!, durationFrames: 60 }, exact.clips[1]!] }, [video(firstId, 2.5), video(secondId, 1)]),
    (error) => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID' && /60-frame source/u.test(error.message),
  );
});

test('plan rejects missing duration, wrong media, clip count and total duration limits', () => {
  assert.throws(() => buildMontageEditPlan(input(), [video(firstId, 0), video(secondId)]), /exceeds its measured/u);
  assert.throws(() => buildMontageEditPlan(input(), [{ ...video(firstId), durationSec: null }, video(secondId)]), /missing measured source duration/u);
  assert.throws(() => buildMontageEditPlan(input(), [{ ...video(firstId), mediaKind: 'image', durationSec: null, mimeType: 'image/png' }, video(secondId)]), /owned ready video/u);
  assert.throws(() => buildMontageEditPlan(input({ clips: [input().clips[0]!] }), [video(firstId)]), /2–12 clips/u);
  const thirteen = Array.from({ length: 13 }, (_, index) => ({ assetId: firstId, sourceInFrame: index, durationFrames: 1 }));
  assert.throws(() => buildMontageEditPlan(input({ clips: thirteen }), thirteen.map(() => video(firstId))), /2–12 clips/u);
  const tooLong = input({ clips: [
    { assetId: firstId, sourceInFrame: 0, durationFrames: 2160 },
    { assetId: secondId, sourceInFrame: 0, durationFrames: 2161 },
  ] });
  assert.throws(() => buildMontageEditPlan(tooLong, [video(firstId, 100), video(secondId, 100)]), /180-second limit/u);
});

test('service resolves every occurrence under the OAuth principal and preserves neutral denials', async () => {
  const calls: string[] = [];
  const service = createPrepareMontageService(async (currentPrincipal, assetId) => {
    assert.equal(currentPrincipal, principal);
    calls.push(assetId);
    if (assetId === secondId) {
      throw new AgentApiError('REFERENCE_NOT_FOUND', 'database URL https://secret.example/source.mp4');
    }
    return video(assetId);
  });
  await assert.rejects(
    () => service(input(), principal),
    (error) => error instanceof AgentApiError
      && error.code === 'REFERENCE_NOT_FOUND'
      && error.message === 'Reference media not found.'
      && !error.message.includes('secret.example'),
  );
  assert.deepEqual(calls, [firstId, secondId]);
});
