import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEnglishScenarios, summarizeEnglishResults } from "../scripts/qa/studio-sol-english-runner";
import type { EnglishScenario } from "./fixtures/studio-image-english-scenarios";

const reference = {
  assetId: "ma_11111111111111111111111111111111", role: "reference" as const,
  mediaKind: "image" as const, storageUrl: "data:image/png;base64,fixture",
  width: 512, height: 512, durationSec: null, mimeType: "image/png",
};
const scenarios: EnglishScenario[] = [
  { id: "help", message: "How do I start?", expectedRatio: null, history: [], reference: false },
  { id: "opt-in", message: "Create one square image of the attached logo.", expectedRatio: "1:1", history: [], reference: true },
];
const event = {
  responseId: "qa-response",
  model: "gpt-6.1-sol", status: "completed" as const, serviceTier: "default" as const, elapsedMs: 5,
  usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    output_tokens: 20, output_tokens_details: { reasoning_tokens: 10 }, total_tokens: 120 },
};

test("the consecutive evaluation reuses actual replies and counts each response once", async () => {
  let calls = 0;
  const results = await evaluateEnglishScenarios({ scenarios, reference, consecutive: true,
    createDirector: (onResponse) => async (input, history, refs) => {
      if (calls === 0) assert.deepEqual(history, []);
      else {
        assert.deepEqual(history, [{ message: scenarios[0].message, reply: "Actual reply" }]);
        assert.deepEqual(input.references, [reference.assetId]);
        assert.deepEqual(refs, [reference]);
      }
      onResponse(event);
      calls++;
      return { reply: "Actual reply", image: calls === 1 ? null : { prompt: "Preserve white M", aspectRatio: "1:1" } };
    },
  });
  assert.equal(calls, 2);
  assert.ok(results.every((result) => result.actionPassed));
  assert.deepEqual(results.map((result) => result.historyTurnsSent), [0, 1]);
  const summary = summarizeEnglishResults(results);
  assert.equal(summary.inputTokens, 200);
  assert.equal(summary.outputTokens, 40);
  assert.equal(summary.totalTokens, 240);
  assert.equal(summary.reasoningTokensIncludedInOutput, 20);
  assert.deepEqual(summary.estimatedUsd, { min: 0.0008, max: 0.0008 });
});

test("incomplete billable responses retain usage and stop a broken conversation chain", async () => {
  let calls = 0;
  const results = await evaluateEnglishScenarios({ scenarios, reference, consecutive: true,
    createDirector: (onResponse) => async () => {
      calls++;
      onResponse({ ...event, status: "incomplete" });
      throw Object.assign(new Error("private provider detail"), { code: "INTERNAL_ERROR" });
    },
  });
  assert.equal(calls, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].errorCode, "INTERNAL_ERROR");
  assert.ok(!JSON.stringify(results).includes("private provider detail"));
  const summary = summarizeEnglishResults(results);
  assert.equal(summary.totalTokens, 120);
  assert.equal(summary.missingUsage, 0);
  assert.ok(summary.estimatedUsd);
});

test("a wrong draft action fails and missing usage is never reported as a zero cost", async () => {
  const results = await evaluateEnglishScenarios({ scenarios: [scenarios[0]], reference,
    createDirector: () => async () => ({ reply: "Prepared", image: { prompt: "Unexpected", aspectRatio: "1:1" } }),
  });
  assert.equal(results[0].actionPassed, false);
  assert.equal(summarizeEnglishResults(results).estimatedUsd, null);
  assert.equal(summarizeEnglishResults(results).missingUsage, 1);
});
