import assert from "node:assert/strict";
import test from "node:test";
import { getDb } from "../frontend/src/lib/db";
import { createStudioImageGenerationService } from "../frontend/src/server/studio/image-generation-service";
import {
  createPaidGenerationTestSchema,
  startDisposablePostgres,
} from "./helpers/disposable-postgres";
import {
  addTopup,
  ProviderHarness,
  createServices,
  principal,
} from "./helpers/mcp-paid-e2e-harness";
import { getFalEngineById } from "../frontend/src/config/falEngines";
import type { AgentPublicGenerationEngine } from "../frontend/src/server/agent-api/model-catalog";

test("Studio session prepares without spending, confirms once and recovers through the shared executor", async (t) => {
  const pg = await startDisposablePostgres("studio-first-image");
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await addTopup(pg.pool, "studio-owner", 10000);
  const entry = getFalEngineById("gpt-image-2");
  assert.ok(entry);
  const catalog: AgentPublicGenerationEngine[] = [
    {
      engine: entry.engine,
      surface: "image",
      publicModes: ["t2i", "i2i"],
      modeCaps: Object.fromEntries(entry.modes.map((m) => [m.mode, m.ui])),
    },
  ];
  const provider = new ProviderHarness(pg.pool);
  const options = {
    enabled: true,
    prepareDependencies: {
      listPublicEngines: async () => catalog,
      resolveRequestExecutability: () => ({
        executable: true as const,
        reason: "available" as const,
      }),
    },
    confirmDependencies: {
      listPublicEngines: async () => catalog,
      resolveRequestExecutability: () => ({
        executable: true as const,
        reason: "available" as const,
      }),
      submitPaidGeneration: provider.submit,
    },
  };
  const actor = {
    authMethod: "studio-session" as const,
    userId: "studio-owner",
    projectId: "project-a",
    clientId: null,
  };
  const studio = createStudioImageGenerationService(actor, options);
  const prepared = await studio.prepare({
    surface: "image",
    engineId: "gpt-image-2",
    mode: "t2i",
    prompt: "A cobalt blue perfume bottle in sunlight",
    settings: { resolution: "1024x1024", aspectRatio: "1:1", quality: "high" },
    outputCount: 1,
  });
  assert.equal(provider.captures.length, 0);
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_receipts WHERE type = 'charge'",
      )
    ).rows[0].n,
    0,
  );
  const oauth = createServices({
    publicEngines: catalog,
    submitPaidGeneration: provider.submit,
  });
  await assert.rejects(
    oauth.confirmGeneration!(
      { quoteId: prepared.quoteId, confirmed: true },
      { ...principal("studio-owner"), clientId: null },
    ),
    { code: "QUOTE_EXPIRED" },
  );
  await assert.rejects(
    createStudioImageGenerationService(
      { ...actor, projectId: "project-b" },
      options,
    ).confirm({ quoteId: prepared.quoteId, confirmed: true }),
    { code: "QUOTE_EXPIRED" },
  );
  const results = await Promise.all([
    studio.confirm({ quoteId: prepared.quoteId, confirmed: true }),
    studio.confirm({ quoteId: prepared.quoteId, confirmed: true }),
  ]);
  assert.ok(results.every((r) => r.jobId === prepared.quoteId));
  assert.equal(provider.captures.length, 1);
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_receipts WHERE type = 'charge' AND job_id = $1",
        [prepared.quoteId],
      )
    ).rows[0].n,
    1,
  );
  const recovered = await studio.recover(prepared.quoteId);
  assert.equal(recovered?.jobId, prepared.quoteId);
  assert.equal(provider.captures.length, 1);
  await assert.rejects(
    studio.prepare({
      surface: "image",
      engineId: "uncertified",
      mode: "t2i",
      prompt: "No",
    }),
    { code: "ENGINE_UNAVAILABLE" },
  );
  await assert.rejects(
    createStudioImageGenerationService(actor, {
      ...options,
      enabled: false,
    }).prepare({
      surface: "image",
      engineId: "gpt-image-2",
      mode: "t2i",
      prompt: "No",
    }),
    { code: "ENGINE_UNAVAILABLE" },
  );
});
