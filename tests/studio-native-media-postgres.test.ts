import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {renewMobileStudioQuote} from '../frontend/src/server/mobile/studio-renewal';
import {createStudioAudioGenerationService} from '../frontend/src/server/studio/audio-generation-service';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {prepareAudioRun} from '../frontend/src/server/audio/prepare-audio';
import {completeAudioJob} from '../frontend/src/server/audio/audio-generate-jobs';
import {loadPricingPolicyOverridesWithExecutor} from '../frontend/src/lib/pricing-rule-store';
import {createPaidGenerationTestSchema, startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup, ProviderHarness} from './helpers/mcp-paid-e2e-harness';

test('native video/voice/music turns keep quotes, confirmation and recovery in the same owned conversation', async t => {
  const pg = await startDisposablePostgres('studio-native-media');
  const prior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end(); if (prior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior; await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  const userId = '00000000-0000-4000-8000-000000000084';
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    CREATE TABLE studio_sequences(id text PRIMARY KEY); CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text);`);
  await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd')", [userId]);
  await pg.pool.query("INSERT INTO studio_projects VALUES ('film',$1,'Film',NULL),('other',$1,'Other',NULL)", [userId]);
  for (const name of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])
    await pg.pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
  await addTopup(pg.pool, userId, 1000);
  const actor = {authMethod: 'studio-session' as const, userId, projectId: 'film', clientId: null};
  const engine = getFalEngineById('wan-3')!;
  const catalog = [{engine: engine.engine, surface: 'video' as const, publicModes: ['t2v' as const,'i2v' as const], modeCaps: Object.fromEntries(engine.modes.map(mode => [mode.mode, mode.ui]))}];
  const provider = new ProviderHarness(pg.pool);
  const videoFactory: typeof createStudioVideoGenerationService = (current, options) => createStudioVideoGenerationService(current, {...options,
    prepareDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true, reason: 'available'})},
    confirmDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true, reason: 'available'}), submitPaidGeneration: provider.submit},
  });
  const env = {FAL_KEY: 'test-only-no-network', GOOGLE_VERTEX_PROJECT_ID: 'test-project', GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: 'test-only-no-network'};
  const executor = {query: async (sql: string, params?: unknown[]) => (await pg.pool.query(sql, params)).rows};
  let audioExecutions = 0;
  const audioFactory: typeof createStudioAudioGenerationService = (current, options) => createStudioAudioGenerationService(current, {...options,
    prepareDependencies: {listCapabilities: () => listAudioCapabilities(env), prepareRun: (body, owner) => prepareAudioRun(body, owner, {env, pricingPolicy: {loadOverrides: () => loadPricingPolicyOverridesWithExecutor(executor)}})},
    confirmDependencies: {listCapabilities: () => listAudioCapabilities(env), executeRun: async run => {audioExecutions++; await completeAudioJob(run.jobId, {progress: 100, message: 'Ready', audioUrl: 'https://media.maxvideoai.com/audio/fixture.mp3'});}},
  });
  let calls = 0;
  let next: any;
  const options = {enabled: true, actionsEnabled: true, mediaEnabled: true, videoGenerationFactory: videoFactory, audioGenerationFactory: audioFactory,
    createActionResponse: async () => {calls++; const {action, ...args} = next; return {id: 'response-' + calls, model: 'gpt-6.1-sol', status: 'completed' as const, service_tier: 'default' as const, usage: null, output_text: '',
      output: [{type: 'function_call' as const, name: action.replace('.', '_'), call_id: 'call-' + calls, arguments: JSON.stringify(args)}]};}};
  const service = createImageConversationService(actor, options);
  const actions = [
    {action: 'video.prepare', reply: 'A quiet motion. Review the quote.', prompt: 'Slow push in on a cream card, warm light', aspectRatio: '16:9', source: null},
    {action: 'voice.prepare', reply: 'A calm narration. Review the quote.', script: 'Your film starts with a conversation.', language: 'english'},
    {action: 'music.prepare', reply: 'A restrained instrumental. Review the quote.', prompt: 'Soft piano and warm textures, no vocals', mood: 'dreamy'},
  ];
  await t.test('accepting a creative offer saves one priced proposal in that project across retries', async () => {
    const other = {...actor, projectId:'other'};
    const offer = 'Keep the ice in deep shadow. Shall I prepare the quote for the first firefly shot?';
    const planning = createImageConversationService(other, {...options, createActionResponse:async () => ({
      id:'offer', model:'gpt-6.1-sol', status:'completed', service_tier:'default', usage:null,
      output_text:JSON.stringify({reply:offer}), output:[],
    })});
    const direction = await planning.submit({requestId:randomUUID(), message:'Give the first firefly shot a darker look', references:[]});
    assert.equal(direction.quote, null);
    assert.equal(direction.reply, offer);
    const acceptance = {requestId:randomUUID(), message:'Yes, please.', references:[]};
    const accepted = createImageConversationService(other, {...options, createActionResponse:async params => {
      assert.ok(JSON.stringify(params.input).includes(offer), 'The offer must survive into the acceptance turn');
      return {id:'acceptance', model:'gpt-6.1-sol', status:'completed', service_tier:'default', usage:null, output_text:'',
        output:[{type:'function_call', name:'video_prepare', call_id:'prepare-fireflies', arguments:JSON.stringify({
          reply:'Review the price for the first shot.', prompt:'Fireflies lift off blue ice, dark exposure, tight framing.', aspectRatio:'9:16', source:null,
        })}]};
    }});
    const quoted = await accepted.submit(acceptance);
    assert.ok(quoted.quote?.confirmationRequired);
    assert.ok(quoted.quote.price.amountCents > 0);
    assert.equal((await accepted.submit(acceptance)).quote?.quoteId, quoted.quote.quoteId);
    const stored = await pg.pool.query('SELECT studio_project_id, state, job_id, price_cents FROM mcp_generation_quotes WHERE quote_id=$1', [quoted.quote.quoteId]);
    assert.deepEqual(stored.rows, [{studio_project_id:other.projectId, state:'prepared', job_id:null, price_cents:quoted.quote.price.amountCents}]);
    assert.equal(provider.captures.length, 0);
    assert.equal((await pg.pool.query("SELECT COUNT(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n, 0);
  });
  for (const [index, action] of actions.entries()) {
    next = action;
    const input = {requestId: randomUUID(), message: ['Can it move?', 'Add a voice, you choose the words.', 'Some music too.'][index], references: []};
    const turn = await service.submit(input);
    assert.ok(turn.quote);
    assert.equal(turn.quote.summary.surface, index ? 'audio' : 'video');
    assert.equal(turn.quote.confirmationRequired, true);
    assert.equal((await pg.pool.query("SELECT * FROM app_receipts WHERE type='charge' AND job_id=$1", [turn.quote.quoteId])).rows.length, 0);
    assert.equal((await service.submit(input)).quote?.quoteId, turn.quote.quoteId);
    assert.equal(calls, index + 1);
    await assert.rejects(createImageConversationService({...actor, projectId: 'other'}, options).confirm({requestId: input.requestId, quoteId: turn.quote.quoteId, confirmed: true}), {code: 'QUOTE_EXPIRED'});
    const confirmations = await Promise.all([service.confirm({requestId: input.requestId, quoteId: turn.quote.quoteId, confirmed: true}), service.confirm({requestId: input.requestId, quoteId: turn.quote.quoteId, confirmed: true})]);
    const reopened = (await createImageConversationService(actor, options).read()).turns.find(saved => saved.requestId === input.requestId)!;
    assert.equal(reopened.generation?.jobId, confirmations[0].jobId);
    assert.equal(confirmations[0].jobId, confirmations[1].jobId);
    if (index) assert.equal(reopened.generation?.result?.surface, 'audio');
    assert.deepEqual((await pg.pool.query("SELECT amount_cents FROM app_receipts WHERE type='charge' AND job_id=$1", [confirmations[0].jobId])).rows.map(row => row.amount_cents), [turn.quote.price.amountCents]);
  }
  assert.equal(provider.captures.length, 1);
  assert.equal(audioExecutions, 2);
  // Failed preparation retains the script; explicit retry and renewal must not rewrite it with Sol.
  next = actions[1];
  const input = {requestId: randomUUID(), message: 'Another voice please.', references: []};
  let fail = true;
  const failingAudio: typeof createStudioAudioGenerationService = (current, config) => {
    const normal = audioFactory(current, config);
    return {...normal, prepare: async request => {if (fail) throw new Error('Controlled interruption'); return normal.prepare(request);}};
  };
  const retry = createImageConversationService(actor, {...options, audioGenerationFactory: failingAudio});
  await assert.rejects(retry.submit(input));
  fail = false;
  const saved = await retry.submit(input);
  assert.equal(calls, 4);
  assert.ok(saved.quote);
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired' WHERE quote_id=$1", [saved.quote.quoteId]);
  const renewed = await retry.submit({...input, requestId: randomUUID(), renewedFromRequestId: input.requestId});
  assert.equal(calls, 4);
  assert.ok(renewed.quote && renewed.quote.quoteId !== saved.quote.quoteId);
  assert.equal(renewed.quote.summary.surface, 'audio');
  assert.equal((renewed.quote.summary.settings as any).script, actions[1].script);
  for (const action of [actions[0], actions[2]]) {
    next = action;
    const source = await service.submit({requestId:randomUUID(), message:'Prepare my next test quote.', references:[]});
    assert.ok(source.quote);
    await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired' WHERE quote_id=$1",[source.quote.quoteId]);
    const before = calls;
    const input = {action:'renew-generation' as const, requestId:source.requestId,
      quoteId:source.quote.quoteId,renewalId:randomUUID(),locale:'es' as const};
    await assert.rejects(renewMobileStudioQuote({...actor,projectId:'other'},input,service), {code:'REVIEW_REQUIRED'});
    const fresh = await renewMobileStudioQuote(actor,input,service);
    assert.notEqual(fresh.quote.review?.quoteId,source.quote.quoteId);
    assert.equal(fresh.requestId,input.renewalId);
    assert.equal(fresh.quote.state,'prepared');
    assert.equal(fresh.quote.amountCents,source.quote.price.amountCents);
    assert.deepEqual(await renewMobileStudioQuote(actor,input,service),fresh);
    assert.equal(calls,before);
    assert.equal(provider.captures.length,1);
    assert.equal(audioExecutions,2);
  }

});
