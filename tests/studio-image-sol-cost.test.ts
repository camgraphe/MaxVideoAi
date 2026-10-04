import assert from "node:assert/strict";
import test from "node:test";
import { estimateSolCost } from "../scripts/qa/studio-sol-cost";

test("uses response usage token buckets and does not add reasoning tokens twice", () => {
  const estimate = estimateSolCost(
    {
      input_tokens: 1_000,
      input_tokens_details: {
        cached_tokens: 200,
        cache_write_tokens: 100,
      },
      output_tokens: 400,
      output_tokens_details: { reasoning_tokens: 100 },
    },
    "standard",
    "gpt-6.1-sol",
  );

  assert.deepEqual(estimate, {
    minUsd: 0.00567,
    maxUsd: 0.00567,
    assumptions: [],
  });
});

test("ranges missing cache-write usage from ordinary input to cache writes", () => {
  const estimate = estimateSolCost(
    {
      input_tokens: 2_000,
      input_tokens_details: { cached_tokens: 500 },
      output_tokens: 100,
    },
    "default",
    "gpt-6.1-sol",
  );

  assert.deepEqual(estimate, {
    minUsd: 0.00405,
    maxUsd: 0.0048,
    assumptions: [
      "cache_write_tokens absent: min assumes zero cache writes; max assumes all non-cached input tokens were cache writes.",
    ],
  });
});

test("applies service-tier multipliers and preserves sub-cent precision", () => {
  const usage = {
    input_tokens: 1,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    output_tokens: 1,
  };
  assert.deepEqual(estimateSolCost(usage, "flex", "gpt-6.1-sol"), {
    minUsd: 0.000006,
    maxUsd: 0.000006,
    assumptions: [],
  });
  assert.equal(
    estimateSolCost(usage, "priority", "gpt-6.1-sol")?.minUsd,
    0.000024,
  );
});

test("uses long-context rates only when input exceeds 272,000 tokens", () => {
  const standardBoundary = estimateSolCost(
    {
      input_tokens: 272_000,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens: 1,
    },
    "standard",
    "gpt-6.1-sol",
  );
  assert.deepEqual(standardBoundary, {
    minUsd: 0.54401,
    maxUsd: 0.54401,
    assumptions: [],
  });

  const longContext = estimateSolCost(
    {
      input_tokens: 272_001,
      input_tokens_details: { cached_tokens: 1 },
      output_tokens: 2,
    },
    "standard",
    "gpt-6.1-sol",
  );
  assert.ok(longContext);
  assert.ok(Math.abs(longContext.minUsd - 1.0880302) < 1e-12);
  assert.ok(Math.abs(longContext.maxUsd - 1.3600302) < 1e-12);
  assert.deepEqual(longContext.assumptions, [
    "cache_write_tokens absent: min assumes zero cache writes; max assumes all non-cached input tokens were cache writes.",
  ]);
});

test("returns null for missing, malformed, or internally inconsistent usage", () => {
  for (const usage of [
    null,
    undefined,
    {},
    { input_tokens: -1, output_tokens: 0 },
    { input_tokens: 1.5, output_tokens: 0 },
    { input_tokens: Number.MAX_SAFE_INTEGER + 1, output_tokens: 0 },
    { input_tokens: 10, output_tokens: 0, input_tokens_details: { cached_tokens: 11 } },
    { input_tokens: 10, output_tokens: 0, input_tokens_details: { cache_write_tokens: -1 } },
    {
      input_tokens: 10,
      output_tokens: 0,
      input_tokens_details: { cached_tokens: 3, cache_write_tokens: 8 },
    },
  ]) {
    assert.equal(estimateSolCost(usage, "standard", "gpt-6.1-sol"), null);
  }
});

test("returns null for unknown service tiers and models", () => {
  const usage = {
    input_tokens: 1,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: 1,
  };
  for (const tier of ["", "auto", "scale", "toString", "__proto__", null, undefined]) {
    assert.equal(estimateSolCost(usage, tier, "gpt-6.1-sol"), null);
  }
  for (const model of ["gpt-6-sol", "gpt-6.1-sol-2026-10-01", null, undefined]) {
    assert.equal(estimateSolCost(usage, "standard", model), null);
  }
});
