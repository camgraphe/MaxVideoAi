import assert from "node:assert/strict";
import test from "node:test";
import { getFalEngineById } from "../frontend/src/config/falEngines";
import { compareGenerationPrices } from "../frontend/src/server/agent-api/generation-price-comparison";
import type { GenerationPricingReadDependencies } from "../frontend/src/server/agent-api/generation-pricing-read";
import type { AgentPublicGenerationEngine } from "../frontend/src/server/agent-api/model-catalog";

const actor = {
  authMethod: "studio-session" as const,
  userId: "owner",
  projectId: "project",
  clientId: null,
};
const membership = {
  tier: "member" as const,
  source: "app_receipts_rolling_30d" as const,
  spent30Cents: 0,
  thresholdCents: 0,
  discountPercent: 0,
};
function candidate(id: string): AgentPublicGenerationEngine {
  const entry = getFalEngineById(id)!;
  return {
    engine: entry.engine,
    surface: "video",
    publicModes: entry.engine.modes,
    modeCaps: Object.fromEntries(
      entry.modes.map((mode) => [mode.mode, mode.ui]),
    ),
  };
}
const ids = [
  "minimax-h3",
  "minimax-h3-max",
  "wan-3",
  "wan-3-prime",
  "seedance-2-5",
];

test('a bounded whole-film mismatch keeps the longest component durations visible instead of the first short models only',async()=>{
  const choices=['ltx-2-5-pro','veo-3-1','veo-3-1-fast','veo-3-1-lite','kling-3-pro','kling-3-standard','kling-o3-pro','kling-o3-standard','seedance-2-5','wan-3','ltx-2-5-fast'];
  await assert.rejects(compareGenerationPrices({surface:'video',mode:'t2v',prompt:'A full one-minute film',settings:{durationSec:60},references:[],candidateModelIds:choices},actor,dependencies({listPublicEngines:async()=>choices.map(candidate)})),(error:any)=>{
    const diagnostic=error.nextAction;
    assert.equal(diagnostic.durationMismatch,true);assert.equal(diagnostic.modelsTruncated,true);assert.equal(diagnostic.models.length,8);
    assert.ok(diagnostic.models.some((model:any)=>model.modelId==='seedance-2-5'&&model.duration.options.includes(30)));
    assert.ok(diagnostic.models.some((model:any)=>model.modelId==='ltx-2-5-fast'&&model.duration.options.includes(20)));
    return true;
  });
});
const prices: Record<string, number> = {
  "minimax-h3": 94,
  "minimax-h3-max": 125,
  "wan-3": 156,
  "wan-3-prime": 219,
  "seedance-2-5": 694,
};
function dependencies(
  overrides: Partial<GenerationPricingReadDependencies> = {},
): GenerationPricingReadDependencies {
  return {
    listPublicEngines: async () => ids.map(candidate),
    resolveMembershipPricing: async () => membership,
    resolveRequestExecutability: () => ({
      executable: true,
      reason: "available",
    }),
    priceGeneration: async (request, tier) => ({
      priceCents: prices[request.engineId],
      currency: "USD",
      membershipTier: tier,
      pricingSnapshot: {
        totalCents: prices[request.engineId],
        currency: "USD",
        membershipTier: tier,
      },
    }),
    ...overrides,
  };
}
const input = {
  surface: "video" as const,
  mode: "t2v" as const,
  prompt: "A puppet sings and waves her arms",
  settings: { durationSec: 12 },
  references: [],
};

test("a one-minute single-output comparison reports live clip durations without pricing a shorter substitute", async () => {
  let priced = 0;
  await assert.rejects(compareGenerationPrices(
    { ...input, settings: { durationSec: 60, audio: true } }, actor,
    dependencies({listPublicEngines: async () => [candidate('ltx-2-5-pro')],
      priceGeneration: async () => { priced++; throw new Error('Unsupported duration must not be priced.'); }}),
  ), error => {
    const failure = error as {code: string; message: string; nextAction: Record<string, any>};
    assert.equal(failure.code, 'PARAMETER_INVALID');
    assert.equal(failure.nextAction?.type, 'generation_comparison');
    assert.equal(failure.nextAction?.reason, 'no_matching_scenario');
    assert.equal(failure.nextAction?.requestedDurationSec, 60);
    assert.equal(failure.nextAction?.durationMismatch, true);
    assert.equal(failure.nextAction?.models[0].modelId, 'ltx-2-5-pro');
    assert.equal(failure.nextAction?.models[0].mode, 't2v');
    assert.equal(failure.nextAction?.models[0].durationPolicy, 'requested');
    assert.deepEqual(failure.nextAction?.models[0].duration, {options: [6, 8, 10], range: null});
    assert.equal(failure.nextAction?.models[0].audio, 'optional');
    assert.deepEqual(failure.nextAction?.models[0].resolutions, ['720p', '1080p']);
    assert.match(failure.message, /single|one.*clip/i);
    assert.match(failure.message, /60/);
    assert.doesNotMatch(JSON.stringify(failure.nextAction), /"(?:prompt|quoteId|price|wallet|storageUrl)"/);
    return true;
  });
  assert.equal(priced, 0);
});

test("a sound mismatch is not diagnosed as an unsupported duration", async () => {
  await assert.rejects(compareGenerationPrices(
    {...input, settings: {durationSec: 12, audio: false}, candidateModelIds: ['minimax-h3']}, actor, dependencies(),
  ), error => {
    const failure = error as {nextAction: Record<string, any>};
    assert.equal(failure.nextAction?.durationMismatch, false);
    assert.equal(failure.nextAction?.models[0].audio, 'always_generated');
    return true;
  });
});

test("comparison offers three distinct current prices, preserves a repriced baseline and creates no quote", async () => {
  const result = await compareGenerationPrices(
    { ...input, baselineModelId: "seedance-2-5" },
    actor,
    dependencies(),
  );
  assert.equal(result.options.length, 3);
  assert.equal(
    new Set(result.options.map((option) => option.price.amountCents)).size,
    3,
  );
  assert.equal(result.options[0].modelId, "minimax-h3");
  assert.equal(result.baseline?.price.amountCents, 694);
  assert.equal(result.options[0].savings?.amountCents, 600);
  assert.equal(
    result.options[0].savings?.configurationDiffers,
    true,
    "768P and 720p are disclosed as different presets",
  );
  assert.equal(result.quoteRequired, true);
  assert.doesNotMatch(
    JSON.stringify(result),
    /"(?:quoteId|balance|providerCost|pricingSnapshot|storageUrl)"/,
  );
  const updated = await compareGenerationPrices(
    { ...input, baselineModelId: "seedance-2-5" },
    actor,
    dependencies({
      priceGeneration: async (request, tier) => {
        const amount =
          request.engineId === "seedance-2-5" ? 800 : prices[request.engineId];
        return {
          priceCents: amount,
          currency: "USD",
          membershipTier: tier,
          pricingSnapshot: {
            totalCents: amount,
            currency: "USD",
            membershipTier: tier,
          },
        };
      },
    }),
  );
  assert.equal(updated.options[0].savings?.amountCents, 706);
});

test("explicit resolution, audio and duration constraints filter before shortlisting, never relax to get three", async () => {
  const result = await compareGenerationPrices(
    {
      ...input,
      settings: { durationSec: 12, resolution: "720p", audio: true },
    },
    actor,
    dependencies(),
  );
  assert.ok(result.options.length > 0);
  assert.ok(
    result.options.every(
      (option) =>
        option.settings.resolution === "720p" &&
        option.settings.durationSec === 12,
    ),
  );
  assert.ok(
    result.options.every((option) => !option.modelId.startsWith("minimax")),
  );
  const few = await compareGenerationPrices(
    {
      ...input,
      candidateModelIds: ["wan-3", "minimax-h3"],
      settings: { durationSec: 12, resolution: "720p" },
    },
    actor,
    dependencies(),
  );
  assert.deepEqual(
    few.options.map((option) => option.modelId),
    ["wan-3"],
  );
  await assert.rejects(
    compareGenerationPrices(
      { ...input, settings: { durationSec: 1000 } },
      actor,
      dependencies(),
    ),
    { code: "PARAMETER_INVALID" },
  );
});

test("always-generated audio satisfies sound requirement but cannot satisfy a silent requirement", async () => {
  const withSound = await compareGenerationPrices(
    {
      ...input,
      candidateModelIds: ["minimax-h3"],
      settings: { durationSec: 12, audio: true },
    },
    actor,
    dependencies(),
  );
  assert.equal(withSound.options[0].audio, "always_generated");
  assert.equal(
    withSound.options[0].settings.audio,
    undefined,
    "fixed audio has no invented toggle",
  );
  await assert.rejects(
    compareGenerationPrices(
      {
        ...input,
        candidateModelIds: ["minimax-h3"],
        settings: { durationSec: 12, audio: false },
      },
      actor,
      dependencies(),
    ),
    { code: "PARAMETER_INVALID" },
  );
});

test("reference combinations and metadata are checked by canonical validation before pricing", async () => {
  const references = [
    { kind: "asset" as const, assetId: "image", role: "reference" as const },
    { kind: "asset" as const, assetId: "sound", role: "reference" as const },
  ];
  let priced = 0;
  const result = await compareGenerationPrices(
    { ...input, mode: "ref2v", references },
    actor,
    dependencies({
      resolveGenerationReferences: async () => [
        {
          assetId: "image",
          mediaKind: "image",
          role: "reference",
          storageUrl: "https://owned.example/image.png",
          mimeType: "image/png",
          width: 1072,
          height: 1959,
        },
        {
          assetId: "sound",
          mediaKind: "audio",
          role: "reference",
          storageUrl: "https://owned.example/sound.mp3",
          mimeType: "audio/mpeg",
          durationSec: 10,
        },
      ],
      priceGeneration: async (request, tier) => {
        priced++;
        assert.ok(
          ["wan-3", "wan-3-prime", "seedance-2-5"].includes(request.engineId),
        );
        return {
          priceCents: prices[request.engineId],
          currency: "USD",
          membershipTier: tier,
          pricingSnapshot: {
            totalCents: prices[request.engineId],
            currency: "USD",
            membershipTier: tier,
          },
        };
      },
    }),
  );
  assert.ok(result.options.length > 0);
  assert.ok(result.options.every((option) => option.referenceCount === 2));
  assert.ok(priced > 0);
});

test("unavailable or malformed prices never become cheap options; missing baseline yields no savings", async () => {
  const result = await compareGenerationPrices(
    { ...input, baselineModelId: "seedance-2-5" },
    actor,
    dependencies({
      resolveRequestExecutability: (request) => ({
        executable: request.engineId !== "seedance-2-5",
        reason: "available",
      }),
      priceGeneration: async (request, tier) => ({
        priceCents: prices[request.engineId],
        currency: "USD",
        membershipTier: tier,
        pricingSnapshot: {
          totalCents:
            request.engineId === "minimax-h3" ? 0 : prices[request.engineId],
          currency: "USD",
          membershipTier: tier,
        },
      }),
    }),
  );
  assert.equal(result.baseline, null);
  assert.ok(
    result.options.every(
      (option) => option.modelId !== "minimax-h3" && !option.savings,
    ),
  );
  assert.ok(
    result.unavailable.some((option) => option.modelId === "seedance-2-5"),
  );
});

test("a different resolution on the same model compares against freshly repriced original settings", async () => {
  const result = await compareGenerationPrices(
    {
      ...input,
      baselineModelId: "wan-3",
      candidateModelIds: ["wan-3"],
      settings: { durationSec: 12, resolution: "480p", audio: true },
      baselineSettings: { durationSec: 12, resolution: "720p", audio: true },
    },
    actor,
    dependencies({
      priceGeneration: async (request, tier) => {
        const amount = request.settings.resolution === "720p" ? 800 : 450;
        return {
          priceCents: amount,
          currency: "USD",
          membershipTier: tier,
          pricingSnapshot: {
            totalCents: amount,
            currency: "USD",
            membershipTier: tier,
          },
        };
      },
    }),
  );
  assert.equal(result.options.length, 1);
  assert.equal(result.options[0].price.amountCents, 450);
  assert.equal(result.baseline?.price.amountCents, 800);
  assert.equal(result.baseline?.settings.resolution, "720p");
  assert.equal(result.options[0].savings?.amountCents, 350);
  assert.equal(result.options[0].savings?.configurationDiffers, true);
});

test("shortlisting keeps three distinct prices even when the baseline is cheapest and variants share a price", async () => {
  const amounts = [10, 20, 20, 100, 200];
  const result = await compareGenerationPrices(
    { ...input, baselineModelId: ids[0] },
    actor,
    dependencies({
      priceGeneration: async (request, tier) => {
        const amount = amounts[ids.indexOf(request.engineId)];
        return {
          priceCents: amount,
          currency: "USD",
          membershipTier: tier,
          pricingSnapshot: {
            totalCents: amount,
            currency: "USD",
            membershipTier: tier,
          },
        };
      },
    }),
  );
  assert.equal(result.options.length, 3);
  assert.equal(
    new Set(result.options.map((option) => option.price.amountCents)).size,
    3,
  );
});

test("a baseline sharing the cheapest price occupies one option and leaves room for two different prices", async () => {
  const amounts = [10, 10, 20, 100, 200];
  const result = await compareGenerationPrices(
    { ...input, baselineModelId: ids[1] },
    actor,
    dependencies({
      priceGeneration: async (request, tier) => {
        const amount = amounts[ids.indexOf(request.engineId)];
        return {
          priceCents: amount,
          currency: "USD",
          membershipTier: tier,
          pricingSnapshot: {
            totalCents: amount,
            currency: "USD",
            membershipTier: tier,
          },
        };
      },
    }),
  );
  assert.equal(result.options.length, 3);
  assert.equal(
    new Set(result.options.map((option) => option.price.amountCents)).size,
    3,
  );
  assert.ok(result.options.some((option) => option.modelId === ids[1]));
});

test("source-derived video comparison reports canonical fractional output timing, never the rounded request", async () => {
  const result = await compareGenerationPrices(
    {
      surface: "video",
      mode: "v2v",
      prompt: "Keep the supplied action",
      settings: { durationSec: 4, resolution: "720p", audio: true },
      references: [{ kind: "asset", assetId: "source", role: "source" }],
      candidateModelIds: ["gemini-omni-flash"],
    },
    actor,
    dependencies({
      listPublicEngines: async () => [candidate("gemini-omni-flash")],
      resolveGenerationReferences: async () => [
        {
          assetId: "source",
          role: "source",
          mediaKind: "video",
          storageUrl: "https://owned.example/source.mp4",
          mimeType: "video/mp4",
          width: 1920,
          height: 1080,
          durationSec: 3.25,
        },
      ],
      priceGeneration: async (_request, tier) => ({
        priceCents: 48,
        currency: "USD",
        membershipTier: tier,
        pricingSnapshot: {
          totalCents: 48,
          currency: "USD",
          membershipTier: tier,
          meta: { output_duration_sec: 3.25 },
        },
      }),
    }),
  );
  assert.equal(result.options[0].settings.durationSec, 4);
  assert.equal(result.options[0].outputDurationSec, 3.25);
});

test("different currencies cannot displace the cheapest comparable alternative or produce cross-currency savings", async () => {
  const result = await compareGenerationPrices(
    { ...input, baselineModelId: "seedance-2-5" },
    actor,
    dependencies({
      priceGeneration: async (request, tier) => {
        const amount = prices[request.engineId],
          currency = request.engineId === "minimax-h3-max" ? "EUR" : "USD";
        return {
          priceCents: amount,
          currency,
          membershipTier: tier,
          pricingSnapshot: {
            totalCents: amount,
            currency,
            membershipTier: tier,
          },
        };
      },
    }),
  );
  assert.equal(result.comparisonCurrency, "USD");
  assert.ok(result.options.every((option) => option.price.currency === "USD"));
  assert.equal(result.options[0].modelId, "minimax-h3");
  assert.ok(
    result.excludedCurrencies?.some(
      (option) =>
        option.modelId === "minimax-h3-max" && option.currency === "EUR",
    ),
  );
});
