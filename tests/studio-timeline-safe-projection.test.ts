import assert from 'node:assert/strict';
import test from 'node:test';
import {projectStudioConversationTimeline} from '../frontend/src/server/studio/conversation-timeline';

test('the shared timeline projection exposes exact edit facts without passthrough media or workspace metadata',()=>{
  const source = {
    project: {id: 'project',revision: 12,updatedAt: '2026-10-03T00:00:00Z',workspaceState: {activeSequenceId: 'sequence',privateGraph: 'secret'}},
    sequences: [{id: 'sequence',name: 'Main',settings: {fps: 30},timelineState: {lockedTimelineTracks: ['video'],mutedAudioTracks: ['audio-2'],timelineItems: [
      {id: 'clip',title: 'Sound',mediaKind: 'audio',track: 'audio',startSec: 2,durationSec: 3,sourceStartSec: 1,audioMix: {volume: 15,muted: false},ref: {type: 'job-output',jobId: 'job',outputId: 'b11fb77a-7e4c-4bcd-a47f-46cddcf305b4',kind: 'audio'},url: 'https://private.example/audio',mediaAccessUrl: 'secret'},
      {id: 'legacy',title: 'Legacy',mediaKind: 'image',track: 'video',startSec: 0,durationSec: 1,ref: {type: 'asset',assetId: `ma_${'1'.repeat(32)}`,kind: 'image',privateUrl: 'secret'}},
    ]}}],
  };
  const {data} = projectStudioConversationTimeline(source as any);
  assert.deepEqual(data.lockedTracks,['video']);
  assert.deepEqual(data.mutedAudioTracks,['audio-2']);
  assert.deepEqual(data.clips[0],{id: 'clip',title: 'Sound',kind: 'audio',track: 'audio',startFrame: 60,durationFrames: 90,sourceInFrame: 30,volume: 15,muted: false,ref: {type: 'job-output',jobId: 'job',outputId: 'b11fb77a-7e4c-4bcd-a47f-46cddcf305b4',kind: 'audio'}});
  assert.doesNotMatch(JSON.stringify(data),/privateUrl|secret|https?:|privateGraph/,'A malformed legacy ref cannot inject original URLs or secret fields into MCP.');
  data.lockedTracks!.push('audio');
  assert.deepEqual(source.sequences[0].timelineState.lockedTimelineTracks,['video'],'Returned facts are detached from the canonical snapshot.');
});
