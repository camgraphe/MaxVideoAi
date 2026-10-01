import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDb } from "../frontend/src/lib/db";
import { getFalEngineById } from "../frontend/src/config/falEngines";
import type { AgentPublicGenerationEngine } from "../frontend/src/server/agent-api/model-catalog";
import {
  createImageConversationService,
  type ImageGenerationFactory,
} from "../frontend/src/server/studio/image-conversation-service";
import { createStudioImageGenerationService } from "../frontend/src/server/studio/image-generation-service";
import {
  createPaidGenerationTestSchema,
  startDisposablePostgres,
} from "./helpers/disposable-postgres";
import { addTopup, ProviderHarness } from "./helpers/mcp-paid-e2e-harness";

test("image chat persists its intent and exact quote, resumes safely and leaves confirmation to the client", async (t) => {
  const pg = await startDisposablePostgres("studio-chat-turns");
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(
    "CREATE TABLE studio_projects (id text PRIMARY KEY, user_id text NOT NULL, name text NOT NULL, deleted_at timestamptz)",
  );
  await pg.pool.query(
    "INSERT INTO studio_projects VALUES ('project-a','owner','First image',NULL), ('project-b','owner','Other',NULL), ('project-foreign','foreign','Private',NULL)",
  );
  await pg.pool.query(
    readFileSync("neon/migrations/50_studio_image_conversation.sql", "utf8"),
  );
  await addTopup(pg.pool, "owner", 10000);
  await pg.pool.query(readFileSync("neon/migrations/51_studio_image_model_usage.sql", "utf8"));
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
  const factory: ImageGenerationFactory = (actor, options) =>
    createStudioImageGenerationService(actor, {
      ...options,
      prepareDependencies: {
        listPublicEngines: async () => catalog,
        resolveRequestExecutability: () => ({
          executable: true,
          reason: "available",
        }),
      },
      confirmDependencies: {
        listPublicEngines: async () => catalog,
        resolveRequestExecutability: () => ({
          executable: true,
          reason: "available",
        }),
        submitPaidGeneration: provider.submit,
      },
    });
  const actor = {
    authMethod: "studio-session" as const,
    userId: "owner",
    projectId: "project-a",
    clientId: null,
  };
  let calls = 0;
  const director = async () => {
    calls++;
    return {
      reply: "Une direction lumineuse autour du bleu et de l’eau.",
      image: {
        prompt:
          "Cobalt blue perfume in natural sunlight, fine editorial photograph",
        aspectRatio: "1:1" as const,
      },
    };
  };
  const service = createImageConversationService(actor, {
    enabled: true,
    director,
    generationFactory: factory,
  });
  const input = {
    requestId: randomUUID(),
    message: "Crée une image de parfum bleue",
    references: [],
  };
  const turn = await service.submit(input);
  assert.equal(turn.state, "ready");
  assert.ok(turn.quote);
  assert.equal(calls, 1);
  assert.equal(provider.captures.length, 0);
  assert.deepEqual(await service.submit(input), turn);
  assert.equal(calls, 1);
  await assert.rejects(
    service.submit({ ...input, message: "Different request" }),
    { code: "PARAMETER_INVALID" },
  );
  const snapshot = await service.read();
  assert.equal(snapshot.turns.length, 1);
  assert.equal(snapshot.turns[0].quote?.quoteId, turn.quote.quoteId);
  await assert.rejects(
    service.confirm({
      requestId: randomUUID(),
      quoteId: turn.quote.quoteId,
      confirmed: true,
    }),
    { code: "QUOTE_EXPIRED" },
  );
  await assert.rejects(
    service.confirm({
      requestId: input.requestId,
      quoteId: turn.quote.quoteId,
      confirmed: true,
      userId: "foreign",
    }),
    /unrecognized/i,
  );
  const foreign = createImageConversationService(
    { ...actor, projectId: "project-foreign" },
    { enabled: true, director, generationFactory: factory },
  );
  await assert.rejects(foreign.submit({ ...input, requestId: randomUUID() }), {
    code: "PARAMETER_INVALID",
  });
  assert.equal(calls, 1);
  await Promise.all([
    service.confirm({
      requestId: input.requestId,
      quoteId: turn.quote.quoteId,
      confirmed: true,
    }),
    service.confirm({
      requestId: input.requestId,
      quoteId: turn.quote.quoteId,
      confirmed: true,
    }),
  ]);
  assert.equal(provider.captures.length, 1);
  assert.equal(
    (await service.read()).turns[0].generation?.jobId,
    turn.quote.quoteId,
  );
  // A crash/failure after the director checkpoint reuses the saved intent, with no extra model call.
  let fail = true;
  const failingFactory: ImageGenerationFactory = (current, options) => {
    const base = factory(current, options);
    return {
      ...base,
      prepare: async (request) => {
        if (fail) {
          fail = false;
          throw new Error("Simulated failure before quote commit");
        }
        return base.prepare(request);
      },
    };
  };
  const resumable = createImageConversationService(actor, {
    enabled: true,
    director,
    generationFactory: failingFactory,
  });
  const second = { ...input, requestId: randomUUID() };
  await assert.rejects(resumable.submit(second), /simulated/i);
  assert.equal(calls, 2);
  const resumed = await resumable.submit(second);
  assert.equal(resumed.state, "ready");
  assert.equal(calls, 2);
  assert.equal(provider.captures.length, 1);
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM mcp_generation_quotes",
      )
    ).rows[0].n,
    2,
  );
  await pg.pool
    .query(`CREATE TABLE job_outputs (id text PRIMARY KEY, job_id text, user_id text, status text, kind text, url text);
    CREATE TABLE media_assets (id text PRIMARY KEY, public_id text, user_id text, kind text, url text, mime_type text, size_bytes bigint, width int, height int, status text, deleted_at timestamptz, metadata jsonb, source_job_id text, source_output_id text, thumb_url text, preview_url text)`);
  const assetId = "ma_" + "a".repeat(32);
  await pg.pool.query(
    `INSERT INTO media_assets (id, public_id, user_id, kind, url, mime_type, size_bytes, width, height, status, metadata) VALUES ('asset-owned',$1,'owner','image','https://cdn.maxvideoai.com/first-reference.png','image/png',1024,1024,1024,'ready','{}')`,
    [assetId],
  );
  const withRef = await service.submit({
    ...input,
    requestId: randomUUID(),
    references: [assetId],
  });
  assert.equal(withRef.quote?.summary.mode, "i2i");
  assert.ok(withRef.quote);
  // New input supersedes the previously prepared approval, without spending.
  assert.equal(
    (
      await pg.pool.query(
        "SELECT state FROM mcp_generation_quotes WHERE quote_id = $1",
        [resumed.quote!.quoteId],
      )
    ).rows[0].state,
    "expired",
  );
  const callsBeforeForeign = calls;
  await assert.rejects(
    service.submit({
      ...input,
      requestId: randomUUID(),
      references: ["ma_" + "b".repeat(32)],
    }),
    { code: "REFERENCE_INVALID" },
  );
  assert.equal(calls, callsBeforeForeign);
  const referenceTurn = await service.submit({
    ...input,
    requestId: randomUUID(),
    references: [assetId],
  });
  assert.ok(referenceTurn.quote);
  await pg.pool.query(
    "UPDATE media_assets SET url = 'https://cdn.maxvideoai.com/changed-reference.png' WHERE public_id = $1",
    [assetId],
  );
  await assert.rejects(
    service.confirm({
      requestId: referenceTurn.requestId,
      quoteId: referenceTurn.quote.quoteId,
      confirmed: true,
    }),
    { code: "QUOTE_EXPIRED" },
  );
  assert.equal(provider.captures.length, 1);
  assert.equal(
    (await service.read()).turns.find(
      (turn) => turn.requestId === referenceTurn.requestId,
    )?.quote?.state,
    "expired",
  );
  await t.test(
    "draft references cannot drift while Sol is working or on retry",
    async () => {
      const delayed = createImageConversationService(actor, {
        enabled: true,
        generationFactory: factory,
        director: async (_input, _history, refs) => {
          assert.equal(
            refs[0].storageUrl,
            "https://cdn.maxvideoai.com/changed-reference.png",
          );
          await pg.pool.query(
            "UPDATE media_assets SET url = 'https://cdn.maxvideoai.com/during-director.png' WHERE public_id = $1",
            [assetId],
          );
          return director();
        },
      });
      const driftInput = {
        ...input,
        requestId: randomUUID(),
        references: [assetId],
      };
      await assert.rejects(delayed.submit(driftInput), {
        code: "REFERENCE_INVALID",
      });
      await assert.rejects(delayed.submit(driftInput), {
        code: "REFERENCE_INVALID",
      });
      const saved = (await service.read()).turns.find(
        (turn) => turn.requestId === driftInput.requestId,
      );
      assert.equal(saved?.quote, null);
      assert.equal(provider.captures.length, 1);
    },
  );
  await t.test(
    "resuming an older intent supersedes newer prepared approval",
    async () => {
      let failOnce = true;
      const broken: ImageGenerationFactory = (current, options) => {
        const base = factory(current, options);
        return {
          ...base,
          prepare: async (request) => {
            if (failOnce) {
              failOnce = false;
              throw new Error("before quote");
            }
            return base.prepare(request);
          },
        };
      };
      const old = createImageConversationService(actor, {
        enabled: true,
        director,
        generationFactory: broken,
      });
      const oldInput = { ...input, requestId: randomUUID() };
      await assert.rejects(old.submit(oldInput), /before quote/);
      const newer = await service.submit({ ...input, requestId: randomUUID() });
      assert.equal(newer.quote?.state, "prepared");
      await old.submit(oldInput);
      assert.equal(
        (await service.read()).turns.find(
          (turn) => turn.requestId === newer.requestId,
        )?.quote?.state,
        "expired",
      );
      await assert.rejects(
        service.confirm({
          requestId: newer.requestId,
          quoteId: newer.quote!.quoteId,
          confirmed: true,
        }),
        { code: "QUOTE_EXPIRED" },
      );
      assert.equal(provider.captures.length, 1);
    },
  );
  await t.test(
    "hiding a reference expires its unusable approval without spending",
    async () => {
      const hidden = await service.submit({
        ...input,
        requestId: randomUUID(),
        references: [assetId],
      });
      await pg.pool.query(
        "UPDATE media_assets SET deleted_at = now() WHERE public_id = $1",
        [assetId],
      );
      await assert.rejects(
        service.confirm({
          requestId: hidden.requestId,
          quoteId: hidden.quote!.quoteId,
          confirmed: true,
        }),
        { code: "REFERENCE_INVALID" },
      );
      assert.equal(
        (await service.read()).turns.find(
          (turn) => turn.requestId === hidden.requestId,
        )?.quote?.state,
        "expired",
      );
      assert.equal(provider.captures.length, 1);
    },
  );
});
