import assert from 'node:assert/strict';
import test from 'node:test';
import { movePlaylistItem } from '../frontend/lib/admin/playlist-order';
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
