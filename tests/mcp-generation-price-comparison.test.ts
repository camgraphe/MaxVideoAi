import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from "../frontend/src/server/mcp/server";
import { compareGenerationPricesInputSchema } from "../frontend/src/server/mcp/tools/compare-generation-prices";

test("MCP comparison rejects price/actor injection and unsaved URL references", () => {
  const input = {
    surface: "video",
    mode: "i2v",
    prompt: "Animate the puppet",
    settings: { durationSec: 12, audio: true },
    references: [{ kind: "asset", assetId: "image", role: "first_frame" }],
  };
  assert.equal(
    compareGenerationPricesInputSchema.safeParse(input).success,
    true,
  );
  for (const extra of [
    { userId: "other" },
    { confirmed: true },
    { quoteId: "forged" },
    { priceCents: 1 },
  ])
    assert.equal(
      compareGenerationPricesInputSchema.safeParse({ ...input, ...extra })
        .success,
      false,
    );
  assert.equal(
    compareGenerationPricesInputSchema.safeParse({
      ...input,
      references: [
        {
          kind: "https",
          url: "https://host.example/private.png",
          role: "first_frame",
          mediaKind: "image",
        },
      ],
    }).success,
    false,
  );
});

test("MCP comparison is read only, calls the authorized shared service and preserves complete result text", async () => {
  const principal = {
    authMethod: "oauth" as const,
    userId: "owner",
    clientId: "client",
    emailVerified: true,
  };
  let calls = 0;
  const comparison = {
    options: [],
    baseline: null,
    unavailable: [],
    estimatedAt: "2026-10-08T20:00:00Z",
    quoteRequired: true as const,
  };
  const services = {
    getAccountStatus: async () => {
      throw new Error("No wallet read");
    },
    listModels: async () => [],
    getModelDetails: async () => {
      throw new Error("unused");
    },
    recommendModels: async () => ({
      recommendations: [],
      nextAction: "clarify_requirements" as const,
    }),
    compareGenerationPrices: async (input, actor) => {
      calls++;
      assert.equal(actor, principal);
      assert.deepEqual(input.settings, { durationSec: 12, audio: true });
      assert.deepEqual(input.references, []);
      assert.equal(input.baselineModelId, undefined);
      return comparison;
    },
  } satisfies MaxVideoAiMcpServices;
  const server = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: false,
    referenceUploads: false,
    montagePreparation: false,
    studioMontageCreation: false,
    studioTimelineEditing: false,
    studioExports: false,
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({
    name: "price-comparison-contract",
    version: "1",
  });
  await client.connect(clientTransport);
  try {
    const descriptor = (await client.listTools()).tools.find(
      (tool) => tool.name === "compare_generation_prices",
    )!;
    assert.equal(descriptor.annotations?.readOnlyHint, true);
    assert.match(
      descriptor.description ?? "",
      /three.*compatible|compatible.*three/i,
    );
    const result = await client.callTool({
      name: "compare_generation_prices",
      arguments: {
        surface: "video",
        mode: "t2v",
        prompt: "A puppet sings",
        settings: { durationSec: 12, audio: true, resolution: null },
      },
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, comparison);
    const text = (result.content as { type: string; text?: string }[]).find(
      (item) => item.type === "text",
    )!.text!;
    assert.deepEqual(JSON.parse(text), comparison);
    assert.equal(calls, 1);
  } finally {
    await client.close();
    await server.close();
  }
});
