import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkpointModelUsage } from "../server/model-usage";

test("recovering an older turn checkpoint cannot erase already measured project usage", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-usage-recovery-"));
  try {
    await mkdir(join(root, "assistant"));
    const pending = { attemptId: "one", responseId: null, status: "unknown", durationMs: 0, usage: null };
    await checkpointModelUsage(root, "film", "turn", [pending]);
    await checkpointModelUsage(root, "film", "turn", [{ ...pending, responseId: "response-one", status: "completed",
      model: "gpt-6.1-sol", serviceTier: "default", durationMs: 100,
      usage: { inputTokens: 100, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 40, reasoningTokens: 0, totalTokens: 140 } }]);
    await checkpointModelUsage(root, "film", "turn", [pending]);
    const entries = JSON.parse(await readFile(join(root, "assistant", "film.usage.json"), "utf8"));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].responseId, "response-one");
    assert.equal(entries[0].usage.totalTokens, 140);
  } finally { await rm(root, { recursive: true, force: true }); }
});
