import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {renameStudioConversationProject,automaticallyNameStudioProject,readStudioProjectTitleFallbacks} from '../frontend/src/server/studio/conversation-project-naming';
import {saveStudioConversationMemory} from '../frontend/src/server/studio/conversation-run-repository';
import {listStudioConversationProjects} from '../frontend/src/server/studio/conversation-project-list';
import {readImageConversationProject} from '../frontend/src/server/studio/image-conversation-repository';
import {withDbTransaction,getDb} from '../frontend/src/lib/db';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {claimImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';

test('first meaningful message titles the project without altering its sequence or revision',async t=>{
  const pg=await startDisposablePostgres('studio-names');const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const file of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const actor={authMethod:'studio-session' as const,userId:'00000000-0000-4000-8000-000000000096',clientId:null,projectId:''};
  const project=await createStudioConversationProject(actor,{name:'Untitled project',idempotencyKey:randomUUID()},{featureEnabled:true});actor.projectId=project.projectId;
  const before=(await pg.pool.query('SELECT revision,workspace_state,settings FROM studio_projects WHERE id=$1',[project.projectId])).rows[0];
  await claimImageTurn(actor,{requestId:randomUUID(),message:'Create a cinematic perfume launch in Paris.',references:[]});
  const after=(await pg.pool.query('SELECT name,revision,workspace_state,settings FROM studio_projects WHERE id=$1',[project.projectId])).rows[0];
  assert.equal(after.name,'Cinematic perfume launch in Paris');
  const {name,...unchanged}=after;assert.deepEqual(unchanged,before);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_sequences WHERE project_id=$1',[project.projectId])).rows[0].n,1);
  await pg.pool.query("UPDATE studio_image_turns SET state='ready' WHERE project_id=$1",[project.projectId]);
  await t.test('semantic title shares an existing memory write; a customer rename always wins',async()=>{
    await saveStudioConversationMemory(actor,{revision:0,brief:'A warm perfume campaign in Paris.',decisions:[],projectTitle:'Paris perfume launch'});
    assert.equal((await readImageConversationProject(actor.userId,actor.projectId)).name,'Paris perfume launch');
    const manual={name:'My fragrance film',idempotencyKey:randomUUID()};
    const result=await renameStudioConversationProject(actor,manual);
    assert.deepEqual(await renameStudioConversationProject(actor,manual),result,'lost acknowledgements replay the same receipt');
    await assert.rejects(renameStudioConversationProject(actor,{...manual,name:'Something else'}),/STUDIO_IDEMPOTENCY_CONFLICT/);
    await saveStudioConversationMemory(actor,{revision:1,brief:'Campaign with a narrator.',decisions:[],projectTitle:'A narrator in Paris'});
    assert.equal((await readImageConversationProject(actor.userId,actor.projectId)).name,manual.name);
    const memory=await saveStudioConversationMemory(actor,{revision:2,brief:'Useful brief survives a malformed optional title.',decisions:[],projectTitle:'Paris\nlaunch'});
    assert.equal(memory.revision,3);assert.equal(memory.brief,'Useful brief survives a malformed optional title.');
    assert.equal((await readImageConversationProject(actor.userId,actor.projectId)).name,manual.name);
    await claimImageTurn(actor,{requestId:randomUUID(),message:'Create a completely different story.',references:[]});
    assert.equal((await readImageConversationProject(actor.userId,actor.projectId)).name,manual.name);
    assert.deepEqual((await pg.pool.query('SELECT revision,workspace_state,settings FROM studio_projects WHERE id=$1',[project.projectId])).rows[0],before);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,0);
  });
  await pg.pool.query("UPDATE studio_image_turns SET state='ready' WHERE user_id=$1",[actor.userId]);
  await t.test('old untitled chat gets a bounded read-only title; explicitly choosing Untitled project locks it',async()=>{
    const old=await createStudioConversationProject(actor,{name:'Untitled project',idempotencyKey:randomUUID()},{featureEnabled:true});
    const oldActor={...actor,projectId:old.projectId};
    await claimImageTurn(oldActor,{requestId:randomUUID(),message:'Bonjour',references:[]});
    await pg.pool.query("UPDATE studio_image_turns SET state='ready' WHERE user_id=$1",[actor.userId]);
    await claimImageTurn(oldActor,{requestId:randomUUID(),message:'Je voudrais une vidéo pour un parfum à Paris.',references:[]});
    await pg.pool.query("DELETE FROM studio_project_commands WHERE project_id=$1 AND command_kind='auto_title_studio_conversation'",[old.projectId]);
    await pg.pool.query("UPDATE studio_projects SET name='Untitled project' WHERE id=$1",[old.projectId]);
    const rows=await listStudioConversationProjects(actor.userId);
    assert.equal(rows.find(row=>row.id===old.projectId)?.name,'Une vidéo pour un parfum à Paris');
    assert.equal((await readImageConversationProject(actor.userId,old.projectId)).name,'Une vidéo pour un parfum à Paris');
    assert.equal((await pg.pool.query('SELECT name FROM studio_projects WHERE id=$1',[old.projectId])).rows[0].name,'Untitled project','reads must not persist');
    await renameStudioConversationProject(oldActor,{name:'Untitled project',idempotencyKey:randomUUID()});
    await withDbTransaction(tx=>automaticallyNameStudioProject(oldActor,'assistant','Paris campaign',tx));
    assert.equal((await readImageConversationProject(actor.userId,old.projectId)).name,'Untitled project');
    assert.equal((await listStudioConversationProjects(actor.userId)).find(row=>row.id===old.projectId)?.name,'Untitled project');
  });
  await t.test('ownership, deletion and retirement guards prevent title writes',async()=>{
    await assert.rejects(renameStudioConversationProject({...actor,userId:'other'},{name:'Stolen',idempotencyKey:randomUUID()}),/STUDIO_PROJECT_NOT_FOUND/);
    const retired=await createStudioConversationProject(actor,{name:'Private project',idempotencyKey:randomUUID()},{featureEnabled:true});
    await pg.pool.query("UPDATE studio_projects SET persistence_mode='legacy' WHERE id=$1",[retired.projectId]);
    await assert.rejects(renameStudioConversationProject({...actor,projectId:retired.projectId},{name:'Rename',idempotencyKey:randomUUID()}),/STUDIO_PROJECT_NOT_FOUND/);
    await pg.pool.query('UPDATE studio_projects SET deleted_at=now() WHERE id=$1',[project.projectId]);
    await assert.rejects(renameStudioConversationProject(actor,{name:'Deleted',idempotencyKey:randomUUID()}),/STUDIO_PROJECT_NOT_FOUND/);
  });
  await t.test('a concurrent automatic suggestion cannot overwrite a manual name',async()=>{
    const fresh=await createStudioConversationProject(actor,{name:'Untitled project',idempotencyKey:randomUUID()},{featureEnabled:true}),a={...actor,projectId:fresh.projectId};
    await Promise.all([withDbTransaction(tx=>automaticallyNameStudioProject(a,'assistant','Ocean perfume',tx)),renameStudioConversationProject(a,{name:'Chosen by me',idempotencyKey:randomUUID()})]);
    assert.equal((await readImageConversationProject(a.userId,a.projectId)).name,'Chosen by me');
  });

  await t.test('old-title projection bounds project count, message count, text and ownership on real rows',async()=>{
    await pg.pool.query("INSERT INTO studio_projects(id,user_id,name,persistence_mode) SELECT 'project_names_bound_'||n,$1,'Untitled project','connected' FROM generate_series(1,105) n",[actor.userId]);
    const bounded='project_names_bound_1';
    for(let n=0;n<12;n++)await pg.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,lease_id,lease_expires_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,now())`,[actor.userId,bounded,randomUUID(),'a'.repeat(64),JSON.stringify({message:'Long retained source '.repeat(30),references:[]}),randomUUID()]);
    const foreign=await createStudioConversationProject({userId:'foreign-reader'},{name:'Untitled project',idempotencyKey:randomUUID()},{featureEnabled:true});
    let observed=0;
    const executor={async query<T>(sql:string,params?:readonly unknown[]){const rows=(await pg.pool.query(sql,params?[...params]:undefined)).rows;observed=rows.length;for(const row of rows){assert.ok(row.messages.length<=10);for(const message of row.messages)assert.ok(message.length<=240);}return rows as T[];}};
    await readStudioProjectTitleFallbacks(actor.userId,Array.from({length:105},(_,i)=>'project_names_bound_'+(i+1)),executor);
    assert.equal(observed,100);
    assert.equal((await readStudioProjectTitleFallbacks(actor.userId,[foreign.projectId])).size,0);
    const list=await listStudioConversationProjects(actor.userId);assert.equal(list.length,100);assert.ok(!list.some(row=>row.id===foreign.projectId));
  });

});
