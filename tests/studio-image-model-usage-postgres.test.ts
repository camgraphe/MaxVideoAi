import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDb } from "../frontend/src/lib/db";
import { createImageConversationService } from "../frontend/src/server/studio/image-conversation-service";
import { createStudioImageDirector } from "../frontend/src/server/studio/image-conversation-director";
import { createPaidGenerationTestSchema, startDisposablePostgres } from "./helpers/disposable-postgres";

test("native usage survives replay, incomplete replies and unknown failures without crossing accounts", async (t) => {
  const module = await import("../frontend/src/server/studio/image-model-usage").catch(() => null);
  assert.ok(module?.listImageModelUsage, "Native conversation needs a durable, account-scoped usage owner");
  const pg = await startDisposablePostgres("studio-model-usage");
  const prior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (prior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query("CREATE TABLE studio_projects (id text PRIMARY KEY, user_id text NOT NULL, name text NOT NULL, deleted_at timestamptz)");
  await pg.pool.query("INSERT INTO studio_projects VALUES ('film','owner','Promo',NULL), ('other','owner','Other',NULL), ('private','foreign','Private',NULL)");
  for (const migration of ["50_studio_image_conversation.sql", "51_studio_image_model_usage.sql"])
    await pg.pool.query(readFileSync("neon/migrations/" + migration, "utf8"));
  const actor = { authMethod: "studio-session" as const, userId: "owner", projectId: "film", clientId: null };
  const usage = { input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 30 },
    output_tokens: 40, output_tokens_details: { reasoning_tokens: 10 }, total_tokens: 140 };
  let calls = 0;
  const service = createImageConversationService(actor, { enabled: true, director: createStudioImageDirector({
    createResponse: async () => {
      calls++;
      return { id: "resp-first", model: "gpt-6.1-sol", service_tier: "priority", status: "completed", usage,
        output_text: JSON.stringify({ reply: "Tell me your idea.", image: null }) };
    },
  }) });
  const input = { requestId: randomUUID(), message: "How does Studio work?", references: [] };
  await service.submit(input);
  await service.submit(input);
  await service.read();
  const saved = await module.listImageModelUsage(actor);
  assert.equal(calls, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].state, "reported");
  assert.equal(saved[0].requestId, input.requestId);
  assert.equal(saved[0].response?.responseId, "resp-first");
  assert.equal(saved[0].response?.serviceTier, "priority");
  assert.equal(saved[0].response?.model, "gpt-6.1-sol");
  assert.deepEqual(saved[0].response?.usage, usage);
  assert.ok(!JSON.stringify(saved).includes("How does Studio work"));
  assert.ok(!JSON.stringify(await service.read()).includes("input_tokens"));
  assert.deepEqual(await module.listImageModelUsage({ ...actor, projectId: "other" }), []);
  assert.deepEqual(await module.listImageModelUsage({ ...actor, userId: "foreign" }), []);

  let incompleteCalls = 0;
  const incomplete = createImageConversationService(actor, { enabled: true, director: createStudioImageDirector({
    createResponse: async () => {
      incompleteCalls++;
      return { id: "resp-incomplete-" + incompleteCalls, model: "gpt-6.1-sol", service_tier: "default",
        status: "incomplete", usage, output_text: "" };
    },
  }) });
  const failedInput = { ...input, requestId: randomUUID() };
  await assert.rejects(incomplete.submit(failedInput), { code: "INTERNAL_ERROR" });
  await assert.rejects(incomplete.submit(failedInput), { code: "INTERNAL_ERROR" });
  await assert.rejects(incomplete.submit(failedInput), { code: "RATE_LIMITED" });
  const failed = (await module.listImageModelUsage(actor)).filter((entry) => entry.requestId === failedInput.requestId);
  assert.equal(failed.length, 2);
  assert.ok(failed.every((entry) => entry.response?.status === "incomplete"));
  assert.ok(failed.every((entry) => entry.response?.usage?.total_tokens === 140));

  const timeout = createImageConversationService(actor, { enabled: true, director: createStudioImageDirector({
    createResponse: async () => { throw new Error("private provider credentials"); },
  }) });
  const timeoutInput = { ...input, requestId: randomUUID() };
  await assert.rejects(timeout.submit(timeoutInput), { code: "INTERNAL_ERROR" });
  const unknown = (await module.listImageModelUsage(actor)).find((entry) => entry.requestId === timeoutInput.requestId);
  assert.equal(unknown?.state, "unknown");
  assert.equal(unknown?.response, null);
  assert.ok(!JSON.stringify(unknown).includes("credentials"));
  await pg.pool.query("DELETE FROM studio_projects WHERE id = 'film'");
  assert.deepEqual(await module.listImageModelUsage(actor), []);
});
