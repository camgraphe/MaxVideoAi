import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';

test('an explicit Luna handoff keeps the full action tools and passes the identical standard-tier payload to its reservation checkpoint',async()=>{
 let sent:unknown,checkpointed:unknown;
 const director=createStudioConversationDirector({model:'gpt-6-luna',createResponse:async params=>{sent=params;return {id:'luna',model:'gpt-6-luna',status:'completed',service_tier:'default',usage:null,output:[],output_text:JSON.stringify({reply:'Let us plan the next scene.'})};}});
 const result=await director({message:'Plan the next scene',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'Preserve warm light',decisions:[]},generations:[]},execute:async()=>{throw new Error('No tool action expected');},checkpoint:async(index,create,params)=>{assert.equal(index,0);checkpointed=params;return create();}});
 assert.equal((sent as {model:string}).model,'gpt-6-luna');assert.equal((sent as {service_tier:string}).service_tier,'default');assert.equal(sent,checkpointed);
 assert.match(JSON.stringify(sent),/Preserve warm light/);assert.match(JSON.stringify(sent),/image_prepare/);assert.equal(result.reply,'Let us plan the next scene.');
});

test('token preflight preserves every token-bearing request field without response-only API arguments',async()=>{
 const preflight=await import('../frontend/src/server/studio/assistance-token-count').catch(()=>null);
 assert.ok(preflight,'Native token count needs its documented request projection');
 const params={model:'gpt-6.1-sol',input:[{role:'user' as const,content:'Hello'}],instructions:'Be useful',tools:[],tool_choice:'auto' as const,parallel_tool_calls:false,reasoning:{effort:'medium' as const},text:{format:{type:'json_object' as const}},max_output_tokens:2200,store:false,service_tier:'default' as const,include:['reasoning.encrypted_content' as const]};
 const projected=preflight.studioTokenCountInput(params);
 assert.equal(projected.input,params.input);assert.equal(projected.tools,params.tools);assert.equal(projected.text,params.text);assert.equal(projected.instructions,'Be useful');
 assert.equal(projected.model,'gpt-6.1-sol');assert.equal('max_output_tokens' in projected,false);assert.equal('store' in projected,false);assert.equal('service_tier' in projected,false);
});
