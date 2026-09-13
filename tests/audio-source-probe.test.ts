import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { createReferenceFileDownloader } from '../frontend/src/server/agent-api/reference-file-download';
import { inspectSourceVideo } from '../frontend/src/server/audio/source-video-probe';

test('audio source rejects private hosts, mixed DNS and private redirects before any probe', async () => {
  let probes = 0;
  for (const url of ['http://127.0.0.1/video.mp4', 'https://127.0.0.1/video.mp4', 'https://mixed.example/video.mp4', 'https://redirect.example/video.mp4']) {
    const download = createReferenceFileDownloader({
      lookupHost: async host => host === '127.0.0.1' ? [{ address: '127.0.0.1', family: 4 }] : host === 'mixed.example' ? [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }] : [{ address: '8.8.8.8', family: 4 }],
      openPinnedHttps: async () => ({ statusCode: 302, headers: { location: 'https://127.0.0.1/secret.mp4' }, body: (async function* () {})() }),
    }, { accepted: ['video/mp4'], maxBytes: 10 });
    await assert.rejects(inspectSourceVideo(url, { download, probe: async () => { probes++; return {}; } }));
  }
  assert.equal(probes, 0);
});

test('audio source preserves signed URL, probes only downloaded bytes and cleans up on success or failure', async () => {
  const url = 'https://public.example/source.mp4?signature=a%2Fb%2Bc&expires=123';
  let localPath = '';
  let pinned = '';
  const download = createReferenceFileDownloader({
    lookupHost: async () => [{ address: '8.8.8.8', family: 4 }],
    openPinnedHttps: async (value, address) => {
      assert.equal(value.href, url); pinned = address.address;
      return { statusCode: 200, headers: { 'content-type': 'video/mp4' }, body: (async function* () { yield Buffer.from('media'); })() };
    },
  }, { accepted: ['video/mp4'], maxBytes: 5 });
  const result = await inspectSourceVideo(url, { download, probe: async file => {
    localPath = file; assert.equal((await readFile(file)).toString(), 'media'); assert.ok(!file.includes('https:'));
    return { streams: [{ codec_type: 'video', width: 1280, height: 720 }, { codec_type: 'audio' }], format: { duration: '8.5' } };
  } });
  assert.deepEqual(result, { width: 1280, height: 720, durationSec: 8.5, hasAudio: true });
  assert.equal(pinned, '8.8.8.8'); await assert.rejects(stat(localPath));
  await assert.rejects(inspectSourceVideo(url, { download, probe: async file => { localPath = file; throw new Error('probe timeout'); } }), /probe timeout/);
  await assert.rejects(stat(localPath));
});

test('oversized or invalid source never reaches a media subprocess', async () => {
  let probes = 0;
  const download = createReferenceFileDownloader({
    lookupHost: async () => [{ address: '8.8.8.8', family: 4 }],
    openPinnedHttps: async () => ({ statusCode: 200, headers: { 'content-type': 'video/mp4' }, body: (async function* () { yield Buffer.alloc(6); })() }),
  }, { accepted: ['video/mp4'], maxBytes: 5 });
  await assert.rejects(inspectSourceVideo('https://public.example/source.mp4', { download, probe: async () => { probes++; return {}; } }), /limit/);
  assert.equal(probes, 0);
  const source = await readFile('frontend/src/server/audio/source-video-probe.ts', 'utf8');
  assert.match(source, /'-protocol_whitelist', 'file,pipe'/);
  assert.match(source, /'-format_whitelist', 'mov,matroska,webm'/);
  assert.match(source, /timeout: 15_000/);
});
