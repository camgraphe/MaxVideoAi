import assert from 'node:assert/strict';
import test from 'node:test';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

const items: WorkspaceTimelineItem[] = [
  {id: 'one', outputNodeId: 'source-one', title: 'Opening', track: 'video', mediaKind: 'video', startSec: 0, durationSec: 5, sourceStartSec: 2, sourceDurationSec: 8, status: 'completed', mediaUrl: 'https://cdn.maxvideoai.com/one.mp4'},
  {id: 'two', outputNodeId: 'source-two', title: 'Ending', track: 'video', mediaKind: 'video', startSec: 5, durationSec: 5, sourceStartSec: 0, sourceDurationSec: 5, status: 'completed', mediaUrl: 'https://cdn.maxvideoai.com/two.mp4'},
];
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
