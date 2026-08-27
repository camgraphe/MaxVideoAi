import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { type QueryExecutor, getDb } from '../../frontend/src/lib/db';
import { listMcpActivityHistory } from '../../frontend/src/server/agent-api/activity-history';
import { normalizeGenerationRequest } from '../../frontend/src/server/agent-api/generation-normalization';
import { updateMcpSpendingSettings } from '../../frontend/src/server/agent-api/spending-limits';
import { verifyMcpTopupHandoff } from '../../frontend/src/server/agent-api/topup-handoff';
import {
  ProviderHarness,
  TOPUP_SECRET,
  addTopup,
  assertPersistedPriceParity,
  assertOAuthQuoteMutationScope,
  assertOAuthRecoveryScope,
  assertRecoverySafe,
  assertWalletParity,
  callConfirmed,
  callPrepared,
  capturePreparedPriceParity,
  connect,
  createServices,
  errorCode,
  principal,
  record,
  structured,
} from '../helpers/mcp-paid-e2e-harness';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from '../helpers/disposable-postgres';

test('paid facade completes deterministic SDK, PostgreSQL, pricing, recovery, controls, and accounting flows', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }
  const postgres = await startDisposablePostgres('mcp-paid-p11-e2e');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = postgres.databaseUrl;
  t.after(async () => {
    await getDb().end().catch(() => undefined);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await postgres.cleanup();
  });
  await createPaidGenerationTestSchema(postgres.pool);
  const provider = new ProviderHarness(postgres.pool);
  const services = createServices({ submitPaidGeneration: provider.submit });
  const sessions: Awaited<ReturnType<typeof connect>>[] = [];
  const sessionFor = async (identity: AgentPrincipal, paid = true, custom = services) => {
    const session = await connect(identity, custom, paid);
    sessions.push(session);
    return session;
  };
  t.after(async () => {
    await Promise.allSettled(sessions.map((session) => session.close()));
  });
  const registryIdentity = principal('p11-registry');
  const defaults = await sessionFor(registryIdentity, false);
  const enabled = await sessionFor(registryIdentity, true);
  assert.deepEqual((await defaults.client.listTools()).tools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'get_model_details', 'recommend_models',
    'calculate_project_budget',
  ]);
  const paidTools = (await enabled.client.listTools()).tools;
  assert.deepEqual(paidTools.map((tool) => tool.name), [
    'get_account_status', 'list_models', 'get_model_details', 'recommend_models',
    'calculate_project_budget', 'prepare_generation',
    'confirm_generation', 'get_generation_status', 'list_recent_generations', 'get_generation_download', 'present_generation', 'create_topup_link',
  ]);
  const annotations = Object.fromEntries(paidTools.map((tool) => [tool.name, tool.annotations]));
  assert.deepEqual(annotations.confirm_generation, {
    readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
  });
  assert.deepEqual(annotations.create_topup_link, {
    readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true,
  });
  for (const name of [
    'get_account_status', 'list_models', 'get_model_details', 'recommend_models',
    'calculate_project_budget', 'prepare_generation', 'get_generation_status', 'list_recent_generations', 'get_generation_download', 'present_generation',
  ]) {
    assert.equal(record(annotations[name]).readOnlyHint, true);
    assert.equal(record(annotations[name]).destructiveHint, false);
    assert.equal(record(annotations[name]).openWorldHint, false);
  }
  const publication = JSON.parse(readFileSync('frontend/config/mcp-publication.json', 'utf8')) as Record<string, unknown>;
  assert.equal(Object.keys(publication).length, 8);
  assert.ok(Object.values(publication).every((value) => value === false));
  const mediaIdentity = principal('p11-media');
  await addTopup(postgres.pool, mediaIdentity.userId, 1_100_000);
  await postgres.pool.query(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description)
     VALUES ($1, 'charge', 600000, 'USD', 'P11 production-like prior membership spend')`,
    [mediaIdentity.userId],
  );
  const media = await sessionFor(mediaIdentity);
  const t2iInput = {
    surface: 'image', engineId: 'gpt-image-2', mode: 't2i',
    prompt: 'P11 private text to image prompt',
    settings: { resolution: '1024x1024', quality: 'high', aspectRatio: '1:1' },
    references: [], outputCount: 1,
  };
  const t2iPrepared = await callPrepared(media.client, t2iInput);
  assert.deepEqual(t2iPrepared.summary, normalizeGenerationRequest(t2iInput));
  const t2iQuoteId = String(t2iPrepared.quoteId);
  const t2iPricing = await capturePreparedPriceParity({
    pool: postgres.pool, userId: mediaIdentity.userId,
    quoteId: t2iQuoteId, input: t2iInput, prepared: t2iPrepared,
  });
  assert.equal(t2iPricing.membershipTier, 'plus');
  const t2iConfirmed = await callConfirmed(media.client, t2iQuoteId);
  assert.notEqual(t2iConfirmed.isError, true, JSON.stringify(t2iConfirmed.structuredContent));
  assert.equal(structured(t2iConfirmed).status, 'completed');
  await assertPersistedPriceParity(postgres.pool, t2iQuoteId, t2iPricing);
  assertRecoverySafe(t2iConfirmed, [t2iInput.prompt, mediaIdentity.clientId]);
  const t2iStatus = await media.client.callTool({
    name: 'get_generation_status', arguments: { jobId: t2iQuoteId },
  }) as CallToolResult;
  assert.equal(structured(t2iStatus).status, 'completed');
  const t2iResources = t2iStatus.content.filter((entry) => entry.type === 'resource_link');
  assert.ok(t2iResources.length >= 1 && t2iResources.length <= 8);
  assert.ok(t2iResources.every((entry) => entry.type === 'resource_link'
    && entry.uri.startsWith('https://cdn.maxvideoai.com/')));
  assertRecoverySafe(t2iStatus, [t2iInput.prompt, mediaIdentity.clientId]);
  const recentImages = await media.client.callTool({
    name: 'list_recent_generations', arguments: { surface: 'image', limit: 10 },
  }) as CallToolResult;
  assert.ok((structured(recentImages).items as unknown[]).some((item) => record(item).jobId === t2iQuoteId));
  assertRecoverySafe(recentImages, [t2iInput.prompt, mediaIdentity.clientId]);
  const imageReference = 'https://fixtures.maxvideoai.com/p11/source.png';
  const i2iInput = {
    surface: 'image', engineId: 'gpt-image-2', mode: 'i2i',
    prompt: 'P11 private image edit prompt',
    settings: { resolution: '1024x1024', quality: 'high', aspectRatio: '1:1' },
    references: [{ kind: 'https', url: imageReference, role: 'source', mediaKind: 'image' }], outputCount: 1,
  };
  const i2iPrepared = await callPrepared(media.client, i2iInput);
  assert.deepEqual(i2iPrepared.summary, normalizeGenerationRequest(i2iInput));
  const i2iQuoteId = String(i2iPrepared.quoteId);
  const i2iPricing = await capturePreparedPriceParity({
    pool: postgres.pool, userId: mediaIdentity.userId,
    quoteId: i2iQuoteId, input: i2iInput, prepared: i2iPrepared,
  });
  const i2iConfirmed = await callConfirmed(media.client, i2iQuoteId);
  assert.equal(structured(i2iConfirmed).status, 'completed');
  await assertPersistedPriceParity(postgres.pool, i2iQuoteId, i2iPricing);
  const i2iCapture = provider.captures.find((capture) => capture.quoteId === i2iQuoteId);
  assert.deepEqual(i2iCapture?.body.imageUrls, [imageReference]);
  assert.equal(i2iCapture?.body.jobId, i2iQuoteId);
  assert.equal(i2iCapture?.options.walletReservation, 'already_reserved');
  assert.equal(record(i2iCapture?.options.preReservedInitialState).jobId, i2iQuoteId);
  assertRecoverySafe(i2iConfirmed, [i2iInput.prompt, imageReference, mediaIdentity.clientId]);
  const t2vInput = {
    surface: 'video', engineId: 'seedance-2-0-mini', mode: 't2v',
    prompt: 'P11 private text to video prompt',
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true },
    references: [], outputCount: 1,
  };
  const t2vPrepared = await callPrepared(media.client, t2vInput);
  const t2vQuoteId = String(t2vPrepared.quoteId);
  const t2vPricing = await capturePreparedPriceParity({
    pool: postgres.pool, userId: mediaIdentity.userId,
    quoteId: t2vQuoteId, input: t2vInput, prepared: t2vPrepared,
  });
  const t2vConfirmed = await callConfirmed(media.client, t2vQuoteId);
  assert.equal(structured(t2vConfirmed).status, 'accepted');
  await assertPersistedPriceParity(postgres.pool, t2vQuoteId, t2vPricing);
  const t2vCapture = provider.captures.find((capture) => capture.quoteId === t2vQuoteId);
  assert.equal(t2vCapture?.body.jobId, t2vQuoteId);
  assert.equal(t2vCapture?.body.durationSec, 5);
  assert.equal(t2vCapture?.body.resolution, '720p');
  assert.equal(t2vCapture?.body.aspectRatio, '16:9');
  assert.equal(t2vCapture?.body.audio, true);
  assert.equal(t2vCapture?.options.walletReservation, 'already_reserved');
  assert.equal(record(t2vCapture?.options.preReservedInitialState).jobId, t2vQuoteId);
  await postgres.pool.query(
    `UPDATE app_jobs SET status = 'running', progress = 47, updated_at = clock_timestamp()
      WHERE job_id = $1`, [t2vQuoteId],
  );
  const running = await media.client.callTool({
    name: 'get_generation_status', arguments: { jobId: t2vQuoteId },
  }) as CallToolResult;
  assert.equal(structured(running).status, 'running');
  assert.equal(structured(running).progress, 47);
  const videoUrl = `https://cdn.maxvideoai.com/p11/${t2vQuoteId}.mp4`;
  await postgres.pool.query(
    `UPDATE app_jobs
        SET status = 'completed', progress = 100, video_url = $2,
            preview_video_url = $2, updated_at = clock_timestamp()
      WHERE job_id = $1`, [t2vQuoteId, videoUrl],
  );
  const completedVideo = await media.client.callTool({
    name: 'get_generation_status', arguments: { jobId: t2vQuoteId },
  }) as CallToolResult;
  assert.equal(structured(completedVideo).status, 'completed');
  assert.ok(completedVideo.content.some((entry) => entry.type === 'resource_link' && entry.uri === videoUrl));
  assertRecoverySafe(completedVideo, [t2vInput.prompt, `private-provider-${t2vQuoteId}`, mediaIdentity.clientId]);
  const firstFrame = 'https://fixtures.maxvideoai.com/p11/first-frame.png';
  const i2vInput = {
    surface: 'video', engineId: 'seedance-2-0-mini', mode: 'i2v',
    prompt: 'P11 private image to video prompt',
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'https', url: firstFrame, role: 'first_frame', mediaKind: 'image' }], outputCount: 1,
  };
  const i2vPrepared = await callPrepared(media.client, i2vInput);
  const i2vQuoteId = String(i2vPrepared.quoteId);
  const i2vPricing = await capturePreparedPriceParity({
    pool: postgres.pool, userId: mediaIdentity.userId,
    quoteId: i2vQuoteId, input: i2vInput, prepared: i2vPrepared,
  });
  const i2vConfirmed = await callConfirmed(media.client, i2vQuoteId);
  assert.equal(structured(i2vConfirmed).status, 'accepted');
  await assertPersistedPriceParity(postgres.pool, i2vQuoteId, i2vPricing);
  const i2vCapture = provider.captures.find((capture) => capture.quoteId === i2vQuoteId);
  assert.equal(i2vCapture?.body.imageUrl, firstFrame);
  assert.equal(i2vCapture?.body.jobId, i2vQuoteId);
  assertRecoverySafe(i2vConfirmed, [i2vInput.prompt, firstFrame, mediaIdentity.clientId]);

  const mediaGenerationCents = [t2iPricing, i2iPricing, t2vPricing, i2vPricing]
    .reduce((total, pricing) => total + pricing.amountCents, 0);
  await assertWalletParity({
    client: media.client, pool: postgres.pool, userId: mediaIdentity.userId,
    expected: {
      topups: { amountCents: 1_100_000, count: 1 },
      charges: { amountCents: 600_000 + mediaGenerationCents, count: 5 },
      refunds: { amountCents: 0, count: 0 },
    },
  });
  const expiredIdentity = principal('p11-expired');
  await addTopup(postgres.pool, expiredIdentity.userId, 10_000);
  const expiryProvider = new ProviderHarness(postgres.pool);
  const expired = await sessionFor(expiredIdentity, true, createServices({
    submitPaidGeneration: expiryProvider.submit,
    prepareNow: () => new Date(Date.now() - 11 * 60 * 1000),
  }));
  const expiredPrepared = await callPrepared(expired.client, t2iInput);
  const expiredQuoteId = String(expiredPrepared.quoteId);
  const expiredResult = await callConfirmed(expired.client, expiredQuoteId);
  assert.equal(errorCode(expiredResult), 'QUOTE_EXPIRED');
  assertRecoverySafe(expiredResult, [t2iInput.prompt, expiredIdentity.clientId]);
  assert.equal(expiryProvider.calls(expiredQuoteId), 0);
  const expiredCounts = await postgres.pool.query<{ charges: string; jobs: string }>(`
    SELECT
      (SELECT count(*) FROM app_receipts WHERE user_id = $1 AND type = 'charge')::text AS charges,
      (SELECT count(*) FROM app_jobs WHERE user_id = $1)::text AS jobs`, [expiredIdentity.userId]);
  assert.deepEqual(expiredCounts.rows[0], { charges: '0', jobs: '0' });
  const topupIdentity = principal('p11-topup');
  const topup = await sessionFor(topupIdentity);
  const poorPrepared = await callPrepared(topup.client, t2iInput);
  assert.equal(poorPrepared.topupRequired, true);
  const poorQuoteId = String(poorPrepared.quoteId);
  const insufficient = await callConfirmed(topup.client, poorQuoteId);
  assert.equal(errorCode(insufficient), 'INSUFFICIENT_FUNDS');
  assertRecoverySafe(insufficient, [t2iInput.prompt, topupIdentity.clientId]);
  assert.equal(provider.calls(poorQuoteId), 0);
  const handoff = await topup.client.callTool({
    name: 'create_topup_link', arguments: { quoteId: poorQuoteId },
  }) as CallToolResult;
  assert.notEqual(handoff.isError, true);
  const handoffValue = structured(handoff);
  assert.equal(handoffValue.freshQuoteRequired, true);
  assert.equal(
    handoffValue.expiresAtIso,
    new Date(Number(handoffValue.expiresAt) * 1_000).toISOString(),
  );
  const handoffDestination = record(handoffValue.destination);
  assert.match(String(handoffDestination.url), /^https:\/\/maxvideoai\.com\/billing\?mcp_topup=v1\./u);
  assert.equal(JSON.stringify(handoff).includes(TOPUP_SECRET), false);
  const handoffToken = new URL(String(handoffDestination.url)).searchParams.get('mcp_topup');
  assert.deepEqual(
    verifyMcpTopupHandoff(handoffToken, { secret: TOPUP_SECRET, now: new Date() }),
    {
      amountCents: handoffValue.amountCents,
      currency: 'USD',
      quoteIntentId: handoffValue.quoteIntentId,
      expiresAt: handoffValue.expiresAt,
    },
  );
  assertRecoverySafe(handoff, [t2iInput.prompt, topupIdentity.clientId]);
  await assertWalletParity({
    client: topup.client, pool: postgres.pool, userId: topupIdentity.userId,
    expected: {
      topups: { amountCents: 0, count: 0 }, charges: { amountCents: 0, count: 0 },
      refunds: { amountCents: 0, count: 0 },
    },
  });
  await addTopup(postgres.pool, topupIdentity.userId, 10_000);
  const staleAfterTopup = await callConfirmed(topup.client, poorQuoteId);
  assert.equal(errorCode(staleAfterTopup), 'QUOTE_EXPIRED');
  assertRecoverySafe(staleAfterTopup, [t2iInput.prompt, topupIdentity.clientId]);
  const fundedPrepared = await callPrepared(topup.client, t2iInput);
  const fundedQuoteId = String(fundedPrepared.quoteId);
  const fundedConfirmed = await callConfirmed(topup.client, fundedQuoteId);
  assert.equal(structured(fundedConfirmed).status, 'completed');
  assertRecoverySafe(fundedConfirmed, [t2iInput.prompt, topupIdentity.clientId]);
  assert.equal(provider.calls(fundedQuoteId), 1);
  await assertWalletParity({
    client: topup.client, pool: postgres.pool, userId: topupIdentity.userId,
    expected: {
      topups: { amountCents: 10_000, count: 1 },
      charges: { amountCents: Number(record(fundedPrepared.price).amountCents), count: 1 },
      refunds: { amountCents: 0, count: 0 },
    },
  });

  const rejectionIdentity = principal('p11-rejection');
  await addTopup(postgres.pool, rejectionIdentity.userId, 10_000);
  const rejection = await sessionFor(rejectionIdentity);
  const rejectedPrepared = await callPrepared(rejection.client, t2vInput);
  const rejectedQuoteId = String(rejectedPrepared.quoteId);
  provider.plans.set(rejectedQuoteId, 'reject');
  const rejected = await callConfirmed(rejection.client, rejectedQuoteId);
  assert.equal(structured(rejected).status, 'failed');
  assert.equal(structured(rejected).paymentStatus, 'refunded_wallet');
  assertRecoverySafe(rejected, [t2vInput.prompt, rejectionIdentity.clientId]);
  const rejectedCents = Number(record(rejectedPrepared.price).amountCents);
  await assertWalletParity({
    client: rejection.client, pool: postgres.pool, userId: rejectionIdentity.userId,
    expected: {
      topups: { amountCents: 10_000, count: 1 },
      charges: { amountCents: rejectedCents, count: 1 },
      refunds: { amountCents: rejectedCents, count: 1 },
    },
  });
  const rejectedCounts = await postgres.pool.query<{ charges: string; refunds: string }>(`
    SELECT
      count(*) FILTER (WHERE type = 'charge')::text AS charges,
      count(*) FILTER (WHERE type = 'refund')::text AS refunds
      FROM app_receipts WHERE job_id = $1`, [rejectedQuoteId]);
  assert.deepEqual(rejectedCounts.rows[0], { charges: '1', refunds: '1' });

  const ambiguousIdentity = principal('p11-ambiguous');
  await addTopup(postgres.pool, ambiguousIdentity.userId, 10_000);
  const ambiguous = await sessionFor(ambiguousIdentity);
  const ambiguousPrepared = await callPrepared(ambiguous.client, t2vInput);
  const ambiguousQuoteId = String(ambiguousPrepared.quoteId);
  provider.plans.set(ambiguousQuoteId, 'ambiguous');
  const ambiguousResult = await callConfirmed(ambiguous.client, ambiguousQuoteId);
  assert.equal(structured(ambiguousResult).status, 'accepted');
  assertRecoverySafe(ambiguousResult, [t2vInput.prompt, ambiguousIdentity.clientId]);
  await assertWalletParity({
    client: ambiguous.client, pool: postgres.pool, userId: ambiguousIdentity.userId,
    expected: {
      topups: { amountCents: 10_000, count: 1 },
      charges: { amountCents: Number(record(ambiguousPrepared.price).amountCents), count: 1 },
      refunds: { amountCents: 0, count: 0 },
    },
  });
  const ambiguousState = await postgres.pool.query<{ state: string }>(
    'SELECT state FROM mcp_generation_quotes WHERE quote_id = $1', [ambiguousQuoteId],
  );
  assert.equal(ambiguousState.rows[0]?.state, 'claimed');

  const raceIdentity = principal('p11-same-quote-race');
  await addTopup(postgres.pool, raceIdentity.userId, 10_000);
  const race = await sessionFor(raceIdentity);
  const racePrepared = await callPrepared(race.client, t2vInput);
  const raceQuoteId = String(racePrepared.quoteId);
  const blocker = provider.block(raceQuoteId);
  const firstConfirmation = callConfirmed(race.client, raceQuoteId);
  await blocker.started;
  const secondConfirmation = await callConfirmed(race.client, raceQuoteId);
  blocker.signalRelease();
  const firstConfirmationResult = await firstConfirmation;
  assert.equal(structured(firstConfirmationResult).jobId, raceQuoteId);
  assert.equal(structured(secondConfirmation).jobId, raceQuoteId);
  assertRecoverySafe(firstConfirmationResult, [t2vInput.prompt, raceIdentity.clientId]);
  assertRecoverySafe(secondConfirmation, [t2vInput.prompt, raceIdentity.clientId]);
  assert.equal(provider.calls(raceQuoteId), 1);
  const raceCounts = await postgres.pool.query<{ charges: string; jobs: string }>(`
    SELECT
      (SELECT count(*) FROM app_receipts WHERE job_id = $1 AND type = 'charge')::text AS charges,
      (SELECT count(*) FROM app_jobs WHERE job_id = $1)::text AS jobs`, [raceQuoteId]);
  assert.deepEqual(raceCounts.rows[0], { charges: '1', jobs: '1' });
  await assertWalletParity({
    client: race.client, pool: postgres.pool, userId: raceIdentity.userId,
    expected: {
      topups: { amountCents: 10_000, count: 1 },
      charges: { amountCents: Number(record(racePrepared.price).amountCents), count: 1 },
      refunds: { amountCents: 0, count: 0 },
    },
  });

  const capIdentity = principal('p11-daily-cap-race');
  await addTopup(postgres.pool, capIdentity.userId, 100_000);
  const cap = await sessionFor(capIdentity);
  const capPreparedA = await callPrepared(cap.client, t2iInput);
  const capPreparedB = await callPrepared(cap.client, t2vInput);
  const capA = String(capPreparedA.quoteId);
  const capB = String(capPreparedB.quoteId);
  const capCents = Math.max(
    Number(record(capPreparedA.price).amountCents),
    Number(record(capPreparedB.price).amountCents),
  );
  const executor: QueryExecutor = {
    async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await postgres.pool.query<TRecord>(sql, params as unknown[] | undefined)).rows;
    },
  };
  const activity = await listMcpActivityHistory({
    userId: mediaIdentity.userId,
    clientLabels: { [mediaIdentity.clientId!]: 'Codex local fixture' },
  }, { executor });
  assert.ok(activity.length >= 4);
  const serializedActivity = JSON.stringify(activity);
  for (const privateValue of [
    t2iInput.prompt, i2iInput.prompt, t2vInput.prompt, i2vInput.prompt,
    imageReference, firstFrame, mediaIdentity.clientId,
  ]) assert.equal(serializedActivity.includes(privateValue), false);
  await updateMcpSpendingSettings(capIdentity.userId, {
    paidGenerationEnabled: true,
    perGenerationCents: null,
    dailyCents: capCents,
    webApprovalAboveCents: null,
  }, { executor });
  const capResults = await Promise.all([callConfirmed(cap.client, capA), callConfirmed(cap.client, capB)]);
  assert.equal(capResults.filter((result) => result.isError !== true).length, 1);
  assert.equal(capResults.filter((result) => result.isError === true
    && errorCode(result) === 'SPENDING_LIMIT_EXCEEDED').length, 1);
  const capLedger = await postgres.pool.query<{ charges: string }>(
    `SELECT count(*) FILTER (WHERE type = 'charge')::text AS charges
       FROM app_receipts WHERE user_id = $1`, [capIdentity.userId],
  );
  assert.equal(capLedger.rows[0]?.charges, '1');
  assert.equal(provider.calls(capA) + provider.calls(capB), 1);
  const capSuccessIndex = capResults.findIndex((result) => result.isError !== true);
  const capChargedCents = Number(record([capPreparedA, capPreparedB][capSuccessIndex].price).amountCents);
  await assertWalletParity({
    client: cap.client, pool: postgres.pool, userId: capIdentity.userId,
    expected: {
      topups: { amountCents: 100_000, count: 1 },
      charges: { amountCents: capChargedCents, count: 1 },
      refunds: { amountCents: 0, count: 0 },
    },
  });
  for (const result of capResults) {
    assertRecoverySafe(result, [t2iInput.prompt, t2vInput.prompt, capIdentity.clientId]);
  }

  const denialCases = [
    { suffix: 'kill', settings: { paidGenerationEnabled: false, perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null } },
    { suffix: 'per', settings: { paidGenerationEnabled: true, perGenerationCents: 1, dailyCents: null, webApprovalAboveCents: null } },
    { suffix: 'daily', settings: { paidGenerationEnabled: true, perGenerationCents: null, dailyCents: 1, webApprovalAboveCents: null } },
    { suffix: 'web', settings: { paidGenerationEnabled: true, perGenerationCents: null, dailyCents: null, webApprovalAboveCents: 1 } },
  ] as const;
  for (const denial of denialCases) {
    const identity = principal(`p11-control-${denial.suffix}`);
    await addTopup(postgres.pool, identity.userId, 10_000);
    const session = await sessionFor(identity);
    const prepared = await callPrepared(session.client, t2iInput);
    const quoteId = String(prepared.quoteId);
    await updateMcpSpendingSettings(identity.userId, denial.settings, { executor });
    const denied = await callConfirmed(session.client, quoteId);
    assert.equal(errorCode(denied), 'SPENDING_LIMIT_EXCEEDED');
    assertRecoverySafe(denied, [t2iInput.prompt, identity.clientId]);
    assert.equal(provider.calls(quoteId), 0);
    const mutation = await postgres.pool.query<{ charges: string; jobs: string }>(`
      SELECT
        (SELECT count(*) FROM app_receipts WHERE user_id = $1 AND type = 'charge')::text AS charges,
        (SELECT count(*) FROM app_jobs WHERE user_id = $1)::text AS jobs`, [identity.userId]);
    assert.deepEqual(mutation.rows[0], { charges: '0', jobs: '0' });
  }

  const restrictedIdentity = principal('p11-restricted');
  await addTopup(postgres.pool, restrictedIdentity.userId, 10_000);
  const restricted = await sessionFor(restrictedIdentity);
  const restrictedPrepared = await callPrepared(restricted.client, t2iInput);
  const restrictedQuoteId = String(restrictedPrepared.quoteId);
  await postgres.pool.query(
    `INSERT INTO user_account_restrictions (user_id, reason, message)
     VALUES ($1, 'local_test', 'P11 local restriction')`,
    [restrictedIdentity.userId],
  );
  const restrictedResult = await callConfirmed(restricted.client, restrictedQuoteId);
  assert.equal(errorCode(restrictedResult), 'ACCOUNT_RESTRICTED');
  assertRecoverySafe(restrictedResult, [t2iInput.prompt, restrictedIdentity.clientId]);
  const restrictedMutation = await postgres.pool.query<{ charges: string; jobs: string }>(`
    SELECT
      (SELECT count(*) FROM app_receipts WHERE user_id = $1 AND type = 'charge')::text AS charges,
      (SELECT count(*) FROM app_jobs WHERE user_id = $1)::text AS jobs`, [restrictedIdentity.userId]);
  assert.deepEqual(restrictedMutation.rows[0], { charges: '0', jobs: '0' });

  const ownerIdentity = principal('p11-owner', 'p11-owner-client');
  await addTopup(postgres.pool, ownerIdentity.userId, 10_000);
  const owner = await sessionFor(ownerIdentity);
  const ownedPrepared = await callPrepared(owner.client, i2iInput);
  const ownedQuoteId = String(ownedPrepared.quoteId);
  const wrongUserIdentity = principal('p11-intruder', 'p11-intruder-client');
  const wrongUser = await sessionFor(wrongUserIdentity);
  const wrongClient = await sessionFor(principal(ownerIdentity.userId, 'p11-other-client'));
  const ownershipSecrets = [i2iInput.prompt, imageReference, ownerIdentity.clientId];
  await assertOAuthQuoteMutationScope({
    sameUserOtherClient: wrongClient.client, wrongUser: wrongUser.client,
    quoteId: ownedQuoteId, forbidden: ownershipSecrets,
  });
  const ownedConfirmed = await callConfirmed(owner.client, ownedQuoteId);
  assert.equal(structured(ownedConfirmed).status, 'completed');
  assertRecoverySafe(ownedConfirmed, ownershipSecrets);
  await assertOAuthRecoveryScope({
    sameUserOtherClient: wrongClient.client, wrongUser: wrongUser.client,
    jobId: ownedQuoteId, forbidden: ownershipSecrets,
  });
});
