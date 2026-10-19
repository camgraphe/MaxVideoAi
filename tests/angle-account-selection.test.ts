import assert from 'node:assert/strict';
import test from 'node:test';
import { mountAngle } from './helpers/tool-selection-fixture';

const key = 'maxvideoai.tools.angle.v1';
const saved = JSON.stringify({ version: 1, engineId: 'qwen-multiple-angles', params: { rotation: 8, tilt: 2, zoom: 1.2 }, safeMode: true, generateBestAngles: false, sourceImage: { url: 'https://example.invalid/A.png', source: 'library' }, result: { ok: true, jobId: 'A-job', outputs: [{ url: 'https://example.invalid/A-result.png' }] }, selectedOutputIndex: 0 });

test('Angle never restores an ownerless draft under another authenticated account', async () => {
  const f = await mountAngle({ userId: 'B', storage: { [key]: saved } });
  try { assert.equal(f.w.settings.sourceImage, null); assert.equal(f.w.outputs.result, null); }
  finally { await f.close(); }
});

test('Angle A to B to A and reload preserve only the confirmed account draft', async () => {
  const f = await mountAngle();
  try {
    await f.choose('A'); await f.auth('B');
    assert.equal(f.w.settings.sourceImage, null);
    assert.ok(f.w.framesSeen.filter((x: any) => x.user === 'B').every((x: any) => x.source !== 'https://example.invalid/A.png'));
    await f.choose('B'); await f.auth('A');
    assert.equal(f.w.settings.sourceImage.url, 'https://example.invalid/A.png');
    assert.equal(JSON.parse(f.w.localStorage.getItem(key + ':B')).sourceImage.url, 'https://example.invalid/B.png');
    const reload = await mountAngle({ storage: { [key + ':A']: f.w.localStorage.getItem(key + ':A') } });
    try { assert.equal(reload.w.settings.sourceImage.url, 'https://example.invalid/A.png'); }
    finally { await reload.close(); }
    await f.auth(null);
    assert.equal(f.w.settings.sourceImage.source, 'example');
    assert.equal(JSON.parse(f.w.localStorage.getItem(key + ':A')).sourceImage.url, 'https://example.invalid/A.png');
  } finally { await f.close(); }
});

test('unresolved authentication does not hydrate, clear or overwrite Angle account storage', async () => {
  const f = await mountAngle({ userId: null, loading: true, storage: { [key]: saved, [key + ':A']: saved } });
  try {
    assert.equal(f.w.settings, undefined);
    assert.equal(f.w.localStorage.getItem(key), saved);
    assert.equal(f.w.localStorage.getItem(key + ':A'), saved);
    await f.auth('A');
    assert.equal(f.w.settings.sourceImage.url, 'https://example.invalid/A.png');
    assert.equal(f.w.outputs.result.jobId, 'A-job');
    await f.auth('A');
    assert.equal(f.w.outputs.result.jobId, 'A-job', 'same-account auth refresh preserves the result');
  } finally { await f.close(); }
});

for (const choice of ['library', 'remove', 'paste'] as const) {
  test(`Angle ignores an upload superseded by ${choice}`, async () => {
    const f = await mountAngle();
    try {
      await f.choose('original');
      const { pending } = await f.upload();
      const request = f.w.requests[0];
      if (choice === 'library') await f.choose('B');
      if (choice === 'remove') await f.act(async () => f.w.settings.onRemoveSource());
      if (choice === 'paste') await f.act(async () => f.w.settings.onSourcePaste({ preventDefault() {}, clipboardData: { items: [], getData: () => 'https://example.invalid/B.png' } }));
      await f.respond(request, { ok: true, asset: { url: 'https://example.invalid/A.png' } });
      await pending;
      assert.equal(f.w.settings.sourceImage?.url ?? null, choice === 'remove' ? null : 'https://example.invalid/B.png');
      assert.equal(f.w.settings.uploading, false);
      assert.ok(f.w.revoked.includes('blob:test-1'));
    } finally { await f.close(); }
  });
}

test('a superseded Angle failure cannot replace the new upload loading state or error', async () => {
  const f = await mountAngle();
  try {
    const a = await f.upload(); const b = await f.upload();
    await f.respond(f.w.requests[0], { ok: false, error: 'old upload failure' }, 500); await a.pending;
    assert.equal(f.w.settings.uploading, true); assert.equal(f.w.settings.error, null);
    await f.respond(f.w.requests[1], { ok: true, asset: { url: 'https://example.invalid/B.png' } }); await b.pending;
    assert.equal(f.w.settings.sourceImage.url, 'https://example.invalid/B.png'); assert.equal(f.w.settings.uploading, false);
  } finally { await f.close(); }
});

test('Angle upload preparation cannot dispatch after its account workspace unmounts', async () => {
  const f = await mountAngle();
  try {
    let finish!: (file: File) => void;
    f.w.prepareUpload = () => new Promise(resolve => { finish = resolve; });
    const a = await f.upload(); await f.auth('B');
    await f.act(async () => finish(new f.w.File(['image'], 'A.png', { type: 'image/png' })));
    // Resolve unexpected requests too, so the failing baseline cannot hang.
    if (f.w.requests.length) await f.respond(f.w.requests[0], { ok: true, asset: { url: 'https://example.invalid/A.png' } });
    await a.pending;
    assert.equal(f.w.requests.length, 0); assert.equal(f.w.settings.sourceImage, null);
  } finally { await f.close(); }
});
