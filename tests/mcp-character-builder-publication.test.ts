import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDefaultMaxVideoAiMcpServices, createMaxVideoAiMcpServer } from '../frontend/src/server/mcp/server';
import { resolveMcpRuntimeCapabilities } from '../frontend/src/server/mcp/operational-access';
import { resolveMcpConfig } from '../frontend/src/server/mcp/config';

const principal={userId:'builder-owner',clientId:'builder-client',emailVerified:true,authMethod:'oauth' as const};
const writes=['prepare_character_builder','confirm_character_builder'];
const reads=['get_character_builder_quote','get_character_builder_status'];
test('new Builder purchases need their migration-qualified flag and existing Character/paid/reference gates',async t=>{
  const config=resolveMcpConfig({NODE_ENV:'production'});
  for(const [builder,paid,refs] of [[false,true,true],[true,true,true],[true,false,true],[true,true,false]] as const){
    const capabilities={paidGeneration:paid,referenceUploads:refs,audioGeneration:false,characterStudio:true,characterBuilder:builder};
    const services=createDefaultMaxVideoAiMcpServices(config,{clientIp:null},capabilities);
    const server=createMaxVideoAiMcpServer(principal,services,capabilities);
    const [ct,st]=InMemoryTransport.createLinkedPair();await server.connect(st);
    const client=new Client({name:'builder-publication-test',version:'1'});await client.connect(ct);
    t.after(async()=>{await client.close();await server.close();});
    const names=(await client.listTools()).tools.map(tool=>tool.name);
    assert.ok(reads.every(name=>names.includes(name)),'closing new purchases keeps known quote recovery');
    assert.equal(writes.every(name=>names.includes(name)),builder&&paid&&refs);
    assert.ok(names.includes('list_saved_characters'),'existing Character Studio remains available');
  }
});
test('Builder execution configuration is explicit and cannot publish Character Studio on its own',()=>{
  assert.notEqual(resolveMcpRuntimeCapabilities({MCP_CHARACTER_STUDIO_ENABLED:'1'},null).characterBuilder,true);
  assert.notEqual(resolveMcpRuntimeCapabilities({MCP_CHARACTER_STUDIO_ENABLED:'1',MCP_CHARACTER_BUILDER_ENABLED:'true'},null).characterBuilder,true);
  assert.notEqual(resolveMcpRuntimeCapabilities({MCP_CHARACTER_BUILDER_ENABLED:'1'},null).characterBuilder,true);
  assert.equal(resolveMcpRuntimeCapabilities({MCP_CHARACTER_STUDIO_ENABLED:'1',MCP_CHARACTER_BUILDER_ENABLED:'1'},null).characterBuilder,true);
});
