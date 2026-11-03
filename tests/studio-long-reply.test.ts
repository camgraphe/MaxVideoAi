import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import {createStudioConversationDirector,isReplayableStudioResponse,type StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import {createStudioImageDirector} from '../frontend/src/server/studio/image-conversation-director';

const long='R'+'é'.repeat(49998)+'Z';
const response=(body:unknown):StudioDirectorResponse=>({id:'synthetic',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:JSON.stringify(body),output:[]});

test('strict conversation-only long outputs remain bounded without broadening malformed or tool replay policy',()=>{
 assert.equal(imageDraftSchema.parse({reply:long,image:null}).reply,long);
 assert.equal(imageDraftSchema.safeParse({reply:long+'!',image:null}).success,false);
 assert.equal(isReplayableStudioResponse(response({reply:long})),true);
 assert.equal(isReplayableStudioResponse(response({reply:long+'!'})),true,'a saved overlimit conversation replays only its deterministic limit notice');
 for(const body of [{reply:long+'!',extra:true},{reply:5},{reply:''},{other:long+'!'}])assert.equal(isReplayableStudioResponse(response(body)),false);
 assert.equal(isReplayableStudioResponse({...response({reply:long+'!'}),output_text:'not JSON'}),false);
 assert.equal(isReplayableStudioResponse({...response({reply:long+'!'}),status:'failed'}),false);
 assert.equal(isReplayableStudioResponse({...response({reply:long+'!'}),output:[{type:'function_call',call_id:'invalid',name:'unavailable_tool',arguments:'{}'}]}),false,'a long reply field must not make an invalid action replayable');
});

test('legacy and action directors preserve complete long assistant history without changing their output token bounds',async()=>{
 const history=[{message:'Plan the station reveal.',reply:long}];
 const legacy=createStudioImageDirector({createResponse:async params=>{
  const assistant=(params.input as Array<{role?:string;content?:unknown}>).find(item=>item.role==='assistant');assert.equal(assistant?.content,long);assert.equal(params.max_output_tokens,1600);return {...response({reply:'A new direction.',image:null})};
 }});
 await legacy({requestId:randomUUID(),message:'Keep the final image.',references:[]},history,[]);
 const director=createStudioConversationDirector({createResponse:async params=>{
  const assistant=(params.input as Array<{role?:string;content?:unknown}>).find(item=>item.role==='assistant');assert.equal(assistant?.content,long);assert.equal(params.max_output_tokens,2200);return response({reply:'A new direction.'});
 }});
 await director({message:'Keep the final image.',references:[],history,project:{name:'Film',revision:0,memory:{brief:'',decisions:[],referenceIds:[]}},execute:async()=>{throw Error('No action requested');},checkpoint:async(_index,create)=>create()});
});
