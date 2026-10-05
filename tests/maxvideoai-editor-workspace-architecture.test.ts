import assert from 'node:assert/strict';
import test from 'node:test';
import type {WorkspaceGraphNode,WorkspaceTimelineItem,WorkspaceTimelineTrack} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';

/** Independent sequence fixture: no Canvas/template builder owns render-test inputs. */
function createRenderFixture(): {nodes: WorkspaceGraphNode[];timelineItems: WorkspaceTimelineItem[]} {
  const video=(id: string,startSec: number,durationSec: number): WorkspaceTimelineItem => ({
    id,outputNodeId:id,track:'video',title:id,startSec,durationSec,sourceStartSec:0,
    sourceDurationSec:durationSec,mediaKind:'video',mediaUrl:'/media/'+id+'.mp4',
    sourceWidth:1920,sourceHeight:1080,status:'completed',
  });
  return {
    nodes:[{id:'music-source',position:{x:0,y:0},data:{kind:'asset-audio',title:'Music',asset:{
      id:'music-source',kind:'audio',filename:'music.wav',subtitle:'Music',url:'/media/music.wav',durationSec:28,
    }}}],
    timelineItems:[
      video('timeline-output-01',0,5),
      {...video('timeline-output-02',5,6),linkedGroupId:'timeline-output-02'},
      {id:'timeline-output-02-audio',outputNodeId:'timeline-output-02',track:'audio',title:'Linked audio',
        startSec:5,durationSec:6,sourceStartSec:0,sourceDurationSec:6,mediaKind:'audio',
        mediaUrl:'/media/linked-audio.wav',linkedGroupId:'timeline-output-02',status:'completed'},
      {id:'timeline-music',outputNodeId:'music-source',track:'audio-2',title:'Music',startSec:0,durationSec:28,
        sourceStartSec:0,sourceDurationSec:28,mediaKind:'audio',status:'completed'},
    ],
  };
}

test('program snapshots only fall back to image-safe preview URLs', async () => {
  const {
    isProgramSnapshotImageUrl,
    resolveProgramSnapshotFallbackSourceUrl,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-program-snapshot');

  assert.equal(isProgramSnapshotImageUrl('/api/media/frame.png'), true, 'snapshot helper should accept ordinary image URLs');
  assert.equal(isProgramSnapshotImageUrl('data:image/jpeg;base64,abc'), true, 'snapshot helper should accept captured image data URLs');
  assert.equal(isProgramSnapshotImageUrl('/api/media/source.mp4'), false, 'snapshot helper should reject video URLs for image nodes');
  assert.equal(
    resolveProgramSnapshotFallbackSourceUrl({
      mediaKind: 'video',
      sourceUrl: '/api/media/source.mp4',
      thumbnailUrl: '/api/media/source-thumb.webp',
    }),
    '/api/media/source-thumb.webp',
    'video snapshots should fall back to their image thumbnail when frame capture is unavailable'
  );
  assert.equal(
    resolveProgramSnapshotFallbackSourceUrl({
      mediaKind: 'image',
      sourceUrl: '/api/media/source.png',
      thumbnailUrl: '/api/media/source-thumb.webp',
    }),
    '/api/media/source.png',
    'image snapshots should keep the visible image source before using a thumbnail'
  );
  assert.equal(
    resolveProgramSnapshotFallbackSourceUrl({
      mediaKind: 'video',
      sourceUrl: '/api/media/source.mp4',
      thumbnailUrl: null,
    }),
    undefined,
    'video snapshots without a captured frame or thumbnail should not create broken image nodes'
  );
});

test('MaxVideoAI editor timeline track helpers reject impossible video lanes', async () => {
  const {
    isWorkspaceTimelineAudioTrack,
    isWorkspaceTimelineVideoTrack,
    workspaceTimelineAudioTrackId,
    workspaceTimelineAudioTrackIndex,
    workspaceTimelineVideoTrackId,
    workspaceTimelineTrackLabel,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-tracks');

  assert.equal(isWorkspaceTimelineVideoTrack('video'), true, 'base video track should be treated as video');
  assert.equal(isWorkspaceTimelineVideoTrack('video-2'), true, 'added video tracks should be treated as video');
  assert.equal(
    isWorkspaceTimelineVideoTrack('video-0' as WorkspaceTimelineTrack),
    false,
    'timeline should reject impossible V0 tracks at runtime'
  );
  assert.equal(workspaceTimelineVideoTrackId(3), 'video-3', 'timeline should generate stable added video track ids');
  assert.equal(workspaceTimelineTrackLabel('video-2'), 'V2', 'timeline should label added video tracks as editing lanes');
  assert.equal(isWorkspaceTimelineAudioTrack('audio'), true, 'base audio track should be treated as audio');
  assert.equal(isWorkspaceTimelineAudioTrack('audio-3'), true, 'added audio tracks should be treated as audio');
  assert.equal(
    isWorkspaceTimelineAudioTrack('audio-0' as WorkspaceTimelineTrack),
    false,
    'timeline should reject impossible A0 tracks at runtime'
  );
  assert.equal(workspaceTimelineAudioTrackId(4), 'audio-4', 'timeline should generate stable added audio track ids');
  assert.equal(workspaceTimelineAudioTrackIndex('audio-3'), 3, 'timeline should parse added audio track indexes');
  assert.equal(workspaceTimelineTrackLabel('audio'), 'Audio 1', 'timeline should label the base audio lane generically');
  assert.equal(workspaceTimelineTrackLabel('audio-3'), 'Audio 3', 'timeline should label added audio tracks generically');
});

test('MaxVideoAI editor timeline defaults to one video track and two audio tracks', async () => {
  const {
    MIN_TIMELINE_AUDIO_TRACKS,
    audioTrackCountForTimelineItems,
    createWorkspaceSequenceRecord,
    videoTrackCountForTimelineItems,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_state/workspace-state');
  const { DEFAULT_WORKSPACE_PROJECT_SETTINGS } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-project-settings'
  );

  assert.equal(MIN_TIMELINE_AUDIO_TRACKS, 2, 'timeline should expose two audio tracks by default');
  assert.equal(videoTrackCountForTimelineItems([]), 1, 'empty timelines should start with one video track');
  assert.equal(audioTrackCountForTimelineItems([]), 2, 'empty timelines should start with two audio tracks');

  const emptySequence = createWorkspaceSequenceRecord({
    id: 'sequence-default-tracks',
    name: 'Default tracks',
    timelineItems: [],
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });

  assert.equal(emptySequence.videoTrackCount, 1, 'new empty sequences should persist one video track');
  assert.equal(emptySequence.audioTrackCount, 2, 'new empty sequences should persist two audio tracks');
});

test('MaxVideoAI editor timeline editing supports drag ordering and cut splits', async () => {
  const {
    buildWorkspaceTimelineItemsForAsset,
    buildWorkspaceTimelineItemsForOutput,
    deleteWorkspaceTimelineItem,
    deleteWorkspaceTimelineGap,
    insertWorkspaceTimelineItems,
    linkWorkspaceTimelineSelection,
    moveWorkspaceTimelineItem,
    moveWorkspaceTimelineSelectionWithMode,
    normalizeWorkspaceTimelineIdentities,
    positionWorkspaceTimelineItem,
    positionWorkspaceTimelineItems,
    reorderWorkspaceTimelineItem,
    resizeWorkspaceTimelineItem,
    splitWorkspaceTimelineItem,
    toggleWorkspaceTimelineCrossfade,
    trimWorkspaceTimelineItem,
    unlinkWorkspaceTimelineSelection,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing');
  const { resolveWorkspaceTimelineGapSelection } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-gap-editing');



  const { timelineTrackHasOverlap } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-collisions');
  const assertNoTimelineOverlap = (candidateItems: WorkspaceTimelineItem[], message: string) => {
    assert.equal(timelineTrackHasOverlap(candidateItems), false, message);
  };
  const items: WorkspaceTimelineItem[] = [
    {
      id: 'clip-a',
      outputNodeId: 'output-a',
      track: 'video',
      title: 'Clip A',
      durationSec: 8,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 8,
      linkedGroupId: 'group-a',
      mediaKind: 'video',
      hasEmbeddedAudio: true,
      mediaUrl: '/hero/veo3.mp4',
    },
    {
      id: 'clip-a-audio',
      outputNodeId: 'output-a',
      track: 'audio',
      title: 'Clip A Audio',
      durationSec: 8,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 8,
      linkedGroupId: 'group-a',
      mediaKind: 'audio',
      mediaUrl: '/hero/veo3.mp4',
    },
    {
      id: 'clip-b',
      outputNodeId: 'output-b',
      track: 'video',
      title: 'Clip B',
      durationSec: 6,
      startSec: 8,
      mediaUrl: '/hero/pika-22.mp4',
    },
    {
      id: 'music-a',
      outputNodeId: 'audio-a',
      track: 'audio-2',
      title: 'Music',
      durationSec: 12,
      startSec: 0,
    },
  ];

  const moved = moveWorkspaceTimelineItem(items, 'clip-b', -1);
  assert.deepEqual(
    moved.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [
      ['clip-b', 0],
      ['clip-a', 6],
    ],
    'moving a clip left should reorder only its track and recalculate video starts'
  );
  assert.deepEqual(
    moved.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 6, 8]],
    'linked audio should stay synchronized when its video group moves'
  );
  assert.deepEqual(
    moved.filter((item) => item.track === 'audio-2').map((item) => [item.id, item.startSec]),
    [['music-a', 0]],
    'moving video clips should not disturb music track timing'
  );

  const timelineGapItems: WorkspaceTimelineItem[] = [
    { id: 'gap-video-a', outputNodeId: 'gap-video-a', track: 'video', title: 'Video A', durationSec: 4, startSec: 0, mediaKind: 'video' },
    { id: 'gap-audio-a', outputNodeId: 'gap-audio-a', track: 'audio', title: 'Audio A', durationSec: 4, startSec: 0, mediaKind: 'audio' },
    { id: 'gap-audio-b', outputNodeId: 'gap-audio-b', track: 'audio', title: 'Audio B', durationSec: 8, startSec: 10, mediaKind: 'audio' },
    { id: 'gap-video-b', outputNodeId: 'gap-video-b', track: 'video', title: 'Video B', durationSec: 4, startSec: 12, mediaKind: 'video' },
  ];
  assert.deepEqual(
    resolveWorkspaceTimelineGapSelection(timelineGapItems, 8),
    { startSec: 4, endSec: 10 },
    'clicking empty timeline space should select the common gap across every track'
  );
  assert.deepEqual(
    resolveWorkspaceTimelineGapSelection(timelineGapItems, 8, 'audio-2'),
    { startSec: 4, endSec: 10, track: 'audio-2' },
    'timeline gap selection should remember the clicked track for single-lane visual feedback'
  );
  assert.equal(
    resolveWorkspaceTimelineGapSelection(timelineGapItems, 11),
    null,
    'timeline gap selection should be refused when another track has content at that time'
  );
  const deletedGapItems = deleteWorkspaceTimelineGap(timelineGapItems, { startSec: 4, endSec: 10 });
  assert.deepEqual(
    deletedGapItems.map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['gap-video-a', 'video', 0, 4],
      ['gap-audio-a', 'audio', 0, 4],
      ['gap-audio-b', 'audio', 4, 8],
      ['gap-video-b', 'video', 6, 4],
    ],
    'deleting a selected common gap should ripple every later track item left by the gap duration'
  );
  assert.equal(
    deleteWorkspaceTimelineGap(timelineGapItems, { startSec: 9, endSec: 12 }),
    timelineGapItems,
    'gap deletion should no-op when any track contains media inside the requested range'
  );

  const dragged = reorderWorkspaceTimelineItem(items, 'clip-a', 'clip-b');
  assert.deepEqual(
    dragged.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [
      ['clip-b', 0],
      ['clip-a', 6],
    ],
    'dragging clip A onto clip B should place it after the drop target and normalize starts'
  );

  const split = splitWorkspaceTimelineItem(items, 'clip-a', 3);
  assert.deepEqual(
    split.filter((item) => item.track === 'video').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 3, 0, 0],
      ['clip-a-split', 5, 3, 3],
      ['clip-b', 6, 8, 0],
    ],
    'cut should split a clip at the requested offset, keep subsequent clips aligned, and preserve source in-points'
  );
  assert.deepEqual(
    split.filter((item) => item.track === 'audio').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec, item.linkedGroupId]),
    [
      ['clip-a-audio', 3, 0, 0, 'group-a'],
      ['clip-a-audio-split', 5, 3, 3, 'group-a-split'],
    ],
    'cut should split linked audio with the same timing and a new right-side group'
  );

  const splitAgain = splitWorkspaceTimelineItem(split, 'clip-a', 1.5);
  assert.equal(
    new Set(splitAgain.map((item) => item.id)).size,
    splitAgain.length,
    'repeated cuts should keep every timeline item id unique'
  );
  assert.deepEqual(
    splitAgain.filter((item) => item.track === 'video').map((item) => [item.id, item.linkedGroupId ?? null, item.durationSec, item.startSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 'group-a', 1.5, 0, 0],
      ['clip-a-split-2', 'group-a-split-2', 1.5, 1.5, 1.5],
      ['clip-a-split', 'group-a-split', 5, 3, 3],
      ['clip-b', null, 6, 8, 0],
    ],
    'cutting an already split left segment should create a new right-side identity instead of colliding with the older split'
  );
  assert.deepEqual(
    Array.from(splitAgain.reduce((groups, item) => {
      if (!item.linkedGroupId) return groups;
      const tracks = groups.get(item.linkedGroupId) ?? [];
      tracks.push(item.track);
      groups.set(item.linkedGroupId, tracks);
      return groups;
    }, new Map<string, WorkspaceTimelineTrack[]>()).entries())
      .map(([groupId, tracks]) => [groupId, tracks.sort()])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    [
      ['group-a', ['audio', 'video']],
      ['group-a-split', ['audio', 'video']],
      ['group-a-split-2', ['audio', 'video']],
    ],
    'each split segment should keep exactly one video and one linked audio item in its own linked group'
  );

  const repairedDuplicateSplit = normalizeWorkspaceTimelineIdentities([
    { ...items[0], id: 'duplicate-video', linkedGroupId: 'duplicate-group', startSec: 0, durationSec: 2 },
    { ...items[0], id: 'duplicate-video', linkedGroupId: 'duplicate-group', startSec: 2, durationSec: 2, sourceStartSec: 2 },
    { ...items[1], id: 'duplicate-audio', linkedGroupId: 'duplicate-group', startSec: 0, durationSec: 2 },
    { ...items[1], id: 'duplicate-audio', linkedGroupId: 'duplicate-group', startSec: 2, durationSec: 2, sourceStartSec: 2 },
  ]);
  assert.deepEqual(
    repairedDuplicateSplit.map((item) => [item.id, item.linkedGroupId, item.startSec, item.durationSec]),
    [
      ['duplicate-video', 'duplicate-group', 0, 2],
      ['duplicate-video-2', 'duplicate-group-2', 2, 2],
      ['duplicate-audio', 'duplicate-group', 0, 2],
      ['duplicate-audio-2', 'duplicate-group-2', 2, 2],
    ],
    'persisted timelines with stale duplicate split ids should be repaired into distinct linked clip pairs'
  );

  const movedRepairedSplit = positionWorkspaceTimelineItem(repairedDuplicateSplit, 'duplicate-video-2', 4);
  assert.deepEqual(
    movedRepairedSplit.filter((item) => item.linkedGroupId === 'duplicate-group-2').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['duplicate-video-2', 4, 2],
      ['duplicate-audio-2', 4, 2],
    ],
    'dragging one repaired split segment should move only its video/audio pair'
  );
  assert.deepEqual(
    movedRepairedSplit.filter((item) => item.linkedGroupId === 'duplicate-group').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['duplicate-video', 0, 2],
      ['duplicate-audio', 0, 2],
    ],
    'dragging a repaired segment should not move the older segment from the same original clip'
  );

  const repairedOrphanAudioGroup = normalizeWorkspaceTimelineIdentities([
    { ...items[1], id: 'orphan-audio', linkedGroupId: 'orphan-group' },
  ]);
  assert.deepEqual(
    repairedOrphanAudioGroup.map((item) => [item.id, item.linkedGroupId ?? null, item.linkedGroupKind ?? null]),
    [['orphan-audio', null, null]],
    'persisted orphan audio links should be cleared when no corresponding video clip remains'
  );

  const trimmedEnd = trimWorkspaceTimelineItem(items, 'clip-a', 'end', 2);
  assert.deepEqual(
    trimmedEnd.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec]),
    [
      ['clip-a', 6, 0, 0],
      ['clip-a-audio', 6, 0, 0],
    ],
    'end trim should shorten linked video and audio together'
  );
  assert.equal(
    trimmedEnd.find((item) => item.id === 'clip-b')?.startSec,
    6,
    'end trim should ripple the next video clip left'
  );

  const trimmedStart = trimWorkspaceTimelineItem(items, 'clip-a', 'start', 2);
  assert.deepEqual(
    trimmedStart.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.durationSec, item.startSec, item.sourceStartSec]),
    [
      ['clip-a', 6, 0, 2],
      ['clip-a-audio', 6, 0, 2],
    ],
    'start trim should advance linked source in-points while keeping the group on the sequence line'
  );

  const positioned = positionWorkspaceTimelineItem(items, 'clip-a', 16);
  assert.deepEqual(
    positioned.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 16, 8],
      ['clip-a-audio', 16, 8],
    ],
    'pointer move should reposition linked video and audio together in an unoccupied range'
  );

  const multiPositioned = positionWorkspaceTimelineItems(items, ['clip-a', 'clip-b'], 'clip-a', 2);
  assert.deepEqual(
    multiPositioned.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 2, 8],
      ['clip-b', 10, 6],
    ],
    'multi-select drag should move selected visual clips together while preserving their relative timing'
  );
  assert.deepEqual(
    multiPositioned.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 2, 8]],
    'multi-select drag should keep linked audio synchronized with selected video groups'
  );
  assert.deepEqual(
    positionWorkspaceTimelineItems(items, ['clip-a', 'clip-b'], 'clip-a', -6)
      .filter((item) => item.track === 'video')
      .map((item) => [item.id, item.startSec]),
    [
      ['clip-a', 0],
      ['clip-b', 8],
    ],
    'multi-select drag should clamp the whole selection at the start of the sequence'
  );

  const pointerReordered = positionWorkspaceTimelineItem(items, 'clip-b', 0);
  assert.deepEqual(
    pointerReordered.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [
      ['clip-b', 0],
      ['clip-a', 6],
    ],
    'dragging a clip past a neighboring midpoint should reorder the video track instead of leaving the clip blocked'
  );
  assert.deepEqual(
    pointerReordered.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 6, 8]],
    'pointer reorder should keep linked audio aligned with its moved video group'
  );

  const movedToOverlayTrack = positionWorkspaceTimelineItem(items, 'clip-a', 1, 'video-2');
  assert.deepEqual(
    movedToOverlayTrack.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video-2', 1, 8],
      ['clip-a-audio', 'audio', 1, 8],
    ],
    'vertical drag should move the video clip to a target video track while keeping linked audio synchronized'
  );

  const timelineItemsWithOpenAudio2 = items.filter((item) => item.id !== 'music-a');
  const movedLinkedAudioToSecondTrack = positionWorkspaceTimelineItem(timelineItemsWithOpenAudio2, 'clip-a-audio', 0, 'audio-2');
  assert.deepEqual(
    movedLinkedAudioToSecondTrack.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video', 0, 8],
      ['clip-a-audio', 'audio-2', 0, 8],
    ],
    'vertical drag should move linked audio to a target audio track while keeping its linked video synchronized'
  );
  const movedLinkedAudioWithInsertMode = moveWorkspaceTimelineSelectionWithMode({
    items: timelineItemsWithOpenAudio2,
    itemIds: ['clip-a-audio'],
    anchorItemId: 'clip-a-audio',
    nextStartSec: 0,
    nextTrack: 'audio-2',
    mode: 'insert',
    idSeed: 'linked-audio-track-drag',
  });
  assert.deepEqual(
    movedLinkedAudioWithInsertMode.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video', 0, 8],
      ['clip-a-audio', 'audio-2', 0, 8],
    ],
    'pointer drag should let a linked audio clip retarget to another audio track without unlinking it'
  );
  const splitTrackLinkedItems: WorkspaceTimelineItem[] = [
    { ...items[0], track: 'video', startSec: 0 },
    { ...items[1], track: 'audio-2', startSec: 0 },
    { id: 'music-b', outputNodeId: 'audio-b', track: 'audio-2', title: 'Music B', durationSec: 4, startSec: 10, mediaKind: 'audio' },
  ];
  const blockedLinkedVideoMove = moveWorkspaceTimelineSelectionWithMode({
    items: splitTrackLinkedItems,
    itemIds: ['clip-a'],
    anchorItemId: 'clip-a',
    nextStartSec: 8,
    mode: 'insert',
    idSeed: 'linked-peer-collision',
  });
  assertNoTimelineOverlap(blockedLinkedVideoMove, 'linked timeline drags should not overlap clips on the linked audio peer track');
  assert.deepEqual(
    blockedLinkedVideoMove.map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video', 0, 8],
      ['clip-a-audio', 'audio-2', 0, 8],
      ['music-b', 'audio-2', 10, 4],
    ],
    'moving a linked video should stay blocked when its linked audio would collide on the current audio track'
  );
  const linkedAudioDragWithBlockedVideoPeerItems: WorkspaceTimelineItem[] = [
    { ...items[0], track: 'video', startSec: 0 },
    { ...items[1], track: 'audio-2', startSec: 0 },
    { id: 'clip-b-peer-blocker', outputNodeId: 'output-b', track: 'video', title: 'Clip B', durationSec: 4, startSec: 8, mediaKind: 'video' },
  ];
  const blockedLinkedAudioMove = moveWorkspaceTimelineSelectionWithMode({
    items: linkedAudioDragWithBlockedVideoPeerItems,
    itemIds: ['clip-a-audio'],
    anchorItemId: 'clip-a-audio',
    nextStartSec: 2,
    nextTrack: 'audio-2',
    mode: 'insert',
    idSeed: 'linked-video-peer-collision',
  });
  assertNoTimelineOverlap(blockedLinkedAudioMove, 'linked audio drags should not overlap clips on the linked video peer track');
  assert.deepEqual(
    blockedLinkedAudioMove.map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video', 0, 8],
      ['clip-a-audio', 'audio-2', 0, 8],
      ['clip-b-peer-blocker', 'video', 8, 4],
    ],
    'moving linked audio should stay blocked when its linked video would collide on the current video track'
  );

  const resizedEnd = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 5,
  });
  assert.deepEqual(
    resizedEnd.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 0, 5, 0],
      ['clip-a-audio', 0, 5, 0],
    ],
    'pointer end-resize should shorten linked video and audio together'
  );

  const resizedStart = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'start',
    nextStartSec: 2,
    nextDurationSec: 6,
  });
  assert.deepEqual(
    resizedStart.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 2, 6, 2],
      ['clip-a-audio', 2, 6, 2],
    ],
    'pointer start-resize should advance linked in-points and keep the group synchronized'
  );

  const blockedEndExpansion = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 20,
  });
  assert.deepEqual(
    blockedEndExpansion.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 0, 8, 0],
      ['clip-a-audio', 0, 8, 0],
    ],
    'end-resize should not extend a clip beyond its original source duration'
  );

  const restoredStartExpansion = resizeWorkspaceTimelineItem({
    items: resizedStart,
    itemId: 'clip-a',
    edge: 'start',
    nextStartSec: -10,
    nextDurationSec: 20,
  });
  assert.deepEqual(
    restoredStartExpansion.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 0, 8, 0],
      ['clip-a-audio', 0, 8, 0],
    ],
    'start-resize should restore earlier source frames but stop at the original media in-point'
  );

  const missingSourceDurationExpansion = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-b',
    edge: 'end',
    nextStartSec: 8,
    nextDurationSec: 20,
  });
  assert.equal(
    missingSourceDurationExpansion.find((item) => item.id === 'clip-b')?.durationSec,
    6,
    'clips without explicit source duration should treat their current duration as the source cap'
  );

  const linkedStartExpansionWithAudioBlockerItems: WorkspaceTimelineItem[] = [
    {
      ...items[0],
      startSec: 10,
      durationSec: 6,
      sourceStartSec: 4,
      sourceDurationSec: 16,
    },
    {
      ...items[1],
      startSec: 10,
      durationSec: 6,
      sourceStartSec: 4,
      sourceDurationSec: 16,
    },
    {
      id: 'previous-audio',
      outputNodeId: 'previous-audio',
      track: 'audio',
      title: 'Previous Audio',
      durationSec: 5,
      startSec: 4,
      mediaKind: 'audio',
    },
  ];
  const blockedLinkedStartExpansion = resizeWorkspaceTimelineItem({
    items: linkedStartExpansionWithAudioBlockerItems,
    itemId: 'clip-a',
    edge: 'start',
    nextStartSec: 6,
    nextDurationSec: 10,
  });
  assertNoTimelineOverlap(blockedLinkedStartExpansion, 'linked start trim should not overlap existing audio on the linked audio track');
  assert.deepEqual(
    blockedLinkedStartExpansion.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec]),
    [
      ['clip-a', 9, 7, 3],
      ['clip-a-audio', 9, 7, 3],
    ],
    'start-resize should clamp a linked video expansion to the nearest blocker on its linked audio track'
  );



  const rippleResizedEnd = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 5,
    mode: 'ripple',
  });
  assert.deepEqual(
    rippleResizedEnd.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 5],
      ['clip-b', 5, 6],
    ],
    'ripple end trim should pull later video clips left when the selected clip is shortened'
  );

  const rippleResizedAttachedChain = resizeWorkspaceTimelineItem({
    items: [
      ...items,
      {
        id: 'clip-c',
        outputNodeId: 'output-c',
        track: 'video',
        title: 'Clip C',
        durationSec: 3,
        startSec: 14,
        mediaUrl: '/hero/veo3-c.mp4',
      },
      {
        id: 'clip-d',
        outputNodeId: 'output-d',
        track: 'video',
        title: 'Clip D',
        durationSec: 3,
        startSec: 20,
        mediaUrl: '/hero/veo3-d.mp4',
      },
    ],
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 5,
    mode: 'ripple',
  });
  assert.deepEqual(
    rippleResizedAttachedChain.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 5],
      ['clip-b', 5, 6],
      ['clip-c', 11, 3],
      ['clip-d', 20, 3],
    ],
    'ripple end trim should move only the contiguous clip chain and preserve intentional gaps'
  );

  const rippleResizedStart = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-b',
    edge: 'start',
    nextStartSec: 10,
    nextDurationSec: 4,
    mode: 'ripple',
  });
  assert.deepEqual(
    rippleResizedStart.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 8, 0],
      ['clip-b', 8, 4, 2],
    ],
    'ripple start trim should advance the source in-point while keeping the clip on the sequence line'
  );

  const rollItems: WorkspaceTimelineItem[] = items.map((item) => {
    if (item.id === 'clip-a' || item.id === 'clip-a-audio') return { ...item, sourceDurationSec: 12 };
    if (item.id === 'clip-b') return { ...item, sourceStartSec: 2, sourceDurationSec: 10 };
    return item;
  });
  const rollResizedEnd = resizeWorkspaceTimelineItem({
    items: rollItems,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 10,
    mode: 'roll',
  });
  assert.deepEqual(
    rollResizedEnd.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 10],
      ['clip-b', 10, 4],
    ],
    'roll end trim should move the cut into the next clip without changing total sequence length'
  );

  const sourceBoundRollEnd = resizeWorkspaceTimelineItem({
    items: rollItems,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 20,
    mode: 'roll',
  });
  assert.deepEqual(
    sourceBoundRollEnd.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 12, 0],
      ['clip-b', 12, 2, 6],
    ],
    'roll trim should stop expanding the outgoing clip when its source media is exhausted'
  );

  const crossfaded = toggleWorkspaceTimelineCrossfade(items, 'clip-a', 1);
  assert.deepEqual(
    crossfaded.filter((item) => item.track === 'video').map((item) => [item.id, item.transitionOut?.type ?? null, item.transitionOut?.durationSec ?? null]),
    [
      ['clip-a', 'crossfade', 1],
      ['clip-b', null, null],
    ],
    'crossfade toggle should mark the outgoing selected clip when an adjacent next clip exists'
  );
  const crossfadeRemoved = toggleWorkspaceTimelineCrossfade(crossfaded, 'clip-a', 1);
  assert.equal(
    crossfadeRemoved.find((item) => item.id === 'clip-a')?.transitionOut,
    null,
    'crossfade toggle should remove an existing matching transition'
  );

  const linkedOutputItems = buildWorkspaceTimelineItemsForOutput({
    outputNodeId: 'output-c',
    title: 'Generated Clip',
    output: {
      kind: 'video',
      modelId: 'veo-3-1',
      modelLabel: 'Veo 3.1',
      workflowType: 'image_to_video',
      durationSec: 5,
      status: 'ready',
      createdAt: '2026-06-05T10:00:00.000Z',
      sourceShotId: 'shot-c',
      url: '/hero/veo3.mp4',
      audioUrl: '/hero/veo3-audio.m4a',
      thumbUrl: '/hero/showcase-veo-3-1.webp',
      hasAudio: true,
      audioProvenance: 'external',
    },
    startSec: 14,
    idSeed: 'test',
  });
  assert.deepEqual(
    linkedOutputItems.map((item) => [item.track, item.durationSec, item.startSec, item.linkedGroupId, item.mediaKind, item.mediaUrl]),
    [
      ['video', 5, 14, 'timeline-output-c-test', 'video', '/hero/veo3.mp4'],
      ['audio', 5, 14, 'timeline-output-c-test', 'audio', '/hero/veo3-audio.m4a'],
    ],
    'video outputs with sound should create synchronized video and audio timeline clips'
  );

  const importedVideoAsset = {
    id: 'imported-video',
    kind: 'video' as const,
    filename: 'phone-shot.mp4',
    subtitle: 'Video · upload',
    url: '/uploads/phone-shot.mp4',
    audioUrl: '/uploads/phone-shot-audio.m4a',
    thumbUrl: '/uploads/phone-shot.jpg',
    hasAudio: true,
    audioProvenance: 'external' as const,
    durationSec: 9,
  };
  const importedVideoItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-video-a',
    title: 'Imported Clip',
    asset: importedVideoAsset,
    startSec: 4,
    idSeed: 'asset-test',
  });
  assert.deepEqual(
    importedVideoItems.map((item) => [item.track, item.durationSec, item.startSec, item.linkedGroupId, item.mediaKind, item.mediaUrl]),
    [
      ['video', 9, 4, 'timeline-asset-video-a-asset-test', 'video', '/uploads/phone-shot.mp4'],
      ['audio', 9, 4, 'timeline-asset-video-a-asset-test', 'audio', '/uploads/phone-shot-audio.m4a'],
    ],
    'imported video assets should enter the timeline as synchronized video and linked audio clips'
  );





  const unlinkedImportedVideoItems = unlinkWorkspaceTimelineSelection(importedVideoItems, ['timeline-asset-video-a-asset-test']);
  assert.deepEqual(
    unlinkedImportedVideoItems.map((item) => [item.id, item.linkedGroupId ?? null, item.linkedGroupKind ?? null]),
    [
      ['timeline-asset-video-a-asset-test', null, null],
      ['timeline-asset-video-a-asset-test-audio', null, null],
    ],
    'unlinking a selected video clip should detach its generated audio peer from the same linked group'
  );
  const unlinkedAudioMove = moveWorkspaceTimelineSelectionWithMode({
    items: unlinkedImportedVideoItems,
    itemIds: ['timeline-asset-video-a-asset-test-audio'],
    anchorItemId: 'timeline-asset-video-a-asset-test-audio',
    nextStartSec: 12,
    mode: 'insert',
    idSeed: 'unlinked-audio-drag',
  });
  assert.deepEqual(
    unlinkedAudioMove.map((item) => [item.id, item.track, item.startSec]),
    [
      ['timeline-asset-video-a-asset-test', 'video', 4],
      ['timeline-asset-video-a-asset-test-audio', 'audio', 12],
    ],
    'after unlink, dragging the audio peer should no longer move the video clip'
  );
  const unlinkedAudioTrackMove = moveWorkspaceTimelineSelectionWithMode({
    items: unlinkedImportedVideoItems,
    itemIds: ['timeline-asset-video-a-asset-test-audio'],
    anchorItemId: 'timeline-asset-video-a-asset-test-audio',
    nextStartSec: 12,
    nextTrack: 'audio-2',
    mode: 'insert',
    idSeed: 'unlinked-audio-track-drag',
  });
  assert.deepEqual(
    unlinkedAudioTrackMove.map((item) => [item.id, item.track, item.startSec]),
    [
      ['timeline-asset-video-a-asset-test', 'video', 4],
      ['timeline-asset-video-a-asset-test-audio', 'audio-2', 12],
    ],
    'after unlink, dragging the audio peer vertically should move it from Audio 1 to Audio 2'
  );

  const relinkedImportedVideoItems = linkWorkspaceTimelineSelection(unlinkedImportedVideoItems, [
    'timeline-asset-video-a-asset-test',
    'timeline-asset-video-a-asset-test-audio',
  ], 'manual-link');
  assert.deepEqual(
    relinkedImportedVideoItems.map((item) => [item.id, item.linkedGroupId ?? null, item.linkedGroupKind ?? null]),
    [
      ['timeline-asset-video-a-asset-test', 'manual-link', 'manual'],
      ['timeline-asset-video-a-asset-test-audio', 'manual-link', 'manual'],
    ],
    'linking selected clips should create one manual linked group for the selection'
  );

  const importedAudioItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-audio-a',
    title: 'Imported Music',
    asset: {
      id: 'imported-audio',
      kind: 'audio',
      filename: 'track.wav',
      subtitle: 'Audio · upload',
      url: '/uploads/track.wav',
      durationSec: 22,
    },
    startSec: 6,
    idSeed: 'audio-test',
  });
  assert.deepEqual(
    importedAudioItems.map((item) => [item.track, item.durationSec, item.startSec, item.linkedGroupId ?? null, item.mediaKind, item.mediaUrl]),
    [
      ['audio', 22, 6, null, 'audio', '/uploads/track.wav'],
    ],
    'imported audio assets should enter the timeline on an audio editing track'
  );

  const importedImageItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-image-a',
    title: 'Imported Still',
    asset: {
      id: 'imported-image',
      kind: 'image',
      filename: 'reference.png',
      subtitle: 'Image · upload',
      url: '/uploads/reference.png',
    },
    startSec: 10,
    idSeed: 'image-test',
  });
  assert.deepEqual(
    importedImageItems.map((item) => [item.track, item.durationSec, item.startSec, item.mediaKind, item.mediaUrl]),
    [
      ['video', 5, 10, 'image', '/uploads/reference.png'],
    ],
    'imported images should enter the timeline as still visual clips'
  );

  const insertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 6,
    selectedItemId: null,
    idSeed: 'insert',
  });
  assertNoTimelineOverlap(insertEdit, 'insert edit should not leave overlapping clips on any same-type timeline track');
  assert.deepEqual(
    insertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 8, 0],
      ['timeline-output-c-test', 8, 5, 0],
      ['clip-b', 13, 6, 0],
    ],
    'insert edit should resolve drops in the right half of a clip to the next edit point without shortening the target'
  );
  assert.deepEqual(
    insertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 8, 0, 'group-a'],
      ['timeline-output-c-test-audio', 8, 5, 0, 'timeline-output-c-test'],
    ],
    'insert edit should preserve the linked audio duration while inserting at the resolved edit point'
  );

  const leftHalfInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 2,
    selectedItemId: null,
    idSeed: 'left-half-insert',
  });
  assert.deepEqual(
    leftHalfInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['timeline-output-c-test', 0, 5, 0],
      ['clip-a', 5, 8, 0],
      ['clip-b', 13, 6, 0],
    ],
    'insert edit should resolve drops in the left half of a clip to the previous edit point and push every later clip'
  );
  assert.deepEqual(
    leftHalfInsertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['timeline-output-c-test-audio', 0, 5, 0, 'timeline-output-c-test'],
      ['clip-a-audio', 5, 8, 0, 'group-a'],
    ],
    'left-half insert should keep linked audio synchronized after the whole target clip shifts'
  );

  const boundaryInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 8,
    selectedItemId: null,
    idSeed: 'boundary-insert',
  });
  assert.deepEqual(
    boundaryInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 8, 0],
      ['timeline-output-c-test', 8, 5, 0],
      ['clip-b', 13, 6, 0],
    ],
    'insert edit should still insert at an edit point and push later clips'
  );

  const spliceInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'insert',
    playheadSec: 6,
    selectedItemId: null,
    idSeed: 'insert',
    allowInsertIntoClip: true,
  });
  assertNoTimelineOverlap(spliceInsertEdit, 'explicit splice insertion should not leave same-track overlaps after splitting');
  assert.deepEqual(
    spliceInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 6, 0],
      ['timeline-output-c-test', 6, 5, 0],
      ['clip-a-tail-insert', 11, 2, 6],
      ['clip-b', 13, 6, 0],
    ],
    'explicit splice insertion should split the clip under the playhead and push later clips'
  );
  assert.deepEqual(
    spliceInsertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 6, 0, 'group-a'],
      ['timeline-output-c-test-audio', 6, 5, 0, 'timeline-output-c-test'],
      ['clip-a-audio-tail-insert', 11, 2, 6, 'group-a-tail-insert'],
    ],
    'explicit splice insertion should split linked audio with the source video clip'
  );

  const overwriteEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'overwrite',
    playheadSec: 2,
    selectedItemId: null,
    idSeed: 'overwrite',
  });
  assertNoTimelineOverlap(overwriteEdit, 'overwrite edit should rewrite the target range without same-track overlaps');
  assert.deepEqual(
    overwriteEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 2, 0],
      ['timeline-output-c-test', 2, 5, 0],
      ['clip-a-tail-overwrite', 7, 1, 7],
      ['clip-b', 8, 6, 0],
    ],
    'overwrite edit should trim and split clips under the inserted range instead of allowing track overlap'
  );
  assert.deepEqual(
    overwriteEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 2, 0, 'group-a'],
      ['timeline-output-c-test-audio', 2, 5, 0, 'timeline-output-c-test'],
      ['clip-a-audio-tail-overwrite', 7, 1, 7, 'group-a-tail-overwrite'],
    ],
    'overwrite edit should rewrite linked audio under the same range as its source video clip'
  );

  const replaceEdit = insertWorkspaceTimelineItems({
    items,
    newItems: linkedOutputItems,
    mode: 'replace',
    playheadSec: 0,
    selectedItemId: 'clip-b',
    idSeed: 'replace',
  });
  assert.deepEqual(
    replaceEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 8],
      ['timeline-output-c-test', 8, 5],
    ],
    'replace edit should swap the selected clip slot without moving earlier clips'
  );
  assert.deepEqual(
    replaceEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 8, 'group-a'],
      ['timeline-output-c-test-audio', 8, 5, 'timeline-output-c-test'],
    ],
    'replace edit should add linked audio for the replacement without disturbing earlier linked clips'
  );

  const visualOnlyInsertEdit = insertWorkspaceTimelineItems({
    items,
    newItems: importedImageItems,
    mode: 'insert',
    playheadSec: 6,
    selectedItemId: null,
    idSeed: 'image-insert',
  });
  assert.deepEqual(
    visualOnlyInsertEdit.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId ?? null]),
    [
      ['clip-a', 0, 8, 0, 'group-a'],
      ['timeline-asset-image-a-image-test', 8, 5, 0, null],
      ['clip-b', 13, 6, 0, null],
    ],
    'visual-only insert should snap an occupied drop to the nearest edit point without splitting the source video'
  );
  assert.deepEqual(
    visualOnlyInsertEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 8, 0, 'group-a'],
    ],
    'visual-only insert should preserve the original linked audio segment by default'
  );

  const visualOnlyOverwriteEdit = insertWorkspaceTimelineItems({
    items,
    newItems: importedImageItems,
    mode: 'overwrite',
    playheadSec: 2,
    selectedItemId: null,
    idSeed: 'image-overwrite',
  });
  assert.deepEqual(
    visualOnlyOverwriteEdit.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 2, 0, 'group-a'],
      ['clip-a-audio-tail-image-overwrite', 7, 1, 7, 'group-a-tail-image-overwrite'],
    ],
    'visual-only overwrite should remove the covered linked audio section instead of leaving stale full-length audio'
  );

  const insertedDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-b'],
    anchorItemId: 'clip-b',
    nextStartSec: 2,
    mode: 'insert',
    idSeed: 'drag-insert',
  });
  assert.deepEqual(
    insertedDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-b', 0, 6, 0],
      ['clip-a', 6, 8, 0],
    ],
    'insert-mode drag should resolve an occupied left-half drop to before the whole target clip'
  );
  assert.deepEqual(
    insertedDragMove.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 6, 8, 0, 'group-a'],
    ],
    'insert-mode drag should move the target linked audio without splitting it by default'
  );

  const freeRightDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-a'],
    anchorItemId: 'clip-a',
    nextStartSec: 16,
    mode: 'insert',
    idSeed: 'drag-free-gap',
  });
  assertNoTimelineOverlap(freeRightDragMove, 'dragging into empty time should keep same-track clips non-overlapping');
  assert.deepEqual(
    freeRightDragMove
      .filter((item) => item.track === 'video')
      .map((item) => [item.id, item.startSec, item.durationSec])
      .sort((left, right) => Number(left[1]) - Number(right[1])),
    [
      ['clip-b', 8, 6],
      ['clip-a', 16, 8],
    ],
    'dragging a selected clip right into empty time should leave the original gap instead of rippling earlier clips closed'
  );
  assert.deepEqual(
    freeRightDragMove.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 16, 8]],
    'dragging a linked video right into empty time should move its linked audio with the same gap'
  );

  const ambiguousSelfOverlapDrag = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-a'],
    anchorItemId: 'clip-a',
    nextStartSec: 1,
    mode: 'insert',
    idSeed: 'ambiguous-self-drag',
  });
  assertNoTimelineOverlap(ambiguousSelfOverlapDrag, 'ambiguous self-overlap drag should revert to a no-overlap timeline');
  assert.deepEqual(
    ambiguousSelfOverlapDrag.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 8],
      ['clip-b', 8, 6],
    ],
    'insert-mode drag should revert when the drop remains inside the dragged clip instead of committing an overlap'
  );
  assert.deepEqual(
    ambiguousSelfOverlapDrag.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec]),
    [['clip-a-audio', 0, 8]],
    'ambiguous self-overlap drag should also keep linked audio at the original position'
  );

  const spliceInsertedDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-b'],
    anchorItemId: 'clip-b',
    nextStartSec: 4,
    mode: 'insert',
    idSeed: 'drag-insert',
    allowInsertIntoClip: true,
  });
  assert.deepEqual(
    spliceInsertedDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 4, 0],
      ['clip-b', 4, 6, 0],
      ['clip-a-tail-drag-insert', 10, 4, 4],
    ],
    'splice insert drag should split a long target clip when the explicit tool is enabled'
  );
  assert.deepEqual(
    spliceInsertedDragMove.filter((item) => item.track === 'audio').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0, item.linkedGroupId]),
    [
      ['clip-a-audio', 0, 4, 0, 'group-a'],
      ['clip-a-audio-tail-drag-insert', 10, 4, 4, 'group-a-tail-drag-insert'],
    ],
    'splice insert drag should split linked audio with the target video clip'
  );

  const multiDragItems: WorkspaceTimelineItem[] = [
    { id: 'long-a', outputNodeId: 'long-a', track: 'video', title: 'Long A', durationSec: 10, startSec: 0, mediaKind: 'video' },
    { id: 'move-b', outputNodeId: 'move-b', track: 'video', title: 'Move B', durationSec: 4, startSec: 10, mediaKind: 'video' },
    { id: 'move-c', outputNodeId: 'move-c', track: 'video', title: 'Move C', durationSec: 4, startSec: 14, mediaKind: 'video' },
    { id: 'tail-d', outputNodeId: 'tail-d', track: 'video', title: 'Tail D', durationSec: 4, startSec: 18, mediaKind: 'video' },
  ];
  const multiInsertedDragMove = moveWorkspaceTimelineSelectionWithMode({
    items: multiDragItems,
    itemIds: ['move-b', 'move-c'],
    anchorItemId: 'move-b',
    nextStartSec: 4,
    mode: 'insert',
    idSeed: 'multi-drag',
  });
  assertNoTimelineOverlap(multiInsertedDragMove, 'insert-mode multi-select drag should push enough space for the moved package');
  assert.deepEqual(
    multiInsertedDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['move-b', 0, 4],
      ['move-c', 4, 4],
      ['long-a', 8, 10],
      ['tail-d', 18, 4],
    ],
    'insert-mode multi-select drag should insert before the whole target clip when dropped in its left half'
  );

  const overwriteDragMove = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-b'],
    anchorItemId: 'clip-b',
    nextStartSec: 2,
    mode: 'overwrite',
    idSeed: 'drag-overwrite',
  });
  assert.deepEqual(
    overwriteDragMove.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec, item.durationSec, item.sourceStartSec ?? 0]),
    [
      ['clip-a', 0, 2, 0],
      ['clip-b', 2, 6, 0],
    ],
    'overwrite-mode drag should rewrite the target range without pushing later clips'
  );

  const movedToV2WithMode = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['clip-a'],
    anchorItemId: 'clip-a',
    nextStartSec: 1,
    nextTrack: 'video-2',
    mode: 'insert',
    idSeed: 'v2-drop',
  });
  assert.deepEqual(
    movedToV2WithMode.filter((item) => item.linkedGroupId === 'group-a').map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video-2', 1, 8],
      ['clip-a-audio', 'audio', 1, 8],
    ],
    'insert-mode vertical drop should place the visual clip on V2 and keep linked audio synchronized'
  );

  const rippleDeleted = deleteWorkspaceTimelineItem(items, 'clip-a', { ripple: true });
  assert.deepEqual(
    rippleDeleted.filter((item) => item.track === 'video').map((item) => [item.id, item.startSec]),
    [['clip-b', 0]],
    'ripple delete should remove linked clips and pull later clips left on the affected track'
  );
});

test('MaxVideoAI editor timeline render manifest captures clips, assets, transitions, and blockers', async () => {
  const {
    buildWorkspaceTimelineRenderManifest,
    serializeWorkspaceTimelineRenderManifest,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render');
  const {
    WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS,
    buildWorkspaceTimelineVideoExportRequest,
    buildWorkspaceTimelineEdl,
    serializeWorkspaceTimelineVideoExportRequest,
    workspaceTimelineExportReadinessChecks,
    workspaceTimelineRenderReadinessLabel,
  } = await import('../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-export');
  const template = createRenderFixture();
  const items = template.timelineItems.map((item) =>
    item.id === 'timeline-output-01'
      ? { ...item, transitionOut: { type: 'crossfade' as const, durationSec: 1 } }
      : item
  );

  const manifest = buildWorkspaceTimelineRenderManifest({
    items,
    nodes: template.nodes,
    projectName: 'Product Ad',
    sequenceId: 'sequence-main',
    sequenceName: 'Main sequence',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  const videoTrack = manifest.tracks.find((track) => track.id === 'video');
  const linkedAudioTrack = manifest.tracks.find((track) => track.id === 'audio');
  const musicTrack = manifest.tracks.find((track) => track.id === 'audio-2');

  assert.equal(manifest.status, 'ready', 'ready timelines should produce a renderable manifest');
  assert.equal(manifest.sequenceId, 'sequence-main', 'render manifests should carry the active Studio sequence id');
  assert.equal(manifest.sequenceName, 'Main sequence', 'render manifests should carry the active Studio sequence name');
  assert.equal(manifest.durationSec, 28, 'manifest duration should include audio beds, not only the video track');
  assert.deepEqual(
    videoTrack?.clips.map((clip) => [clip.id, clip.startSec, clip.endSec, clip.sourceStartSec, clip.sourceEndSec]),
    [
      ['timeline-output-01', 0, 5, 0, 5],
      ['timeline-output-02', 5, 11, 0, 6],
    ],
    'video clips should export ordered sequence timing and source in/out timing'
  );
  assert.deepEqual(
    videoTrack?.clips[0]?.transitionOut,
    { type: 'crossfade', durationSec: 1, nextClipId: 'timeline-output-02' },
    'crossfades should export as metadata on the outgoing clip'
  );
  const clampedManifest = buildWorkspaceTimelineRenderManifest({
    items: items.map((item) =>
      item.id === 'timeline-output-01'
        ? { ...item, transitionOut: { type: 'crossfade' as const, durationSec: 10 } }
        : item
    ),
    nodes: template.nodes,
    projectName: 'Product Ad',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  assert.deepEqual(
    clampedManifest.tracks.find((track) => track.id === 'video')?.clips[0]?.transitionOut,
    { type: 'crossfade', durationSec: 2.5, nextClipId: 'timeline-output-02' },
    'render manifest should clamp stale crossfades to the same safe bounds as the viewer preview'
  );
  assert.equal(
    linkedAudioTrack?.clips[0]?.linkedGroupId,
    'timeline-output-02',
    'embedded generated audio should stay linked to its video clip in the manifest'
  );
  assert.ok(
    musicTrack?.clips[0]?.mediaUrl,
    'asset-library audio timeline items should resolve media from their source asset node'
  );
  assert.match(
    serializeWorkspaceTimelineRenderManifest(manifest),
    /"source": "maxvideoai-editor"/,
    'serialized manifest should remain a plain JSON backend handoff'
  );
  assert.equal(
    workspaceTimelineRenderReadinessLabel(manifest),
    'Render manifest ready: 4 clips, 28s.',
    'export notice should summarize render readiness'
  );
  assert.deepEqual(
    WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS.map((preset) => preset.id),
    ['draft', 'standard', 'high'],
    'video export should expose draft, standard, and high quality presets'
  );
  assert.deepEqual(
    workspaceTimelineExportReadinessChecks(manifest).map((check) => [check.id, check.status]),
    [
      ['media', 'pass'],
      ['timeline', 'pass'],
      ['range', 'pass'],
      ['audio', 'pass'],
    ],
    'video export should expose reader-facing preflight checks before rendering'
  );
  const videoExportRequest = buildWorkspaceTimelineVideoExportRequest(manifest, {
    qualityPreset: 'high',
    createdAt: '2026-06-06T10:15:00.000Z',
  });
  assert.deepEqual(
    {
      source: videoExportRequest.source,
      status: videoExportRequest.status,
      format: videoExportRequest.exportSettings.format,
      qualityPreset: videoExportRequest.exportSettings.qualityPreset,
      includeAudio: videoExportRequest.exportSettings.includeAudio,
      serverRenderMode: videoExportRequest.exportSettings.serverRenderMode,
      hasIdempotencyKey: typeof videoExportRequest.idempotencyKey === 'string' && videoExportRequest.idempotencyKey.length > 0,
      rangeMode: videoExportRequest.manifest.exportRange.mode,
      sequenceId: videoExportRequest.manifest.sequenceId,
    },
    {
      source: 'maxvideoai-editor',
      status: 'ready',
      format: 'mp4-h264',
      qualityPreset: 'high',
      includeAudio: true,
      serverRenderMode: 'server',
      hasIdempotencyKey: true,
      rangeMode: 'sequence',
      sequenceId: 'sequence-main',
    },
    'video export request should wrap the manifest with MP4/H.264 settings and selected quality'
  );
  assert.match(
    serializeWorkspaceTimelineVideoExportRequest(videoExportRequest),
    /"qualityPreset": "high"/,
    'serialized video export request should carry quality preset for the backend renderer'
  );

  const rangeManifest = buildWorkspaceTimelineRenderManifest({
    items,
    nodes: template.nodes,
    projectName: 'Product Ad',
    createdAt: '2026-06-06T10:00:00.000Z',
    exportRange: {
      mode: 'in-out',
      startSec: 4,
      endSec: 10,
    },
  });
  assert.deepEqual(
    rangeManifest.exportRange,
    {
      mode: 'in-out',
      startSec: 4,
      endSec: 10,
      durationSec: 6,
    },
    'render manifest should describe whether the export is the full sequence or an in/out range'
  );
  assert.equal(rangeManifest.durationSec, 6, 'in/out render duration should match the selected range');
  assert.deepEqual(
    rangeManifest.tracks.find((track) => track.id === 'video')?.clips.map((clip) => [
      clip.id,
      clip.startSec,
      clip.endSec,
      clip.sourceStartSec,
      clip.sourceEndSec,
    ]),
    [
      ['timeline-output-01', 0, 1, 4, 5],
      ['timeline-output-02', 1, 6, 0, 5],
    ],
    'in/out export should trim overlapping clips and retime them from the range start'
  );
  assert.match(
    buildWorkspaceTimelineEdl(rangeManifest),
    /TITLE: Product Ad[\s\S]*FCM: NON-DROP FRAME[\s\S]*001\s+TIMELINE\s+V\s+C\s+00:00:04:00\s+00:00:05:00\s+00:00:00:00\s+00:00:01:00/,
    'EDL export should serialize the same in/out edit decisions for NLE handoff'
  );

  const overlayManifest = buildWorkspaceTimelineRenderManifest({
    items: [
      ...items,
      {
        ...items.find((item) => item.id === 'timeline-output-01')!,
        id: 'timeline-overlay-v2',
        track: 'video-2',
        title: 'Overlay V2',
        startSec: 2,
        durationSec: 3,
      },
    ],
    nodes: template.nodes,
    projectName: 'Product Ad Overlay',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  assert.ok(
    overlayManifest.tracks.some((track) => track.id === 'video-2' && track.clips.some((clip) => clip.id === 'timeline-overlay-v2')),
    'render manifest should include added video tracks instead of dropping overlay clips'
  );

  const blockedManifest = buildWorkspaceTimelineRenderManifest({
    items: [
      {
        id: 'blocked-clip',
        outputNodeId: 'missing-output',
        track: 'video',
        title: 'Missing Clip',
        durationSec: 4,
        startSec: 0,
      },
    ],
    nodes: template.nodes,
    projectName: 'Blocked',
    createdAt: '2026-06-06T10:00:00.000Z',
  });
  assert.equal(blockedManifest.status, 'blocked', 'missing media should block final render');
  assert.deepEqual(
    blockedManifest.issues.map((issue) => [issue.code, issue.severity, issue.itemId]),
    [['missing_media', 'blocking', 'blocked-clip']],
    'blocked manifests should explain which clip cannot render'
  );
});

test('MaxVideoAI editor library assets map to media node records', async () => {
  const {
    WORKSPACE_LIBRARY_ASSETS,
    WORKSPACE_LIBRARY_SOURCE_OPTIONS,
    buildWorkspaceUserLibraryUrl,
    normalizeWorkspaceUserLibraryPage,
    normalizeWorkspaceUserLibraryPayload,
    workspaceLibrarySourceOptionsForKind,
    workspaceAssetRecordFromLibraryAsset,
    workspaceLibraryAssetFromUploadedAsset,
    workspaceLibraryAssetsForNodeKind,
    workspaceLibraryKindForNodeKind,
    workspaceUploadAcceptForNodeKind,
    workspaceUploadEndpointForNodeKind,
  } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-library-assets'
  );

  assert.ok(WORKSPACE_LIBRARY_ASSETS.some((asset) => asset.kind === 'image'), 'library should expose reusable image assets');
  assert.ok(WORKSPACE_LIBRARY_ASSETS.some((asset) => asset.kind === 'video'), 'library should expose reusable video assets');
  assert.ok(WORKSPACE_LIBRARY_ASSETS.some((asset) => asset.kind === 'audio'), 'library should expose reusable audio assets');
  const videoAsset = WORKSPACE_LIBRARY_ASSETS.find((asset) => asset.kind === 'video');
  const audioAsset = WORKSPACE_LIBRARY_ASSETS.find((asset) => asset.kind === 'audio');
  assert.match(String(videoAsset?.url ?? ''), /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i, 'studio library video assets should map to playable video URLs');
  assert.match(String(audioAsset?.url ?? ''), /^(?:data:audio\/|blob:|.*\.(?:mp3|wav|ogg|m4a|aac)(?:[?#].*)?$)/i, 'studio library audio assets should map to playable audio URLs');
  assert.deepEqual(
    WORKSPACE_LIBRARY_SOURCE_OPTIONS.slice(0, 3),
    ['all', 'recent', 'upload'],
    'studio library should start from the same source filter structure as the app library'
  );
  assert.deepEqual(
    workspaceLibrarySourceOptionsForKind('video').slice(0, 3),
    ['all', 'recent', 'upload'],
    'video blocks should offer recent app outputs before narrower saved-asset filters'
  );

  const imageAssets = workspaceLibraryAssetsForNodeKind('asset-image');
  assert.ok(imageAssets.length > 0, 'image blocks should receive image library candidates');
  assert.equal(imageAssets.every((asset) => asset.kind === 'image'), true, 'image block library should only include images');

  const mapped = workspaceAssetRecordFromLibraryAsset(imageAssets[0]);
  assert.equal(mapped.kind, 'image');
  assert.equal(mapped.filename, imageAssets[0].name);
  assert.equal(mapped.subtitle, 'Image');
  assert.equal(mapped.thumbUrl, imageAssets[0].thumbUrl);

  assert.equal(workspaceLibraryKindForNodeKind('asset-image'), 'image');
  assert.equal(workspaceLibraryKindForNodeKind('asset-video'), 'video');
  assert.equal(workspaceLibraryKindForNodeKind('asset-audio'), 'audio');
  assert.equal(workspaceUploadEndpointForNodeKind('asset-image'), '/api/uploads/image');
  assert.equal(workspaceUploadEndpointForNodeKind('asset-video'), '/api/uploads/video');
  assert.equal(workspaceUploadEndpointForNodeKind('asset-audio'), '/api/uploads/audio');
  assert.equal(workspaceUploadEndpointForNodeKind('text-prompt'), null);
  assert.equal(workspaceUploadAcceptForNodeKind('asset-image'), 'image/*');
  assert.equal(workspaceUploadAcceptForNodeKind('asset-video'), 'video/*');
  assert.equal(workspaceUploadAcceptForNodeKind('asset-audio'), 'audio/*');
  assert.equal(workspaceUploadAcceptForNodeKind('text-prompt'), undefined);
  assert.equal(buildWorkspaceUserLibraryUrl('video'), '/api/media-library/assets?limit=60&kind=video');
  assert.equal(
    buildWorkspaceUserLibraryUrl('video', 'recent'),
    '/api/media-library/recent-outputs?limit=60&kind=video'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('image', 'generated'),
    '/api/media-library/assets?limit=60&kind=image&source=generated'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('image', 'generated', { cursor: 'cursor_2' }),
    '/api/media-library/assets?limit=60&kind=image&cursor=cursor_2&source=generated'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('video', 'all', { q: 'source' }),
    '/api/media-library/assets?limit=60&kind=video&q=source'
  );
  assert.equal(
    buildWorkspaceUserLibraryUrl('video', 'generated', { q: 'source' }),
    '/api/media-library/assets?limit=60&kind=video&q=source&source=generated'
  );
  assert.equal(buildWorkspaceUserLibraryUrl(null, 'all', { limit: 48 }), '/api/media-library/assets?limit=48');
  assert.equal(buildWorkspaceUserLibraryUrl(null), '/api/media-library/assets?limit=60');

  const normalizedPage = normalizeWorkspaceUserLibraryPage(
    {
      ok: true,
      nextCursor: 'cursor_2',
      hasMore: true,
      assets: [
        {
          id: 'page-image-1',
          url: 'https://cdn.example.com/page-image.png',
          kind: 'image',
          mime: 'image/png',
        },
      ],
    },
    null
  );
  assert.deepEqual(
    {
      ids: normalizedPage.assets.map((asset) => asset.id),
      nextCursor: normalizedPage.nextCursor,
      hasMore: normalizedPage.hasMore,
    },
    { ids: ['page-image-1'], nextCursor: 'cursor_2', hasMore: true },
    'studio library should preserve app media-library pagination metadata'
  );

  const normalized = normalizeWorkspaceUserLibraryPayload(
    {
      ok: true,
      assets: [
        {
          id: 'user-image-1',
          url: 'https://cdn.example.com/image-one.png',
          thumbUrl: 'https://cdn.example.com/image-one-thumb.png',
          kind: 'image',
          mime: 'image/png',
          width: 1200,
          height: 800,
          source: 'upload',
        },
        {
          id: 'user-video-1',
          url: 'https://cdn.example.com/video-one.mp4',
          thumbUrl: 'https://cdn.example.com/video-one.jpg',
          kind: 'image',
          source: 'generated',
        },
      ],
    },
    'image'
  );
  assert.deepEqual(
    normalized.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, meta: asset.meta })),
    [{ id: 'user-image-1', name: 'image-one.png', kind: 'image', meta: 'Image · 1200x800' }],
    'studio library should normalize and filter signed-in user assets from the app media-library API'
  );

  const projectMediaAssets = normalizeWorkspaceUserLibraryPayload(
    {
      ok: true,
      assets: [
        {
          id: 'legacy-video-without-mime',
          url: 'https://cdn.example.com/legacy-video.mp4?token=abc',
          thumbUrl: 'https://cdn.example.com/legacy-video.jpg',
          kind: 'image',
          duration: 12,
          source: 'upload',
        },
        {
          id: 'typed-video-with-alt-shape',
          url: 'https://cdn.example.com/typed-video',
          previewUrl: 'https://cdn.example.com/typed-video-preview.jpg',
          mediaType: 'asset-video',
          mimeType: 'video/mp4',
          durationSec: 8,
          source: 'upload',
        },
      ],
    },
    null
  );
  assert.deepEqual(
    projectMediaAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      durationSec: asset.durationSec,
      meta: asset.meta,
    })),
    [
      {
        id: 'legacy-video-without-mime',
        name: 'legacy-video.mp4',
        kind: 'video',
        durationSec: 12,
        meta: 'Video · upload',
      },
      {
        id: 'typed-video-with-alt-shape',
        name: 'typed-video',
        kind: 'video',
        durationSec: 8,
        meta: 'Video · upload',
      },
    ],
    'project media import should keep videos visible when API rows use legacy URLs or alternate MIME fields'
  );

  const recentVideoAssets = normalizeWorkspaceUserLibraryPayload(
    {
      ok: true,
      outputs: [
        {
          id: 'recent-output-video-1',
          url: 'https://cdn.example.com/recent-output.mp4',
          thumbUrl: 'https://cdn.example.com/recent-output.jpg',
          kind: 'video',
          mime: 'video/mp4',
          durationSec: 5,
        },
      ],
    },
    'video'
  );
  assert.deepEqual(
    recentVideoAssets.map((asset) => ({ id: asset.id, name: asset.name, kind: asset.kind, durationSec: asset.durationSec })),
    [{ id: 'recent-output-video-1', name: 'recent-output.mp4', kind: 'video', durationSec: 5 }],
    'studio library should normalize recent app outputs for media node selection'
  );

  const uploaded = workspaceLibraryAssetFromUploadedAsset(
    {
      id: 'uploaded-audio-1',
      url: 'https://cdn.example.com/voice-over.wav',
      kind: 'audio',
      mime: 'audio/wav',
      source: 'upload',
    },
    'audio'
  );
  assert.deepEqual(
    uploaded && { id: uploaded.id, name: uploaded.name, kind: uploaded.kind, meta: uploaded.meta, url: uploaded.url },
    {
      id: 'uploaded-audio-1',
      name: 'voice-over.wav',
      kind: 'audio',
      meta: 'Audio · upload',
      url: 'https://cdn.example.com/voice-over.wav',
    },
    'studio library should normalize uploaded app assets before assigning them to media blocks'
  );
});
