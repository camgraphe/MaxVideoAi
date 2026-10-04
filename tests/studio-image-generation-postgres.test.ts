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

test("Flare reference edits keep the prepared snapshot through Studio and MCP confirmation", async (t) => {
  const pg = await startDisposablePostgres("studio-flare-edit");
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await addTopup(pg.pool, "flare-owner", 10000);
  await pg.pool.query("CREATE TABLE job_outputs (id text PRIMARY KEY, job_id text, user_id text, status text, kind text, url text)");
  await pg.pool.query(`CREATE TABLE media_assets (
    id text PRIMARY KEY, public_id text, user_id text, kind text, url text,
    mime_type text, size_bytes bigint, width int, height int, status text,
    deleted_at timestamptz, metadata jsonb, source_job_id text,
    source_output_id text, thumb_url text, preview_url text)`);
  const assetId = "ma_11111111111111111111111111111111";
  await pg.pool.query(`INSERT INTO media_assets
    (id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
    VALUES ('owned-flare',$1,'flare-owner','image','https://cdn.maxvideoai.com/owned-reference.png',
    'image/png',1024,1024,1024,'ready','{}')`, [assetId]);
  const entry = getFalEngineById("gpt-image-2-5-flare");
  assert.ok(entry);
  const catalog: AgentPublicGenerationEngine[] = [{
    engine: entry.engine, surface: "image", publicModes: ["t2i", "i2i"],
    modeCaps: Object.fromEntries(entry.modes.map(m => [m.mode, m.ui])),
  }];
  const provider = new ProviderHarness(pg.pool);
  const availability = () => ({ executable: true as const, reason: "available" as const });
  const studio = createStudioImageGenerationService({
    authMethod: "studio-session", userId: "flare-owner", projectId: "flare-project", clientId: null,
  }, {
    enabled: true,
    prepareDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: availability },
    confirmDependencies: {
      listPublicEngines: async () => catalog, resolveRequestExecutability: availability,
      submitPaidGeneration: provider.submit,
    },
  });
  const mcp = createServices({publicEngines: catalog, submitPaidGeneration: provider.submit});
  const request = {
    surface: "image" as const, engineId: entry.id, mode: "i2i" as const,
    prompt: "Keep the subject and give it a warmer editorial setting.",
    settings: {resolution: "landscape_16_9", aspectRatio: "16:9", quality: "high", outputFormat: "png"},
    outputCount: 1,
  };
  for (const transport of ["studio", "mcp"]) {
    await t.test(transport, async () => {
      const prepared = transport === "studio"
        ? await studio.prepare({...request, references: [{kind: "asset", role: "reference", assetId}]})
        : await mcp.prepareGeneration!({...request, references: [{
            kind: "https", role: "reference", mediaKind: "image",
            url: "https://cdn.maxvideoai.com/owned-reference.png",
          }]}, principal("flare-owner"));
      const before = await pg.pool.query("SELECT COUNT(*)::int AS n FROM app_receipts WHERE job_id=$1 AND type='charge'", [prepared.quoteId]);
      assert.equal(before.rows[0].n, 0);
      const input = {quoteId: prepared.quoteId, confirmed: true as const};
      const results = transport === "studio"
        ? await Promise.all([studio.confirm(input), studio.confirm(input)])
        : await Promise.all([
            mcp.confirmGeneration!(input, principal("flare-owner")),
            mcp.confirmGeneration!(input, principal("flare-owner")),
          ]);
      assert.ok(results.every(result => result.jobId === prepared.quoteId));
      const receipts = await pg.pool.query("SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'", [prepared.quoteId]);
      assert.deepEqual(receipts.rows.map(row => row.amount_cents), [prepared.price.amountCents]);
      assert.equal(provider.captures.filter(call => call.quoteId === prepared.quoteId).length, 1);
    });
  }
});


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
