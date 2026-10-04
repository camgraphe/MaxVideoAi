import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {initializeStudioConnectedFixture,STUDIO_CONNECTED_MONTAGE_INPUT} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {createStudioMontageProject} from '../frontend/src/server/studio/montage-command';
import {readStudioWorkspace} from '../frontend/src/server/studio/workspace-command';
import {editStudioConversationTimeline} from '../frontend/src/server/studio/conversation-edit-command';
import type {QueryExecutor} from '../frontend/src/lib/db';
import type {AgentPrincipal} from '../frontend/src/server/agent-api/principal';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createMaxVideoAiMcpServer,type MaxVideoAiMcpServices} from '../frontend/src/server/mcp/server';

// Catches bypassed OAuth/project guards, a separate edit implementation, stale revision
// writes, duplicate retries, unrestricted output reuse, and private source URL leakage.
test('OAuth timeline adapters preserve canonical edits, receipts and ownership across session and MCP clients',async t => {
  const module = await import('../frontend/src/server/agent-api/studio-timeline').catch(() => null);
  assert.ok(module?.createAgentStudioTimelineService,'The OAuth adapter must expose the canonical saved timeline.');
  const pg = await startDisposablePostgres('mcp-timeline');
  t.after(() => pg.cleanup());
  await initializeStudioConnectedFixture(pg);
  for (const name of ['30_mcp_paid_generation.sql','49_studio_generation_scope.sql']) await pg.pool.query(await readFile(`neon/migrations/${name}`,'utf8'));
  await pg.pool.query("ALTER TABLE app_jobs ADD COLUMN status text; UPDATE media_assets SET url='https://cdn.maxvideoai.com/' || public_id || '.mp4'");
  const withTransaction = async <T>(callback: (executor: QueryExecutor) => Promise<T>) => {
    const client = await pg.pool.connect();
    try {await client.query('BEGIN');const result = await callback({query: async(sql,values)=>(await client.query(sql,values)).rows});await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  };
  const dependencies = {withTransaction,featureEnabled: true};
  const principal: AgentPrincipal = {userId: STUDIO_FIXTURE_OWNERS[0],clientId: 'real-oauth-client',authMethod: 'oauth',emailVerified: true};
  const service = module.createAgentStudioTimelineService(dependencies);
  const project = await createStudioMontageProject(principal,STUDIO_CONNECTED_MONTAGE_INPUT,dependencies);
  const initial = await service.read({projectId: project.projectId},principal);
  const services: MaxVideoAiMcpServices = {
    async getAccountStatus(){throw new Error('unused');},async listModels(){return [];},async getModelDetails(){throw new Error('unused');},async recommendModels(){return {recommendations: [],nextAction: 'clarify_requirements'};},
    readStudioTimeline: service.read,editStudioTimeline: service.edit,
  };
  const server = createMaxVideoAiMcpServer(principal,services,{paidGeneration: false,referenceUploads: false,studioTimelineEditing: true});
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'timeline-proof',version: '1'});
  await server.connect(serverTransport);await client.connect(clientTransport);
  t.after(async()=>{await client.close();await server.close();});
  const tools = (await client.listTools()).tools;
  const readTool = tools.find(tool=>tool.name==='get_studio_timeline');
  const editTool = tools.find(tool=>tool.name==='edit_studio_timeline');
  assert.ok(readTool,'Enabled MCP must expose an actual owned timeline read.');
  assert.ok(editTool);
  assert.equal(readTool.inputSchema.additionalProperties,false);
  assert.equal(editTool.inputSchema.additionalProperties,false);
  assert.equal(readTool.outputSchema?.additionalProperties,false,'Read tools publish the exact safe result schema.');
  assert.equal(editTool.outputSchema?.additionalProperties,false,'Edit tools publish the canonical command receipt schema.');
  assert.deepEqual(editTool.annotations,{readOnlyHint: false,destructiveHint: true,idempotentHint: true,openWorldHint: false});
  const transported = await client.callTool({name: 'get_studio_timeline',arguments: {projectId: project.projectId}});
  assert.deepEqual(transported.structuredContent,initial);
  const forbidden = await client.callTool({name: 'get_studio_timeline',arguments: {projectId: project.projectId,userId: principal.userId}});
  assert.equal(forbidden.isError,true,'Identity cannot be supplied through MCP arguments.');
  const disabledServer = createMaxVideoAiMcpServer(principal,services,{paidGeneration: false,referenceUploads: false});
  const [disabledClientTransport,disabledServerTransport] = InMemoryTransport.createLinkedPair();
  const disabledClient = new Client({name: 'timeline-disabled',version: '1'});
  await disabledServer.connect(disabledServerTransport);await disabledClient.connect(disabledClientTransport);
  t.after(async()=>{await disabledClient.close();await disabledServer.close();});
  assert.equal((await disabledClient.listTools()).tools.some(tool=>tool.name==='get_studio_timeline'||tool.name==='edit_studio_timeline'),false,'Unchanged publication flags keep the public transport closed.');
  assert.equal(initial.revision,0);
  assert.equal(initial.sequenceId,project.sequenceId);
  assert.equal(initial.fps,30);
  assert.deepEqual(initial.clips.map(clip=>[clip.id,clip.startFrame,clip.durationFrames,clip.sourceInFrame]),[['montage-clip-01',0,60,30],['montage-clip-02',60,60,15]]);
  assert.doesNotMatch(JSON.stringify(initial),/https?:|storageKey|workspaceState|userId|nodes/,'Discovery exposes identities and edit facts, never private source URLs or graph state.');
  assert.deepEqual(await service.read({projectId: project.projectId,sequenceId: project.sequenceId},principal),initial);
  await assert.rejects(service.read({projectId: project.projectId}, {...principal,authMethod: 'studio-session'} as unknown as AgentPrincipal),{code: 'AUTH_REQUIRED'});
  await assert.rejects(service.edit({projectId: project.projectId,sequenceId: project.sequenceId,expectedRevision: 0,idempotencyKey: randomUUID(),edit: {kind: 'remove',clipId: 'montage-clip-01'}},{...principal,clientId: null}),{code: 'AUTH_REQUIRED'});
  await assert.rejects(service.read({projectId: project.projectId}, {...principal,userId: STUDIO_FIXTURE_OWNERS[1]}),{code: 'REFERENCE_NOT_FOUND'});
  await assert.rejects(service.read({projectId: project.projectId,sequenceId: 'foreign-sequence'},principal),{code: 'REFERENCE_NOT_FOUND'});
  await assert.rejects(service.read({projectId: project.projectId,owner: principal.userId} as any,principal),{code: 'PARAMETER_INVALID'});
  await assert.rejects(module.createAgentStudioTimelineService({...dependencies,featureEnabled: false}).read({projectId: project.projectId},principal),{code: 'ENGINE_UNAVAILABLE'});
  const command = {projectId: project.projectId,sequenceId: project.sequenceId,expectedRevision: 0,idempotencyKey: randomUUID(),edit: {kind: 'trim' as const,clipId: 'montage-clip-01',edge: 'start' as const,durationFrames: 30}};
  await assert.rejects(service.edit(command,{...principal,userId: STUDIO_FIXTURE_OWNERS[1]}),{code: 'REFERENCE_NOT_FOUND'});
  const trimmed = await client.callTool({name: 'edit_studio_timeline',arguments: command});
  assert.equal(trimmed.isError,undefined,JSON.stringify(trimmed));
  const trim = trimmed.structuredContent as Awaited<ReturnType<typeof service.edit>>;
  assert.equal(trim.revision,1);
  assert.deepEqual(await service.edit(command,principal),trim);
  assert.deepEqual((await service.read({projectId: project.projectId},principal)).clips.map(clip=>[clip.startFrame,clip.durationFrames,clip.sourceInFrame]),[[0,30,60],[30,60,15]]);
  await assert.rejects(service.edit({...command,expectedRevision: 1},principal),{code: 'PARAMETER_INVALID'});
  const manual = await editStudioConversationTimeline({userId: principal.userId},{...command,expectedRevision: 1,idempotencyKey: randomUUID(),edit: {kind: 'move',clipId: 'montage-clip-02',startFrame: 90}},dependencies);
  assert.equal(manual.revision,2);
  await assert.rejects(service.edit({...command,idempotencyKey: randomUUID()},principal),{code: 'PARAMETER_INVALID',retryable: false,nextAction: {action: 'read_timeline',projectId: project.projectId}});
  const outputId = randomUUID();
  await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES('owned-complete',$1,'completed'),('foreign-complete',$2,'completed'),('pending',$1,'running')",[principal.userId,STUDIO_FIXTURE_OWNERS[1]]);
  for (const [id,job,owner] of [[outputId,'owned-complete',principal.userId],[randomUUID(),'foreign-complete',STUDIO_FIXTURE_OWNERS[1]],[randomUUID(),'pending',principal.userId]]) {
    await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,status,metadata) VALUES($1,$2,$3,'video','https://cdn.maxvideoai.com/real.mp4','video/mp4','ready',$4::jsonb)",[id,job,owner,JSON.stringify({mediaFacts: {source: 'probe',durationSec: 6,width: 320,height: 180,hasAudio: true}})]);
  }
  const insert = {...command,expectedRevision: 2,idempotencyKey: randomUUID(),edit: {kind: 'insert' as const,ref: {type: 'job-output' as const,jobId: 'owned-complete',outputId,kind: 'video' as const},startFrame: 90,durationFrames: 60}};
  await assert.rejects(editStudioConversationTimeline({userId: principal.userId},insert,dependencies),/MEDIA_NOT_AVAILABLE/,'Session insertion retains the original accepted project-quote requirement.');
  const reused = await service.edit(insert,principal);
  assert.equal(reused.revision,3);
  assert.equal(reused.clipCount,3);
  assert.deepEqual(await service.edit(insert,{...principal,clientId: 'another-real-client'}),reused,'Canonical receipts prevent a second edit across authorized clients.');
  await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='owned-complete'");
  await assert.rejects(service.edit({...insert,expectedRevision: 3,idempotencyKey: randomUUID()},principal),{code: 'REFERENCE_NOT_FOUND'});
  await pg.pool.query("UPDATE app_jobs SET hidden=false WHERE job_id='owned-complete'");
  for (const [job,owner] of [['foreign-complete',STUDIO_FIXTURE_OWNERS[1]],['pending',principal.userId]]) {
    const row = (await pg.pool.query('SELECT id FROM job_outputs WHERE job_id=$1 AND user_id=$2',[job,owner])).rows[0];
    await assert.rejects(service.edit({...insert,expectedRevision: 3,idempotencyKey: randomUUID(),edit: {...insert.edit,ref: {...insert.edit.ref,jobId: job,outputId: row.id}}},principal),{code: 'REFERENCE_NOT_FOUND'});
  }
  const concurrent = await Promise.allSettled([120,150].map(startFrame=>service.edit({...command,expectedRevision: 3,idempotencyKey: randomUUID(),edit: {kind: 'move',clipId: 'montage-clip-01',startFrame}},principal)));
  assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await readStudioWorkspace(principal,project.projectId,dependencies)).project.revision,4);
  const gain = await client.callTool({name: 'edit_studio_timeline',arguments: {...command,expectedRevision: 4,idempotencyKey: randomUUID(),edit: {kind: 'gain',clipId: reused.clip!.id,volume: 15}}});
  assert.equal(gain.isError,undefined,JSON.stringify(gain));
  assert.equal((await service.read({projectId: project.projectId},principal)).clips.find(clip=>clip.id===reused.clip!.id)?.volume,15,'MCP gain updates the same percentage mix read by Studio and renderer.');
  const remove = await client.callTool({name: 'edit_studio_timeline',arguments: {...command,expectedRevision: 5,idempotencyKey: randomUUID(),edit: {kind: 'remove',clipId: reused.clip!.id}}});
  assert.equal(remove.isError,undefined,JSON.stringify(remove));
  assert.equal((await service.read({projectId: project.projectId},principal)).clips.some(clip=>clip.id===reused.clip!.id),false);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM job_outputs WHERE id=$1',[outputId])).rows[0].n,1,'Removing a timeline clip preserves its original output.');
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n,0,'Reading and editing create no generation quote.');
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM studio_project_commands WHERE command_kind='conversation_timeline_edit'")).rows[0].n,6,'Retries/rejections produce no additional edit receipt.');
  await pg.pool.query('UPDATE studio_projects SET deleted_at=NOW() WHERE id=$1',[project.projectId]);
  await assert.rejects(service.edit(command,principal),{code: 'REFERENCE_NOT_FOUND'},'A stored receipt cannot bypass deleted project ownership.');
});
