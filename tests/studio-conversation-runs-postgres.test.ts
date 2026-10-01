import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {claimImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {createPaidGenerationTestSchema, startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup, ProviderHarness} from './helpers/mcp-paid-e2e-harness';

test('native tool runs preserve brief, every response, exact quote and accepted job across lost ACK', async (t) => {
  const repo = await import('../frontend/src/server/studio/conversation-run-repository').catch(() => null);
  assert.ok(repo?.readStudioConversationProject, 'Studio needs a durable project brief and action journal');
  const pg = await startDisposablePostgres('studio-conversation-runs');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end(); if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects (id text PRIMARY KEY, user_id text NOT NULL, name text NOT NULL, deleted_at timestamptz);
    CREATE TABLE studio_sequences (id text PRIMARY KEY);
    INSERT INTO studio_projects (id,user_id,name) VALUES ('film','owner','Promo'), ('other','owner','Other'), ('private','foreign','Private');`);
  for (const name of ['50_studio_image_conversation.sql', '51_studio_image_model_usage.sql'])
    await pg.pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
  await assert.rejects(pg.pool.query(readFileSync('neon/migrations/52_studio_conversation_runs.sql', 'utf8')), /migration 42/,
    'Action runs must not initialize against an unmigrated legacy Studio schema');
  await pg.pool.query(readFileSync('neon/migrations/42_studio_connected_montages.sql', 'utf8'));
  await pg.pool.query(readFileSync('neon/migrations/52_studio_conversation_runs.sql', 'utf8'));
  await addTopup(pg.pool, 'owner', 1000);
  const actor = {authMethod: 'studio-session' as const, userId: 'owner', projectId: 'film', clientId: null};
  const engine = getFalEngineById('gpt-image-2')!;
  const catalog = [{engine: engine.engine, surface: 'image' as const, publicModes: ['t2i' as const], modeCaps: Object.fromEntries(engine.modes.map(mode => [mode.mode, mode.ui]))}];
  const provider = new ProviderHarness(pg.pool);
  const factory: typeof createStudioImageGenerationService = (current, options) => createStudioImageGenerationService(current, {...options,
    prepareDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true, reason: 'available'})},
    confirmDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({executable: true, reason: 'available'}), submitPaidGeneration: provider.submit},
  });
  let calls = 0;
  const usage = {input_tokens: 100, input_tokens_details: {cached_tokens: 0}, output_tokens: 50, output_tokens_details: {reasoning_tokens: 10}, total_tokens: 150};
  const createResponse = async () => {
    calls++;
    const name = calls === 1 ? 'project_remember' : calls === 2 ? 'catalog_read' : 'image_prepare';
    const args = calls === 1 ? {revision: 0, brief: 'A cheap landscape Studio promo. No neon. Elegant, quiet.', decisions: ['Warm cinematic light', 'English voice later']}
      : calls === 2 ? {} : {reply: 'I chose warm paper and light. Please review the image quote.', prompt: 'A cream paper card on walnut, warm cinematic light, no neon', aspectRatio: '16:9'};
    return {id: 'response-' + calls, model: 'gpt-6.1-sol', status: 'completed' as const, service_tier: 'default' as const, usage, output_text: '',
      output: [{type: 'function_call' as const, name, call_id: 'call-' + calls, arguments: JSON.stringify(args)}]};
  };
  const service = createImageConversationService(actor, {enabled: true, generationFactory: factory, actionsEnabled: true, createActionResponse: createResponse});
  const input = {requestId: randomUUID(), message: "I'm new. A nice cheap film for Studio. You choose.", references: []};
  const turn = await service.submit(input);
  assert.equal(turn.state, 'ready');
  assert.ok(turn.quote);
  assert.equal(calls, 3);
  assert.equal(provider.captures.length, 0);
  assert.match((await repo.readStudioConversationProject(actor)).memory.brief, /No neon/);
  assert.equal((await repo.readStudioConversationProject(actor)).memory.revision, 1);
  await assert.rejects(repo.readStudioConversationProject({...actor, projectId: 'private'}), {code: 'PARAMETER_INVALID'});
  assert.equal((await repo.readStudioConversationProject({...actor, projectId: 'other'})).memory.brief, '');
  assert.equal((await pg.pool.query('SELECT * FROM studio_conversation_responses')).rows.length, 3);
  assert.equal((await pg.pool.query("SELECT * FROM studio_conversation_steps WHERE state = 'completed'")).rows.length, 3);
  // The quote backlink and completed action commit together. Replay does not call Sol or prepare again.
  assert.equal((await service.submit(input)).quote?.quoteId, turn.quote.quoteId);
  assert.equal(calls, 3);
  const result = (await pg.pool.query("SELECT result_json FROM studio_conversation_steps WHERE action_json->>'action'='image.prepare'")).rows[0].result_json;
  assert.equal(result.data.quoteId, turn.quote.quoteId);
  assert.equal(result.data.confirmationRequired, true);
  await service.confirm({requestId: input.requestId, quoteId: turn.quote.quoteId, confirmed: true});
  // Simulate the browser losing the accepted response and reopening the project.
  const reopened = createImageConversationService(actor, {enabled: true, generationFactory: factory, actionsEnabled: true, createActionResponse: createResponse});
  assert.equal((await reopened.read()).turns[0].generation?.jobId, turn.quote.quoteId);
  await reopened.confirm({requestId: input.requestId, quoteId: turn.quote.quoteId, confirmed: true});
  assert.equal(provider.captures.length, 1);
  assert.equal(calls, 3);
  assert.equal((await pg.pool.query("SELECT * FROM app_receipts WHERE type='charge'")).rows.length, 1);
  // A current memory edit cannot be overwritten by a stale model revision.
  await assert.rejects(repo.saveStudioConversationMemory(actor, {revision: 0, brief: 'lost', decisions: []}), {code: 'PARAMETER_INVALID'});
  assert.match((await repo.readStudioConversationProject(actor)).memory.brief, /No neon/);
  const responses = await repo.listStudioConversationUsage(actor);
  assert.equal(responses.length, 3);
  assert.equal(responses.reduce((sum, row) => sum + (row.response?.usage?.total_tokens ?? 0), 0), 450);
  assert.deepEqual(await repo.listStudioConversationUsage({...actor, userId: 'foreign'}), []);
  // Lose an ACK after saving a model tool call but before recording its read result.
  // The next lease must recover the saved response and safely finish that same action.
  const resumeInput = {requestId: randomUUID(), message: 'What is possible now?', references: []};
  const claim = await claimImageTurn(actor, resumeInput);
  await repo.checkpointStudioResponse(actor, claim.turn, 0, async () => ({id: 'crash-response', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage, output_text: '',
    output: [{type: 'function_call', name: 'catalog_read', call_id: 'interrupted-read', arguments: '{}'}]}));
  await repo.beginStudioAction(actor, claim.turn, 'interrupted-read', {action: 'catalog.read'});
  await pg.pool.query("UPDATE studio_image_turns SET state='failed' WHERE request_id=$1", [resumeInput.requestId]);
  let resumedCalls = 0;
  const resumedService = createImageConversationService(actor, {enabled: true, actionsEnabled: true, generationFactory: factory,
    createActionResponse: async params => {resumedCalls++; assert.match(JSON.stringify(params.input), /No neon/); return {id: 'resumed-response', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage,
      output_text: JSON.stringify({reply: 'You can create or edit one image and review its exact quote.'}), output: []};},
  });
  assert.equal((await resumedService.submit(resumeInput)).state, 'ready');
  assert.equal(resumedCalls, 1, 'The saved tool-request response must not consume a second model call');
  assert.equal(provider.captures.length, 1);
  const incompleteInput = {requestId: randomUUID(), message: 'Help me pick a direction', references: []};
  let incompleteCalls = 0;
  const incompleteService = createImageConversationService(actor, {enabled: true, actionsEnabled: true, generationFactory: factory,
    createActionResponse: async () => {incompleteCalls++; return {id: 'incomplete-' + incompleteCalls, model: 'gpt-6.1-sol', status: incompleteCalls === 1 ? 'incomplete' : 'completed', service_tier: 'default', usage,
      output_text: incompleteCalls === 1 ? '' : JSON.stringify({reply: 'We can use warm cinematic light.'}), output: []};},
  });
  await assert.rejects(incompleteService.submit(incompleteInput), {code: 'INTERNAL_ERROR'});
  assert.equal((await incompleteService.submit(incompleteInput)).state, 'ready');
  assert.equal(incompleteCalls, 2, 'An explicit retry must preserve the incomplete usage and obtain a usable answer');
  const unknownService = createImageConversationService(actor, {enabled: true, actionsEnabled: true, generationFactory: factory,
    createActionResponse: async () => {throw new Error('Transport timeout; provider usage unavailable');},
  });
  await assert.rejects(unknownService.submit({requestId: randomUUID(), message: 'What do you suggest?', references: []}), /timeout/);
  assert.ok((await repo.listStudioConversationUsage(actor)).some(row => row.state === 'unknown' && row.response === null));
  let failPreparation = true;
  const failingFactory: typeof factory = (current, options) => {
    const base = factory(current, options);
    return {...base, prepare: async value => {if (failPreparation) {failPreparation = false; throw new Error('Preparation unavailable once');} return base.prepare(value);}};
  };
  let prepareCalls = 0;
  const preparationService = createImageConversationService(actor, {enabled: true, actionsEnabled: true, generationFactory: failingFactory,
    createActionResponse: async () => {prepareCalls++; return {id: 'preparation-response', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage, output_text: '',
      output: [{type: 'function_call', name: 'image_prepare', call_id: 'prepare-interrupted', arguments: JSON.stringify({reply: 'A warm cinematic direction, awaiting your confirmation.', prompt: 'Warm paper in sunlight', aspectRatio: '16:9'})}]};},
  });
  const failedPreparationInput = {requestId: randomUUID(), message: 'Yes, create the first image.', references: []};
  await assert.rejects(preparationService.submit(failedPreparationInput), {code: 'INTERNAL_ERROR'});
  const recoveredQuote = await preparationService.submit(failedPreparationInput);
  assert.ok(recoveredQuote.quote);
  assert.equal(prepareCalls, 1);
  assert.equal((await pg.pool.query('SELECT * FROM studio_conversation_steps WHERE request_id=$1', [failedPreparationInput.requestId])).rows.length, 2,
    'The failed preparation and successful draft recovery must each retain their own action receipt');
  assert.equal(provider.captures.length, 1);
  // The first brief is no longer in the eight-turn dialogue window.
  for (let index = 0; index < 10; index++) await pg.pool.query(`INSERT INTO studio_image_turns
    (user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,state,lease_id,lease_expires_at)
    VALUES ('owner','film',$1,$2,$3::jsonb,$4::jsonb,$2,'ready',$5,clock_timestamp())`,
    [randomUUID(), '0'.repeat(64), JSON.stringify({requestId: randomUUID(), message: 'Tell me more.', references: []}), JSON.stringify({reply: 'Of course.', image: null}), randomUUID()]);
  let durableCalls = 0;
  const durableService = createImageConversationService(actor, {enabled: true, actionsEnabled: true, generationFactory: factory,
    createActionResponse: async params => {durableCalls++; const sent = JSON.stringify(params.input); assert.match(sent, /No neon/); assert.ok(!sent.includes("I'm new"));
      return {id: 'durable-response', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage, output_text: JSON.stringify({reply: 'I remember: elegant landscape film, no neon, and a small budget.'}), output: []};},
  });
  assert.match((await durableService.submit({requestId: randomUUID(), message: 'Do you remember my constraints?', references: []})).reply ?? '', /no neon/);
  assert.equal(durableCalls, 1);
  await pg.pool.query("DELETE FROM studio_projects WHERE id='film'");
  assert.equal((await pg.pool.query('SELECT * FROM studio_conversation_steps')).rows.length, 0);
  assert.equal((await pg.pool.query('SELECT * FROM studio_conversation_responses')).rows.length, 0);
});
