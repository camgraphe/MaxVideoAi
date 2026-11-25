import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  comparisonSelection,
  chooseComparedEdit,
} from '../frontend/src/server/studio/conversation-comparison-choice';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import { createStudioVideoGenerationService } from '../frontend/src/server/studio/image-generation-service';
import { studioTaskFixture } from './helpers/studio-task-fixture';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { workflowCatalog } from './helpers/studio-video-workflow-fixtures';

const assetId = 'ma_' + 'a'.repeat(32);
const source = { type: 'asset' as const, kind: 'video' as const, assetId };
const prompt = 'Add a ribbon of blue light around the moving bicycle; keep its original movement.';
const comparison = {
  action: 'pricing.compare',
  mode: 'v2v',
  surface: 'video',
  prompt,
  references: [{ ref: source, role: 'source' }],
  settings: [],
  outputCount: 1,
  candidateModelIds: null,
  baselineModelId: null,
};
const option = (modelId: string, amountCents: number) => ({
  modelId,
  modelLabel: modelId,
  mode: 'v2v',
  surface: 'video',
  outputCount: 1,
  referenceCount: 1,
  quoteRequired: true,
  settings: { resolution: '360p', aspectRatio: '16:9' },
  references: [{ kind: 'asset', assetId, role: 'source' }],
  price: { amountCents, currency: 'USD' },
});
const options = [option('seedance-2-5', 113), option('gemini-omni-flash', 36), option('seedance-2-5-flash', 61)];
const result = {
  ok: true,
  action: 'pricing.compare',
  data: { options, quoteRequired: true, comparisonCurrency: 'USD', excludedCurrencies: [], baseline: null },
};
const select = (data: object, action = comparison) =>
  chooseComparedEdit(
    { action_json: action, result_json: { ...result, data: { ...result.data, ...data } } },
    [{ assetId, kind: 'video', label: 'Video 1', requestId: randomUUID() }],
    'fr',
    { by: 'minimum' },
  );

test('only a positive choice selects a comparable, unique and source-bound edit', () => {
  for (const text of [
    'Teste ton moins cher',
    'Va pour le moins cher !',
    'Le moins cher',
    'Try the cheapest one.',
    'Prueba el más barato',
    'D’accord, on part sur le moins cher des trois alors',
    'Celui à 0,36 $ me va',
  ])
    assert.ok(comparisonSelection(text), text);
  for (const text of [
    'Quel est le moins cher ?',
    'Ne prends pas le moins cher',
    'Is that the cheapest?',
    'Prueba el más barato en vertical',
    'Le moins cher avec Vidéo 2',
  ])
    assert.equal(comparisonSelection(text), null, text);
  const selected = select({});
  assert.ok(selected && 'revision' in selected);
  assert.equal(selected.revision?.action?.modelId, 'gemini-omni-flash');
  for (const change of [
    { options: [options[1], option('seedance-2-5', 36)] },
    { options: [] },
    { excludedCurrencies: [{ modelId: 'another', currency: 'EUR' }] },
    { options: [{ ...options[1], references: [{ kind: 'asset', assetId, role: 'reference' }] }] },
    {
      options: [
        { ...options[1], references: [{ kind: 'asset', assetId: 'ma_' + 'b'.repeat(32), role: 'source' }] },
      ],
    },
    { baseline: { ...options[1], settings: { resolution: '720p' } } },
  ])
    assert.ok('clarification' in select(change)!);
  assert.equal(
    chooseComparedEdit({ action_json: { ...comparison, filmDurationSec: 60 }, result_json: result }, [], 'fr', {
      by: 'minimum',
    }),
    null,
  );
});

test('selecting the cheapest edit prepares a fresh quote on the original video, before and after an old refusal', async (t) => {
  const fixture = await studioTaskFixture(t);
  const { pool } = fixture;
  const savedEnv = { NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  t.after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  });
  for (const file of [
    '53_studio_media_generation_scope.sql',
    '27_pricing_admin_cockpit.sql',
    '54_customer_tariff_cells.sql',
    '55_customer_tariff_versions.sql',
  ])
    await pool.query(readFileSync('neon/migrations/' + file, 'utf8'));
  await pool.query(`CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text)`);
  // The persisted comparison is 36 cents. The current local tariff intentionally prices the same edit at 42.
  const scenario = collectSellableManualTariffCoverage({
    modelId: 'gemini-omni-flash',
    mode: 'v2v',
  }).scenarios.find((row) => row.selector.resolution === '360p')!;
  const selector = {
    ...scenario.selector,
    durationSec: '4.132',
    inputVideoDurationSec: '4.132',
    inheritedDurationSec: '4.132',
  };
  await pool.query(
    `INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
    VALUES('comparison-qa',$1,$2,$3,'USD',now()-interval '1 day',1,'11111111-1111-4111-8111-111111111111')`,
    [
      JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b))),
      selector,
      { kind: 'fixed', customerCents: 42 },
    ],
  );
  await pool.query('UPDATE app_customer_tariff_state SET active=true, revision=1');
  const catalog = await workflowCatalog();
  for (const scenario of [
    'direct',
    'reopened',
    'worded',
    'amount',
    'director',
    'question',
    'interrupted',
    'latest-failed',
    'deleted',
  ] as const) {
    const actor = await fixture.actor();
    await pool.query(
      `INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
      VALUES($1,$2,$3,'video','https://cdn.maxvideoai.com/bicycle.mp4','video/mp4',10000,1080,1920,'ready','{"durationSec":4.132}')`,
      [randomUUID(), assetId, actor.userId],
    );
    const message = (message: string) => ({
      message,
      requestId: randomUUID(),
      locale: 'fr' as const,
      references: [],
    });
    const store = async (input: ReturnType<typeof message>, reply: string) => {
      await pool.query(
        `INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,lease_id,lease_expires_at,state)
        VALUES($1,$2,$3,repeat('a',64),$4,$5,repeat('b',64),$6,now(),'ready')`,
        [actor.userId, actor.projectId, input.requestId, input, { reply, image: null }, randomUUID()],
      );
    };
    const first = {
      ...message('Compare trois modèles pour retoucher cette vidéo.'),
      attachments: [source],
      referenceMentions: [{ label: 'Video 1', assetId }],
    };
    await store(first, 'Gemini ou Seedance ?');
    await pool.query(
      `INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision,state,result_json)
      VALUES($1,$2,$3,'pricing',$4,repeat('c',64),$5,0,'completed',$6)`,
      [actor.userId, actor.projectId, first.requestId, randomUUID(), comparison, result],
    );
    const choice = 'Teste ton moins cher';
    if (scenario === 'reopened') await store(message(choice), 'Réattachez la vidéo.');
    if (scenario === 'deleted')
      await pool.query('UPDATE media_assets SET deleted_at=now() WHERE user_id=$1', [actor.userId]);
    if (scenario === 'interrupted')
      await store(message('Combien de crédits me reste-t-il ?'), 'Voici comment consulter ton solde.');
    if (scenario === 'latest-failed')
      await pool.query(
        `INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision,state,result_json)
      VALUES($1,$2,$3,'second-pricing',$4,repeat('d',64),$5,0,'completed',$6)`,
        [
          actor.userId,
          actor.projectId,
          first.requestId,
          randomUUID(),
          comparison,
          { ok: false, action: 'pricing.compare', error: { code: 'PARAMETER_INVALID' } },
        ],
      );
    let directorCalls = 0;
    const open = () =>
      createImageConversationService(actor, {
        enabled: true,
        actionsEnabled: true,
        mediaEnabled: true,
        assistancePolicy: {
          enabled: false,
          solAllowanceNanoUsd: 0,
          lunaAllowanceNanoUsd: 0,
          campaignNanoUsd: 0,
          maxAdditionalBudgetCents: 0,
        },
        createActionResponse: async (params) => {
          directorCalls++;
          const response = {
            id: 'response-' + randomUUID(),
            model: 'gpt-6.1-sol',
            status: 'completed' as const,
            service_tier: 'default' as const,
            usage: null,
          };
          if (scenario === 'question' || scenario === 'interrupted')
            return {
              ...response,
              output: [],
              output_text: JSON.stringify({ reply: 'Voici les informations demandées.' }),
            };
          assert.equal(scenario, 'director', 'Only an open-ended choice needs model interpretation');
          assert.match(JSON.stringify(params.input), new RegExp(assetId));
          return {
            ...response,
            output_text: '',
            output: [
              {
                type: 'function_call' as const,
                name: 'video_prepare',
                call_id: 'selected-model',
                arguments: JSON.stringify({
                  source,
                  modelId: 'gemini-omni-flash',
                  mode: 'v2v',
                  prompt,
                  settings: [{ name: 'resolution', value: '360p' }],
                  aspectRatio: '16:9',
                  reply: 'Voici le devis.',
                }),
              },
            ],
          };
        },
        videoGenerationFactory: (owner, opts) =>
          createStudioVideoGenerationService(owner, {
            ...opts,
            prepareDependencies: {
              listPublicEngines: async () => catalog,
              resolveRequestExecutability: () => ({ executable: true, reason: 'available' }),
            },
          }),
      });
    const input = message(
      scenario === 'director'
        ? 'Ton option économique me tente bien'
        : scenario === 'question'
          ? 'Quel est le moins cher ?'
          : scenario === 'amount'
            ? 'Celui à 0,36 $ me va'
            : scenario === 'worded'
              ? 'D’accord, on part sur le moins cher des trois alors'
              : choice,
    );
    const turn = await open().submit(input);
    if (['question', 'interrupted', 'latest-failed'].includes(scenario)) {
      assert.equal(turn.quote, null);
      assert.equal(directorCalls, scenario === 'latest-failed' ? 0 : 1);
      if (scenario === 'latest-failed') assert.match(turn.reply!, /quel modèle/);
      continue;
    }
    if (scenario === 'deleted') {
      assert.equal(turn.quote, null);
      assert.match(turn.reply!, /ne peux pas lire/);
      continue;
    }
    assert.equal(directorCalls, scenario === 'director' ? 1 : 0);
    assert.ok(turn.quote, turn.reply ?? 'missing quote');
    assert.equal(turn.quote.summary.engineId, 'gemini-omni-flash');
    assert.equal(turn.quote.summary.mode, 'v2v');
    assert.equal(turn.quote.summary.prompt, prompt);
    assert.equal(turn.quote.sourceReferenceSummary, 'Vidéo 1');
    assert.equal(turn.quote.summary.settings.resolution, '360p');
    assert.equal(turn.quote.summary.settings.aspectRatio, '16:9');
    assert.deepEqual(turn.quote.summary.references, options[1].references);
    assert.equal(turn.quote.price.amountCents, 42);
    assert.equal(turn.quote.outputDurationSec, 4.132);
    assert.equal((await open().submit(input)).quote?.quoteId, turn.quote.quoteId);
    assert.equal(
      (await open().read()).turns.find((row) => row.requestId === input.requestId)?.quote?.quoteId,
      turn.quote.quoteId,
    );
    const counts = (
      await pool.query(
        `SELECT sum(jsonb_array_length(coalesce(input_json->'attachments','[]')))::int attachments,
      (SELECT count(*)::int FROM mcp_generation_quotes WHERE studio_project_id=$1) quotes,
      (SELECT count(*)::int FROM app_jobs) jobs,(SELECT count(*)::int FROM app_receipts WHERE type='charge') charges
      FROM studio_image_turns WHERE project_id=$1`,
        [actor.projectId],
      )
    ).rows[0];
    assert.deepEqual(counts, { attachments: 1, quotes: 1, jobs: 0, charges: 0 });
  }
});
