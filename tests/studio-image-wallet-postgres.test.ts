import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDb } from "../frontend/src/lib/db";
import { getFalEngineById } from "../frontend/src/config/falEngines";
import type { AgentPublicGenerationEngine } from "../frontend/src/server/agent-api/model-catalog";
import type { WalletSummary } from "../frontend/src/server/wallet-summary";
import { createStudioImageGenerationService } from "../frontend/src/server/studio/image-generation-service";
import {
  createImageConversationService,
  type ImageGenerationFactory,
} from "../frontend/src/server/studio/image-conversation-service";
import {
  createPaidGenerationTestSchema,
  startDisposablePostgres,
} from "./helpers/disposable-postgres";
import { addTopup, ProviderHarness } from "./helpers/mcp-paid-e2e-harness";

test("Studio image wallet insufficiency, retry, repeat confirmation, expiry, and quote scope", async (t) => {
  const pg = await startDisposablePostgres("studio-image-wallet");
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
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
  await pg.pool.query(readFileSync("neon/migrations/51_studio_image_model_usage.sql", "utf8"));

  const entry = getFalEngineById("gpt-image-2");
  assert.ok(entry);
  const catalog: AgentPublicGenerationEngine[] = [
    {
      engine: entry.engine,
      surface: "image",
      publicModes: ["t2i", "i2i"],
      modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
    },
  ];
  const provider = new ProviderHarness(pg.pool);
  const actor = {
    authMethod: "studio-session" as const,
    userId: "owner",
    projectId: "project-a",
    clientId: null,
  };
  const makeFactory = (
    prepareNow?: () => Date,
    getWalletSummary?: () => Promise<WalletSummary>,
  ): ImageGenerationFactory =>
    (currentActor, options) =>
      createStudioImageGenerationService(currentActor, {
        ...options,
        prepareDependencies: {
          ...(prepareNow ? { now: prepareNow } : {}),
          ...(getWalletSummary
            ? { getWalletSummary: async () => getWalletSummary() }
            : {}),
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
  let directorCalls = 0;
  const director = async () => {
    directorCalls++;
    return {
      reply: "Une image de parfum bleu cobalt, en lumière naturelle.",
      image: {
        prompt: "Cobalt blue perfume bottle in natural light",
        aspectRatio: "1:1" as const,
      },
    };
  };
  const service = createImageConversationService(actor, {
    enabled: true,
    director,
    generationFactory: makeFactory(),
  });
  const input = {
    requestId: randomUUID(),
    message: "Crée une image de parfum bleu cobalt",
    references: [],
  };

  const prepared = await service.submit(input);
  assert.equal(prepared.state, "ready");
  assert.equal(prepared.retryable, false);
  assert.equal(prepared.message, input.message);
  assert.equal(prepared.reply, "Une image de parfum bleu cobalt, en lumière naturelle.");
  assert.ok(prepared.quote);
  assert.equal(prepared.quote.state, "prepared");
  assert.equal(prepared.quote.confirmationRequired, true);
  assert.equal(prepared.quote.fundingMode, "wallet");
  assert.equal(prepared.quote.price.currency, "USD");
  assert.ok(prepared.quote.price.amountCents > 0);
  assert.ok("wallet" in prepared.quote);
  assert.deepEqual(prepared.quote.wallet, { amountCents: 0, currency: "USD" });
  assert.equal(prepared.quote.summary.prompt, "Cobalt blue perfume bottle in natural light");
  assert.equal(prepared.quote.summary.outputCount, 1);
  assert.equal(provider.captures.length, 0);
  assert.equal(directorCalls, 1);

  const [preparedQuote] = (
    await pg.pool.query<{ state: string; price_cents: number }>(
      "SELECT state, price_cents FROM mcp_generation_quotes WHERE quote_id = $1",
      [prepared.quote.quoteId],
    )
  ).rows;
  assert.deepEqual(preparedQuote, {
    state: "prepared",
    price_cents: prepared.quote.price.amountCents,
  });
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_jobs WHERE user_id = $1",
        [actor.userId],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_receipts WHERE user_id = $1 AND type = 'charge'",
        [actor.userId],
      )
    ).rows[0].n,
    0,
  );

  await assert.rejects(
    service.confirm({
      requestId: input.requestId,
      quoteId: prepared.quote.quoteId,
      confirmed: true,
    }),
    { code: "INSUFFICIENT_FUNDS" },
  );
  assert.equal(
    (
      await pg.pool.query(
        "SELECT state FROM mcp_generation_quotes WHERE quote_id = $1",
        [prepared.quote.quoteId],
      )
    ).rows[0].state,
    "prepared",
  );
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_jobs WHERE user_id = $1",
        [actor.userId],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_receipts WHERE user_id = $1 AND type = 'charge'",
        [actor.userId],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(provider.captures.length, 0);

  const otherProject = createStudioImageGenerationService(
    { ...actor, projectId: "project-b" },
    {
      enabled: true,
      confirmDependencies: {
        listPublicEngines: async () => catalog,
        submitPaidGeneration: provider.submit,
      },
    },
  );
  await assert.rejects(
    otherProject.confirm({ quoteId: prepared.quote.quoteId, confirmed: true }),
    { code: "QUOTE_EXPIRED" },
  );
  const foreignActor = createStudioImageGenerationService(
    {
      authMethod: "studio-session",
      userId: "foreign",
      projectId: "project-foreign",
      clientId: null,
    },
    {
      enabled: true,
      confirmDependencies: {
        listPublicEngines: async () => catalog,
        submitPaidGeneration: provider.submit,
      },
    },
  );
  await assert.rejects(
    foreignActor.confirm({ quoteId: prepared.quote.quoteId, confirmed: true }),
    { code: "QUOTE_EXPIRED" },
  );
  assert.equal(provider.captures.length, 0);

  await addTopup(pg.pool, actor.userId, prepared.quote.price.amountCents);
  const afterTopup = await service.read();
  const sameQuote = afterTopup.turns.find(
    (turn) => turn.requestId === input.requestId,
  )?.quote;
  assert.ok(sameQuote);
  assert.equal(sameQuote.quoteId, prepared.quote.quoteId);
  assert.equal(sameQuote.price.amountCents, prepared.quote.price.amountCents);
  assert.ok("wallet" in sameQuote);
  assert.deepEqual(sameQuote.wallet, {
    amountCents: prepared.quote.price.amountCents,
    currency: "USD",
  });
  assert.equal(directorCalls, 1);
  const confirmed = await service.confirm({
    requestId: input.requestId,
    quoteId: prepared.quote.quoteId,
    confirmed: true,
  });
  assert.equal(confirmed.jobId, prepared.quote.quoteId);
  const recovered = await service.confirm({
    requestId: input.requestId,
    quoteId: prepared.quote.quoteId,
    confirmed: true,
  });
  assert.equal(recovered.jobId, confirmed.jobId);
  assert.equal(provider.calls(prepared.quote.quoteId), 1);
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_jobs WHERE user_id = $1 AND job_id = $2",
        [actor.userId, prepared.quote.quoteId],
      )
    ).rows[0].n,
    1,
  );
  const [charge] = (
    await pg.pool.query<{ amount_cents: number; count: number }>(
      "SELECT amount_cents, COUNT(*) OVER ()::int AS count FROM app_receipts WHERE user_id = $1 AND type = 'charge' AND job_id = $2",
      [actor.userId, prepared.quote.quoteId],
    )
  ).rows;
  assert.deepEqual(charge, {
    amount_cents: prepared.quote.price.amountCents,
    count: 1,
  });

  let walletReads = 0;
  const unavailableWalletService = createImageConversationService(actor, {
    enabled: true,
    director,
    generationFactory: makeFactory(undefined, async () => {
      walletReads++;
      if (walletReads > 1) throw new Error("Simulated wallet read failure");
      return {
        balanceCents: 0,
        currency: "USD",
        pendingCents: 0,
        hasCompletedTopUp: false,
      };
    }),
  });
  const unavailableWalletInput = {
    ...input,
    requestId: randomUUID(),
    message: "Prépare une image même si le wallet ne répond pas",
  };
  const unavailableWalletTurn = await unavailableWalletService.submit(
    unavailableWalletInput,
  );
  assert.equal(unavailableWalletTurn.state, "ready");
  assert.ok(unavailableWalletTurn.quote);
  assert.equal(unavailableWalletTurn.quote.wallet, null);
  assert.equal(provider.captures.length, 1);
  assert.equal(directorCalls, 2);
  const readsBeforeRefresh = walletReads;
  const unavailableWalletRead = await unavailableWalletService.read();
  assert.ok(
    unavailableWalletRead.turns.some(
      (turn) =>
        turn.requestId === unavailableWalletInput.requestId &&
        turn.state === "ready" &&
        turn.quote?.wallet === null,
    ),
  );
  assert.equal(walletReads, readsBeforeRefresh + 1);
  assert.equal(provider.captures.length, 1);
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_receipts WHERE user_id = $1 AND type = 'charge'",
        [actor.userId],
      )
    ).rows[0].n,
    1,
  );

  const expiredService = createImageConversationService(actor, {
    enabled: true,
    director,
    generationFactory: makeFactory(() => new Date(Date.now() - 2 * 60 * 60 * 1000)),
  });
  const expiredInput = {
    ...input,
    requestId: randomUUID(),
    message: "Prépare une autre image, devis déjà expiré",
  };
  const expired = await expiredService.submit(expiredInput);
  assert.ok(expired.quote);
  assert.ok(Date.parse(expired.quote.expiresAt) < Date.now());
  assert.equal(expired.quote.state, "expired");
  await assert.rejects(
    expiredService.confirm({
      requestId: expiredInput.requestId,
      quoteId: expired.quote.quoteId,
      confirmed: true,
    }),
    { code: "QUOTE_EXPIRED" },
  );
  assert.equal(provider.captures.length, 1);
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_jobs WHERE user_id = $1",
        [actor.userId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pg.pool.query(
        "SELECT COUNT(*)::int AS n FROM app_receipts WHERE user_id = $1 AND type = 'charge'",
        [actor.userId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pg.pool.query(
        "SELECT state FROM mcp_generation_quotes WHERE quote_id = $1",
        [expired.quote.quoteId],
      )
    ).rows[0].state,
    "expired",
  );
});
