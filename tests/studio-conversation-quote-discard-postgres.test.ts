import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {getDb,withDbTransaction} from '../frontend/src/lib/db';
import {claimImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {beginStudioAction,completeStudioAction} from '../frontend/src/server/studio/conversation-run-repository';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createImageConversationService,type ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';

test('discarding a prepared quote is scoped, lease-guarded and atomic with its action receipt',async t => {
  const module = await import('../frontend/src/server/studio/conversation-quote-command').catch(() => null);
  assert.ok(module?.discardStudioPreparedQuote,'A cancellation needs an explicit scoped command.');
  const pg = await startDisposablePostgres('studio-discard');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end();if (previous === undefined) delete process.env.DATABASE_URL;else process.env.DATABASE_URL = previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query('CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz); CREATE TABLE studio_sequences(id text PRIMARY KEY);');
  for (const name of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql']) await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES ('film','owner','Film'),('other-film','owner','Other film'),('foreign-film','other-user','Foreign film')");
  const actor = {authMethod: 'studio-session' as const,userId: 'owner',projectId: 'film',clientId: null};
  const newQuote = async (options: {userId?: string;projectId?: string;origin?: 'oauth'|'studio-session';surface?: 'image'|'video'|'audio'} = {}) => {
    const id = randomUUID();
    await pg.pool.query(`INSERT INTO mcp_generation_quotes(quote_id,user_id,oauth_client_id,auth_origin,studio_project_id,request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,expires_at)
      VALUES($1,$2,NULL,$3,$4,$6::jsonb,$5,'test','{}',6,'USD','wallet','prepared',now()+interval '45 minutes')`,[id,options.userId ?? actor.userId,options.origin ?? 'studio-session',options.origin === 'oauth' ? null : options.projectId ?? actor.projectId,'a'.repeat(64),JSON.stringify({schemaVersion: 1,surface: options.surface ?? 'image'})]);
    return id;
  };
  const row = async (id: string) => (await pg.pool.query('SELECT state,job_id,claimed_at,updated_at,expires_at,price_cents FROM mcp_generation_quotes WHERE quote_id=$1',[id])).rows[0];
  const pending = await claimImageTurn(actor,{requestId: randomUUID(),message: 'Cancel that image quote.',references: []});
  const turn = pending.turn;
  const discard = (quoteId: string,currentTurn = turn) => withDbTransaction(tx => module.discardStudioPreparedQuote(actor,currentTurn,quoteId,tx));

  await t.test('only the exact prepared quote changes, with one durable replayable result',async () => {
    const target = await newQuote();
    const neighbour = await newQuote();
    const beforeNeighbour = await row(neighbour);
    const beforeTarget = await row(target);
    const action = {action: 'quote.discard' as const,quoteId: target};
    assert.equal(await beginStudioAction(actor,turn,'discard-one',action),null);
    const result = await withDbTransaction(async tx => {
      const data = await module.discardStudioPreparedQuote(actor,turn,target,tx);
      const value = {ok: true as const,action: 'quote.discard' as const,data};
      await completeStudioAction(actor,turn,'discard-one',value,tx);
      return value;
    });
    assert.equal(result.data.status,'discarded');
    assert.equal((await row(target)).state,'expired');
    assert.equal((await row(target)).price_cents,beforeTarget.price_cents);
    assert.deepEqual((await row(target)).expires_at,beforeTarget.expires_at);
    assert.deepEqual(await row(neighbour),beforeNeighbour);
    const after = await row(target);
    assert.deepEqual(await beginStudioAction(actor,turn,'discard-one',action),result);
    assert.deepEqual(await row(target),after);
  });
  await t.test('a lost action receipt rolls back the quote mutation',async () => {
    const target = await newQuote();
    const before = await row(target);
    await assert.rejects(withDbTransaction(async tx => {
      const data = await module.discardStudioPreparedQuote(actor,turn,target,tx);
      await completeStudioAction(actor,turn,'missing-start',{ok: true,action: 'quote.discard',data},tx);
    }),/superseded/);
    assert.deepEqual(await row(target),before);
  });
  await t.test('accepted and claimed quotes retain their jobs and report that submission cannot be cancelled',async () => {
    for (const state of ['claimed','accepted']) {
      const target = await newQuote();
      await pg.pool.query("UPDATE mcp_generation_quotes SET state='claimed',job_id=$2,claimed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE quote_id=$1",[target,'job-'+target]);
      if (state === 'accepted') await pg.pool.query("UPDATE mcp_generation_quotes SET state='accepted',updated_at=clock_timestamp() WHERE quote_id=$1",[target]);
      const before = await row(target);
      const result = await discard(target);
      assert.equal(result.status,'already_submitted');
      assert.match(result.message,/cannot.*cancel/i);
      assert.deepEqual(await row(target),before);
    }
  });
  await t.test('other users, projects and OAuth quotes stay inaccessible and unchanged',async () => {
    for (const options of [{projectId: 'other-film'},{projectId: 'foreign-film',userId: 'other-user'},{origin: 'oauth' as const}]) {
      const target = await newQuote(options);
      const before = await row(target);
      await assert.rejects(discard(target),/not available/);
      assert.deepEqual(await row(target),before);
    }
  });
  await t.test('video and audio quotes use the same prepared-consent withdrawal',async () => {
    for (const surface of ['video','audio'] as const) {
      const target = await newQuote({surface});
      assert.equal((await discard(target)).status,'discarded');
      assert.equal((await row(target)).state,'expired');
      const beforeReplay = await row(target);
      assert.equal((await discard(target)).status,'already_unavailable');
      assert.deepEqual(await row(target),beforeReplay);
    }
  });
  await t.test('the user advisory lock fences a cancellation before its lease is checked',async () => {
    const target = await newQuote();
    const before = await row(target);
    const blocker = await pg.pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`studio-image:${actor.userId}`]);
    const attempt = discard(target).then(value => ({value,error: null}),error => ({value: null,error}));
    try {
      let waiting = false;
      for (let index = 0; index < 100; index++) {
        waiting = (await pg.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'")).rows[0].n > 0;
        if (waiting) break;
        await delay(10);
      }
      assert.equal(waiting,true,'Discard waits on the same account lock used by message claiming and replacement.');
      await pg.pool.query("UPDATE studio_image_turns SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[turn.request_id]);
    } finally {await blocker.query('ROLLBACK');blocker.release();}
    const completed = await attempt;
    assert.equal(completed.value,null);
    assert.match(completed.error?.message ?? '',/superseded/);
    assert.deepEqual(await row(target),before);
    await pg.pool.query("UPDATE studio_image_turns SET lease_expires_at=clock_timestamp()+interval '3 minutes' WHERE request_id=$1",[turn.request_id]);
  });
  await t.test('a replaced, expired or completed turn cannot invalidate a valid quote',async () => {
    const target = await newQuote();
    const before = await row(target);
    await assert.rejects(discard(target,{...turn,lease_id: randomUUID()}),/superseded/);
    await pg.pool.query("UPDATE studio_image_turns SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[turn.request_id]);
    await assert.rejects(discard(target),/superseded/);
    await pg.pool.query("UPDATE studio_image_turns SET lease_expires_at=clock_timestamp()+interval '3 minutes',state='ready' WHERE request_id=$1",[turn.request_id]);
    await assert.rejects(discard(target),/superseded/);
    assert.deepEqual(await row(target),before);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts")).rows[0].n,0);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_jobs")).rows[0].n,0);
  });
});

test('a natural cancellation uses the explicit tool, survives a lost reply and makes the old card unconfirmable',async t => {
  const pg = await startDisposablePostgres('studio-discard-run');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end();if (previous === undefined) delete process.env.DATABASE_URL;else process.env.DATABASE_URL = previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query('CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz); CREATE TABLE studio_sequences(id text PRIMARY KEY);');
  for (const name of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql']) await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES ('film','owner','Film')");
  const actor = {authMethod: 'studio-session' as const,userId: 'owner',projectId: 'film',clientId: null};
  const engine = getFalEngineById('gpt-image-2')!;
  const catalog = [{engine: engine.engine,surface: 'image' as const,publicModes: ['t2i' as const],modeCaps: Object.fromEntries(engine.modes.map(mode => [mode.mode,mode.ui]))}];
  const factory: ImageGenerationFactory = (scopedActor,options) => createStudioImageGenerationService(scopedActor,{...options,prepareDependencies: {listPublicEngines: async () => catalog,resolveRequestExecutability: () => ({executable: true,reason: 'available'})}});
  const original = createImageConversationService(actor,{enabled: true,generationFactory: factory,director: async () => ({reply: 'Review the image quote.',image: {prompt: 'Warm cinematic folded paper',aspectRatio: '16:9'}})});
  const quoted = await original.submit({requestId: randomUUID(),message: 'Make one image. You choose.',references: []});
  assert.ok(quoted.quote);
  const row = async () => (await pg.pool.query('SELECT state,updated_at,price_cents,request_hash,expires_at FROM mcp_generation_quotes WHERE quote_id=$1',[quoted.quote!.quoteId])).rows[0];
  const before = await row();
  const explanation = createImageConversationService(actor,{enabled: true,generationFactory: factory,actionsEnabled: true,
    createActionResponse: async () => ({id: 'explain-'+randomUUID(),model: 'gpt-6.1-sol',status: 'completed',service_tier: 'default',usage: null,output_text: JSON.stringify({reply: 'The displayed amount covers this one image. Nothing is generated until you confirm.'}),output: []}),
  });
  await explanation.submit({requestId: randomUUID(),message: 'What does this price include?',references: []});
  assert.deepEqual(await row(),before,'A price question does not invoke cancellation.');
  let calls = 0;
  const cancellation = createImageConversationService(actor,{enabled: true,generationFactory: factory,actionsEnabled: true,
    createActionResponse: async params => {
      calls++;
      if (calls === 2) throw new Error('Simulated lost cancellation reply');
      if (calls === 3) assert.match(JSON.stringify(params.input),/discarded/,'The resumed director sees the committed cancellation result.');
      return {id: 'discard-response-'+calls,model: 'gpt-6.1-sol',status: 'completed',service_tier: 'default',usage: null,
        output_text: calls === 1 ? '' : JSON.stringify({reply: 'I discarded that quote. Nothing was generated.'}),
        output: calls === 1 ? [{type: 'function_call',name: 'quote_discard',call_id: 'cancel-request',arguments: JSON.stringify({quoteId: quoted.quote!.quoteId})}] : []};
    },
  });
  const request = {requestId: randomUUID(),message: 'Cancel that, please.',references: []};
  await assert.rejects(cancellation.submit(request),/Simulated lost cancellation reply/);
  const after = await row();
  assert.equal(after.state,'expired');
  const steps = (await pg.pool.query("SELECT state,result_json FROM studio_conversation_steps WHERE action_json->>'action'='quote.discard'")).rows;
  assert.equal(steps.length,1);
  assert.equal(steps[0].state,'completed');
  assert.equal(steps[0].result_json.data.status,'discarded');
  const finished = await cancellation.submit(request);
  assert.match(finished.reply!,/discarded/);
  assert.equal(finished.quote,null);
  assert.equal(calls,3,'Replay recovers the first model response and action; only the lost final reply repeats.');
  assert.deepEqual(await cancellation.submit(request),finished);
  assert.deepEqual(await row(),after,'No second invalidation or duplicate checkpoint occurs.');
  const loaded = await cancellation.read();
  assert.equal(loaded.turns.find(turn => turn.requestId === quoted.requestId)?.quote?.state,'expired');
  await assert.rejects(cancellation.confirm({requestId: quoted.requestId,quoteId: quoted.quote.quoteId,confirmed: true}),{code: 'QUOTE_EXPIRED'});
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs')).rows[0].n,0);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_receipts')).rows[0].n,0);
});
