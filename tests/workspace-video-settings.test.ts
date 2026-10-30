import assert from 'node:assert/strict';
import test from 'node:test';

import type { EngineCaps } from '../frontend/types/engines';
import { buildQuadTileFromGroupMember } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-render-groups';
import { getBaseEngines } from '../frontend/src/lib/engines';
import {
  buildVideoSettingsFormState,
  buildVideoSettingsSnapshotFromTile,
  buildVideoSettingsSnapshotFromSharedVideo,
  claimSharedVideoHydration,
  resolveVideoSettingsSnapshot,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';

function seedanceEngine(): EngineCaps {
  return {
    id: 'seedance-2-0',
    label: 'Seedance 2.0',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v'],
    maxDurationSec: 15,
    resolutions: ['720p'],
    aspectRatios: ['16:9'],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    updatedAt: '2026-07-10T00:00:00.000Z',
    ttlSec: 60,
    availability: 'available',
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        duration: { options: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 8 },
        resolution: ['720p'],
        aspectRatio: ['16:9'],
        fps: [24],
        audioToggle: true,
      },
    },
  };
}

test('shared video hydration waits for engines and claims the same id only once across revalidation', () => {
  let appliedVideoId: string | null = null;
  let prompt = '';
  let snapshotApplications = 0;
  let jobHydrations = 0;

  const runHydrationEffect = (sharedVideoId: string | null, engineCount: number) => {
    const claim = claimSharedVideoHydration(appliedVideoId, sharedVideoId, engineCount);
    appliedVideoId = claim.nextAppliedVideoId;
    if (!claim.shouldApply) return;
    snapshotApplications += 1;
    jobHydrations += 1;
    prompt = `snapshot:${sharedVideoId}`;
  };

  runHydrationEffect('job_123', 0);
  assert.equal(snapshotApplications, 0);
  assert.equal(jobHydrations, 0);

  runHydrationEffect('job_123', 1);
  assert.equal(snapshotApplications, 1);
  assert.equal(jobHydrations, 1);
  assert.equal(prompt, 'snapshot:job_123');

  prompt = 'visitor edit after recreation';
  runHydrationEffect('job_123', 1);
  assert.equal(snapshotApplications, 1);
  assert.equal(jobHydrations, 1);
  assert.equal(prompt, 'visitor edit after recreation');
});

function resolveForEngine(snapshot: unknown, engine: EngineCaps) {
  return resolveVideoSettingsSnapshot(snapshot, {
    engines: [engine],
    engineMap: new Map([[engine.id, engine]]),
    createLocalId: (prefix) => `${prefix}-1`,
    createFallbackScene: () => ({ id: 'scene-1', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({
      id: 'element-1', frontal: null, references: [null, null, null], video: null,
    }),
  });
}

function sharedSnapshot(aspectRatio: string, engineId = 'minimax-h3') {
  return buildVideoSettingsSnapshotFromSharedVideo({
    id: 'example', engineId, engineLabel: 'Example', durationSec: 15,
    prompt: 'Recreate this shot', aspectRatio, createdAt: '2026-09-06T00:00:00Z',
  });
}

test('recreating an H3 example preserves its near-16:9 framing instead of selecting 21:9', () => {
  const engine = getBaseEngines().find((candidate) => candidate.id === 'minimax-h3');
  assert.ok(engine);
  const resolved = resolveForEngine(sharedSnapshot('159:91'), engine);
  const form = buildVideoSettingsFormState(resolved);
  assert.equal(form.aspectRatio, '16:9');
  assert.equal(form.durationSec, 15);
  assert.equal(resolved.prompt, 'Recreate this shot');
});

test('derived tile ratios use the nearest supported ratio, including portrait and equivalent dimensions', () => {
  const engine = seedanceEngine();
  engine.modeCaps!.t2v!.aspectRatio = ['21:9', '16:9', '9:16'];
  for (const [input, expected] of [['159:91', '16:9'], ['91:159', '9:16'], ['1920/1080', '16:9']]) {
    const snapshot = buildVideoSettingsSnapshotFromTile({
      engineId: engine.id, aspectRatio: input, durationSec: 12, iterationCount: 1,
      prompt: 'Example',
    } as Parameters<typeof buildVideoSettingsSnapshotFromTile>[0]);
    assert.equal(buildVideoSettingsFormState(resolveForEngine(snapshot, engine)).aspectRatio, expected);
  }
});

test('derived framing only snaps small differences and respects mode-specific or source-driven ratios', () => {
  const engine = seedanceEngine();
  engine.aspectRatios = ['16:9', '9:16'];
  engine.modeCaps!.t2v!.aspectRatio = ['21:9', '16:9', 'auto'];
  for (const input of ['21:9', 'auto', '4:3', '1.83:1', '91:159', '0:9', 'invalid']) {
    assert.equal(resolveForEngine(sharedSnapshot(input, engine.id), engine).formValues.aspectRatio, input);
  }
  assert.equal(buildVideoSettingsFormState(resolveForEngine(sharedSnapshot('4:3', engine.id), engine)).aspectRatio, '21:9');
  engine.modeCaps!.t2v!.aspectRatio = [];
  assert.equal(resolveForEngine(sharedSnapshot('159:91', engine.id), engine).formValues.aspectRatio, '159:91');
});

test('saved generation settings stay authoritative and are not normalized like derived media metadata', () => {
  const engine = seedanceEngine();
  const snapshot = {
    schemaVersion: 1, surface: 'video', engineId: engine.id, inputMode: 't2v',
    core: { aspectRatio: '159:91' }, meta: {},
  };
  assert.equal(resolveForEngine(snapshot, engine).formValues.aspectRatio, '159:91');
});

test('shared video hydration resets for a changed or cleared shared video id', () => {
  const first = claimSharedVideoHydration(null, 'job_123', 1);
  assert.deepEqual(first, { nextAppliedVideoId: 'job_123', shouldApply: true });

  const changedWhileWaiting = claimSharedVideoHydration(first.nextAppliedVideoId, 'job_456', 0);
  assert.deepEqual(changedWhileWaiting, { nextAppliedVideoId: null, shouldApply: false });

  const changedReady = claimSharedVideoHydration(changedWhileWaiting.nextAppliedVideoId, 'job_456', 1);
  assert.deepEqual(changedReady, { nextAppliedVideoId: 'job_456', shouldApply: true });

  const cleared = claimSharedVideoHydration(changedReady.nextAppliedVideoId, null, 1);
  assert.deepEqual(cleared, { nextAppliedVideoId: null, shouldApply: false });

  const reappliedAfterClear = claimSharedVideoHydration(cleared.nextAppliedVideoId, 'job_456', 1);
  assert.deepEqual(reappliedAfterClear, { nextAppliedVideoId: 'job_456', shouldApply: true });
});

test('guest sample duration selects the matching duration option', () => {
  const engine = seedanceEngine();
  const snapshot = buildVideoSettingsSnapshotFromTile({
    engineId: engine.id,
    durationSec: 12,
    aspectRatio: '16:9',
    iterationCount: 1,
    prompt: 'Starter sample',
    hasAudio: true,
  } as Parameters<typeof buildVideoSettingsSnapshotFromTile>[0]);
  const resolved = resolveVideoSettingsSnapshot(snapshot, {
    engines: [engine],
    engineMap: new Map([[engine.id, engine]]),
    createLocalId: (prefix) => `${prefix}-1`,
    createFallbackScene: () => ({ id: 'scene-1', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({
      id: 'element-1',
      frontal: null,
      references: [null, null, null],
      video: null,
    }),
  });

  const next = buildVideoSettingsFormState(resolved);

  assert.equal(next.durationSec, 12);
  assert.equal(next.durationOption, 12);
});

test('historical Sora recall preserves its engine and prompt instead of silently selecting another model', () => {
  const engines = [seedanceEngine()];
  const resolved = resolveVideoSettingsSnapshot({ schemaVersion: 1, surface: 'video', engineId: 'sora-2', inputMode: 't2v', prompt: 'Saved shot', core: { durationSec: 8 } }, {
    engines, engineMap: new Map(engines.map(engine => [engine.id, engine])),
    createLocalId: () => 'local', createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 4 }),
    createFallbackKlingElement: () => ({ id: 'element', frontal: null, references: [], video: null }),
  });
  assert.equal(resolved.engine.id, 'sora-2');
  assert.equal(resolved.prompt, 'Saved shot');
});

test('public example recreation carries measured resolution and explicit audio', () => {
  const engine = seedanceEngine();
  engine.resolutions = ['480p', '720p'];
  engine.modeCaps!.t2v!.resolution = ['480p', '720p'];
  const snapshot = buildVideoSettingsSnapshotFromSharedVideo({
    id: 'example', engineId: engine.id, engineLabel: engine.label, durationSec: 12,
    prompt: 'The complete original prompt', aspectRatio: '16:9', createdAt: '',
    outputWidth: 1280, outputHeight: 720, hasAudio: false,
  } as Parameters<typeof buildVideoSettingsSnapshotFromSharedVideo>[0]);
  const form = buildVideoSettingsFormState(resolveForEngine(snapshot, engine));
  assert.equal(form.resolution, '720p');
  assert.equal(form.audio, false);
});

test('derived public resolution maps to the engine token without dropping 1080p to 768P', () => {
  const engine = getBaseEngines().find(candidate => candidate.id === 'minimax-h3-max');
  assert.ok(engine);
  const snapshot = buildVideoSettingsSnapshotFromSharedVideo({
    id: 'example', engineId: engine.id, engineLabel: engine.label, durationSec: 15,
    prompt: 'Example', aspectRatio: '16:9', createdAt: '', outputWidth: 1920, outputHeight: 1080, hasAudio: true,
  });
  const form = buildVideoSettingsFormState(resolveForEngine(snapshot, engine));
  assert.equal(form.resolution, '1080P');
});

test('complete public recreation restores typed reference fields without a private job hydration', () => {
  const engine = getBaseEngines().find(candidate => candidate.id === 'luma-ray-3-2');
  assert.ok(engine);
  const snapshot = { schemaVersion:1,surface:'video',engineId:engine.id,inputMode:'v2v',prompt:'Exact modify prompt',
    core:{durationSec:5,resolution:'720p',aspectRatio:'16:9'},advanced:{extraInputValues:{strength:0.7}},
    refs:{videoUrls:['https://media.example/marketing-media/source.mp4'],inputs:null} };
  const result=resolveForEngine(snapshot,engine);
  assert.equal(result.inputAssets?.video_url?.[0]?.url,'https://media.example/marketing-media/source.mp4');
  assert.equal(result.formValues.extraInputValues.strength,0.7);
});

test('public recreation strips private source binding while authenticated personal recall preserves it', () => {
  const engine = getBaseEngines().find(engine => engine.id === 'flux-3-draft')!;
  const snapshot = {schemaVersion:1,surface:'video',engineId:engine.id,inputMode:'v2v',operation:'flux-draft-enhance',
    prompt:'Reusable creative text',sourceJobId:'private-job',sourceOutputId:'private-output',
    core:{resolution:'1080p'},advanced:{extraInputValues:{source_job_id:'private-job',source_output_id:'private-output',safety_tolerance:2}},refs:{inputs:[]}};
  const options = {engines:[engine],engineMap:new Map([[engine.id,engine]]),createLocalId:()=> 'id',
    createFallbackScene:()=>({id:'scene',prompt:'',duration:5}),createFallbackKlingElement:()=>({id:'element',frontal:null,references:[],video:null})};
  const shared = buildVideoSettingsSnapshotFromSharedVideo({id:'public',engineId:engine.id,recreationSnapshot:snapshot} as any);
  const publicResult = resolveVideoSettingsSnapshot(shared,options as any);
  assert.equal(publicResult.prompt,snapshot.prompt);
  assert.equal(publicResult.formValues.operation,'flux-draft-enhance');
  assert.deepEqual(publicResult.formValues.extraInputValues,{safety_tolerance:2});
  const personalResult=resolveVideoSettingsSnapshot(snapshot,options as any);
  assert.deepEqual(personalResult.formValues.extraInputValues,snapshot.advanced.extraInputValues);
  assert.equal(snapshot.sourceJobId,'private-job','the authored recipe is not mutated');
});

test('recalling nullable generation settings restores model defaults and clears unused references', () => {
  const engine = seedanceEngine();
  engine.resolutions = ['720p', '1080p'];
  engine.modeCaps!.t2v!.resolution = ['720p', '1080p'];
  engine.modeCaps!.t2v!.aspectRatio = ['16:9', '9:16'];
  engine.modeCaps!.t2v!.fps = [24, 30];
  const resolved = resolveForEngine({
    schemaVersion: 1, surface: 'video', engineId: engine.id, inputMode: 't2v',
    core: { durationSec: null, durationOption: null, numFrames: null, resolution: null,
      aspectRatio: null, fps: null, iterationCount: null, audio: null },
    advanced: { seed: null, loop: null, cameraFixed: null, safetyChecker: null }, refs: {},
  }, engine);
  const restored = buildVideoSettingsFormState(resolved);
  assert.equal(restored.durationSec, 8);
  assert.equal(restored.resolution, '720p');
  assert.equal(restored.aspectRatio, '16:9');
  assert.equal(restored.fps, 24);
  assert.equal(restored.iterations, 1);
  assert.equal(restored.seed, null);
  assert.equal(restored.seedLocked, false);
  assert.equal(restored.audio, true);
  assert.equal(restored.cameraFixed, false);
  assert.equal(restored.safetyChecker, true);
  assert.deepEqual(restored.extraInputValues, {});
  assert.deepEqual(resolved.inputAssets, {});
  assert.deepEqual(resolved.klingElements, [{ id: 'element-1', frontal: null, references: [null, null, null], video: null }]);
});

test('Kling Edit recall uses its operation controls rather than Reference duration and framing options', () => {
  const engine = getBaseEngines().find(candidate => candidate.id === 'kling-o3-standard');
  assert.ok(engine);
  const resolved = resolveForEngine({
    schemaVersion: 1, surface: 'video', engineId: engine.id, inputMode: 'v2v', operation: 'kling-edit',
    core: { durationSec: 13, aspectRatio: 'source', resolution: '720p' },
    advanced: { extraInputValues: { keep_audio: false } },
    refs: { videoUrls: ['https://media.example/original-source.mp4'], inputs: null },
  }, engine);
  const form = buildVideoSettingsFormState(resolved);
  assert.equal(form.operation, 'kling-edit');
  assert.equal(form.durationSec, 13);
  assert.equal(form.aspectRatio, 'source');
  assert.equal(form.extraInputValues.keep_audio, false);
  assert.equal(resolved.inputAssets?.video_url?.[0]?.url, 'https://media.example/original-source.mp4');
});

test('source operation recall binds typed references against the selected operation schema', () => {
  const engine = getBaseEngines().find(candidate => candidate.id === 'minimax-h3-max');
  assert.ok(engine);
  const resolved = resolveForEngine({
    schemaVersion: 1, surface: 'video', engineId: engine.id, inputMode: 'v2v', operation: 'h3-recast',
    core: { durationSec: 25, resolution: '1080P', aspectRatio: 'source' },
    refs: { videoUrls: ['https://media.example/source.mp4'], referenceImages: ['https://media.example/person.png'] },
  }, engine);
  const form = buildVideoSettingsFormState(resolved);
  assert.equal(form.operation, 'h3-recast');
  assert.equal(form.durationSec, 25);
  assert.equal(form.resolution, '1080P');
  assert.equal(form.aspectRatio, 'source');
  assert.equal(resolved.inputAssets?.video_url?.[0]?.url, 'https://media.example/source.mp4');
  assert.equal(resolved.inputAssets?.reference_image_urls?.[0]?.url, 'https://media.example/person.png');
});

test('history tile recall keeps the complete generation snapshot and original Modify inputs', () => {
  const engine = getBaseEngines().find(candidate => candidate.id === 'kling-o3-standard');
  assert.ok(engine);
  const settingsSnapshot = {
    schemaVersion: 1, surface: 'video', engineId: engine.id, inputMode: 'v2v', operation: 'kling-edit',
    prompt: 'Replace the sky', negativePrompt: 'noise', core: { resolution: '720p' },
    advanced: { seed: 0, extraInputValues: { keep_audio: false } },
    refs: { videoUrls: ['https://media.example/original-input.mp4'] },
  };
  const member = {
    id: 'completed', jobId: 'completed', engineId: engine.id, engineLabel: engine.label,
    durationSec: 12, prompt: 'Replace the sky', createdAt: '', source: 'job' as const,
    videoUrl: 'https://media.example/generated-output.mp4',
    job: { jobId: 'completed', engineLabel: engine.label, durationSec: 12, prompt: 'Replace the sky', createdAt: '', settingsSnapshot },
  };
  const tile = buildQuadTileFromGroupMember({
    id: 'group', source: 'history', count: 1, totalPriceCents: null, createdAt: '',
    hero: member, members: [member], previews: [],
  }, member, engine.id);
  const resolved = resolveForEngine(buildVideoSettingsSnapshotFromTile(tile), engine);
  assert.equal(resolved.mode, 'v2v');
  assert.equal(resolved.formValues.operation, 'kling-edit');
  assert.equal(resolved.formValues.seed, 0);
  assert.equal(resolved.negativePrompt, 'noise');
  assert.equal(resolved.inputAssets?.video_url?.[0]?.url, 'https://media.example/original-input.mp4');
  assert.deepEqual(settingsSnapshot.refs.videoUrls, ['https://media.example/original-input.mp4']);
});

test('shared metadata without a full recipe retains Extend mode without turning output into its source', () => {
  const engine = getBaseEngines().find(candidate => candidate.id === 'luma-ray-3-2');
  assert.ok(engine);
  const resolved = resolveForEngine(buildVideoSettingsSnapshotFromSharedVideo({
    id: 'example', engineId: engine.id, engineLabel: engine.label, durationSec: 5,
    prompt: 'Continue the scene', createdAt: '', generationMode: 'extend', operation: 'luma-extend',
    videoUrl: 'https://media.example/generated-output.mp4',
  }), engine);
  assert.equal(resolved.mode, 'extend');
  assert.equal(resolved.formValues.operation, 'luma-extend');
  assert.deepEqual(resolved.inputAssets, {});
  assert.equal(resolved.formValues.extraInputValues.source_job_id, undefined);
});
