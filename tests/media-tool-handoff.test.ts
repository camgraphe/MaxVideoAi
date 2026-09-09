import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeMediaHandoff, stageMediaHandoff, supportsMediaDestination, MEDIA_TOOL_DESTINATIONS } from '../frontend/lib/media-handoff';

function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } }; }
const original = { id: 'output-exact-17', sourceOutputId: 'output-exact-17', jobId: 'job-1', url: 'https://media.example/original.mp4?signature=exact', thumbUrl: 'https://media.example/thumb.jpg', kind: 'video' as const };
test('tool continuations keep the selected original and identity, consume once, and reject wrong kinds/accounts/expired transfers', () => {
  for (const tool of MEDIA_TOOL_DESTINATIONS) {
    const value = tool === 'angle' ? { ...original, kind: 'image' as const, url: 'https://media.example/original.png' } : original;
    const store = storage();
    const path = stageMediaHandoff(store, 'a', value, tool, 'token', 100);
    assert.ok(path.startsWith(`/app/tools/${tool}?media=token`));
    assert.deepEqual(consumeMediaHandoff(store, 'a', tool, 'token', 101), value);
    assert.equal(consumeMediaHandoff(store, 'a', tool, 'token', 102), null);
    stageMediaHandoff(store, 'a', value, tool, 'token', 100);
    assert.equal(consumeMediaHandoff(store, 'b', tool, 'token', 101), null);
    stageMediaHandoff(store, 'a', value, tool, 'token', 100);
    assert.equal(consumeMediaHandoff(store, 'a', tool, 'token', 700000), null);
  }
  assert.equal(supportsMediaDestination({ kind: 'audio' }, 'upscale'), false);
  assert.equal(supportsMediaDestination({ kind: 'image' }, 'denoise'), false);
  assert.throws(() => stageMediaHandoff(storage(), 'a', original, 'angle', 'token'));
  assert.match(stageMediaHandoff(storage(), 'a', original, 'upscale', 'token'), /&kind=video$/);
});
