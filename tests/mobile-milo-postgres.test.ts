import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { getDb } from '../frontend/src/lib/db';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { readMobileModels } from '../frontend/src/server/mobile/catalog';
import { runPromptAssistanceWorkerOnce } from '../frontend/src/server/prompt-assistance/worker';
import { buildPromptAssistanceContext } from '../frontend/src/server/prompt-assistance/context';
import { handleMobileMilo, handleMobileMiloAnalysis } from '../frontend/src/server/mobile/milo';
import { MobileHttpError } from '../frontend/src/server/mobile/errors';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const headers = { authorization: 'Bearer fixture', 'x-maxvideoai-auth-mode': 'bearer' };
function route(query = '', body?: unknown, extra: Record<string, string> = headers) {
  return new NextRequest('https://example.test/api/mobile/milo' + query, {
    method: body ? 'POST' : 'GET',
    headers: extra,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('native Milo requires an explicit bearer and current consent before admitting reads or writes', async () => {
  for (const body of [
    undefined,
    { action: 'choose', choice: { action: 'select_luna', expectedRevision: 0 } },
  ]) {
    for (const extra of [
      { cookie: 'session=fixture' },
      { authorization: 'Bearer fixture' },
      { 'x-maxvideoai-auth-mode': 'bearer', cookie: 'session=fixture' },
    ]) {
      const res = await handleMobileMilo(route('', body, extra as Record<string, string>), {
        enabled: true,
      });
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { ok: false, error: 'UNAUTHORIZED' });
    }
    const blocked = await handleMobileMilo(route('', body), {
      enabled: true,
      user: async (_req, consent) => {
        assert.equal(consent, true);
        throw new MobileHttpError('LEGAL_CONSENT_REQUIRED', 403, 'Review your account.');
      },
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).error, 'LEGAL_CONSENT_REQUIRED');
  }
  const disabled = await handleMobileMilo(route(), {
    enabled: false,
    user: async () => {
      throw Error('unexpected');
    },
  });
  assert.equal(disabled.status, 404);
});


test('native excerpt analysis uses bearer identity and current consent before preparing or confirming', async () => {
  const sessionId = randomUUID();
  for (const body of [
    undefined,
    {
      action: 'confirm',
      sessionId,
      confirmation: { analysisId: randomUUID(), maxCredits: 20, policyVersion: 'fixture', confirmed: true },
    },
  ]) {
    const unauthenticated = await handleMobileMiloAnalysis(
      route('/analyses', body, { cookie: 'session=fixture' }),
      { enabled: true },
    );
    assert.equal(unauthenticated.status, 401);
    const prevented = await handleMobileMiloAnalysis(route('/analyses', body), {
      enabled: true,
      user: async (_req, consent) => {
        assert.equal(consent, true);
        throw new MobileHttpError('LEGAL_CONSENT_REQUIRED', 403, 'Review your account.');
      },
    });
    assert.equal(prevented.status, 403);
  }
  const deps = { enabled: true, user: async () => 'owner', models: async () => [] };
  for (const body of [
    { action: 'startRecommended', requestId: randomUUID(), sessionId },
    {
      action: 'prepare',
      requestId: randomUUID(),
      sessionId,
      fieldId: 'video_url',
      slot: 0,
      modality: 'visual',
      startSec: 0,
      draft: {
        surface: 'video',
        workflow: 'modify',
        engineId: 'unpublished-native-engine',
        mode: 'v2v',
        target: 'prompt',
        text: '',
        settings: {},
        references: [
          {
            fieldId: 'video_url',
            slot: 0,
            label: 'Video',
            ref: { type: 'asset', assetId: 'ma_' + '1'.repeat(32), kind: 'video' },
          },
        ],
      },
    },
  ]) {
    const prevented = await handleMobileMiloAnalysis(route('/analyses', body), deps);
    assert.equal(prevented.status, 400);
    assert.equal((await prevented.json()).error, 'INVALID_REQUEST');
  }
});

test('mobile shares Milo selection and owner-scoped requests without granting a purchase or starting a provider on read', async (t) => {
  const pg = await startDisposablePostgres('mobile-milo');
  const env = {
    DATABASE_URL: pg.databaseUrl,
    STUDIO_ASSISTANCE_ENABLED: 'true',
    PROMPT_ASSISTANCE_WORKERS_ENABLED: 'true',
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(async () => {
    await getDb().end();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  for (const name of [
    '54_studio_assistance_ledger.sql',
    '62_studio_assistance_resolutions.sql',
    '63_studio_assistance_credits.sql',
    '85_prompt_assistance.sql',
    '86_milo_three_levels.sql',
    '87_milo_runtime_bounds.sql',
    '96_milo_lite_output_allowance.sql',
    '92_milo_reply_workers.sql',
    '93_milo_output_credit_refunds.sql',
  ])
    await pg.pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
  const wakeups: unknown[] = [];
  const catalog = {
    listEngines: async () => getBaseEnginesByCategory('video'),
    surfaceByEngineId: () => 'video' as const,
  };
  const deps = {
    enabled: true,
    user: async () => 'alice',
    schedule: (scope: unknown) => {
      wakeups.push(scope);
    },
    models: async (filter: Parameters<typeof readMobileModels>[0]) => readMobileModels(filter, catalog),
  };
  const call = (body?: unknown, query = '', who = 'alice') =>
    handleMobileMilo(route(query, body), { ...deps, user: async () => who });
  const choose = (action: string, expectedRevision: number) => ({
    action: 'choose',
    choice: { action, expectedRevision },
  });
  const status = async () => {
    const res = await call();
    assert.equal(res.status, 200);
    return res.json();
  };
  const balances = async () =>
    (
      await pg.pool.query(`SELECT
    (SELECT count(*)::int FROM studio_assistance_calls) AS provider_calls,
    (SELECT count(*)::int FROM studio_assistance_turns) AS turns,
    (SELECT count(*)::int FROM app_receipts) AS receipts`)
    ).rows[0];
  const before = await balances();
  const initial = await status();
  assert.equal(initial.result.enabled, true);
  assert.equal(initial.pendingRequest, undefined);
  assert.deepEqual(await balances(), before);
  const request = {
    sessionId: randomUUID(),
    requestId: randomUUID(),
    draftRevision: 1,
    assistanceModel: initial.result.selectedModel,
    assistanceRevision: initial.result.revision,
    locale: 'fr',
    message: 'Précise le mouvement de caméra.',
    draft: {
      surface: 'video',
      mode: 't2v',
      workflow: 'create',
      engineId: 'seedance-2-5',
      target: 'prompt',
      text: 'Le bateau rentre au port.',
      settings: {},
      references: [],
    },
  };
  const message = (overrides: object = {}) => ({
    action: 'message',
    request: { ...request, ...overrides },
  });
  for (const rejected of [
    message({ assistanceModel: undefined, assistanceRevision: undefined }),
    message({ assistanceRevision: undefined }),
    ...[
      { target: 'script' },
      { surface: 'audio' },
      { mode: 'v2v', workflow: 'create' },
      {
        mode: 'v2v',
        workflow: 'modify',
        references: [
          {
            fieldId: 'wrong_field',
            slot: 0,
            label: 'Source video',
            ref: { type: 'asset', kind: 'video', assetId: 'ma_' + '7'.repeat(32) },
          },
        ],
      },
      { workflow: undefined },
      { engineId: 'hidden' },
      { references: [{ fieldId: 'startImage', slot: 0, label: 'Image', ref: null }] },
    ].map((draft) => message({ draft: { ...request.draft, ...draft } })),
    { action: 'recover', sessionId: request.sessionId, requestId: request.requestId },
    choose('disable_paid', 0),
    {
      action: 'choose',
      choice: {
        action: 'purchase_pack',
        amountCents: 200,
        expectedRevision: 0,
        purchaseKey: randomUUID(),
        tariffVersion: 'fixture',
      },
    },
    {
      action: 'choose',
      choice: {
        action: 'authorize_paid',
        budgetCents: 200,
        expectedRevision: 0,
        tariffVersion: 'fixture',
      },
    },
    {
      action: 'choose',
      choice: { action: 'resume_paid', expectedRevision: 0, tariffVersion: 'fixture' },
    },
  ]) {
    const response = await call(rejected);
    assert.equal(response.status, 400, JSON.stringify(rejected));
    assert.equal((await response.json()).error, 'INVALID_REQUEST');
  }
  let rev = initial.result.revision;
  for (const [action, model] of [
    ['select_terra', 'gpt-6.1-terra'],
    ['select_sol', 'gpt-6.1-sol'],
    ['select_luna', 'gpt-6-luna'],
  ]) {
    const selected = await call(choose(action, rev));
    assert.equal(selected.status, 200);
    const result = (await selected.json()).result;
    assert.equal(result.selectedModel, model);
    assert.equal(result.paid.enabled, false);
    rev = result.revision;
  }
  assert.deepEqual(await balances(), before);
  const stale = await call(message());
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, 'ASSISTANCE_SELECTION_CHANGED');
  const accepted = message({ assistanceModel: 'gpt-6-luna', assistanceRevision: rev });
  const send = await call(accepted);
  assert.equal(send.status, 200);
  assert.equal((await send.json()).result.state, 'pending');
  assert.deepEqual(wakeups, [
    { userId: 'alice', sessionId: request.sessionId, requestId: request.requestId },
  ]);
  const after = await balances();
  assert.deepEqual(after, { ...before, turns: before.turns + 1 });
  const pending = await status();
  assert.equal(pending.pendingRequest.scope, 'video:create');
  const session = '?sessionId=' + request.sessionId,
    poll = session + '&requestId=' + request.requestId;
  for (const suffix of [poll, session + '&scope=video:create']) {
    const owned = await call(undefined, suffix);
    assert.equal(owned.status, 200);
    assert.equal((await owned.json()).result.sessionId, request.sessionId);
    const foreign = await call(undefined, suffix, 'bob');
    assert.equal(foreign.status, 404);
  }
  assert.equal((await call(undefined, session + '&scope=image:create')).status, 409);
  assert.equal((await call(undefined, session + '&scope=audio:music')).status, 409);
  assert.equal((await call(undefined, session + '&scope=video:modify')).status, 409);
  assert.equal((await call(undefined, session + '&scope=video:extend')).status, 409);
  for (const invalid of [
    session + '&scope=audio:cinematic',
    session + '&scope=video:unknown',
    poll + '&scope=video:create',
    '?action=purchase_pack',
  ]) {
    assert.equal((await call(undefined, invalid)).status, 400);
  }
  assert.equal(wakeups.length, 1);
  assert.deepEqual(await balances(), after);
  const replay = await call(accepted);
  assert.equal(replay.status, 200);
  assert.deepEqual(await balances(), after);
  let creates = 0;
  const scope = { userId: 'alice', sessionId: request.sessionId, requestId: request.requestId };
  const prompt = 'Le bateau entre lentement au port, cadré depuis le quai.';
  const work = () =>
    runPromptAssistanceWorkerOnce({
      scope,
      executionDependencies: {
        buildContext: (owner, input) => buildPromptAssistanceContext(owner, input, { catalog }),
        count: async () => 100,
        create: async (params) => {
          ++creates;
          assert.equal(params.model, 'gpt-6-luna');
          assert.match(String(params.instructions), /phone app, Create video/);
          assert.match(String(params.instructions), /References beside the model.*Phone gallery/s);
          assert.match(String(params.instructions), /Save copies only this file to your chosen folder/);
          assert.match(String(params.instructions), /Share downloads it and opens the system share sheet/);
          assert.doesNotMatch(String(params.instructions), /Choose from Media|same browser tab/);
          return {
            id: 'resp_mobile_test',
            model: params.model,
            status: 'completed',
            service_tier: 'default',
            output_text: JSON.stringify({
              kind: 'replacement',
              reply: 'Voici le cadrage proposé.',
              text: prompt,
              analysisRequest: null,
            }),
            usage: {
              input_tokens: 100,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens: 100,
            },
          } as never;
        },
      },
    });
  assert.equal(await work(), true);
  assert.equal(creates, 1);
  const completed = await (await call(undefined, poll)).json();
  assert.equal(completed.result.state, 'complete');
  assert.equal(completed.result.reply.text, prompt);
  assert.equal(
    (await (await call(undefined, session + '&scope=video:create')).json()).result.proposal.text,
    prompt,
  );
  assert.equal((await status()).pendingRequest, undefined);
  assert.equal(await work(), false);
  assert.deepEqual(await balances(), { ...after, provider_calls: 1 });
});

test('each published Create mode admits its native prompt workflow and projects analysis for capable clients', async () => {
  const { initialStatus } = await import('./helpers/milo-status-fixture');
  for (const surface of ['video', 'image'] as const) {
    const catalog = {
      listEngines: async () => getBaseEnginesByCategory(surface),
      surfaceByEngineId: () => surface,
    };
    const models = (filter: Parameters<typeof readMobileModels>[0]) => readMobileModels(filter, catalog);
    const list = await models({ surface, mediaReferences: true });
    const modes = new Set(list.flatMap((model) => model.modes.map((option) => option.mode)));
    assert.ok(modes.has(surface === 'video' ? 't2v' : 't2i'));
    assert.ok(modes.has(surface === 'video' ? 'i2v' : 'i2i'));
    for (const mode of modes) {
      const model = list.find((candidate) => candidate.modes.some((option) => option.mode === mode))!;
      const control = model.modes.find((option) => option.mode === mode)!;
      const field = control.sourceVideo?.fieldId ?? control.referenceImageField;
      const closingFrame = control.lastFrame ?? control.optionalLastFrame;
      assert.equal(Boolean(field), Boolean(control.referenceRole), model.id + ' ' + mode);
      const request = {
        sessionId: randomUUID(),
        requestId: randomUUID(),
        draftRevision: 0,
        locale: 'en',
        message: 'Refine this scene.',
        assistanceModel: initialStatus.selectedModel,
        assistanceRevision: initialStatus.revision,
        draft: {
          surface,
          engineId: model.id,
          mode,
          workflow:
            mode === 'v2v' ? 'modify' : mode === 'extend' ? 'extend' : mode === 'i2i' ? 'edit' : 'create',
          target: 'prompt',
          text: 'Boat in port.',
          settings: {},
          references: [
            ...(field ? [
                {
                  fieldId: field,
                  slot: 0,
                  label: control.sourceVideo ? 'Source video' : 'Reference image',
                  ref: { type: 'asset', assetId: 'ma_' + '7'.repeat(32), kind: control.sourceVideo ? 'video' : 'image' },
                },
                ...(closingFrame ? [{fieldId:closingFrame.fieldId,slot:0,label:'Last frame',ref:{type:'asset',assetId:'ma_'+'8'.repeat(32),kind:'image'}}] : []),
              ] : []),
            ...(control.mediaReferenceFields ?? []).map((media, index) => ({
              fieldId: media.fieldId, slot: 0, label: media.kind,
              ref: { type: 'asset', assetId: 'ma_' + String(index + 1).repeat(32), kind: media.kind },
            })),
          ],
        },
      };
      const inlineAnalysis = mode !== 't2v' && mode !== 't2i';
      const result = await handleMobileMilo(
        route('', { action: 'message', request }, inlineAnalysis ? { ...headers, 'x-milo-inline-analysis': '1' } : headers),
        {
          enabled: true,
          user: async () => 'native-owner',
          models,
          send: async (owner, input) => {
            assert.equal(owner, 'native-owner');
            assert.deepEqual(input, request);
            return {
              sessionId: input.sessionId,
              requestId: input.requestId,
              draftRevision: input.draftRevision,
              target: input.draft.target,
              message: input.message,
              state: 'complete',
              assistance: initialStatus,
              reply: {
                reply: 'Describe the motion.',
                text: null,
                analysisRequest: {
                  fieldId: 'video_urls',
                  slot: 0,
                  modality: 'visual',
                  startSec: 0,
                  endSec: 10,
                  ref: { type: 'asset', kind: 'video', assetId: 'ma_' + 'a'.repeat(32) },
                },
              },
            };
          },
        },
      );
      assert.equal(result.status, 200);
      assert.match(result.headers.get('cache-control') ?? '', /no-store/);
      assert.match(result.headers.get('vary') ?? '', /Authorization/);
      const reply = (await result.json()).result.reply;
      assert.equal(reply.reply, 'Describe the motion.');
      assert.equal(reply.text, null);
      assert.equal(reply.analysisRequest?.modality, inlineAnalysis ? 'visual' : undefined);
    }
  }
});

test('mobile audio Milo accepts only live stock workflows with native text target and verified controls', async () => {
  const { initialStatus } = await import('./helpers/milo-status-fixture');
  const { listAudioCapabilities } = await import('../frontend/src/server/agent-api/audio-capabilities');
  const { readMobileAudioCatalog } = await import('../frontend/src/server/mobile/audio-catalog');
  const { AUDIO_INTENT_PACK, AUDIO_CREATION_INTENTS } = await import('../frontend/src/lib/audio-creation');
  const catalog = readMobileAudioCatalog(
    listAudioCapabilities({
      FAL_KEY: 'test-offline',
      GOOGLE_VERTEX_PROJECT_ID: 'test-project',
      GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: 'test-offline',
    }),
  );
  for (const workflow of AUDIO_CREATION_INTENTS) {
    const mode = catalog.modes.find((item) => item.mode === AUDIO_INTENT_PACK[workflow])!;
    for (const variant of mode.variants.filter((item) => item.available)) {
      const draft = {
        surface: 'audio',
        workflow,
        mode: mode.mode,
        engineId: mode.engineId,
        target: workflow === 'voice' ? 'script' : 'prompt',
        text: 'The rain comes and goes.',
        settings: variant.settings,
        references: [],
        ...(workflow === 'song' ? { readOnlyText: { lyrics: 'Here we go again.' } } : {}),
      };
      let sends = 0;
      const call = async (overrides: object) =>
        handleMobileMilo(
          route('', {
            action: 'message',
            request: {
              sessionId: randomUUID(),
              requestId: randomUUID(),
              draftRevision: 1,
              locale: 'en',
              message: 'Improve this text.',
              assistanceModel: initialStatus.selectedModel,
              assistanceRevision: initialStatus.revision,
              draft: { ...draft, ...overrides },
            },
          }),
          {
            enabled: true,
            user: async () => 'owner',
            audio: () => catalog,
            send: async (_user, input) => {
              sends++;
              return {
                sessionId: input.sessionId,
                requestId: input.requestId,
                draftRevision: 1,
                target: input.draft.target,
                message: input.message,
                state: 'complete',
                assistance: initialStatus,
              };
            },
          },
        );
      assert.equal((await call({})).status, 200);
      for (const invalid of [
        { target: 'lyrics' },
        { engineId: 'unpublished' },
        { workflow: 'edit' },
        { settings: { ...variant.settings, unknown: 'invalid' } },
        { readOnlyText: { negativePrompt: 'x' } },
      ]) {
        assert.equal((await call(invalid)).status, 400);
      }
      assert.equal(sends, 1);
    }
  }
});
