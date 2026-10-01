import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSolReportWriter } from "../scripts/qa/studio-sol-report-writer";
import { evaluateEnglishScenarios } from "../scripts/qa/studio-sol-english-runner";

test("atomic checkpoints preserve the last valid report when publishing fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sol-report-"));
  const path = join(directory, "report.json");
  try {
    await writeFile(path, "previous", "utf8");
    const writer = createSolReportWriter(path, { writeFile, rename: async () => { throw new Error("disk failure"); } });
    assert.equal(await writer.write("next"), false);
    assert.equal(writer.failed(), true);
    assert.equal(await readFile(path, "utf8"), "previous");
    assert.ok((await readdir(directory)).some((name) => name.endsWith(".tmp")));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("failure stops new calls, drains already started calls, and can save their usage", async () => {
  const events: string[] = [];
  let writes = 0;
  const writer = createSolReportWriter("/fixture/report", {
    writeFile: async (_path, content) => {
      writes++;
      if (writes === 1) throw new Error("transient disk failure");
      events.push(String(content));
    },
    rename: async () => {},
  });
  let calls = 0;
  const reference = { assetId: "ma_11111111111111111111111111111111", role: "reference" as const,
    mediaKind: "image" as const, storageUrl: "fixture", width: 1, height: 1, durationSec: null, mimeType: "image/png" };
  const scenarios = [0, 1].map((index) => ({ id: `case-${index}`, message: "Help only", expectedRatio: null, history: [], reference: false }));
  const results: { id: string; totalTokens: number | null }[] = [];
  const group = () => evaluateEnglishScenarios({ scenarios, reference,
    createDirector: (onResponse) => async () => {
      calls++;
      onResponse({ model: "gpt-6.1-sol", status: "completed", serviceTier: "default", elapsedMs: 1,
        usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 0 }, output_tokens: 5,
          output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 15 } });
      await Promise.resolve();
      return { reply: "Actual reply", image: null };
    },
    shouldStop: writer.failed,
    onResult: async (result) => { results.push({ id: result.id, totalTokens: result.telemetry?.usage?.total_tokens ?? null }); await writer.write(JSON.stringify(results)); },
  });
  await Promise.all([group(), group()]);
  assert.equal(calls, 2);
  assert.equal(results.length, 2);
  assert.ok(results.every((result) => result.totalTokens === 15));
  assert.equal(writer.failed(), true);
  assert.deepEqual(JSON.parse(events.at(-1)!), results);
});
