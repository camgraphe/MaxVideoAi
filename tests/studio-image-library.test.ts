import assert from "node:assert/strict";
import test from "node:test";
import { saveRecentImageReference } from "../frontend/src/lib/studio/image-library";
const output = {
  id: "output-local",
  jobId: "job-local",
  url: "https://cdn.maxvideoai.com/output.png",
  status: "ready",
};
test("Recent selection saves the owned job/output and resolves its canonical public asset", async () => {
  const calls: { url: string; body?: string }[] = [];
  const asset = { assetId: "ma_" + "a".repeat(32), url: output.url };
  const request = (async (url, options) => {
    calls.push({ url: String(url), body: options?.body as string | undefined });
    return {
      ok: true,
      json: async () =>
        calls.length === 1
          ? { ok: true, asset: { id: "private-uuid", url: output.url } }
          : { ok: true, assets: [asset] },
    };
  }) as typeof fetch;
  assert.deepEqual(await saveRecentImageReference(output, request), asset);
  assert.deepEqual(JSON.parse(calls[0].body!), {
    jobId: output.jobId,
    outputId: output.id,
  });
  assert.match(calls[1].url, /originUrl=https%3A/);
});

test('recent video/audio selections resolve a reusable identity on the matching library surface', async () => {
  const module = await import('../frontend/src/lib/studio/image-library');
  assert.ok(module.saveRecentMediaReference);
  for (const kind of ['video','audio'] as const) {
    const urls: string[] = [];
    const asset = {assetId: 'ma_' + 'b'.repeat(32), url: `https://cdn.maxvideoai.com/source.${kind === 'video' ? 'mp4' : 'mp3'}`};
    const request = (async (url: string) => {urls.push(String(url)); return {ok: true, json: async () => urls.length === 1 ? {ok: true, asset} : {ok: true, assets: [asset]}};}) as typeof fetch;
    const selected = await module.saveRecentMediaReference({...output, url: asset.url}, kind, request);
    assert.equal(selected.kind, kind);
    assert.match(urls[1], new RegExp('kind=' + kind));
    assert.equal(selected.assetId, asset.assetId);
  }
});

test('a selected library voice uses measured fractional duration while preserving its legacy history', async () => {
  const {saveRecentMediaReference} = await import('../frontend/src/lib/studio/image-library');
  const {conversationLibraryInsertTiming} = await import('../frontend/lib/studio/conversation-timeline-editing');
  const asset = {assetId: 'ma_' + 'c'.repeat(32),url: 'https://cdn.maxvideoai.com/voice.mp3',durationSec: 13,
    mediaFacts: {source: 'probe' as const,durationSec: 12.408}};
  let calls = 0;
  const request = (async () => ({ok: true,json: async () => ++calls === 1 ? {ok: true,asset} : {ok: true,assets: [asset]}})) as typeof fetch;
  const selected = await saveRecentMediaReference({...output,url: asset.url},'audio',request);
  assert.equal(selected.durationSec,13);
  assert.deepEqual(conversationLibraryInsertTiming({kind: selected.kind!,mediaFacts: selected.mediaFacts,timelineDurationSec: 0,fps: 30}),{startFrame: 0,durationFrames: 372});
});

test("a saved internal UUID cannot masquerade as a reusable ma_ reference", async () => {
  let calls = 0;
  const request = (async () => ({
    ok: true,
    json: async () =>
      ++calls === 1
        ? { ok: true, asset: { id: "private-uuid", url: output.url } }
        : { ok: true, assets: [{ assetId: "private-uuid", url: output.url }] },
  })) as typeof fetch;
  await assert.rejects(
    saveRecentImageReference(output, request),
    /momentanément indisponible/,
  );
});
