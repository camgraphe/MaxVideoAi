import assert from 'node:assert/strict';
import test from 'node:test';
import type { EngineCaps } from '../frontend/types/engines';
import { getVideoContinuationEngine, resolveMediaContinuationOriginal } from '../frontend/lib/video-continuation';

const video = { id: 'selected', kind: 'video' as const, url: 'https://media.example/original.mp4', durationSec: 5, size: 1000, mime: 'video/mp4' };
const engine = (id: string, modes: EngineCaps['modes'] = ['v2v', 'extend'], patch: Partial<EngineCaps> = {}): EngineCaps => ({
  id, modes, availability: 'available', status: 'live', inputLimits: {},
  inputSchema: { required: [{ id: 'video_url', type: 'video', label: 'Source', modes, maxDurationSec: 15, maxSizeMB: 10 }] }, ...patch,
} as EngineCaps);

test('continuation uses accessible destination capabilities, independent of the source generator', () => {
  const entries = [engine('veo-3-1', ['extend']), engine('wan-3'), engine('seedance-2-5'), engine('luma-ray-3-2', ['v2v'])];
  assert.equal(getVideoContinuationEngine(entries, video, 'v2v', 'unrelated-image-model')?.id, 'seedance-2-5');
  assert.equal(getVideoContinuationEngine(entries, video, 'v2v', 'luma-ray-3-2')?.id, 'luma-ray-3-2');
  assert.equal(getVideoContinuationEngine(entries, video, 'extend', 'luma-ray-3-2')?.id, 'seedance-2-5');
  assert.equal(getVideoContinuationEngine([entries[0]], video, 'extend'), null);
  assert.equal(getVideoContinuationEngine([entries[0]], video, 'extend', 'veo-3-1')?.id, 'veo-3-1');
  assert.equal(getVideoContinuationEngine(entries, { ...video, kind: 'image' }, 'v2v'), null);
});

test('unavailable modes, unsupported known sources and missing video roles are not offered', () => {
  const entries = [engine('paused', ['v2v'], { availability: 'paused' }), engine('waiting', ['v2v'], { availability: 'waitlist' }),
    engine('offline', ['v2v'], { status: 'maintenance' }), engine('disabled', ['v2v'], { modeAvailability: { v2v: { available: false } } }),
    engine('no-video', ['v2v'], { inputSchema: { required: [{ id: 'image', type: 'image', label: 'Image' }] } })];
  assert.equal(getVideoContinuationEngine(entries, video, 'v2v'), null);
  assert.equal(getVideoContinuationEngine([engine('editor')], { ...video, durationSec: 60 }, 'v2v'), null);
  assert.equal(getVideoContinuationEngine([engine('editor')], { ...video, size: 20 * 1024 * 1024 }, 'v2v'), null);
  assert.ok(getVideoContinuationEngine([engine('editor')], { ...video, durationSec: null, size: null, mime: null }, 'v2v'), 'unknown facts are qualified at destination, not invented');
});

test('gallery continuation resolves the exact ready output and never substitutes its preview or a sibling', async () => {
  const selected = { ...video, source: 'gallery', jobId: 'job-a', previewUrl: 'https://media.example/preview.mp4' };
  let requested = '';
  const fetcher = async (url: string) => { requested = url; return { ok: true, json: async () => ({ ok: true, outputs: [
    { ...video, id: 'sibling', url: selected.previewUrl, status: 'ready' }, { ...video, id: 'exact-output', status: 'completed' },
  ] }) }; };
  const result = await resolveMediaContinuationOriginal(selected, fetcher);
  assert.match(requested, /jobId=job-a/);
  assert.equal(result.url, video.url);
  assert.equal(result.sourceOutputId, 'exact-output');
  assert.equal(result.source, 'recent');
  await assert.rejects(resolveMediaContinuationOriginal(selected, async () => ({ ok: true, json: async () => ({ ok: true, outputs: [{ ...video, status: 'running' }] }) })));
  assert.equal(await resolveMediaContinuationOriginal(video, async () => { throw Error('Library original needs no gallery lookup'); }), video);
});
