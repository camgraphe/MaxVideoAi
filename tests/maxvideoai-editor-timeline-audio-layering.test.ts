import assert from 'node:assert/strict';
import test from 'node:test';
import type {WorkspaceTimelineItem,WorkspaceTimelineTrack} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {MAX_TIMELINE_AUDIO_TRACKS} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_state/workspace-state';
import {timelineTrackHasOverlap} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-collisions';

const audio = (id: string,track: WorkspaceTimelineTrack,startSec = 0,durationSec = 4): WorkspaceTimelineItem => ({id,outputNodeId: id,title: id,track,mediaKind: 'audio',startSec,durationSec,sourceStartSec: 1,sourceDurationSec: 12.408,audioMix: {volume: 50,muted: false}});

test('audio layering preserves later clips and reuses the first free range without ripple', async () => {
  const module = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing');
  assert.ok(module.layerWorkspaceTimelineAudioItem,'Audio insertion needs an explicit non-ripple edit operation.');
  const items = [audio('later','audio',5,2),audio('voice','audio-2',0,4)];
  const result = module.layerWorkspaceTimelineAudioItem({items,item: audio('music','audio'),startFrame: 30,fps: 30,maxAudioTracks: MAX_TIMELINE_AUDIO_TRACKS});
  assert.deepEqual(result.find(item => item.id === 'music'),{...audio('music','audio'),startSec: 1});
  assert.deepEqual(result.filter(item => item.id !== 'music'),items,'A future clip on the reused track stays at five seconds.');
  assert.equal(timelineTrackHasOverlap(result),false);
  const overlapping = module.layerWorkspaceTimelineAudioItem({items,item: audio('music','audio'),startFrame: 60,fps: 30,maxAudioTracks: MAX_TIMELINE_AUDIO_TRACKS});
  assert.equal(overlapping.find(item => item.id === 'music')?.track,'audio-3','A partial intersection reserves another track.');
  assert.deepEqual(overlapping.filter(item => item.id !== 'music'),items);
});

test('audio layering skips unavailable tracks and refuses capacity exhaustion without changing the edit', async () => {
  const module = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing');
  assert.ok(module.layerWorkspaceTimelineAudioItem);
  const items = [audio('voice','audio')];
  const result = module.layerWorkspaceTimelineAudioItem({items,item: audio('music','audio'),startFrame: 0,fps: 30,maxAudioTracks: MAX_TIMELINE_AUDIO_TRACKS,unavailableTracks: ['audio-2','audio-3']});
  assert.equal(result.find(item => item.id === 'music')?.track,'audio-4');
  const full = Array.from({length: 8},(_,index) => audio(`existing-${index}`,index === 0 ? 'audio' : `audio-${index+1}`));
  const snapshot = structuredClone(full);
  assert.throws(() => module.layerWorkspaceTimelineAudioItem({items: full,item: audio('music','audio'),startFrame: 0,fps: 30,maxAudioTracks: MAX_TIMELINE_AUDIO_TRACKS}),/Timeline track capacity/);
  assert.deepEqual(full,snapshot);
  assert.throws(() => module.layerWorkspaceTimelineAudioItem({items,item: {...audio('linked','audio'),linkedGroupId: 'video-pair'},startFrame: 0,fps: 30,maxAudioTracks: MAX_TIMELINE_AUDIO_TRACKS}),/standalone audio/);
});

test('explicit canvas insert keeps its existing ripple behavior on the chosen audio track', async () => {
  const {insertWorkspaceTimelineItems} = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing');
  const result = insertWorkspaceTimelineItems({items: [audio('voice','audio')],newItems: [audio('music','audio')],mode: 'insert',playheadSec: 0});
  assert.equal(result.find(item => item.id === 'voice')?.startSec,4);
  assert.equal(result.find(item => item.id === 'music')?.track,'audio');
});
