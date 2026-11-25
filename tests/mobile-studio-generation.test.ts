import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from '../frontend/src/lib/membership-policy';
import type { ImageConversationTurn } from '../frontend/src/lib/studio/image-conversation-contract';
import { handleMobileStudio } from '../frontend/src/server/mobile/studio';

test('Studio mobile reviews the saved project quote and recovers the same media after a lost confirmation', async t => {
  const mediaFlag = process.env.STUDIO_CONVERSATION_MEDIA_ENABLED;
  process.env.STUDIO_CONVERSATION_MEDIA_ENABLED = 'true';
  t.after(() => { if (mediaFlag === undefined) delete process.env.STUDIO_CONVERSATION_MEDIA_ENABLED;
    else process.env.STUDIO_CONVERSATION_MEDIA_ENABLED = mediaFlag; });
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
    result: { surface: 'video', videoUrl: 'https://example.invalid/clip.mp4', playbackVideoUrl: 'https://example.invalid/preview.mp4' },
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
  assert.equal(first.quote.review.canRenew, undefined);
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
  assert.equal((await read()).quote.review.canRenew, true);
  process.env.STUDIO_CONVERSATION_MEDIA_ENABLED = 'false';
  assert.equal((await read()).quote.review.canRenew, undefined);
  process.env.STUDIO_CONVERSATION_MEDIA_ENABLED = 'true';
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
    { kind: 'video', url: 'https://example.invalid/preview.mp4', originalUrl: 'https://example.invalid/clip.mp4' },
  ]);
  assert.equal((await read('')).generation, undefined);
  const imageUrls = ['https://example.invalid/one.jpg', 'https://example.invalid/two.jpg'];
  const thumbnailUrls = ['https://example.invalid/one-thumb.jpg', 'https://example.invalid/two-thumb.jpg'];
  turn.generation = { ...generation, result: { surface: 'image', imageUrls, thumbnailUrls } };
  assert.deepEqual(
    (await read()).generation.outputs,
    imageUrls.map((url) => ({ kind: 'image', url })),
  );
  turn.generation = { ...generation, result: { surface: 'image', imageUrls: [imageUrls[0]], thumbnailUrls: [thumbnailUrls[0]] } };
  assert.deepEqual((await read()).generation.outputs, [
    { kind: 'image', url: imageUrls[0], previewUrl: thumbnailUrls[0] },
  ]);
  const audioUrl = 'https://example.invalid/music.mp3';
  turn.generation = { ...generation, result: { surface: 'audio', audioUrl } } as typeof generation;
  assert.deepEqual((await read()).generation.outputs, [{ kind: 'audio', url: audioUrl }]);
});

test('only an explicit native reporting header on a generation session can identify the app', async () => {
  const { withNativeConfirmationPlatform, generationClaimPlatform } = await import('../frontend/src/server/agent-api/native-generation-platform');
  for (const authMethod of ['studio-session', 'mobile-session', 'oauth', 'toolbox-session']) {
    for (const value of ['ios', 'android', '', 'web', 'google', 'ios, android', 'iOS']) {
      const actor = { authMethod };
      const headers = new Headers({ 'user-agent': 'iPhone', 'x-maxvideoai-auth-mode': 'bearer',
        'x-maxvideoai-client-platform': value });
      const confirmed = withNativeConfirmationPlatform(actor, headers);
      const supported = ['studio-session', 'mobile-session'].includes(authMethod) && ['ios', 'android'].includes(value);
      assert.equal(generationClaimPlatform(confirmed), supported ? value : undefined);
    }
  }
  assert.equal(generationClaimPlatform(withNativeConfirmationPlatform({authMethod:'studio-session'},
    new Headers({'user-agent':'Android'}))), undefined);
});

test('only an owned paused segment with matching terminal evidence reports a reference issue',async()=>{
  const projectId='project';
  const states=[['paused','provider'],['paused',null],['paused','budget'],['unknown','usage'],['completed',null],['paused','provider']] as const;
  const turns=states.map(([state,error])=>({requestId:randomUUID(),message:'Continue',references:[],reply:null,state:'failed',quote:null,task:{state,error}}));
  const deps={enabled:()=>true,access:async()=>({ok:true,userId:'owner'}),owned:async()=>projectId,consentBlocked:async()=>false,allowance:async()=>null,
    journal:async()=>({projectId,turns}),preparationRefusals:async(actor:{userId:string;projectId:string},ids:string[])=>{
      assert.equal(actor.userId,'owner');assert.equal(actor.projectId,projectId);
      assert.deepEqual(ids,[turns[0].requestId,turns[1].requestId,turns[5].requestId]);
      return new Map([[ids[0],'REFERENCE_INVALID'],[ids[1],'MODE_UNSUPPORTED']]);
    }} as unknown as NonNullable<Parameters<typeof handleMobileStudio>[2]>;
  const response=await handleMobileStudio(new NextRequest('https://example.invalid/api/mobile/studio/projects/project',{headers:{authorization:'Bearer test','x-maxvideoai-auth-mode':'bearer'}}),projectId,deps);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).turns.map((turn:{pauseReason?:string})=>turn.pauseReason),['reference',undefined,'budget',undefined,undefined,undefined]);
});
