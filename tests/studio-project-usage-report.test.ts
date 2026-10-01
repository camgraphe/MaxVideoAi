import assert from "node:assert/strict";
import test from "node:test";

test("project reporting counts every response once, including incomplete output, and keeps unknown attempts out of a total", async () => {
  const module = await import("../scripts/qa/studio-project-usage-report").catch(() => null);
  assert.ok(module?.summarizeProjectUsage, "A project cost report must preserve unknown costs and response identity");
  const usage = { input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 30 },
    output_tokens: 40, output_tokens_details: { reasoning_tokens: 10 }, total_tokens: 140 };
  const response = { responseId: "first", model: "gpt-6.1-sol", serviceTier: "default", status: "completed", usage };
  const attempts = [{ response }, { response }, { response: { ...response, responseId: "second", status: "incomplete" } }];
  const summary = module.summarizeProjectUsage(attempts);
  assert.equal(summary.uniqueResponses, 2);
  assert.equal(summary.duplicateResponses, 1);
  assert.equal(summary.knownTokens, 280);
  assert.equal(summary.reasoningTokensIncludedInOutput, 20);
  assert.ok(Math.abs(summary.estimatedTotalUsd.min - 0.001154) < 1e-10);
  assert.ok(Math.abs(summary.estimatedTotalUsd.max - 0.001154) < 1e-10);
  const incomplete = module.summarizeProjectUsage([...attempts, { response: null }]);
  assert.equal(incomplete.unknownAttempts, 1);
  assert.equal(incomplete.knownTokens, 280);
  assert.equal(incomplete.estimatedTotalUsd, null);
  assert.ok(incomplete.estimatedKnownUsd.min > 0);
  assert.equal(module.summarizeProjectUsage([]).estimatedTotalUsd, null);
  assert.equal(module.summarizeProjectUsage([{ response: { ...response, serviceTier: null } }]).estimatedTotalUsd, null);
});
