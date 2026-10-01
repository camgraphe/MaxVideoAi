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
