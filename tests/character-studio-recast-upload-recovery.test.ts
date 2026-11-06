import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
  import {prepareRecastQuote} from './src/components/tools/character-builder/_lib/recast-submit';
  window.prepareRecastQuote=prepareRecastQuote;
`, { '@/lib/authFetch': 'export const authFetch=(...args)=>fetch(...args);' });

for (const kind of ['video', 'audio'] as const) {
  test(`Recast ${kind} multipart cancellation still cleans up parts and a fresh retry succeeds`, async () => {
    const dom = createClientFlowDom('/app/tools/character-builder');
    const w = dom.window as any;
    const requests: Array<{ url: string; signal?: AbortSignal }> = [];
    let starts = 0;
    let parts = 0;
    let blocked = false;
    const assetId = 'ma_' + '4'.repeat(32);
    w.fetch = (url: string, options: any = {}) => {
      requests.push({ url, signal: options.signal });
      if (url.includes('prepare?')) return Promise.resolve(Response.json({ ok: true }));
      if (url.endsWith('/multipart/start')) {
        starts += 1;
        return Promise.resolve(Response.json({ ok: true, upload: { uploadId: `upload-${starts}`, key: `key-${starts}`, chunkSizeBytes: 3_670_016 } }));
      }
      if (url.endsWith('/multipart/part')) {
        parts += 1;
        if (starts === 1 && parts === 2) {
          blocked = true;
          return new Promise<Response>((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new w.DOMException('Cancelled', 'AbortError')), { once: true }));
        }
        return Promise.resolve(Response.json({ ok: true, part: { partNumber: Number(options.body.get('partNumber')), etag: 'etag', key: 'part-key', size: options.body.get('chunk').size } }));
      }
      if (url.endsWith('/multipart/abort')) return Promise.resolve(Response.json({ ok: true }));
      if (url.endsWith('/multipart/complete')) return Promise.resolve(Response.json({ ok: true, asset: { id: 'owned', assetId, url: `https://example.invalid/${kind}` } }));
      if (url.endsWith('/prepare')) {
        const body = JSON.parse(options.body);
        assert.equal(body[kind].assetId, assetId);
        return Promise.resolve(Response.json({ ok: true, kind: 'rehearsal', revision: 'test', amountCents: 168, currency: 'USD', sourceSeconds: kind === 'video' ? 5 : 0, audioSeconds: kind === 'audio' ? 5 : 0 }));
      }
      throw new Error(`Unexpected local transport: ${url}`);
    };
    try {
      w.eval(await bundle);
      const file = new w.File([new Uint8Array(5 * 1024 * 1024)], kind === 'video' ? 'source.mp4' : 'voice.wav', { type: kind === 'video' ? 'video/mp4' : 'audio/wav' });
      const setup = { portrait: { jobId: 'saved', url: 'https://example.invalid/portrait.png', name: 'Saved' }, product: null, video: null, audio: null,
        [kind]: { file, name: file.name, url: 'blob:local', originalSeconds: 5, range: { startSec: 0, endSec: 5 } },
        direction: 'Walk', dialogue: '', seconds: 6, resolution: '720p', aspectRatio: 'auto' };
      const cache = new WeakMap();
      const firstController = new w.AbortController();
      const first = w.prepareRecastQuote(setup, cache, firstController.signal).then(() => null, (error: Error) => error);
      for (let i = 0; i < 30 && !blocked; i += 1) await new Promise(resolve => setTimeout(resolve, 5));
      assert.ok(blocked, 'the second multipart request must be in progress before cancellation');
      firstController.abort();
      assert.equal((await first)?.name, 'AbortError');
      const cleanup = requests.find(request => request.url.endsWith('/multipart/abort'));
      assert.ok(cleanup, 'an already uploaded part still needs cleanup');
      assert.equal(cleanup.signal, undefined, 'cleanup must not inherit the aborted upload signal');
      assert.ok(!requests.some(request => request.url.endsWith('/prepare')));
      const retry = await w.prepareRecastQuote(setup, cache, new w.AbortController().signal);
      assert.equal(retry.kind, 'rehearsal');
      assert.equal(starts, 2, 'the cancelled pending cache entry must not be reused');
      await w.prepareRecastQuote(setup, cache, new w.AbortController().signal);
      assert.equal(starts, 2, 'a completed owned upload remains reusable');
      assert.ok(!requests.some(request => request.url.endsWith('/confirm')));
    } finally { dom.window.close(); }
  });
}

test('a rejected upload cancels its pending sibling; cancelled retries never strand the shared cache', async () => {
  const dom = createClientFlowDom('/app/tools/character-builder');
  const w = dom.window as any;
  const cache = new WeakMap();
  let videos = 0;
  let quotes = 0;
  const audios: Array<{ signal: AbortSignal; resolve: (value: Response) => void }> = [];
  w.fetch = (url: string, options: any = {}) => {
    if (url.includes('prepare?')) return Promise.resolve(Response.json({ ok: true }));
    if (url === '/api/uploads/video') {
      videos += 1;
      return Promise.resolve(videos === 1
        ? Response.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 })
        : Response.json({ ok: true, asset: { id: 'video', assetId: 'ma_' + '2'.repeat(32), url: 'https://example.invalid/video' } }));
    }
    if (url === '/api/uploads/audio') return new Promise<Response>(resolve => audios.push({ signal: options.signal, resolve }));
    if (url.endsWith('/prepare')) {
      quotes += 1;
      return Promise.resolve(Response.json({ ok: true, kind: 'rehearsal', revision: 'test', amountCents: 168, currency: 'USD', sourceSeconds: 5, audioSeconds: 5 }));
    }
    throw new Error(`Unexpected local transport: ${url}`);
  };
  try {
    w.eval(await bundle);
    const video = new w.File(['video'], 'source.mp4', { type: 'video/mp4' });
    const audio = new w.File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const setup = { portrait: { jobId: 'saved', url: 'https://example.invalid/portrait.png', name: 'Saved' }, product: null,
      video: { file: video, range: { startSec: 0, endSec: 5 } }, audio: { file: audio, range: { startSec: 0, endSec: 5 } },
      direction: 'Walk', dialogue: '', seconds: 6, resolution: '720p', aspectRatio: 'auto' };
    await assert.rejects(w.prepareRecastQuote(setup, cache, new w.AbortController().signal), /VIDEO_UPLOAD_INVALID/);
    assert.equal(audios.length, 1);
    assert.equal(audios[0].signal?.aborted, true, 'failure must cancel the remaining upload immediately');
    assert.equal(cache.has(audio), false, 'the rejected preparation must release its pending sibling cache entry');

    const secondController = new w.AbortController();
    const second = w.prepareRecastQuote(setup, cache, secondController.signal).then(() => null, (error: Error) => error);
    for (let i = 0; i < 30 && audios.length < 2; i += 1) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(audios.length, 2);
    secondController.abort();
    assert.equal(audios[1].signal?.aborted, true);
    assert.equal(cache.has(audio), false);
    const uploadedAudio = () => Response.json({ ok: true, asset: { assetId: 'ma_' + '3'.repeat(32) } });
    audios[0].resolve(uploadedAudio()); audios[1].resolve(uploadedAudio());
    assert.equal((await second)?.name, 'AbortError');
    assert.equal(quotes, 0, 'abandoned uploads cannot submit a late price preparation');

    const third = w.prepareRecastQuote(setup, cache, new w.AbortController().signal);
    for (let i = 0; i < 30 && audios.length < 3; i += 1) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(audios.length, 3);
    audios[2].resolve(uploadedAudio());
    assert.equal((await third).kind, 'rehearsal');
    assert.equal(videos, 2, 'the successful video upload from the cancelled retry remains reusable');
    assert.equal(quotes, 1);
  } finally { dom.window.close(); }
});
