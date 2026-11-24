import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {mobileStudioReviewTurns, renewMobileStudioQuote} from '../frontend/src/server/mobile/studio-renewal';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { imageTurnRetryInput, type ImageConversationHistoryTurn } from '../frontend/src/lib/studio/image-conversation-contract';
import { createImageConversationService, type ImageGenerationFactory } from '../frontend/src/server/studio/image-conversation-service';
import { createStudioImageGenerationService } from '../frontend/src/server/studio/image-generation-service';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { addTopup } from './helpers/mcp-paid-e2e-harness';

test('saved labels survive failed renewal, immutable replay and history without granting foreign asset access', async t => {
  const pg = await startDisposablePostgres('studio-reference-mentions');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    INSERT INTO studio_projects VALUES('project-labels','owner','Labels',NULL);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  for (const name of ['50_studio_image_conversation.sql', '51_studio_image_model_usage.sql']) await pg.pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
  await addTopup(pg.pool, 'owner', 10000);
  const imageA = 'ma_' + 'a'.repeat(32);
  const imageB = 'ma_' + 'b'.repeat(32);
  const foreign = 'ma_' + 'c'.repeat(32);
  for (const [index, assetId] of [imageA, imageB, foreign].entries()) await pg.pool.query(
    `INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata) VALUES($1,$2,$3,'image',$4,'image/png',1024,1024,1024,'ready','{}')`,
    [`asset-${index}`, assetId, index === 2 ? 'foreign' : 'owner', `https://cdn.maxvideoai.com/owned-${index}.png`],
  );
  const engine = getFalEngineById('gpt-image-2')!;
  const catalog = [{ engine: engine.engine, surface: 'image' as const, publicModes: ['t2i' as const, 'i2i' as const], modeCaps: Object.fromEntries(engine.modes.map(mode => [mode.mode, mode.ui])) }];
  const factory: ImageGenerationFactory = (actor, options) => createStudioImageGenerationService(actor, { ...options,
    prepareDependencies: { listPublicEngines: async () => catalog, resolveRequestExecutability: () => ({ executable: true, reason: 'available' }) },
  });
  const actor = { authMethod: 'studio-session' as const, userId: 'owner', projectId: 'project-labels', clientId: null };
  let calls = 0;
  let observedHistory: ImageConversationHistoryTurn[] = [];
  const service = createImageConversationService(actor, { enabled: true, generationFactory: factory, director: async (input, history, refs) => {
    calls++;
    observedHistory = history;
    assert.deepEqual(input.referenceMentions, [{ assetId: refs[0].assetId, label: 'Image 1' }]);
    return { reply: 'Use Image 1 as the reference. Review the quote.', image: { prompt: 'A quiet blue product photograph', aspectRatio: '1:1' } };
  } });
  const input = { requestId: randomUUID(), message: 'Create with @Image 1.', references: [imageA], referenceMentions: [{ assetId: imageA, label: 'Image 1' }] };
  const original = await service.submit(input);
  assert.ok(original.quote);
  assert.deepEqual(original.referenceMentions, input.referenceMentions);
  assert.deepEqual((await service.read()).turns[0].referenceMentions, input.referenceMentions);
  assert.deepEqual((await pg.pool.query('SELECT input_json FROM studio_image_turns WHERE request_id=$1', [input.requestId])).rows[0].input_json.referenceMentions, input.referenceMentions);
  assert.deepEqual(await service.submit(imageTurnRetryInput(original)), original);
  assert.equal(calls, 1);
  await assert.rejects(service.submit({ ...input, referenceMentions: [{ assetId: imageA, label: 'Image 2' }] }), { code: 'PARAMETER_INVALID' });

  await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired' WHERE quote_id=$1", [original.quote.quoteId]);
  const renewal = { ...imageTurnRetryInput(original), requestId: randomUUID(), renewedFromRequestId: original.requestId };
  await assert.rejects(service.submit({ ...renewal, referenceMentions: [{ assetId: imageA, label: 'Image 2' }] }), { code: 'PARAMETER_INVALID' });
  const { referenceMentions: _ignored, ...missingLabels } = renewal;
  await assert.rejects(service.submit(missingLabels), { code: 'PARAMETER_INVALID' });
  let failOnce = true;
  const retryFactory: ImageGenerationFactory = (current, options) => {
    const base = factory(current, options);
    return { ...base, prepare: async request => { if (failOnce) { failOnce = false; throw new Error('Lost renewal response'); } return base.prepare(request); } };
  };
  const retryService = createImageConversationService(actor, { enabled: true, generationFactory: retryFactory, director: async () => { throw new Error('Renewal must reuse its saved direction'); } });
  await assert.rejects(retryService.submit(renewal), /Lost renewal response/);
  const failed = (await retryService.read()).turns.find(turn => turn.requestId === renewal.requestId)!;
  assert.deepEqual(imageTurnRetryInput(failed), renewal);
  const recovered = await retryService.submit(imageTurnRetryInput(failed));
  assert.ok(recovered.quote);
  assert.notEqual(recovered.quote.quoteId, original.quote.quoteId);
  assert.deepEqual(recovered.referenceMentions, input.referenceMentions);
  assert.equal(calls, 1);

  const second = await service.submit({ ...input, requestId: randomUUID(), references: [imageB], referenceMentions: [{ assetId: imageB, label: 'Image 1' }] });
  assert.deepEqual(second.referenceMentions, [{ assetId: imageB, label: 'Image 1' }]);
  const journalTurns = (await service.read()).turns;
  const visible = mobileStudioReviewTurns(journalTurns);
  assert.deepEqual(visible.map(turn => turn.requestId), [recovered.requestId, second.requestId]);
  assert.deepEqual(visible.map(turn => turn.references), [[imageA], [imageB]]);
  assert.equal(visible[0].message, visible[1].message, 'Two independent human messages may have identical text');
  const next = { ...recovered, requestId: randomUUID(), renewedFromRequestId: recovered.requestId };
  const expiredParent = { ...recovered, quote: { ...recovered.quote, state: 'expired' as const } };
  const savedOriginal = journalTurns.find(turn => turn.requestId === original.requestId)!;
  assert.deepEqual(mobileStudioReviewTurns([savedOriginal, second, expiredParent, next]).map(turn => turn.requestId),
    [next.requestId, second.requestId]);
  assert.deepEqual(mobileStudioReviewTurns([next]), [next], 'A renewal remains visible when its parent is on an older page');
  const usedParent = { ...expiredParent, quote: { ...expiredParent.quote, state: 'accepted' as const } };
  assert.deepEqual(mobileStudioReviewTurns([usedParent, next]), [usedParent, next], 'Keep any prior accepted receipt');
  assert.deepEqual(mobileStudioReviewTurns([expiredParent, { ...next, state:'failed', quote:null }]),
    [expiredParent], 'Keep the last price review available when its refresh fails');
  assert.deepEqual(observedHistory.map(turn => turn.referenceMentions), [input.referenceMentions, input.referenceMentions]);
  await assert.rejects(service.submit({ ...input, requestId: randomUUID(), references: [foreign], referenceMentions: [{ assetId: foreign, label: 'Image 1' }] }), { code: 'REFERENCE_INVALID' });
  assert.equal(calls, 2, 'foreign media must fail before invoking the director');

  const {readStudioProjectReferenceOrdinals} = await import('../frontend/src/server/studio/project-reference-registry');
  const plain = (message: string) => ({requestId:randomUUID(),message,references:[],locale:'fr' as const});
  const ambiguous = await service.submit(plain('Reprends Image 1'));
  assert.match(ambiguous.reply!, /fichier/i);
  assert.equal(calls,2);
  assert.equal(ambiguous.quote,null);
  const recallA = 'ma_' + 'd'.repeat(32);
  const recallB = 'ma_' + 'e'.repeat(32);
  for (const [id, template] of [[recallA,imageA],[recallB,imageB]]) {
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
      SELECT $1,$1,'artist',kind,url,mime_type,size_bytes,width,height,status,metadata FROM media_assets WHERE public_id=$2`,[id,template]);
  }
  await addTopup(pg.pool, 'artist', 1000);
  await pg.pool.query("INSERT INTO studio_projects VALUES ('recall','artist','Retouche',NULL)");
  const project = {...actor,userId:'artist',projectId:'recall'};
  const seen: string[][] = [];
  const open = (context = project) => createImageConversationService(context,{enabled:true,generationFactory:factory,
    director:async (input,_history,refs) => {
      seen.push(refs.map(ref => ref.assetId));
      if (input.message === 'Oui' || input.message === 'Ignore Image 1, utilise Image 2.') return {reply:'Voici le devis.',image:{prompt:'Brighten the original boat',aspectRatio:'1:1'}};
      const reply = input.message === '1' ? 'Veux-tu le devis pour cette retouche ?' : 'Deux retouches possibles : 1) éclaircir le bateau, 2) assombrir le fond. Laquelle préfères-tu ?';
      return {reply,image:null};
    }});
  const firstPhoto = {...plain('Voici ma photo.'),references:[recallA],referenceMentions:[{assetId:recallA,label:'Image 1'}]};
  await open().submit(firstPhoto);
  const choice = await open().submit(plain('1'));
  assert.deepEqual(choice.references,[]);
  assert.equal(choice.referenceMentions,undefined);
  const yes = plain('Oui');
  const ready = await open().submit(yes);
  assert.equal(ready.quote?.summary.mode,'i2i');
  assert.deepEqual(ready.quote?.summary.references.map(ref=>ref.assetId),[recallA]);
  assert.deepEqual(ready.references,[]);
  assert.deepEqual(seen,[[recallA],[recallA],[recallA]]);
  const again = await open().submit(yes);
  assert.equal(again.quote?.quoteId,ready.quote?.quoteId);
  assert.equal(seen.length,3);
  await open().submit({...plain('Deuxième photo'),references:[recallB],referenceMentions:[{assetId:recallB,label:'Image 2'}]});
  await open().submit(plain('Compare les deux photos.'));
  assert.deepEqual(new Set(seen.at(-1)),new Set([recallA,recallB]));
  // Seed a reopened project across multiple days, independently of the hourly pilot limit.
  const archiveProject = {...project,projectId:'recall-archive'};
  await pg.pool.query("INSERT INTO studio_projects VALUES ('recall-archive','artist','Archives',NULL)");
  const archivedInputs = [firstPhoto, {...plain('Deuxième photo'), references:[recallB],
    referenceMentions:[{assetId:recallB,label:'Image 2'}]}, ...Array.from({length:35},()=>plain('Décision neutre.'))];
  for (const [index, saved] of archivedInputs.entries()) await pg.pool.query(`INSERT INTO studio_image_turns
    (user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,lease_id,lease_expires_at,state,created_at)
    VALUES ('artist','recall-archive',$1,$2,$3,$4,$2,$5,clock_timestamp(),'ready',clock_timestamp()-interval '2 days'+$6*interval '1 minute')`,
    [saved.requestId,'a'.repeat(64),saved,{reply:'Noté.',image:null},randomUUID(),index]);
  assert.deepEqual(await readStudioProjectReferenceOrdinals(archiveProject),{image:2,video:0,audio:0});
  assert.deepEqual(await readStudioProjectReferenceOrdinals({...archiveProject,userId:'foreign'}),{image:0,video:0,audio:0});
  const compare = await open(archiveProject).submit(plain('Compara Imagen 2 y 1.'));
  assert.deepEqual(seen.at(-1),[recallB,recallA]);
  assert.deepEqual(compare.references,[]);
  const beforeAmbiguous=seen.length;
  assert.equal((await open(archiveProject).submit(plain('Retouche cette image'))).quote,null);
  assert.equal(seen.length,beforeAmbiguous);
  const selected = await open(archiveProject).submit(plain('Ignore Image 1, utilise Image 2.'));
  assert.deepEqual(seen.at(-1),[recallB]);
  assert.deepEqual(selected.quote?.summary.references.map(ref=>ref.assetId),[recallB]);
  assert.deepEqual(selected.references,[]);
  await open(archiveProject).submit(plain('N’utilise pas Image 1.'));
  assert.deepEqual(seen.at(-1),[]);
  const originals = (await pg.pool.query('SELECT input_json FROM studio_image_turns WHERE project_id=$1 AND request_id=ANY($2::uuid[]) ORDER BY created_at',
    [archiveProject.projectId,archivedInputs.slice(0,2).map(source=>source.requestId)])).rows;
  assert.deepEqual(originals.map(row=>row.input_json.references),[[recallA],[recallB]]);
  const otherProject = await pg.pool.query('SELECT input_json FROM studio_image_turns WHERE project_id=$1 AND request_id=$2',[project.projectId,yes.requestId]);
  assert.deepEqual(otherProject.rows[0].input_json.references,[]);
  // A later reused label cannot change the source of an already reviewed quote.
  await open().submit({...plain('Autre photo'),references:[recallB],referenceMentions:[{assetId:recallB,label:'Image 1'}]});
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired' WHERE quote_id=$1", [ready.quote!.quoteId]);
  const renewed = await open().submit({...imageTurnRetryInput(ready),requestId:randomUUID(),renewedFromRequestId:yes.requestId});
  assert.deepEqual(renewed.quote?.summary.references.map(ref=>ref.assetId),[recallA]);
  assert.notEqual(renewed.quote?.quoteId,ready.quote!.quoteId);
  assert.deepEqual(renewed.references,[]);
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired' WHERE quote_id=$1",[renewed.quote!.quoteId]);
  const mobileRenewal = await renewMobileStudioQuote(project, {action:'renew-generation', requestId:renewed.requestId,
    quoteId:renewed.quote!.quoteId,renewalId:randomUUID(),locale:'fr'},open());
  assert.equal(mobileRenewal.quote.review?.requestHash,renewed.quote!.requestHash);
  const frozen = (await pg.pool.query('SELECT input_json,draft_json FROM studio_image_turns WHERE request_id=$1',
    [mobileRenewal.requestId])).rows[0];
  assert.deepEqual(frozen.input_json.references,[]);
  assert.deepEqual(frozen.draft_json.recalledReferences.map((ref: {assetId:string})=>ref.assetId),[recallA]);

  // This label belongs only to the other project, even though the user owns both.
  await open().submit({...plain('Photo historique'),references:[recallB],referenceMentions:[{assetId:recallB,label:'Image 9'}]});
  const beforeMissing = seen.length;
  assert.match((await open(archiveProject).submit(plain('Utilise Image 9'))).reply!, /ne peux pas lire/);
  assert.equal(seen.length,beforeMissing);
  await open(archiveProject).submit(plain('Ignore Image 1 et Image 2.'));
  assert.deepEqual(seen.at(-1),[]);
  await open().submit(plain('Make a new image from scratch.'));
  assert.deepEqual(seen.at(-1),[]);
  await open().submit(plain('Write a new prompt for GPT Image 2.5 in 1:1.'));
  assert.deepEqual(seen.at(-1),[]);
  await pg.pool.query('UPDATE media_assets SET deleted_at=clock_timestamp() WHERE public_id=$1',[recallA]);
  const previousCalls=seen.length;
  const deleted=await open(archiveProject).submit(plain('Reprends Image 1'));
  assert.match(deleted.reply!, /ne peux pas lire/);
  assert.equal(deleted.quote,null);
  assert.equal(seen.length,previousCalls);
  assert.deepEqual(await readStudioProjectReferenceOrdinals(project),{image:9,video:0,audio:0});
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  const nextId = randomUUID();
  await pg.pool.query('UPDATE media_assets SET deleted_at=now() WHERE public_id=$1',[imageA]);
  await assert.rejects(renewMobileStudioQuote(actor, {action:'renew-generation', requestId:recovered.requestId,
    quoteId:recovered.quote!.quoteId, renewalId:nextId, locale:'en'}, service), {code:'REFERENCE_INVALID'});
  assert.equal(calls, 2);
  assert.equal((await pg.pool.query('SELECT quote_id FROM studio_image_turns WHERE request_id=$1',[nextId])).rows[0]?.quote_id ?? null,null);
  assert.equal((await pg.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1',[second.quote!.quoteId])).rows[0].state,'prepared');

});
