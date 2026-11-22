import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import type {QueryExecutor} from '../frontend/src/lib/db';
import {normalizeGenerationRequest, hashCanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {createQuoteRepository, generationQuoteCodec} from '../frontend/src/server/agent-api/quote-repository';
import {readStudioArchiveDecisions, readStudioConversationArchive} from '../frontend/src/server/studio/conversation-archive';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import {readStudioProjectMedia} from '../frontend/src/server/studio/conversation-media-generation';
import {listReadyImageHistory} from '../frontend/src/server/studio/image-conversation-repository';
import {studioTaskFixture} from './helpers/studio-task-fixture';

test('long Studio projects recover exact original and named renders from the owned journal', async t => {
  assert.equal(process.env.DATABASE_URL, undefined);
  const pg = await studioTaskFixture(t);
  await pg.pool.query(readFileSync('neon/migrations/53_studio_media_generation_scope.sql', 'utf8'));
  await pg.pool.query(`CREATE TABLE job_outputs(id text PRIMARY KEY,user_id text,job_id text,kind text,status text,url text,
      duration_sec integer,metadata jsonb,created_at timestamptz DEFAULT clock_timestamp());
    INSERT INTO studio_projects(id,user_id,name,persistence_mode) VALUES
      ('film','owner','Blue ice','connected'),('other','owner','Other','connected'),('foreign','guest','Foreign','connected');`);
  const actor = {authMethod: 'studio-session' as const, userId: 'owner', projectId: 'film', clientId: null};
  const executor: QueryExecutor = {query: async <Row>(sql: string, params?: ReadonlyArray<unknown>) =>
    (await pg.pool.query<Row>(sql, params)).rows};
  const assetId = 'ma_' + 'a'.repeat(32);
  const repository = createQuoteRepository(generationQuoteCodec, {origin:'studio-session', projectId: actor.projectId});
  let order = 0;
  async function addTurn(message: string, reply: string, quoteId: string | null = null, project = 'film', state = 'ready') {
    const requestId = randomUUID();
    const imageRefs = quoteId ? [assetId] : [];
    await pg.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,
      draft_reference_fingerprint,quote_id,state,lease_id,lease_expires_at,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$4,$7,$8,$9,clock_timestamp(),$10)`, [
      project === 'foreign' ? 'guest' : 'owner', project, requestId, '0'.repeat(64),
      {requestId, message, references: imageRefs, referenceMentions: imageRefs.map(id => ({assetId:id,label:'Image 2'}))},
      {reply,image:null}, quoteId, state, randomUUID(), new Date(Date.now() - 86_400_000 + ++order * 1000),
    ]);
    return requestId;
  }
  async function addRender(index: number, prompt: string) {
    const request = normalizeGenerationRequest({surface:'video', engineId:'seedance-2-5', mode:'i2v', prompt,
      settings:{durationSec:4, aspectRatio:'9:16', resolution:'480p', audio:true, negativePrompt:'PRIVATE_SETTING'},
      references:[{kind:'asset', assetId, role:'first_frame'}], outputCount:1});
    const quote = await repository.insertPreparedQuote({userId:actor.userId, oauthClientId:null, request,
      requestHash:hashCanonicalGenerationRequest(request), catalogRevision:'fixture', pricingSnapshot:{privateToken:'PRIVATE_TOKEN'},
      priceCents:22, currency:'USD', fundingMode:'wallet'}, {executor});
    const jobId = `archive-job-${index}`;
    const output = {type:'job-output', jobId, outputId:`recorded.take:${index}-master`, kind:'video'};
    await pg.pool.query("UPDATE mcp_generation_quotes SET state='claimed',job_id=$2,claimed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE quote_id=$1", [quote.quoteId, jobId]);
    await pg.pool.query("UPDATE mcp_generation_quotes SET state='accepted',updated_at=clock_timestamp() WHERE quote_id=$1", [quote.quoteId]);
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES($1,'owner','completed')", [jobId]);
    await pg.pool.query("INSERT INTO job_outputs(id,user_id,job_id,kind,status,url) VALUES ($1,'owner',$2,'video','ready','https://private.example/PRIVATE_URL')", [output.outputId, jobId]);
    const turn = await addTurn('Prepare the next blue-ice shot.', 'Review the historical quote.', quote.quoteId);
    return {turn, quoteId:quote.quoteId, output};
  }

  const opening = await addTurn('The film is for the midnight festival.', 'Use a cobalt palette.');
  const original = await addRender(0, 'Fireflies lifting from a crack in blue ice.');
  const named = await addRender(1, 'Chromatic sundial crossings.');
  const decision = await addTurn('Keep the changed ending.', 'Background. '.repeat(400) + 'The brass pendulum stops on beat three. https://x.example/PRIVATE_SIGNED?token=q ');
  await addTurn('PRIVATE_FAILED pendulum', 'Never completed.', null, 'film', 'failed');
  const foreign = await addTurn('PRIVATE_FOREIGN pendulum', 'Cross owner.', null, 'foreign');
  const other = await addTurn('PRIVATE_OTHER pendulum', 'Cross project.', null, 'other');
  let constraint = '', revision = '';
  for (let i = 2; i <= 36; i++) {
    await addRender(i, `Late studio take ${i}.`);
    if (i === 14) constraint = await addTurn('Keep every future scene silent. Source https://example.test/PRIVATE_SIGNED?v=1', 'Silent.');
    if (i === 22) revision = await addTurn('Change the sound decision. From now on keep the wind, without music.', 'Natural wind only.');
  }
  for (let i = 0; i < 16; i++) await addTurn(`Later message ${i}.`, 'Acknowledged.');
  const boundary = await addTurn('Archive ends here.', 'Never an archived turn.');
  const later = await addTurn('PRIVATE_FUTURE pendulum decision', 'Written after the historical cursor.');

  const originalQuery = 'Reprends la première vidéo de ce projet.';
  const archive = await readStudioConversationArchive(actor, boundary, originalQuery);
  assert.ok(Number.isFinite(Date.parse(archive[0].createdAt)));
  assert.equal(archive[0].selectedFor, 'first_render');
  assert.deepEqual(archive[0].render, {quoteId:original.quoteId, modelId:'seedance-2-5', surface:'video', mode:'i2v',
    settings:{durationSec:4, aspectRatio:'9:16', resolution:'480p', audio:true},
    direction:'Fireflies lifting from a crack in blue ice.', references:[{assetId,role:'first_frame'}], referenceCount:1,
    jobId:original.output.jobId, status:'completed', outputs:[original.output]});
  assert.deepEqual(archive[0].attachments, [{assetId,kind:'image',label:'Image 2'}]);
  assert.ok(archive.some(entry => entry.requestId === opening));
  const decisions = await readStudioArchiveDecisions(actor, boundary);
  assert.deepEqual(decisions.filter(entry => [constraint,revision].includes(entry.requestId)).map(entry => entry.requestId), [constraint,revision]);
  assert.deepEqual(decisions.map(row => row.createdAt), decisions.map(row => row.createdAt).sort());
  assert.match(decisions[decisions.length - 1].message, /wind, without music/);
  assert.ok(decisions.length <= 6 && JSON.stringify(decisions).length < 2400);
  assert.doesNotMatch(JSON.stringify(decisions), /PRIVATE_|https?:/);
  assert.ok(!(await readStudioProjectMedia(actor)).some(item => item.ref.type === 'job-output' && item.ref.outputId === original.output.outputId));
  assert.deepEqual((await readStudioProjectMedia(actor, [original.output.outputId])).map(item => item.ref), [original.output]);
  const related = await readStudioConversationArchive(actor, boundary, 'Where does the pendulum stop?');
  assert.match(related.find(entry => entry.requestId === decision)?.reply ?? '', /brass pendulum stops on beat three/);
  assert.equal((await readStudioConversationArchive(actor, boundary, 'Chromatic sundial'))[0].requestId, named.turn);
  assert.equal((await readStudioConversationArchive(actor, boundary, named.output.outputId))[0].selectedFor, 'exact_id');
  assert.equal((await readStudioConversationArchive(actor, boundary, named.quoteId))[0].requestId, named.turn);
  for (const result of [archive,related]) {
    assert.ok(result.length <= 5 && JSON.stringify(result).length <= 6500);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private\.example|Never an archived turn/);
  }
  assert.deepEqual(await readStudioConversationArchive(actor, foreign, 'pendulum'), []);
  assert.deepEqual(await readStudioConversationArchive(actor, other, 'pendulum'), []);
  await assert.rejects(readStudioConversationArchive({...actor,authMethod:'oauth'} as never, boundary, 'pendulum'), {code:'AUTH_REQUIRED'});
  const older = await listReadyImageHistory(actor, boundary);
  assert.equal(older.length, 30);
  assert.ok(older.every(turn => turn.request_id !== later && turn.request_id !== boundary && turn.state === 'ready'));

  let calls = 0;
  const service = createStudioTaskService(actor, {enabled:true, assistancePolicy:pg.policy});
  for (const message of [originalQuery, 'Continue.']) {
    const input = pg.input('standard', message);
    await service.enqueue(input);
    let captured: unknown;
    const options: Parameters<typeof runStudioTaskWorkerOnce>[0] = {enabled:true, assistancePolicy:pg.policy,
      scope:{...actor, requestId:input.requestId}, serviceOptions:{countInputTokens:async () => 800,
        createActionResponse: async params => {
          calls++;
          captured = params.input;
          assert.ok(Array.isArray(params.input));
          const item = params.input.find(item => 'content' in item && typeof item.content === 'string' && item.content.startsWith('Archived project history'));
          assert.ok(item && 'role' in item && item.role === 'user' && 'content' in item && typeof item.content === 'string');
          if (message === originalQuery) {
            assert.ok(item.content.includes(original.output.outputId));
          } else {
            const entries = JSON.stringify(params.input);
            assert.ok(entries.includes(constraint) && entries.includes(revision), 'Generic continuation automatically receives both recorded constraints.');
          }
          return {id:randomUUID(), model:params.model!, status:'completed', service_tier:'default',
            usage:{input_tokens:800,input_tokens_details:{cached_tokens:0},output_tokens:100,output_tokens_details:{reasoning_tokens:0},total_tokens:900},
            output_text:JSON.stringify({reply:'The first video used the cobalt ice and fireflies.'}), output:[]};
        }}};
    assert.equal(await runStudioTaskWorkerOnce(options), true);
    const saved = await service.read(input.requestId);
    assert.equal(saved.state, 'completed', JSON.stringify({message, saved, calls,
      archiveBlock: JSON.stringify(captured ?? '').includes(original.output.outputId), constraint:JSON.stringify(captured ?? '').includes(constraint),
      revision:JSON.stringify(captured ?? '').includes(revision)}));
    assert.equal(saved.completedCalls, 1);
    assert.deepEqual(await service.enqueue(input), saved);
    assert.equal(await runStudioTaskWorkerOnce(options), false);
  }
  assert.equal(calls, 2);
  assert.equal((await pg.pool.query('SELECT COUNT(*)::int n FROM mcp_generation_quotes')).rows[0].n, 37);
  assert.equal((await pg.pool.query('SELECT COUNT(*)::int n FROM app_receipts')).rows[0].n, 0);

  await pg.pool.query("UPDATE job_outputs SET status='deleted' WHERE id=$1", [original.output.outputId]);
  await pg.pool.query("INSERT INTO job_outputs(id,user_id,job_id,kind,status,url) VALUES('PRIVATE_WRONG_OWNER','guest',$1,'video','ready','PRIVATE_URL')", [original.output.jobId]);
  assert.deepEqual((await readStudioConversationArchive(actor, boundary, originalQuery))[0].render?.outputs, []);
  await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id=$1", [original.output.jobId]);
  assert.ok((await readStudioConversationArchive(actor, boundary, original.quoteId)).every(entry => !entry.render?.outputs.some(output => output.jobId === original.output.jobId)));
  await pg.pool.query("UPDATE studio_projects SET deleted_at=clock_timestamp() WHERE id='film'");
  assert.deepEqual(await readStudioConversationArchive(actor, boundary, originalQuery), []);
  assert.deepEqual(await readStudioArchiveDecisions(actor, boundary), []);
});
