import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCreateStudioMontageInput,
  type CreateStudioMontageInput,
} from '../frontend/lib/studio/montage-contract';
import {
  buildStudioMontageProjectState,
  canonicalStudioMontageRequestHash,
} from '../frontend/src/server/studio/montage-command';

const firstAssetId = `ma_${'1'.repeat(32)}`;
const secondAssetId = `ma_${'2'.repeat(32)}`;

const validInput: CreateStudioMontageInput = {
  title: 'Ordered launch cut',
  settings: { fps: 24, aspectRatio: '16:9', resolution: '1080p', audioMode: 'preserve' },
  clips: [
    { assetId: firstAssetId, sourceInFrame: 12, durationFrames: 24 },
    { assetId: secondAssetId, sourceInFrame: 0, durationFrames: 48 },
  ],
  idempotencyKey: 'studio-montage-retry-001',
};

test('the common montage contract rejects transport-only authority and unrecognized nested fields', () => {
  for (const input of [
    { ...validInput, owner: 'attacker' },
    { ...validInput, projectId: 'project-existing' },
    { ...validInput, clips: [{ ...validInput.clips[0], url: 'https://secret.example/a.mp4' }, validInput.clips[1]] },
    { ...validInput, settings: { ...validInput.settings, durationSec: 99 } },
    { ...validInput, clips: [{ ...validInput.clips[0], assetId: 'legacy-asset' }, validInput.clips[1]] },
  ]) {
    assert.throws(() => parseCreateStudioMontageInput(input), /Invalid Studio montage input/u);
  }
});

test('the common montage contract validates title, settings, clip bounds and the required exact retry key', () => {
  assert.deepEqual(parseCreateStudioMontageInput(validInput), validInput);
  for (const input of [
    { ...validInput, title: ' padded ' },
    { ...validInput, settings: { ...validInput.settings, fps: 23 } },
    { ...validInput, settings: { ...validInput.settings, audioMode: 'generate' } },
    { ...validInput, clips: [validInput.clips[0]] },
    { ...validInput, clips: Array.from({ length: 13 }, () => validInput.clips[0]) },
    { ...validInput, idempotencyKey: '' },
    { ...validInput, idempotencyKey: ' padded ' },
  ]) {
    assert.throws(() => parseCreateStudioMontageInput(input), /Invalid Studio montage input/u);
  }
});

test('the persisted montage mapping keeps caller order, repeated occurrences, measured trims and known embedded audio', () => {
  const repeatedInput = {
    ...validInput,
    clips: [validInput.clips[0], { ...validInput.clips[0], sourceInFrame: 48, durationFrames: 12 }],
  };
  const state = buildStudioMontageProjectState({
    input: repeatedInput,
    projectId: 'project-1',
    sequenceId: 'sequence-1',
    now: '2026-09-08T10:00:00.000Z',
    assets: [
      {
        id: 'internal-1', ref: { type: 'asset', assetId: firstAssetId, kind: 'video' }, kind: 'video',
        url: 'https://studio-fixture.example/media-assets/owner-a/a.mp4', thumbUrl: null, previewUrl: null,
        mime: 'video/mp4', mediaFacts: { source: 'probe', durationSec: 6, width: 1920, height: 1080, hasAudio: true },
        originalAccess: { type: 'owned-storage', storageKey: 'media-assets/owner-a/a.mp4' },
        originalName: 'pattern-a.mp4',
      },
      {
        id: 'internal-1', ref: { type: 'asset', assetId: firstAssetId, kind: 'video' }, kind: 'video',
        url: 'https://studio-fixture.example/media-assets/owner-a/a.mp4', thumbUrl: null, previewUrl: null,
        mime: 'video/mp4', mediaFacts: { source: 'probe', durationSec: 6, width: 1920, height: 1080, hasAudio: true },
        originalAccess: { type: 'owned-storage', storageKey: 'media-assets/owner-a/a.mp4' },
        originalName: 'pattern-a.mp4',
      },
    ],
  });

  assert.equal(state.workspaceState.focusMode, 'viewer');
  assert.equal(state.workspaceState.activeSequenceId, 'sequence-1');
  assert.deepEqual(state.workspaceState.nodes, []);
  assert.deepEqual(state.workspaceState.edges, []);
  assert.equal(state.workspaceState.projectAssets?.length, 1, 'a repeated source is one project asset');
  assert.equal(state.sequence.timelineItems.length, 2, 'embedded audio stays on each video occurrence');
  assert.deepEqual(state.sequence.timelineItems.map((clip) => ({
    id: clip.id,
    ref: clip.ref,
    startSec: clip.startSec,
    sourceStartSec: clip.sourceStartSec,
    durationSec: clip.durationSec,
    sourceDurationSec: clip.sourceDurationSec,
    hasEmbeddedAudio: clip.hasEmbeddedAudio,
    audioProvenance: clip.audioProvenance,
    audioMix: clip.audioMix,
  })), [
    {
      id: 'montage-clip-01', ref: { type: 'asset', assetId: firstAssetId, kind: 'video' },
      startSec: 0, sourceStartSec: 0.5, durationSec: 1, sourceDurationSec: 6,
      hasEmbeddedAudio: true, audioProvenance: 'embedded', audioMix: { volume: 100, muted: false },
    },
    {
      id: 'montage-clip-02', ref: { type: 'asset', assetId: firstAssetId, kind: 'video' },
      startSec: 1, sourceStartSec: 2, durationSec: 0.5, sourceDurationSec: 6,
      hasEmbeddedAudio: true, audioProvenance: 'embedded', audioMix: { volume: 100, muted: false },
    },
  ]);
});

test('mute is explicit while unknown audio remains unknown and client duration-like fields never qualify trims', () => {
  const state = buildStudioMontageProjectState({
    input: { ...validInput, settings: { ...validInput.settings, audioMode: 'mute' } },
    projectId: 'project-1', sequenceId: 'sequence-1', now: '2026-09-08T10:00:00.000Z',
    assets: validInput.clips.map((clip, index) => ({
      id: `internal-${index}`, ref: { type: 'asset' as const, assetId: clip.assetId, kind: 'video' as const }, kind: 'video',
      url: `https://cdn.maxvideoai.com/${index}.mp4`, thumbUrl: null, previewUrl: null, mime: 'video/mp4',
      mediaFacts: { source: 'probe' as const, durationSec: 6 }, originalAccess: { type: 'external' as const },
      originalName: `clip-${index}.mp4`,
    })),
  });
  assert.equal(state.sequence.timelineItems[0].hasEmbeddedAudio, undefined);
  assert.equal(state.sequence.timelineItems[0].audioProvenance, 'unknown');
  assert.deepEqual(state.sequence.timelineItems[0].audioMix, { volume: 100, muted: true });

  const assetsWithoutMeasuredDuration = validInput.clips.map((clip, index) => ({
    id: `internal-${index}`, ref: { type: 'asset' as const, assetId: clip.assetId, kind: 'video' as const }, kind: 'video',
    url: `https://cdn.maxvideoai.com/${index}.mp4`, thumbUrl: null, previewUrl: null, mime: 'video/mp4',
    mediaFacts: undefined, originalAccess: { type: 'external' as const }, originalName: `clip-${index}.mp4`,
  }));
  assert.throws(
    () => buildStudioMontageProjectState({ input: validInput, projectId: 'p', sequenceId: 's', now: '2026-09-08T10:00:00.000Z', assets: assetsWithoutMeasuredDuration }),
    /missing measured source duration/u,
  );
});

test('the request hash includes command version, clip order and the full validated business payload but not owner', () => {
  const original = canonicalStudioMontageRequestHash(validInput);
  assert.equal(original, canonicalStudioMontageRequestHash({ ...validInput }));
  assert.notEqual(original, canonicalStudioMontageRequestHash({ ...validInput, clips: [...validInput.clips].reverse() }));
  assert.notEqual(original, canonicalStudioMontageRequestHash({ ...validInput, title: 'Another cut' }));
  assert.match(original, /^[a-f0-9]{64}$/u);
});
