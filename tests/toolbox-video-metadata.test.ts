import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseToolVideoMetadata } from '../frontend/src/server/tools/toolbox-video-metadata';
test('quote metadata accepts measured finite dimensions/duration and fractional frame rate', () => {
  assert.deepEqual(parseToolVideoMetadata({ streams: [{ width: 1920, height: 1080, r_frame_rate: '30000/1001' }], format: { duration: '2.25' } }), { width: 1920, height: 1080, fps: 30000 / 1001, durationSec: 2.25 });
  for (const input of [null, {}, { streams: [{ width: 0, height: 20 }], format: { duration: '2' } }, { streams: [{ width: 20, height: 20 }], format: { duration: 'NaN' } }]) assert.throws(() => parseToolVideoMetadata(input));
});
test('quote probes only a bounded local download and removes temporary media', () => {
  const source = readFileSync('frontend/src/server/tools/toolbox-video-metadata.ts', 'utf8');
  assert.match(source, /createBoundedMediaDownloader/);
  assert.match(source, /'-protocol_whitelist', 'file,pipe'/);
  assert.match(source, /finally \{ await rm\(directory/);
  assert.match(source, /JSON.stringify\(\[account, url\]\)/);
  assert.doesNotMatch(source, /execFileAsync\([^;]*, url\]/);
});

test('tool download policy adds WebM without broadening MCP imports or removing byte/DNS guards', async () => {
  const { createReferenceFileDownloader } = await import('../frontend/src/server/agent-api/reference-file-download');
  const deps = {
    lookupHost: async () => [{ address: '8.8.8.8', family: 4 as const }],
    openPinnedHttps: async () => ({ statusCode: 200, headers: { 'content-type': 'video/webm' }, body: (async function* () { yield Buffer.from('webm'); })() }),
  };
  const file = { file_id: 'fixture', download_url: 'https://media.example/source.webm' };
  await assert.rejects(createReferenceFileDownloader(deps)(file));
  const result = await createReferenceFileDownloader(deps, { accepted: ['video/webm'], maxBytes: 4 })(file);
  assert.equal(result.mimeType, 'video/webm'); assert.equal(result.bytes.length, 4);
  await assert.rejects(createReferenceFileDownloader(deps, { accepted: ['video/webm'], maxBytes: 3 })(file));
  await assert.rejects(createReferenceFileDownloader({ ...deps, lookupHost: async () => [{ address: '127.0.0.1', family: 4 as const }] }, { accepted: ['video/webm'], maxBytes: 4 })(file));
});
