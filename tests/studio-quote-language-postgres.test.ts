import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleStudioImageConversation } from '../frontend/app/api/studio/_lib/studio-image-conversation-handler';
import { createStudioCallRuntime } from '../scripts/qa/studio-call-runtime';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import { createStudioImageGenerationService } from '../frontend/src/server/studio/image-generation-service';
import { detectStudioLexicalLanguage, studioQuoteReplyLanguage } from '../frontend/src/server/studio/conversation-language';
import type { StudioDirectorResponse } from '../frontend/src/server/studio/conversation-director';

const providerPrompt = 'Make this matte table red with beautiful lighting.';
const providerReply = 'Its estimated price is $0.19.';
const response = (quote: boolean): StudioDirectorResponse => ({
  id: randomUUID(), model: 'gpt-6-luna', status: 'completed', service_tier: 'default', usage: null,
  output_text: quote ? '' : '{"reply":"Ready."}',
  output: quote ? [{ type: 'function_call', name: 'image_prepare', call_id: 'image-quote',
    arguments: JSON.stringify({
      reply: providerReply, prompt: providerPrompt, aspectRatio: '1:1', modelId: 'gpt-image-2-5-flare', mode: 't2i',
      outputCount: 1, references: [], settings: [{ name: 'resolution', value: '1024x1024' }, { name: 'outputFormat', value: 'png' }],
    }),
  }] : [],
});

const localePrice = { fr: /Devis de génération.*0,07/, es: /Presupuesto de generación.*0,07/, en: /Generation quote.*\$0\.07/ };
const authoredTurn = (message: string, requestId = randomUUID(), locale?: 'fr' | 'es' | 'en') =>
  ({ requestId, message, references: [], referenceMentions: [], ...(locale ? { locale } : {}) });

async function route(projectId: string, userId: string, input?: ReturnType<typeof authoredTurn>,
  serviceFactory?: typeof createImageConversationService) {
  const origin = 'https://quote-fixture.test';
  const req = new NextRequest(origin + '/api/studio/projects/' + projectId + '/image-conversation', input
    ? { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(input) }
    : undefined);
  const result = await handleStudioImageConversation(req, projectId, input ? 'submit' : 'read', {
    enabled: true, tasksEnabled: false, resolveAccess: async () => ({ ok: true, userId }), serviceFactory,
  });
  const body = await result.json();
  assert.equal(result.status, 200, JSON.stringify(body));
  return body.result;
}

test('quote language follows authored language and explicit preferences, with separate lexical detection', () => {
  assert.equal(detectStudioLexicalLanguage('Please reply in French.'), undefined);
  assert.equal(studioQuoteReplyLanguage({ message: 'Ahora respóndeme en español.' }, { recent: [], precedingCommand: 'fr' }), 'es');
  assert.equal(detectStudioLexicalLanguage('Garde la voix off.', true), undefined);
  assert.equal(detectStudioLexicalLanguage('Une voix off.', true), 'fr');
  assert.equal(detectStudioLexicalLanguage('Una voz en off.', true), 'es');
  assert.equal(studioQuoteReplyLanguage({ message: 'Crée une image de parfum bleu cobalt', locale: 'es' }, { recent: [] }), 'fr');
  assert.equal(studioQuoteReplyLanguage({ message: 'OK', locale: 'en' }, { recent: [{ message: 'Crea una imagen de perfume azul' }] }), 'es');
  assert.equal(studioQuoteReplyLanguage({ message: 'Réponds-moi en français.', locale: 'es' }, { recent: [] }), 'fr');
  assert.equal(studioQuoteReplyLanguage({ message: 'OK' }, { recent: [{ message: 'Fine.', locale: 'es' }] }), 'es');
});

test('short first briefs and historical OKs keep the same localized quote on POST, GET and replay', async t => {
  const entry = getFalEngineById('gpt-image-2-5-flare')!;
  const catalog = [{ engine: entry.engine, surface: 'image' as const, publicModes: ['t2i' as const],
    modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) }];
  const runtime = await createStudioCallRuntime(catalog);
  t.after(() => runtime.close());
  const db = getDb();
  for (const [locale, brief, different] of [
    ['fr', 'Crée une image de parfum bleu cobalt', 'Responde en español.'],
    ['es', 'Crea una imagen de perfume azul', 'Réponds-moi en français.'],
  ] as const) {
    await t.test(locale, async () => {
      const projectId = 'historical-quote-language-' + locale;
      const firstInput = authoredTurn(brief);
      const first = await runtime.submit(projectId, firstInput.message, [], async () => response(true), firstInput.requestId);
      assert.equal(first.error, undefined);
      assert.match(first.result?.reply ?? '', localePrice[locale]);
      assert.equal(first.result?.locale, undefined);
      assert.equal(first.result?.quote?.summary.prompt, providerPrompt);
      const { user_id: userId } = (await db.query<{ user_id: string }>(
        'SELECT user_id FROM studio_projects WHERE id=$1', [projectId])).rows[0];
      assert.match((await route(projectId, userId)).turns[0].reply, localePrice[locale]);

      // A language command from another project owned by the same account must never be inherited.
      const neighbor = projectId + '-other';
      await db.query('INSERT INTO studio_projects(id,user_id,name) VALUES ($1,$2,$3)', [neighbor, userId, 'Other project']);
      const elsewhere = authoredTurn(different);
      await db.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,state,lease_id,lease_expires_at)
        VALUES($1,$2,$3,$4,$5,'ready',$6,clock_timestamp())`,
        [userId, neighbor, elsewhere.requestId, '0'.repeat(64), elsewhere, randomUUID()]);

      const okInput = authoredTurn('OK');
      const ok = await runtime.submit(projectId, okInput.message, [], async () => response(true), okInput.requestId);
      assert.equal(ok.error, undefined);
      assert.equal(ok.result?.locale, undefined);
      assert.match(ok.result?.reply ?? '', localePrice[locale]);

      // Insert later authored turns so GET's oldest listed quote no longer has its preceding brief in the page.
      await db.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,state,lease_id,lease_expires_at,created_at)
        SELECT $1,$2,id,$3,jsonb_build_object('requestId',id,'message',$4::text,'references','[]'::jsonb),'ready',id,
          clock_timestamp(),clock_timestamp()+n*interval '1 microsecond'
        FROM unnest($5::uuid[]) WITH ORDINALITY AS inserted(id,n)`,
        [userId, projectId, '0'.repeat(64), different, Array.from({ length: 29 }, () => randomUUID())]);
      const read = await route(projectId, userId);
      assert.equal(read.turns.length, 30);
      assert.equal(read.turns[0].requestId, okInput.requestId);
      assert.equal(read.turns[0].reply, ok.result?.reply);

      const replay = await route(projectId, userId, okInput, (actor, options) => createImageConversationService(actor, {
        ...options, actionsEnabled: true,
        createActionResponse: async () => assert.fail('A stored turn must not start another model response.'),
      }));
      assert.equal(replay.reply, ok.result?.reply);
      assert.equal(replay.quote.quoteId, ok.result?.quote?.quoteId);
      assert.deepEqual(ok.counts, { jobs: 0, charges: 0 });
    });
  }

  await t.test('an older explicit language survives 35 OKs and a later change leaves the rendered quote alone', async () => {
    const projectId = 'quote-explicit-language';
    await runtime.submit(projectId, 'OK', [], async () => response(false));
    const { user_id: userId } = (await db.query<{ user_id: string }>(
      'SELECT user_id FROM studio_projects WHERE id=$1', [projectId])).rows[0];
    const olderMessages = [
      'Réponds-moi en français.',
      'No me respondas en inglés.'.normalize('NFD'),
      ...Array<string>(34).fill('Garde la voix en français, avec des sous-titres en anglais.'),
      ...Array<string>(35).fill('OK'),
    ];
    await db.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,state,lease_id,lease_expires_at,created_at)
      SELECT $1,$2,id,$3,jsonb_build_object('requestId',id,'message',message,'references','[]'::jsonb),'ready',id,
        clock_timestamp(),clock_timestamp()-interval '2 hours'+n*interval '1 second'
      FROM unnest($4::uuid[],$5::text[]) WITH ORDINALITY AS prior(id,message,n)`,
    [userId, projectId, '0'.repeat(64), olderMessages.map(() => randomUUID()), olderMessages]);
    let modelCalls = 0;
    const serviceFactory: typeof createImageConversationService = (actor, options) => createImageConversationService(actor, {
      ...options, actionsEnabled: true, mediaEnabled: true,
      generationFactory: (actor, options) => createStudioImageGenerationService(actor, {
        ...options, prepareDependencies: {
          listPublicEngines: async () => catalog,
          resolveRequestExecutability: () => ({ executable: true, reason: 'available' }),
        },
      }),
      assistancePolicy: { enabled: false, solAllowanceNanoUsd: 0, lunaAllowanceNanoUsd: 0, campaignNanoUsd: 0, maxAdditionalBudgetCents: 0 },
      createActionResponse: async () => { modelCalls++; return response(true); },
    });
    const spanish = authoredTurn('OK', randomUUID(), 'en');
    const first = await route(projectId, userId, spanish, serviceFactory);
    assert.match(first.reply, localePrice.es);
    const jobId = randomUUID();
    await db.query(`UPDATE mcp_generation_quotes SET state='claimed',job_id=$2,
      claimed_at=created_at+interval '1 microsecond',updated_at=clock_timestamp()
      WHERE quote_id=$1`, [first.quote.quoteId, jobId]);
    await db.query("UPDATE mcp_generation_quotes SET state='accepted',updated_at=clock_timestamp() WHERE quote_id=$1", [first.quote.quoteId]);
    await db.query("INSERT INTO app_jobs(job_id,user_id,surface,status,progress) VALUES ($1,$2,'image','completed',100)", [jobId, userId]);
    const french = authoredTurn('Réponds-moi en français. Prépare le devis.', randomUUID(), 'en');
    const second = await route(projectId, userId, french, serviceFactory);
    assert.match(second.reply, localePrice.fr);
    const read = await route(projectId, userId);
    const oldRender = read.turns.find((turn: { requestId: string }) => turn.requestId === spanish.requestId);
    assert.equal(oldRender.reply, first.reply);
    assert.equal(oldRender.generation.status, 'completed');
    const replay = await route(projectId, userId, spanish, serviceFactory);
    assert.equal(replay.reply, first.reply);
    assert.equal(replay.generation.jobId, jobId);
    assert.equal(modelCalls, 2);
  });
});
