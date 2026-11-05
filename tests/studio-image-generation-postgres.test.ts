import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
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

for (const scenario of [
  { engineId: 'gpt-image-2-5-flare', mode: 'i2i' },
  ...['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst'].flatMap(engineId =>
    ['t2i', 'i2i'].map(mode => ({ engineId, mode }))),
]) test(`${scenario.engineId}/${scenario.mode} keeps the prepared snapshot through Studio and MCP confirmation`, async (t) => {
  const pg = await startDisposablePostgres("studio-flare-edit");
  const previous = process.env.DATABASE_URL;
  const previousPricing = { NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  const gpt26 = scenario.engineId.startsWith('gpt-image-2-6-');
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    for (const [key, value] of Object.entries(previousPricing)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  if (gpt26) {
    Object.assign(process.env, { NODE_ENV: 'development', PRICING_SANDBOX: '1' });
    await pg.pool.query('CREATE TABLE app_pricing_change_events(domain text)');
    for (const file of ['54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql'])
      await pg.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    const folder = 'docs/launch/2026-11-05-model-refresh/gpt26-tariffs/';
    const approval = JSON.parse(readFileSync(folder + 'approval.json', 'utf8'));
    const selected = approval.batches.flatMap((batch: { file: string }) =>
      JSON.parse(readFileSync(folder + batch.file, 'utf8')).selections).find((row: { selector: Record<string, string> }) =>
      row.selector.engineId === scenario.engineId && row.selector.mode === scenario.mode &&
      row.selector.resolution === '1024x1024' && row.selector.durationSec === '1' && row.selector.quality === 'high' &&
      (scenario.mode === 't2i' || row.selector.referenceImageCount === '1'));
    assert.ok(selected, 'The native flow must use the reviewed exact customer price');
    await pg.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES('reviewed-workflow-price',$1,$2,$3,'USD','2026-11-01',1,'11111111-1111-4111-8111-111111111111')`,
    [JSON.stringify(Object.entries(selected.selector).sort(([a], [b]) => a.localeCompare(b))), selected.selector, selected.price]);
    await pg.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
  }
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
  const entry = getFalEngineById(scenario.engineId);
  assert.ok(entry);
  assert.equal(entry.surfaces.app.enabled, true, 'Exercise the actual functional opening candidate');
  const catalog: AgentPublicGenerationEngine[] = [{
    engine: entry.engine, surface: "image", publicModes: ["t2i", "i2i"],
    modeCaps: Object.fromEntries(entry.modes.map(m => [m.mode, m.ui])),
  }];
  const provider = new ProviderHarness(pg.pool);
  let prepareTime: Date | undefined;
  const prepareNow = () => prepareTime ?? new Date();
  const availability = () => ({ executable: true as const, reason: "available" as const });
  const studio = createStudioImageGenerationService({
    authMethod: "studio-session", userId: "flare-owner", projectId: "flare-project", clientId: null,
  }, {
    enabled: true,
    prepareDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: availability, now: prepareNow },
    confirmDependencies: {
      listPublicEngines: async () => catalog, resolveRequestExecutability: availability,
      submitPaidGeneration: provider.submit,
    },
  });
  const mcp = createServices({publicEngines: catalog, submitPaidGeneration: provider.submit, prepareNow});
  const request = {
    surface: "image" as const, engineId: entry.id, mode: scenario.mode as 't2i' | 'i2i',
    prompt: "Keep the subject and give it a warmer editorial setting.",
    settings: gpt26 ? { resolution: '1024x1024', quality: 'high', complexity: 'high', outputFormat: 'png' }
      : {resolution: "landscape_16_9", aspectRatio: "16:9", quality: "high", outputFormat: "png"},
    outputCount: 1,
  };
  for (const transport of ["studio", "mcp"]) {
    await t.test(transport, async () => {
      const prepared = transport === "studio"
        ? await studio.prepare({...request, references: scenario.mode === 't2i' ? [] : [{kind: "asset", role: "reference", assetId}]})
        : await mcp.prepareGeneration!({...request, references: scenario.mode === 't2i' ? [] : gpt26
          ? [{kind: 'asset', role: 'reference', assetId}] : [{
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
      const capture = provider.captures.find(call => call.quoteId === prepared.quoteId)!;
      assert.equal(capture.body.engineId, scenario.engineId);
      if (gpt26) {
        assert.equal(prepared.price.amountCents, scenario.mode === 't2i' ? 10 : 13);
        assert.equal(capture.body.complexity, 'high');
        const stored = (await pg.pool.query('SELECT settings_snapshot,pricing_snapshot FROM app_jobs WHERE job_id=$1', [prepared.quoteId])).rows[0];
        assert.equal(stored.settings_snapshot.engineId, scenario.engineId);
        assert.equal(stored.settings_snapshot.settings.complexity, 'high');
        assert.equal(stored.pricing_snapshot.meta.providerCostIncomplete, true);
        const recovered = transport === 'studio' ? await studio.recover(prepared.quoteId)
          : await mcp.getGenerationStatus!({jobId: prepared.quoteId}, principal('flare-owner'));
        assert.equal(recovered?.jobId, prepared.quoteId);
        assert.equal(provider.captures.filter(call => call.quoteId === prepared.quoteId).length, 1, 'Recovery must not dispatch again');
        prepareTime = new Date(Date.now() - 46 * 60_000);
        const stale = transport === 'studio' ? await studio.prepare({...request, references: scenario.mode === 't2i' ? [] : [{kind: 'asset', role: 'reference', assetId}]})
          : await mcp.prepareGeneration!({...request, references: scenario.mode === 't2i' ? [] : [{kind: 'asset', role: 'reference', assetId}]}, principal('flare-owner'));
        prepareTime = undefined;
        await assert.rejects(transport === 'studio' ? studio.confirm({quoteId: stale.quoteId, confirmed: true})
          : mcp.confirmGeneration!({quoteId: stale.quoteId, confirmed: true}, principal('flare-owner')), {code: 'QUOTE_EXPIRED'});
        assert.equal(provider.captures.some(call => call.quoteId === stale.quoteId), false);
      }
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
