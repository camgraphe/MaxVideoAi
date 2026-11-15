import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// Contract regressions: bypassing these published schemas would admit raw URLs,
// false confirmation, cross-context recipe overrides, or remove gated recovery.
test('Builder authoring tools reject raw URLs and retain quote recovery when execution closes', async t=>{
  let module:typeof import('../frontend/src/server/mcp/tools/character-builder');
  try {module=await import('../frontend/src/server/mcp/tools/character-builder');}
  catch {assert.fail('Character Builder authoring descriptors are required.');}
  const server=new McpServer({name:'builder-authoring-test',version:'1'});
  const seen:unknown[]=[];
  module.registerCharacterBuilderTools(server,()=>({
    prepare:async(input:unknown)=>{seen.push(input);return {quoteId:'00000000-0000-4000-8000-000000000001'};},
    confirm:async()=>{throw new Error('Unexpected confirmation.');},
    getQuote:async()=>({state:'prepared'}),recover:async()=>({status:'no_job',retry:null}),
  }) as never,{executionEnabled:true});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client=new Client({name:'builder-authoring-test',version:'1'});
  await client.connect(clientTransport);
  t.after(async()=>{await client.close();await server.close();});
  const tools=(await client.listTools()).tools;
  assert.deepEqual(tools.map(tool=>tool.name).sort(),['prepare_character_builder','confirm_character_builder',
    'get_character_builder_quote','get_character_builder_status'].sort());
  assert.ok(tools.every(tool=>Buffer.byteLength(tool.description??'','utf8')<=2000));
  for(const input of [{referenceImages:[{url:'https://example.com/forged.png',role:'identity'}]},
    {jobSurface:'character'}, {generateCount:4},
    {traits:{genderPresentation:{value:'not-a-builder-choice',source:'manual'}}}, {characterId:'1',referenceImages:[{assetId:'ma_'+'1'.repeat(32),role:'identity'}]}]) {
    const response=await client.callTool({name:'prepare_character_builder',arguments:input});
    assert.equal(response.isError,true);
  }
  const valid=await client.callTool({name:'prepare_character_builder',arguments:{
    traits:{customDetailsDescription:'A small freckle',genderPresentation:{value:'woman',source:'manual'},skinTone:{value:'#abc',source:'manual'}},referenceImages:[{assetId:'ma_'+'1'.repeat(32),role:'identity'}]}});
  assert.notEqual(valid.isError,true);
  assert.equal(seen.length,1);
  const bad=await client.callTool({name:'confirm_character_builder',arguments:{quoteId:'00000000-0000-4000-8000-000000000001',confirmed:false,amountCents:23,currency:'USD'}});
  assert.equal(bad.isError,true);
  const disabled=new McpServer({name:'builder-gated-test',version:'1'});
  module.registerCharacterBuilderTools(disabled,()=>({}) as never,{executionEnabled:false});
  const [gatedClientTransport,gatedServerTransport]=InMemoryTransport.createLinkedPair();
  await disabled.connect(gatedServerTransport);
  const gated=new Client({name:'builder-gated-test',version:'1'});
  await gated.connect(gatedClientTransport);
  t.after(async()=>{await gated.close();await disabled.close();});
  assert.deepEqual((await gated.listTools()).tools.map(tool=>tool.name).sort(),[
    'get_character_builder_quote','get_character_builder_status'].sort());
});
