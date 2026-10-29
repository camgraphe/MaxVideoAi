import assert from 'node:assert/strict';
import test from 'node:test';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';

const items: WorkspaceTimelineItem[] = [
  {id: 'one', outputNodeId: 'source-one', title: 'Opening', track: 'video', mediaKind: 'video', startSec: 0, durationSec: 5, sourceStartSec: 2, sourceDurationSec: 8, status: 'completed', mediaUrl: 'https://cdn.maxvideoai.com/one.mp4'},
  {id: 'two', outputNodeId: 'source-two', title: 'Ending', track: 'video', mediaKind: 'video', startSec: 5, durationSec: 5, sourceStartSec: 0, sourceDurationSec: 5, status: 'completed', mediaUrl: 'https://cdn.maxvideoai.com/two.mp4'},
];
test('the monitor retains the final decoded frame at the sequence end, including a source start trim', async () => {
  const module = await import('../frontend/lib/studio/conversation-timeline-editing');
  assert.ok(module.conversationMonitorTime, 'The sequence endpoint must sample its last frame rather than an empty interval.');
  const end = module.conversationMonitorTime(10, 10, 30);
  const visible = items.filter(item => end >= item.startSec && end < item.startSec + item.durationSec);
  assert.deepEqual(visible.map(item => item.id), ['two']);
  assert.equal(Math.round(module.conversationSourceTime(visible[0], end) * 30), 149);
  const cut = {...items[0], startSec: 0, durationSec: 4, sourceStartSec: 1, sourceDurationSec: 5};
  assert.equal(Math.round(module.conversationSourceTime(cut, module.conversationMonitorTime(4, 4, 30)) * 30), 149);
  assert.equal(module.conversationMonitorTime(2.5, 10, 30), 2.5, 'Normal scrubbing must retain its requested time.');
  assert.equal(module.conversationMonitorTime(0, 0, 30), 0);
});
test('conversation trim and monitor agree on the source frame at both ends of a cut', async () => {
  const module = await import('../frontend/lib/studio/conversation-timeline-editing').catch(() => null);
  assert.ok(module?.applyConversationTimelineEdit);
  const result = module.applyConversationTimelineEdit(items, {kind: 'trim', clipId: 'one', edge: 'start', durationFrames: 90}, 30, []);
  const cut = result.find(item => item.id === 'one')!;
  assert.equal(cut.durationSec, 3);
  assert.equal(cut.sourceStartSec, 4);
  assert.equal(cut.startSec, 0);
  assert.equal(result.find(item => item.id === 'two')?.startSec, 3);
  assert.equal(module.conversationSourceTime(cut, 0), 4);
  assert.equal(module.conversationSourceTime(cut, 2.5), 6.5);
  assert.equal(module.conversationSourceTime(cut, 100), 7);
  const restored = module.applyConversationTimelineEdit(result, {kind: 'trim', clipId: 'one', edge: 'start', durationFrames: 150}, 30, []);
  assert.equal(restored.find(item => item.id === 'one')?.sourceStartSec, 2);
  assert.equal(restored.find(item => item.id === 'one')?.durationSec, 5);
  assert.equal(restored.find(item => item.id === 'two')?.startSec, 5);
});

test('manual and bot edits retain linked audio, frame snapping, locked tracks and non-overlap', async () => {
  const module = await import('../frontend/lib/studio/conversation-timeline-editing').catch(() => null);
  assert.ok(module?.applyConversationTimelineEdit);
  const linked = [{...items[0], linkedGroupId: 'pair'}, {...items[0], id: 'sound', track: 'audio' as const, mediaKind: 'audio' as const, linkedGroupId: 'pair'}];
  const moved = module.applyConversationTimelineEdit(linked, {kind: 'move', clipId: 'one', startFrame: 25}, 25, []);
  assert.deepEqual(moved.map(item => item.startSec), [1,1]);
  const mixed = module.applyConversationTimelineEdit(moved, {kind: 'gain', clipId: 'sound', volume: 15}, 25, []);
  assert.equal(mixed.find(item => item.id === 'sound')?.audioMix?.volume, 15);
  assert.throws(() => module.applyConversationTimelineEdit(moved, {kind: 'gain', clipId: 'sound', volume: 101}, 25, []));
  assert.throws(() => module.applyConversationTimelineEdit(items, {kind: 'move', clipId: 'one', startFrame: 300}, 30, ['video']), /locked/i);
  assert.throws(() => module.applyConversationTimelineEdit(items, {kind: 'trim', clipId: 'missing', edge: 'end', durationFrames: 30}, 30, []), /clip/i);
  assert.throws(() => module.applyConversationTimelineEdit(items, {kind: 'trim', clipId: 'one', edge: 'end', durationFrames: 1}, 30, []), /duration/i);
});

test('an explicit zero gain can silence an unmeasured video without asserting embedded audio or changing the edit', async () => {
  const {applyConversationTimelineEdit} = await import('../frontend/lib/studio/conversation-timeline-editing');
  for (const legacyAudio of [{}, {audioProvenance: 'unknown' as const}, {audioProvenance: 'none' as const, hasEmbeddedAudio: false}]) {
    const source = {...items[0], ...legacyAudio, ref: {type: 'asset' as const, assetId: 'ma_'+'1'.repeat(32), kind: 'video' as const}, mediaFacts: {source: 'probe' as const, durationSec: 8}};
    const original = structuredClone(source);
    const corrected = {...original, audioProvenance: 'unknown' as const};
    delete corrected.hasEmbeddedAudio;
    const result = applyConversationTimelineEdit([source, items[1]], {kind: 'gain', clipId: source.id, volume: 0}, 30, []);
    assert.deepEqual(result, [{...corrected, audioMix: {volume: 0, muted: false}}, items[1]]);
    const restored = applyConversationTimelineEdit(result, {kind: 'gain', clipId: source.id, volume: 100}, 30, []);
    assert.deepEqual(restored, [{...corrected, audioMix: {volume: 100, muted: false}}, items[1]]);
    assert.deepEqual(applyConversationTimelineEdit(restored, {kind: 'gain', clipId: source.id, volume: 100}, 30, []), restored, 'Repeated restoration stays harmless.');
    assert.deepEqual(applyConversationTimelineEdit([source], {kind: 'gain', clipId: source.id, volume: 100}, 30, [])[0], {...corrected, audioMix: {volume: 100, muted: false}}, 'Original level is safe even without a prior mute.');
    assert.deepEqual(source, original, 'The original media and saved input remain unchanged.');
    for (const volume of [1,25,99]) assert.throws(() => applyConversationTimelineEdit([source], {kind: 'gain', clipId: source.id, volume}, 30, []), /no audio/i, 'Unknown sound does not authorize arbitrary gain.');
    assert.throws(() => applyConversationTimelineEdit([source], {kind: 'gain', clipId: source.id, volume: 0}, 30, ['video']), /locked/i);
  }
});

test('measured embedded audio overrides a stale silent flag while silent videos, images and linked external sound stay protected', async () => {
  const {applyConversationTimelineEdit} = await import('../frontend/lib/studio/conversation-timeline-editing');
  const measured = {...items[0], audioProvenance: 'none' as const, hasEmbeddedAudio: false, mediaFacts: {source: 'probe' as const, durationSec: 8, hasAudio: true}};
  const quieter = applyConversationTimelineEdit([measured], {kind: 'gain', clipId: measured.id, volume: 20}, 30, []);
  assert.equal(quieter[0].audioMix?.volume, 20);
  assert.equal(quieter[0].audioProvenance, 'embedded', 'Exports must receive the measured audio presence instead of the stale flag.');
  assert.equal(quieter[0].hasEmbeddedAudio, true);
  for (const protectedClip of [
    {...measured, mediaFacts: {...measured.mediaFacts, hasAudio: false}},
    {...measured, mediaKind: 'image' as const},
    {...measured, audioProvenance: 'external' as const, linkedGroupId: 'sound-pair'},
  ]) for (const volume of [0,100]) assert.throws(() => applyConversationTimelineEdit([protectedClip], {kind: 'gain', clipId: protectedClip.id, volume}, 30, []), /no audio/i);
});

test('library insertion floors source-limited durations so a fractional final frame never extends audio or video', async () => {
  const module = await import('../frontend/lib/studio/conversation-timeline-editing');
  assert.ok(module.conversationLibraryInsertTiming,'Library insertion needs a bounded frame projection.');
  for (const [kind,sourceDurationSec,timelineDurationSec,fps,want] of [
    ['audio',12.408,0,30,{startFrame: 0,durationFrames: 372}],
    ['audio',12.428,0,30,{startFrame: 0,durationFrames: 372}],
    ['audio',12.428,5.019,30,{startFrame: 0,durationFrames: 150}],
    ['audio',4.92,10,25,{startFrame: 0,durationFrames: 123}],
    ['video',5.017,3,30,{startFrame: 90,durationFrames: 150}],
    ['image',null,3,30,{startFrame: 90,durationFrames: 150}],
    ['video',2000,0,60,{startFrame: 0,durationFrames: 108000}],
  ] as const) {
    const timing = module.conversationLibraryInsertTiming({kind,mediaFacts: {source: 'probe',durationSec: sourceDurationSec},timelineDurationSec,fps});
    assert.deepEqual(timing,want);
    if (kind !== 'image') assert.ok(timing!.durationFrames / fps <= sourceDurationSec!);
  }
  for (const sourceDurationSec of [null,undefined,NaN,Infinity,0,.999]) {
    assert.equal(module.conversationLibraryInsertTiming({kind: 'audio',mediaFacts: {source: 'probe',durationSec: sourceDurationSec},timelineDurationSec: 5,fps: 30}),null);
  }
  for (const fps of [0,-1,NaN,Infinity,29.97,61]) assert.equal(module.conversationLibraryInsertTiming({kind: 'video',mediaFacts: {source: 'probe',durationSec: 5},timelineDurationSec: 5,fps}),null);
  for (const mediaFacts of [undefined,{durationSec: 13},{source: 'browser',durationSec: 12.408},{source: 'requested',durationSec: 13}]) {
    assert.equal(module.conversationLibraryInsertTiming({kind: 'audio',mediaFacts,timelineDurationSec: 5,fps: 30}),null,'Declared duration never becomes source evidence.');
  }
});
