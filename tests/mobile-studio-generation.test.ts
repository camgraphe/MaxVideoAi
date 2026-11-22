import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from '../frontend/src/lib/membership-policy';
import type { ImageConversationTurn } from '../frontend/src/lib/studio/image-conversation-contract';
import { handleMobileStudio } from '../frontend/src/server/mobile/studio';

test('Studio mobile reviews the saved project quote and recovers the same media after a lost confirmation', async () => {
  const projectId = 'my-project',
    requestId = randomUUID(),
    quoteId = randomUUID(),
    requestHash = 'a'.repeat(64);
  const turn = {
    requestId,
    message: 'Make the first shot.',
    reply: 'Review the first clip.',
    state: 'ready',
    references: [],
    quote: {
      quoteId,
      requestHash,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      state: 'prepared',
      modelLabel: 'Test camera',
      price: { currency: 'USD', amountCents: 24 },
      wallet: { currency: 'USD', amountCents: 150 },
      summary: {
        surface: 'video',
        mode: 't2v',
        engineId: 'seedance-2-5',
        prompt: 'Fireflies above the lake.',
        references: [],
        settings: { durationSec: 4, resolution: '480p', aspectRatio: '9:16' },
        outputCount: 1,
      },
    },
    generation: null,
  } as unknown as ImageConversationTurn;
  const generation = {
    jobId: 'job-test',
    status: 'completed',
    result: { surface: 'video', videoUrl: 'https://example.invalid/clip.mp4' },
  } as NonNullable<ImageConversationTurn['generation']>;
  let owned = true,
    consentBlocked = false,
    confirms = 0;
  const deps = {
    enabled: () => true,
    access: async () => ({ ok: true as const, userId: 'owner' }),
    owned: async () => (owned ? projectId : null),
    consentBlocked: async () => consentBlocked,
    allowance: async () => null,
    journal: async () => ({ projectId, projectName: 'Lake', turns: [turn] }),
    conversationService: () => ({
      confirm: async (input: unknown) => {
        assert.deepEqual(input, { requestId, quoteId, confirmed: true });
        confirms++;
        turn.generation = generation;
        turn.quote!.state = 'accepted';
        return generation;
      },
    }),
  } as unknown as NonNullable<Parameters<typeof handleMobileStudio>[2]>;
  const url = 'https://example.invalid/api/mobile/studio/projects/' + projectId;
  const auth = { authorization: 'Bearer test', 'x-maxvideoai-auth-mode': 'bearer' };
  const read = async (query = '?review=1&locale=fr') =>
    (
      await (
        await handleMobileStudio(new NextRequest(url + query, { headers: auth }), projectId, deps)
      ).json()
    ).turns[0];
  const input = {
    action: 'confirm-generation',
    confirmed: true,
    requestId,
    quoteId,
    requestHash,
    amountCents: 24,
    currency: 'USD',
  };
  const post = (changes: object = {}, policy = LIVE_PRICING_POLICY_REVISION) =>
    handleMobileStudio(
      new NextRequest(url, {
        method: 'POST',
        headers: { ...auth, [PRICING_POLICY_HEADER]: policy },
        body: JSON.stringify({ ...input, ...changes }),
      }),
      projectId,
      deps,
    );
  assert.equal((await read('')).quote.review, undefined);
  const first = await read();
  assert.equal(first.quote.review.direction, 'Fireflies above the lake.');
  assert.match(first.quote.review.settings, /9:16/);
  assert.equal(first.quote.amountCents, 24);
  assert.equal((await post({}, 'stale')).status, 409);
  for (const changes of [
    { amountCents: 23 },
    { currency: 'EUR' },
    { quoteId: randomUUID() },
    { requestId: randomUUID() },
    { requestHash: 'b'.repeat(64) },
  ])
    assert.equal((await post(changes)).status, 409);
  assert.equal((await post({ confirmed: false })).status, 400);
  owned = false;
  assert.equal((await post()).status, 404);
  owned = true;
  consentBlocked = true;
  assert.equal((await post()).status, 403);
  consentBlocked = false;
  const quote = turn.quote!;
  quote.wallet!.amountCents = 10;
  assert.equal((await post()).status, 409);
  quote.wallet!.amountCents = 150;
  const expiresAt = quote.expiresAt;
  quote.expiresAt = new Date(0).toISOString();
  assert.equal((await post()).status, 409);
  quote.expiresAt = expiresAt;
  quote.state = 'claimed';
  assert.equal((await post()).status, 409);
  quote.state = 'prepared';
  quote.recast = { confirmationEnabled: true };
  assert.equal((await read()).quote.review, undefined);
  assert.equal((await post()).status, 409);
  delete quote.recast;
  const savedMode = quote.summary.mode;
  Object.assign(quote.summary, { mode: 'extend' });
  assert.match((await read()).quote.review.notices[0], /Seedance/);
  Object.assign(quote.summary, { mode: savedMode });
  turn.quote = null;
  turn.analysisQuote = { confirmationRequired: true } as NonNullable<ImageConversationTurn['analysisQuote']>;
  assert.equal((await read()).webReview, true);
  assert.equal((await read('')).webReview, undefined);
  assert.equal((await post()).status, 409);
  delete turn.analysisQuote;
  turn.quote = quote;
  assert.equal(confirms, 0);
  for (let i = 0; i < 2; i++)
    assert.deepEqual(await (await post()).json(), { projectId, requestId, quoteId });
  assert.equal(confirms, 1);
  assert.deepEqual((await read()).generation.outputs, [
    { kind: 'video', url: 'https://example.invalid/clip.mp4' },
  ]);
  assert.equal((await read('')).generation, undefined);
  const imageUrls = ['https://example.invalid/one.jpg', 'https://example.invalid/two.jpg'];
  turn.generation = { ...generation, result: { surface: 'image', imageUrls } } as typeof generation;
  assert.deepEqual(
    (await read()).generation.outputs,
    imageUrls.map((url) => ({ kind: 'image', url })),
  );
  const audioUrl = 'https://example.invalid/music.mp3';
  turn.generation = { ...generation, result: { surface: 'audio', audioUrl } } as typeof generation;
  assert.deepEqual((await read()).generation.outputs, [{ kind: 'audio', url: audioUrl }]);
});
