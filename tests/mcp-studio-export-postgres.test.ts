import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {getDb} from '../frontend/src/lib/db';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {createMaxVideoAiMcpServer,type MaxVideoAiMcpServices} from '../frontend/src/server/mcp/server';
import {parseTimelineExportRequest} from '../frontend/src/server/timeline-exports/render-request';
import {timelineExportIdFromIdempotencyKey,type TimelineExportJobRecord} from '../frontend/src/server/timeline-exports/repository';
import type {AgentPrincipal} from '../frontend/src/server/agent-api/principal';
import type {StudioExportDependencies} from '../frontend/src/server/studio/conversation-export-command';

// Keeps real OAuth adapters, canonical saved-cut preparation/receipt storage and MCP
// validation. Only the externally effective estimate/submit/job-delivery owners are doubled.
test('MCP exports prepare an owned saved cut, require scoped exact confirmation and recover one safe job',async t=>{
  const module = await import('../frontend/src/server/agent-api/studio-export').catch(()=>null);
  assert.ok(module?.createAgentStudioExportService,'MCP needs an OAuth adapter to the canonical export pipeline.');
  const pg = await startDisposablePostgres('mcp-export');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const name of ['26_studio_projects.sql','42_studio_connected_montages.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const principal: AgentPrincipal = {userId: '00000000-0000-4000-8000-000000000211',clientId: 'oauth-export-client',authMethod: 'oauth',emailVerified: true};
  const project = await createStudioConversationProject({userId: principal.userId},{name: 'A five second film',idempotencyKey: randomUUID()},{featureEnabled: true});
  const clip = {id:'opening',title:'Opening',outputNodeId:'opening-output',assetId:'ma_'+'a'.repeat(32),track:'video',mediaKind:'image',startSec:0,durationSec:5,sourceStartSec:0,sourceWidth:1920,sourceHeight:1080,mediaUrl:'https://cdn.maxvideoai.com/owned.png',status:'completed'};
  await pg.pool.query(`UPDATE studio_sequences SET timeline_state=jsonb_set(timeline_state,'{timelineItems}',$2::jsonb) WHERE id=$1`,[project.sequenceId,JSON.stringify([clip])]);
  let estimates = 0;
  let submitted = 0;
  let grants = 0;
  let job: TimelineExportJobRecord|null = null;
  const projectJob: NonNullable<StudioExportDependencies['projectJob']> = async(value,userId)=>{
    assert.equal(value.user_id,userId);
    return {id:value.id,status:value.status,progress:value.progress,message:value.message,billing:{amountCents:value.amount_cents,currency:value.currency,billingKind:value.billing_kind},artifact:value.status==='completed'?{outputUrl:`/api/studio/timeline-exports/${value.id}/media`,canonicalOriginalUrl:'https://cdn.maxvideoai.com/original-render.mp4',outputAssetId:'ma_'+'b'.repeat(32),sizeBytes:128,mimeType:'video/mp4'}:null};
  };
  const dependencies: StudioExportDependencies = {
    enabled:true,requestOrigin:'http://localhost:3000',
    estimate: async params=>{
      estimates++;
      const request = parseTimelineExportRequest(params.rawRequest);
      assert.equal(params.userId,principal.userId);
      assert.equal(request.projectId,project.projectId);
      assert.equal(request.manifest.tracks[0].clips[0].durationSec,5);
      assert.equal(request.exportSettings.includeAudio,true);
      return {status:200,body:{ok:true,quota:{freeLimit:3,usedFreeExports:3,freeExportsRemaining:0,billingKind:'paid'},estimate:{billingKind:'paid',amountCents:2,currency:'USD',freeExportsRemaining:0,unitCentsPerSecond:1,multiplier:1},estimateToken:'private-estimate-token',estimateExpiresAt:Math.floor(Date.now()/1000)+300}};
    },
    submit: async params=>{
      submitted++;
      assert.equal(params.userId,principal.userId);
      assert.equal(params.estimateToken,'private-estimate-token','The private saved token is read server-side, never supplied by the MCP caller.');
      const request = parseTimelineExportRequest(params.rawRequest);
      assert.equal(request.projectId,project.projectId);
      job = {id:timelineExportIdFromIdempotencyKey(request.idempotencyKey,params.userId),user_id:params.userId,idempotency_key:request.idempotencyKey,project_name:request.manifest.projectName,status:'queued',progress:0,message:null,duration_sec:request.manifest.durationSec,resolution:'720p',fps:30,quality_preset:request.exportSettings.qualityPreset,amount_cents:2,currency:'USD',billing_kind:'paid',billing_status:'paid_reserved',render_manifest:request.manifest,export_settings:request.exportSettings,output_url:null,output_asset_id:null,output_size_bytes:null,output_mime_type:null,created_at:'2026-10-03T00:00:00.000Z',updated_at:'2026-10-03T00:00:00.000Z'};
      return {status:200,body:{ok:true,export:await projectJob(job,params.userId),billing:null,reused:false,workerLaunch:{status:'reused'}}};
    },
    readJob: async params=>job?.user_id===params.userId&&job.idempotency_key===params.idempotencyKey?job:null,
    projectJob,
  };
  const service = module.createAgentStudioExportService({...dependencies,readGrant:async params=>{
    grants++;
    assert.equal(params.userId,principal.userId);
    assert.equal(params.method,'GET');
    assert.equal(params.expiresInSeconds,300);
    assert.equal(params.url,'https://cdn.maxvideoai.com/original-render.mp4');
    return `https://cdn.maxvideoai.com/delivery.mp4?grant=${grants}`;
  }});
  const services: MaxVideoAiMcpServices = {async getAccountStatus(){throw new Error('unused');},async listModels(){return [];},async getModelDetails(){throw new Error('unused');},async recommendModels(){return {recommendations:[],nextAction:'clarify_requirements'};},prepareStudioExport:service.prepare,confirmStudioExport:service.confirm,getStudioExport:service.read};
  const server = createMaxVideoAiMcpServer(principal,services,{paidGeneration:false,referenceUploads:false,studioExports:true});
  const [clientTransport,serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({name:'export-proof',version:'1'});
  await server.connect(serverTransport);await client.connect(clientTransport);
  t.after(async()=>{await client.close();await server.close();});
  const tools = (await client.listTools()).tools;
  for(const [name,annotations] of [
    ['prepare_studio_export',{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}],
    ['confirm_studio_export',{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:true}],
    ['get_studio_export',{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}],
  ] as const){
    const tool = tools.find(candidate=>candidate.name===name);
    assert.ok(tool);
    assert.equal(tool.inputSchema.additionalProperties,false);
    assert.equal(tool.outputSchema?.additionalProperties,false);
    assert.deepEqual(tool.annotations,annotations);
  }
  const input = {projectId:project.projectId,sequenceId:project.sequenceId,expectedRevision:0,idempotencyKey:randomUUID(),qualityPreset:'draft' as const,includeAudio:true};
  for(const extra of [{userId:principal.userId},{manifest:{}},{estimateToken:'invented'},{snapshot:{}},{privateUrl:'https://example.com'}]){
    assert.equal((await client.callTool({name:'prepare_studio_export',arguments:{...input,...extra}})).isError,true);
  }
  assert.equal(estimates,0);
  await assert.rejects(service.prepare(input,{...principal,authMethod:'studio-session'} as unknown as AgentPrincipal),{code:'AUTH_REQUIRED'});
  await assert.rejects(service.prepare(input,{...principal,clientId:null}),{code:'AUTH_REQUIRED'});
  await assert.rejects(module.createAgentStudioExportService({...dependencies,enabled:false}).prepare(input,principal),{code:'ENGINE_UNAVAILABLE'});
  await assert.rejects(service.prepare(input,{...principal,userId:'foreign'}),{code:'REFERENCE_NOT_FOUND'});
  const preparation = await client.callTool({name:'prepare_studio_export',arguments:input});
  assert.equal(preparation.isError,undefined,JSON.stringify(preparation));
  const quote = preparation.structuredContent as Awaited<ReturnType<typeof service.prepare>>;
  assert.equal(quote.price.amountCents,2);
  assert.equal(quote.durationSec,5);
  assert.equal(quote.confirmationRequired,true);
  assert.equal(submitted,0);
  assert.doesNotMatch(JSON.stringify(preparation),/private-estimate-token|owned\.png|workerLaunch|renderManifest/);
  assert.deepEqual((await client.callTool({name:'prepare_studio_export',arguments:input})).structuredContent,quote);
  assert.equal(estimates,1);
  const confirmInput = {projectId:project.projectId,quoteId:quote.quoteId,confirmed:true as const};
  assert.deepEqual((await client.callTool({name:'get_studio_export',arguments:{projectId:project.projectId,quoteId:quote.quoteId}})).structuredContent,{quoteId:quote.quoteId,export:null});
  assert.equal((await client.callTool({name:'confirm_studio_export',arguments:{...confirmInput,confirmed:false}})).isError,true);
  await assert.rejects(service.confirm(confirmInput,{...principal,clientId:'another-client'}),{code:'REFERENCE_NOT_FOUND'});
  await assert.rejects(service.read({projectId:project.projectId,quoteId:quote.quoteId},{...principal,clientId:'another-client'}),{code:'REFERENCE_NOT_FOUND'});
  await pg.pool.query('UPDATE studio_projects SET revision=1 WHERE id=$1',[project.projectId]);
  await assert.rejects(service.confirm(confirmInput,principal),{code:'QUOTE_EXPIRED'});
  assert.equal(submitted,0);
  const fresh = await service.prepare({...input,expectedRevision:1,idempotencyKey:randomUUID()},principal);
  const freshConfirm = {...confirmInput,quoteId:fresh.quoteId};
  const accepted = await client.callTool({name:'confirm_studio_export',arguments:freshConfirm});
  assert.equal(accepted.isError,undefined,JSON.stringify(accepted));
  assert.equal(submitted,1);
  assert.equal((accepted.structuredContent as {reused:boolean}).reused,false);
  await pg.pool.query('UPDATE studio_projects SET revision=2 WHERE id=$1',[project.projectId]);
  assert.equal((await service.confirm(freshConfirm,principal)).reused,true,'Accepted recovery preserves its job after later manual edits.');
  assert.equal(submitted,1);
  job!.status='completed';job!.progress=100;job!.output_url='https://private.example/original.mp4';
  const observed = await client.callTool({name:'get_studio_export',arguments:{projectId:project.projectId,quoteId:fresh.quoteId}});
  assert.equal(observed.isError,undefined,JSON.stringify(observed));
  assert.equal((observed.structuredContent as {export:{status:string}}).export.status,'completed');
  assert.doesNotMatch(JSON.stringify(observed),/canonicalOriginalUrl|original-render|private-estimate-token|workerLaunch|render_manifest|idempotency_key|\/api\/studio\/timeline-exports/);
  const renewed = await service.read({projectId:project.projectId,quoteId:fresh.quoteId},principal);
  assert.notEqual(renewed.export!.artifact!.outputUrl,(observed.structuredContent as any).export.artifact.outputUrl,'Observation refreshes read access without recreating an export.');
  assert.equal(submitted,1);
  const unavailable = await module.createAgentStudioExportService({...dependencies,readGrant:async()=>{throw new Error('Signer unavailable');}}).read({projectId:project.projectId,quoteId:fresh.quoteId},principal);
  assert.equal(unavailable.export!.status,'completed');
  assert.equal(unavailable.export!.artifact,null);
  assert.equal(unavailable.export!.artifactDelivery,'unavailable');
  const receipts = (await pg.pool.query("SELECT request_payload,safe_result FROM studio_project_commands WHERE command_kind='timeline_export_prepare'")).rows;
  assert.doesNotMatch(JSON.stringify(receipts),/delivery\.mp4|grant=|original-render|canonicalOriginalUrl/,'Neither read grants nor artifact originals enter preparation receipts.');
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0,'This qualification never invokes real export billing or a worker.');
  const disabled = createMaxVideoAiMcpServer(principal,services,{paidGeneration:false,referenceUploads:false});
  const [dc,ds] = InMemoryTransport.createLinkedPair();
  const disabledClient = new Client({name:'exports-disabled',version:'1'});
  await disabled.connect(ds);await disabledClient.connect(dc);
  t.after(async()=>{await disabledClient.close();await disabled.close();});
  assert.equal((await disabledClient.listTools()).tools.some(tool=>['prepare_studio_export','confirm_studio_export','get_studio_export'].includes(tool.name)),false,'Production publication stays unchanged.');
});
