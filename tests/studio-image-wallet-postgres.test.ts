import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleMobileStudio } from "../frontend/src/server/mobile/studio";
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from "../frontend/src/lib/membership-policy";
import { priceCanonicalGeneration } from "../frontend/src/server/agent-api/generation-pricing";
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
    archivedPriceDelta = 0,
  ): ImageGenerationFactory =>
    (currentActor, options) =>
      createStudioImageGenerationService(currentActor, {
        ...options,
        prepareDependencies: {
          ...(prepareNow ? { now: prepareNow } : {}),
          ...(archivedPriceDelta ? {priceGeneration: async (request, tier, context) => {
            const live = await priceCanonicalGeneration(request, tier, undefined, context);
            const priceCents = live.priceCents + archivedPriceDelta;
            return {...live, priceCents, pricingSnapshot:{...live.pricingSnapshot,totalCents:priceCents}};
          }} : {}),
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
  assert.ok(prepared.quote);
  assert.equal(prepared.quote.state, "prepared");
  assert.equal(prepared.quote.confirmationRequired, true);
  assert.equal(prepared.quote.fundingMode, "wallet");
  assert.equal(prepared.quote.price.currency, "USD");
  assert.ok(prepared.quote.price.amountCents > 0);
  const displayPrice = new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'USD'}).format(prepared.quote.price.amountCents / 100);
  assert.equal(prepared.reply, 'Une image · 1:1\n\nDevis de génération · ' + displayPrice);
  assert.equal(prepared.quote.summary.prompt, "Cobalt blue perfume bottle in natural light");

  assert.ok("wallet" in prepared.quote);
  assert.deepEqual(prepared.quote.wallet, { amountCents: 0, currency: "USD" });
  assert.equal(prepared.quote.summary.prompt, "Cobalt blue perfume bottle in natural light");
  assert.equal(prepared.quote.summary.outputCount, 1);
  assert.equal(provider.captures.length, 0);
  assert.equal(directorCalls, 1);

  // Replay the phone wire contract against the same saved quote, wallet and provider as web Studio.
  const phoneHeaders = { authorization: "Bearer fixture", "x-maxvideoai-auth-mode": "bearer",
    [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION };
  const phoneCommand = {
    action: "confirm-generation", confirmed: true, requestId: input.requestId,
    quoteId: prepared.quote.quoteId, requestHash: prepared.quote.requestHash,
    amountCents: prepared.quote.price.amountCents, currency: prepared.quote.price.currency,
  };
  const phone = (search: string, command?: object) => handleMobileStudio(
    new NextRequest("https://example.invalid/api/mobile/studio/projects/" + actor.projectId + search, {
      method: command ? "POST" : "GET", headers: phoneHeaders, ...(command ? {body: JSON.stringify(command)} : {}),
    }), actor.projectId, {
      access: async () => ({ok: true, userId: actor.userId}), enabled: () => true,
      consentBlocked: async () => false, owned: async () => actor.projectId,
      journal: () => service.read(), conversationService: () => service, allowance: async () => null,
    },
  );
  const legacy = (await (await phone("")).json()).turns[0];
  const phoneJournal = async () => (await (await phone("?review=1&mediaLabels=1&locale=fr")).json()).turns[0];
  const firstRead = await phoneJournal();
  assert.equal(legacy.quote.review, undefined);
  assert.equal(legacy.quote.amountCents, phoneCommand.amountCents);
  assert.equal(firstRead.reply, prepared.reply);
  assert.equal(firstRead.quote.review.requestHash, phoneCommand.requestHash);
  assert.equal(firstRead.quote.review.wallet, "insufficient");
  assert.equal((await (await phone("", phoneCommand)).json()).error.code, "INSUFFICIENT_FUNDS");

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
  const freshRead = await phoneJournal();
  assert.equal(freshRead.quote.review.wallet, "ready");
  assert.equal(freshRead.quote.amountCents, phoneCommand.amountCents);
  assert.equal(freshRead.quote.review.quoteId, phoneCommand.quoteId);
  const attempts = await Promise.all([phone("", phoneCommand), phone("", phoneCommand)]);
  assert.ok(attempts.some(response => response.status === 200));
  for (const response of attempts.filter(response => response.status !== 200)) {
    assert.equal(response.status, 409);
    const {error} = await response.json();
    assert.ok(["CONFIRMATION_PENDING", "QUOTE_ALREADY_CLAIMED"].includes(error.code), error.code);
  }
  const retry = await phone("", phoneCommand);
  assert.deepEqual(await retry.json(), {projectId: actor.projectId, requestId: input.requestId, quoteId: phoneCommand.quoteId});
  assert.equal((await phoneJournal()).generation.jobId, phoneCommand.quoteId);
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
    generationFactory: makeFactory(() => new Date(Date.now() - 2 * 60 * 60 * 1000), undefined, 13),
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
  const renew = {action: 'renew-generation', requestId: expired.requestId,
    quoteId: expired.quote.quoteId, renewalId: randomUUID(), locale: 'fr'};
  const callsBeforeRenewal = directorCalls;
  const used = await phone('', {...renew, requestId: phoneCommand.requestId, quoteId: phoneCommand.quoteId});
  assert.equal(used.status, 409);
  for (const invalid of [{quoteId: randomUUID()}, {requestId: randomUUID()}, {renewalId: expired.requestId}])
    assert.equal((await phone('', {...renew, ...invalid})).status, 409);
  assert.equal((await phone('', {...renew, confirmed:true})).status, 400);
  const concurrent = await Promise.all([phone('', renew), phone('', renew)]);
  assert.ok(concurrent.some(result => result.status === 200));
  for (const result of concurrent.filter(result => result.status !== 200))
    assert.equal((await result.json()).error.code, 'RENEWAL_PENDING');
  const card = await (await phone('', renew)).json();
  assert.equal(card.projectId, actor.projectId);
  assert.equal(card.requestId, renew.renewalId);
  assert.ok(card.quote.review.requestHash);
  assert.equal(card.quote.state, 'prepared');
  assert.notEqual(card.quote.review.quoteId, expired.quote.quoteId);
  assert.equal(card.quote.review.canRenew, undefined);
  assert.equal(card.quote.review.direction, expired.quote.summary.prompt);
  assert.equal(card.quote.amountCents, expired.quote.price.amountCents - 13);
  const reopened = (await (await phone('?review=1&locale=fr')).json()).turns as import('../frontend/src/lib/mobile-studio').StudioMessage[];
  const repriced = reopened.filter(turn => turn.message === expiredInput.message);
  assert.equal(repriced.length, 1);
  assert.equal(repriced[0].requestId, card.requestId);
  assert.equal(repriced[0].renewedFromRequestId, expired.requestId);
  assert.equal(repriced[0].quote?.review?.quoteId, card.quote.review.quoteId);
  assert.equal(repriced[0].quote?.amountCents, card.quote.amountCents);
  assert.ok(reopened.some(turn => turn.requestId === phoneCommand.requestId && turn.generation?.jobId));
  for (const request of [renew, {...renew, renewalId:randomUUID()}, {...renew,locale:'es'}]) {
    const response = await phone('',request);
    assert.equal(response.status,200);
    const retried = await response.json();
    assert.equal(retried.requestId,card.requestId);
    assert.equal(retried.quote.review.quoteId,card.quote.review.quoteId);
    assert.equal(retried.quote.amountCents,card.quote.amountCents);
    if (request.locale==='es') assert.notEqual(retried.quote.review.title,card.quote.review.title);
  }
  assert.equal(directorCalls, callsBeforeRenewal);
  assert.equal(provider.captures.length, 1);
  const counts = await pg.pool.query(`SELECT
    (SELECT count(*)::int FROM studio_image_turns WHERE input_json->>'renewedFromRequestId'=$1) AS renewals,
    (SELECT count(*)::int FROM app_jobs WHERE user_id=$2) AS jobs,
    (SELECT count(*)::int FROM app_receipts WHERE user_id=$2 AND type='charge') AS charges`, [expired.requestId,actor.userId]);
  assert.deepEqual(counts.rows[0],{renewals:1,jobs:1,charges:1});

  // A price from an older page is still addressable by its exact turn and receipt.
  if (expired.quote.summary.surface !== 'image') assert.fail('Expected the saved image request');
  const historicalPrice = await makeFactory(() => new Date(Date.now()-3*86400000))(actor,{enabled:true}).prepare(expired.quote.summary);
  const historicalId = randomUUID();
  await pg.pool.query(`INSERT INTO studio_image_turns
    (user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,quote_id,state,lease_id,lease_expires_at,created_at)
    SELECT user_id,project_id,$2,request_hash,jsonb_set(input_json,'{requestId}',to_jsonb($2::uuid)),draft_json,draft_reference_fingerprint,
      $3,'ready',$4,clock_timestamp(),clock_timestamp()-interval '3 days' FROM studio_image_turns WHERE request_id=$1`,
    [expired.requestId,historicalId,historicalPrice.quoteId,randomUUID()]);
  for (let i=0;i<35;i++) {
    const id = randomUUID();
    await pg.pool.query(`INSERT INTO studio_image_turns
      (user_id,project_id,request_id,request_hash,input_json,state,lease_id,lease_expires_at,created_at)
      VALUES ($1,$2,$3,$4,$5,'ready',$6,clock_timestamp(),clock_timestamp()-interval '1 day'+$7*interval '1 minute')`,
      [actor.userId,actor.projectId,id,'c'.repeat(64),{requestId:id,message:'Noted.',references:[]},randomUUID(),i]);
  }
  assert.ok(!(await service.read()).turns.some(turn=>turn.requestId===historicalId));
  const archivedCommand = {...renew,requestId:historicalId,quoteId:historicalPrice.quoteId,renewalId:randomUUID()};
  const historical = await phone('',archivedCommand);
  assert.equal(historical.status,200);
  const historicalCard = await historical.json();
  assert.equal(historicalCard.quote.review.direction,card.quote.review.direction);
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired' WHERE quote_id=$1",[historicalCard.quote.review.quoteId]);
  const nextPrice = await (await phone('',{...archivedCommand,renewalId:randomUUID()})).json();
  assert.equal(nextPrice.quote.state,'prepared');
  assert.notEqual(nextPrice.quote.review.quoteId,historicalCard.quote.review.quoteId);
  assert.equal(provider.captures.length,1);
  assert.equal(directorCalls,callsBeforeRenewal);

});
