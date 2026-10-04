import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createImageConversationService, type ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {claimImageTurn, persistImageDraft, failImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {studioReferenceFingerprint} from '../frontend/src/server/agent-api/generation-actor';
import type {ImageDraft} from '../frontend/src/lib/studio/image-conversation-contract';
import {createPaidGenerationTestSchema, startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup, ProviderHarness} from './helpers/mcp-paid-e2e-harness';

test('conversation quote lifetime follows creation intent, not every message', async t => {
  const pg = await startDisposablePostgres('studio-quote-lifecycle');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end(); if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects (id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);
    CREATE TABLE studio_sequences (id text PRIMARY KEY);`);
  for (const name of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql'])
    await pg.pool.query(readFileSync('neon/migrations/' + name,'utf8'));
  await addTopup(pg.pool,'owner',10000);
  t.afterEach(async () => {await pg.pool.query("UPDATE studio_image_turns SET state='failed' WHERE state='thinking'");});
  const engine = getFalEngineById('gpt-image-2')!;
  const catalog = [{engine:engine.engine,surface:'image' as const,publicModes:['t2i' as const],modeCaps:Object.fromEntries(engine.modes.map(mode => [mode.mode,mode.ui]))}];
  const provider = new ProviderHarness(pg.pool);
  const factory: ImageGenerationFactory = (actor,options) => createStudioImageGenerationService(actor,{...options,
    prepareDependencies:{listPublicEngines:async () => catalog,resolveRequestExecutability:() => ({executable:true,reason:'available'})},
    confirmDependencies:{listPublicEngines:async () => catalog,resolveRequestExecutability:() => ({executable:true,reason:'available'}),submitPaidGeneration:provider.submit},
  });
  const input = (message: string) => ({requestId:randomUUID(),message,references:[]});
  const imageDraft: ImageDraft = {reply:'One warm image. Review the quote before creation.',image:{prompt:'A golden paper sculpture on a dark canvas',aspectRatio:'16:9'}};
  const actorFor = async (projectId: string) => {
    await pg.pool.query('INSERT INTO studio_projects(id,user_id,name) VALUES ($1,$2,$3)',[projectId,'owner',projectId]);
    return {authMethod:'studio-session' as const,userId:'owner',projectId,clientId:null};
  };
  const quoteRow = async (id: string) => (await pg.pool.query('SELECT state,request_hash,price_cents,expires_at FROM mcp_generation_quotes WHERE quote_id=$1',[id])).rows[0];

  await t.test('a saved custom-size character request resumes to one quote without another paid response', async () => {
    const actor = await actorFor('custom-character');
    const original = input('3D');
    const saved: ImageDraft = {reply: 'A stylized 3D character reference. Review the quote.', image: {
      modelId: 'gpt-image-2', mode: 't2i', prompt: 'A full-body adult streetwear character in stylized 3D on a neutral background', aspectRatio: '3:4',
      settings: [{name: 'imageWidth', value: 1024}, {name: 'imageHeight', value: 1360}, {name: 'quality', value: 'high'}, {name: 'outputFormat', value: 'png'}], references: [], outputCount: 1,
    }};
    const claimed = await claimImageTurn(actor, original);
    await persistImageDraft(actor, claimed.turn, saved, studioReferenceFingerprint([]));
    await failImageTurn(actor, claimed.turn);
    const service = createImageConversationService(actor, {enabled: true, actionsEnabled: true, generationFactory: factory,
      createActionResponse: async () => {throw new Error('A saved draft must not buy a replacement response');},
    });
    const beforeJobs = provider.captures.length;
    const resumed = await service.submit(original);
    assert.equal(resumed.state, 'ready');
    assert.equal(resumed.reply, saved.reply);
    assert.ok(resumed.quote);
    assert.equal(resumed.quote.summary.settings.resolution, 'custom');
    assert.equal(resumed.quote.summary.settings.imageWidth, 1024);
    assert.equal(resumed.quote.summary.settings.imageHeight, 1360);
    assert.equal((await service.submit(original)).quote?.quoteId, resumed.quote.quoteId);
    assert.deepEqual((await pg.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[original.requestId])).rows[0].draft_json, saved);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM studio_conversation_responses WHERE project_id=$1',[actor.projectId])).rows[0].n, 0);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes WHERE studio_project_id=$1',[actor.projectId])).rows[0].n, 1);
    assert.equal(provider.captures.length, beforeJobs);
  });

  for (const actionsEnabled of [false,true]) await t.test(`${actionsEnabled ? 'tool director' : 'image director'} keeps a valid quote through clarification, failure and reload`, async () => {
    const actor = await actorFor(actionsEnabled ? 'tool-chat' : 'image-chat');
    const creation = createImageConversationService(actor,{enabled:true,generationFactory:factory,director:async () => imageDraft});
    const quoted = await creation.submit(input('Make one inexpensive image. You choose.'));
    const before = await quoteRow(quoted.quote!.quoteId);
    const beforeCalls = provider.captures.length;
    const clarification = createImageConversationService(actor,{enabled:true,generationFactory:factory,actionsEnabled,
      director:async () => ({reply:'Yes, you can decide on music later.',image:null}),
      createActionResponse:async () => ({id:'clarification-' + randomUUID(),model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,
        output_text:JSON.stringify({reply:'Yes, you can decide on music later.'}),output:[]}),
    });
    const answer = await clarification.submit(input('Can I change the music later?'));
    assert.equal(answer.quote,null);
    assert.deepEqual(await quoteRow(quoted.quote!.quoteId),before,'A clarification must preserve the exact price, request and expiry');
    const failedQuestion = createImageConversationService(actor,{enabled:true,generationFactory:factory,actionsEnabled,
      director:async () => {throw new Error('Clarification transport unavailable');},
      createActionResponse:async () => {throw new Error('Clarification transport unavailable');},
    });
    await assert.rejects(failedQuestion.submit(input('How does the timeline work?')),/Clarification transport unavailable/);
    assert.deepEqual(await quoteRow(quoted.quote!.quoteId),before);
    const reopened = await clarification.read();
    assert.equal(reopened.turns.find(turn => turn.requestId === quoted.requestId)?.quote?.state,'prepared');
    assert.equal(provider.captures.length,beforeCalls,'Asking questions never submits media');
    const confirmation = {requestId:quoted.requestId,quoteId:quoted.quote!.quoteId,confirmed:true};
    await clarification.confirm(confirmation);
    await clarification.confirm(confirmation);
    assert.equal(provider.captures.length,beforeCalls + 1);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE job_id=$1 AND type='charge'",[quoted.quote!.quoteId])).rows[0].n,1);
  });

  await t.test('a changed creation expires the previous quote even if replacement preparation fails', async () => {
    const actor = await actorFor('changed-direction');
    const initial = createImageConversationService(actor,{enabled:true,generationFactory:factory,director:async () => imageDraft});
    const quoted = await initial.submit(input('Make a landscape image.'));
    const pending = await claimImageTurn(actor,input('Actually, make it portrait.'));
    assert.equal((await quoteRow(quoted.quote!.quoteId)).state,'prepared','Claiming an unclassified message alone must not discard a quote');
    await persistImageDraft(actor,pending.turn,{...imageDraft,image:{prompt:'A new portrait paper sculpture',aspectRatio:'9:16'}},'0'.repeat(64));
    assert.equal((await quoteRow(quoted.quote!.quoteId)).state,'expired','A saved replacement creation invalidates prior consent before preparation');
    await assert.rejects(initial.confirm({requestId:quoted.requestId,quoteId:quoted.quote!.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
    await pg.pool.query("UPDATE studio_image_turns SET state='failed' WHERE request_id=$1",[pending.turn.request_id]);
  });

  await t.test('a superseded draft writer cannot expire a newer quote', async () => {
    const actor = await actorFor('lease-protection');
    const creation = createImageConversationService(actor,{enabled:true,generationFactory:factory,director:async () => imageDraft});
    const quoted = await creation.submit(input('Prepare one image.'));
    const pending = await claimImageTurn(actor,input('Change the colours.'));
    const before = await quoteRow(quoted.quote!.quoteId);
    assert.equal(before.state,'prepared');
    await pg.pool.query('UPDATE studio_image_turns SET lease_id=$2 WHERE request_id=$1',[pending.turn.request_id,randomUUID()]);
    await assert.rejects(persistImageDraft(actor,pending.turn,imageDraft,'0'.repeat(64)),{code:'PARAMETER_INVALID'});
    assert.deepEqual(await quoteRow(quoted.quote!.quoteId),before,'Lease rejection must roll back any expiry');
  });

  await t.test('a late response from an expired lease cannot discard the next turn’s quote', async () => {
    const actor = await actorFor('expired-writer');
    const old = await claimImageTurn(actor,input('Prepare a first direction.'));
    await pg.pool.query("UPDATE studio_image_turns SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[old.turn.request_id]);
    const creation = createImageConversationService(actor,{enabled:true,generationFactory:factory,director:async () => imageDraft});
    const current = await creation.submit(input('Try a different direction.'));
    const before = await quoteRow(current.quote!.quoteId);
    assert.equal(before.state,'prepared');
    await assert.rejects(persistImageDraft(actor,old.turn,imageDraft,'0'.repeat(64)),{code:'PARAMETER_INVALID'});
    assert.deepEqual(await quoteRow(current.quote!.quoteId),before);
  });
});
