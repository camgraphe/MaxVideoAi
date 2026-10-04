import assert from 'node:assert/strict';
import test from 'node:test';
import { movePlaylistItem } from '../frontend/lib/admin/playlist-order';
import { moveCurationIdToPosition } from '../frontend/lib/admin/playlist-curation';
test('global curation move preserves all 145 IDs across hydration windows', () => {
  const original = Array.from({ length: 145 }, (_, index) => `video-${index + 1}`);
  const moved = moveCurationIdToPosition(original, 'video-1', 100);
  assert.equal(moved.length, 145);
  assert.equal(moved[99], 'video-1');
  assert.equal(moved[0], 'video-2');
  assert.equal(moved[144], 'video-145');
  assert.deepEqual(original.slice(0, 2), ['video-1', 'video-2']);
  assert.equal(moveCurationIdToPosition(original, 'absent', 100), original);
});
test('keyboard movement preserves identities and metadata without mutating the saved order', () => {
  const saved = [
    { videoId: 'a', pinned: true },
    { videoId: 'b', pinned: false },
    { videoId: 'c', pinned: false },
  ];
  const moved = movePlaylistItem(saved, 'b', -1);
  assert.deepEqual(
    moved.map((item) => item.videoId),
    ['b', 'a', 'c']
  );
  assert.equal(moved[1], saved[0]);
  assert.deepEqual(
    saved.map((item) => item.videoId),
    ['a', 'b', 'c']
  );
  assert.equal(movePlaylistItem(saved, 'a', -1), saved);
  assert.equal(movePlaylistItem(saved, 'absent', 1), saved);
});
