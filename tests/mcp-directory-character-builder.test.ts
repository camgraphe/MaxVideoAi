import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDefaultCharacterBuilderState } from '../frontend/src/lib/character-builder';
import { prepareCharacterBuilderRequest } from '../frontend/src/server/tools/character-builder/preparation';
import { characterBuilderCanonicalRequest } from '../frontend/server/character-studio/authoring-preparation';
import { projectCharacterBuilderRecipe } from '../frontend/server/character-studio/authoring-output';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentCharacterBuilderService } from '../frontend/src/server/agent-api/character-builder';
import { registerCharacterBuilderTools } from '../frontend/src/server/mcp/tools/character-builder';
import { characterBuilderOutputSchemas } from '../frontend/src/server/mcp/output-schemas/character-builder';
import { createDefaultMaxVideoAiMcpServices, createMaxVideoAiMcpServer } from '../frontend/src/server/mcp/server';
import { resolveMcpConfig } from '../frontend/src/server/mcp/config';
import { resolveMcpRequestServerOptions } from '../frontend/src/server/mcp/directory-capabilities';

const quoteId='11111111-1111-4111-8111-111111111111';
const prepared=prepareCharacterBuilderRequest({...createDefaultCharacterBuilderState(),userId:'owner',action:'generate',generateCount:1});
const recipe=projectCharacterBuilderRecipe(prepared.settingsSnapshot);
const quote={quoteId,amountCents:11,currency:'USD',expiresAt:'2026-11-12T18:00:00Z',recipe};
const ready={...quote,kind:'wallet',topupRequired:false,quote:{quoteId,expiresAt:quote.expiresAt,
  requestHash:'recipe-bound-request',summary:characterBuilderCanonicalRequest(prepared),
  price:{amountCents:11,currency:'USD'},balance:{beforeCents:50,afterCents:39},
  confirmationRequired:true,topupRequired:false,fundingMode:'wallet'}};
const running={quoteId,jobId:'builder-job',surface:'image',status:'running',progress:30,message:null,
  priceCents:11,currency:'USD',paymentStatus:'paid_wallet',result:null,
  library:{type:'open_url',purpose:'media_library',label:'Library',url:'https://openai-review.maxvideoai.com/app/library'},
  workspace:{type:'open_url',purpose:'generation',label:'Image',url:'https://openai-review.maxvideoai.com/app/image'},
  savedToLibrary:true,needsAttention:true,retry:null};
const complete={...running,status:'completed',progress:100,needsAttention:false,
  result:{surface:'image',imageUrls:['https://media.example/image.png?signature=temporary'],thumbnailUrls:[]},
  openUrl:'https://openai-review.maxvideoai.com/mcp/media/temporary',
  saveSource:{jobId:'builder-job',imageUrl:'https://media.example/image.png'},futureGuidance:{preserved:true}};

test('Builder directory DTOs survive discovery and SDK validation without losing recipe, recovery or canonical save source',async t=>{
  for(const distributionProfile of ['direct','openai-directory'] as const){
    let recovered:object=complete;
    const service={prepare:async()=>ready,confirm:async()=>running,
      getQuote:async()=>({...quote,state:'accepted',jobId:'builder-job'}),recover:async()=>recovered} as unknown as AgentCharacterBuilderService;
    const server=new McpServer({name:'builder-directory',version:'1'});
    registerCharacterBuilderTools(server,()=>service,{executionEnabled:true,distributionProfile});
    const [ct,st]=InMemoryTransport.createLinkedPair();await server.connect(st);
    const client=new Client({name:'reviewer',version:'1'});await client.connect(ct);
    t.after(async()=>{await client.close();await server.close();});
    const tools=(await client.listTools()).tools;
    assert.equal(tools.length,4);
    for(const tool of tools){
      assert.ok(Buffer.byteLength(tool.description??'')<=2000);
      assert.equal(tool.outputSchema?.type,distributionProfile==='openai-directory'?'object':undefined);
    }
    const calls=[['prepare_character_builder',{},ready],['confirm_character_builder',{quoteId,amountCents:11,currency:'USD',confirmed:true},running],
      ['get_character_builder_quote',{quoteId},{...quote,state:'accepted',jobId:'builder-job'}],['get_character_builder_status',{quoteId},complete]] as const;
    for(const [name,args,expected] of calls){
      const result=await client.callTool({name,arguments:args});
      assert.notEqual(result.isError,true,name);assert.deepEqual(result.structuredContent,expected);
      const fallback=(result.content as Array<{type:string;text?:string}>).find(p=>p.type==='text');
      assert.deepEqual(JSON.parse(fallback!.text!),expected);
    }
    recovered={quoteId,jobId:null,status:'no_job',retry:null};
    assert.deepEqual((await client.callTool({name:'get_character_builder_status',arguments:{quoteId}})).structuredContent,recovered);
    service.confirm=async()=>{throw new AgentApiError('INSUFFICIENT_FUNDS','Add funds.',false,{type:'open_url',url:'https://maxvideoai.com/billing'});};
    const error=await client.callTool({name:'confirm_character_builder',arguments:{quoteId,amountCents:11,currency:'USD',confirmed:true}});
    assert.equal(error.isError,true);
    const failure=error.structuredContent as {error:{code:string;nextAction:unknown;message:string}};
    assert.equal(failure.error.code,'INSUFFICIENT_FUNDS');
    if(distributionProfile==='openai-directory'){
      assert.equal(failure.error.nextAction,null);assert.match(failure.error.message,/existing entitlements/);
      assert.doesNotMatch(JSON.stringify(failure),/\/billing|Add funds/);
    }else assert.notEqual(failure.error.nextAction,null);
    service.confirm=async()=>{throw new Error('private diagnostic');};
    const unexpected=await client.callTool({name:'confirm_character_builder',arguments:{quoteId,amountCents:11,currency:'USD',confirmed:true}});
    assert.equal(unexpected.isError,true);assert.doesNotMatch(JSON.stringify(unexpected),/private diagnostic/);
  }
});

test('Builder output validation rejects incomplete jobs and mismatched canonical save sources',()=>{
  assert.equal(characterBuilderOutputSchemas.get_character_builder_status.safeParse({quoteId,jobId:'x',status:'completed',retry:null}).success,false);
  assert.equal(characterBuilderOutputSchemas.get_character_builder_status.safeParse({...complete,saveSource:{jobId:'foreign',imageUrl:'https://media.example/x'}}).success,false);
  assert.equal(characterBuilderOutputSchemas.get_character_builder_status.safeParse({...running,saveSource:complete.saveSource}).success,false);
});

test('dedicated Builder activation is independent; closing execution retains known-quote recovery and full output schemas',async t=>{
  const principal={userId:'review-owner',clientId:'review-client',emailVerified:true,authMethod:'oauth' as const};
  const config=resolveMcpConfig({NODE_ENV:'production'});
  for(const enabled of [true,false]){
    const options=resolveMcpRequestServerOptions('openai-mcp.maxvideoai.com','openai-directory',{
      MCP_OPENAI_DIRECTORY_ENABLED:'true',MCP_OPENAI_DIRECTORY_CHARACTER_STUDIO_ENABLED:'true',
      MCP_OPENAI_DIRECTORY_CHARACTER_BUILDER_ENABLED:String(enabled),
    },{paidGeneration:true,referenceUploads:true,audioGeneration:true,creatorTools:true,montagePreparation:true,
      studioMontageCreation:true,studioTimelineEditing:true,studioExports:true});
    const services=createDefaultMaxVideoAiMcpServices(config,{clientIp:null},{paidGeneration:true,referenceUploads:true,audioGeneration:true,creatorTools:true,
      characterStudio:options.characterStudio,characterBuilder:options.characterBuilder});
    const server=createMaxVideoAiMcpServer(principal,services,options);
    const [ct,st]=InMemoryTransport.createLinkedPair();await server.connect(st);
    const client=new Client({name:'reviewer-capabilities',version:'1'});await client.connect(ct);
    t.after(async()=>{await client.close();await server.close();});
    const tools=(await client.listTools()).tools;
    assert.equal(tools.length,enabled?46:44);
    assert.ok(Buffer.byteLength(client.getInstructions()??'')<=2000);
    assert.ok(tools.every(tool=>Buffer.byteLength(tool.description??'')<=2000));
    assert.equal(tools.some(t=>t.name==='prepare_character_builder'),enabled);
    for(const name of ['get_character_builder_quote','get_character_builder_status'])assert.ok(tools.some(t=>t.name===name));
    for(const tool of tools)assert.equal(tool.outputSchema?.type,'object',tool.name);
    assert.equal(tools.some(t=>t.name==='create_topup_link'),false);
  }
});
