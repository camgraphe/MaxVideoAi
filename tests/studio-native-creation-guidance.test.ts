import assert from 'node:assert/strict';
import test from 'node:test';
import type {ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';
import {createStudioConversationDirector,type StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import {MILO_LEVELS} from '../frontend/src/lib/studio/assistance-contract';
import {STUDIO_TASK_POLICY_VERSION,studioTaskProfileForModel} from '../frontend/src/lib/studio/task-budget-contract';
import type {StudioTaskExecution} from '../frontend/src/server/studio/tasks/execution';

// Envelope/gate coverage only. An injected reply cannot prove natural-language quality.
// Synthetic human-language acceptance cases live in the accompanying design spec.
const message='I have no pictures or clips. Help me develop a visual direction.';
const brief='Use authentic filmed footage of the old harbor; preserve the reveal and names.';
const project={name:'Harbor announcement',revision:0,memory:{revision:1,brief,decisions:['Do not replace actual capture with generated footage without agreement.']}};
const context={message,references:[],history:[{message:'Use real footage for the locations.',reply:'The original footage requirement remains saved.'}],project,
 checkpoint:async(_:number,create:()=>Promise<StudioDirectorResponse>)=>create(),execute:async()=>{throw new Error('The envelope fixture does not request an action.');}};
const toolNames=(params:ResponseCreateParamsNonStreaming)=>params.tools?.flatMap(tool=>tool.type==='function'?[tool.name]:[])??[];

for(const {model} of Object.values(MILO_LEVELS))test(model+' native task receives creative guidance alongside intact constraints and quote authority',async t=>{
 let sent:ResponseCreateParamsNonStreaming|undefined;
 const profile=studioTaskProfileForModel({profile:'standard',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION},model);
 const taskExecution:StudioTaskExecution={taskRequestId:'fixture-task',segmentRequestId:'fixture-segment',workerId:'fixture-worker',profile,maxCalls:4,deadlineAt:new Date(Date.now()+300000),enabled:true};
 await createStudioConversationDirector({model,mediaEnabled:true,editingEnabled:true,exportsEnabled:false,assistanceCreditsEnabled:true,taskExecution,
  createResponse:async params=>{sent=params;return {id:'fixture-response',model,status:'completed',service_tier:'default',usage:null,output:[],output_text:JSON.stringify({reply:'Offline envelope fixture.'})};}})(context);
 assert.ok(sent);
 const instructions=String(sent.instructions);
 t.diagnostic('Instruction envelope: '+instructions.length+' characters.');
 assert.match(instructions,/coherent images[\s\S]*animat/i,'The active native task must receive the images-to-animation creative guidance.');
 assert.match(instructions,/optional visual references/i,'Reference guidance must be delivered alongside creation guidance.');
 assert.match(instructions,/AI-generated alternative/i,'Real-footage constraints need a transparently labeled alternative.');
 assert.match(instructions,/prepare only on request/i);
 assert.match(instructions,/Only clients confirm purchases\/exports/i);
 assert.match(instructions,/Export tools are unavailable/i);
 assert.equal(sent.model,model);
 assert.doesNotMatch(instructions,/old harbor|preserve the reveal/,'Client project memory remains data rather than instruction authority.');
 const inputs=sent.input as Array<{role?:string;content?:unknown}>;
 const facts=inputs.find(input=>input.role==='developer'&&typeof input.content==='string'&&input.content.startsWith('Current project facts'));
 assert.ok(facts&&typeof facts.content==='string');
 assert.deepEqual(JSON.parse(facts.content.slice(facts.content.indexOf('{'))),project,'Ideation guidance cannot rewrite saved constraints.');
 assert.match(JSON.stringify(inputs.at(-1)),/I have no pictures or clips/);
 assert.doesNotMatch(JSON.stringify(inputs),/input_image/,'Absent references must not become model-visible images.');
 const names=toolNames(sent);
 assert.ok(names.includes('image_prepare'));assert.ok(names.includes('video_prepare'));assert.ok(names.includes('model_details'));
 assert.ok(!names.some(name=>/confirm|purchase|recharge|shell|search|stock/.test(name)),'Creative guidance grants no spending or external retrieval tool.');
 assert.ok(!names.includes('export_prepare'));
});

test('image-only guidance keeps unavailable video/audio/export tools outside the director request',async()=>{
 let sent:ResponseCreateParamsNonStreaming|undefined;
 await createStudioConversationDirector({mediaEnabled:false,editingEnabled:false,exportsEnabled:false,createResponse:async params=>{
  sent=params;return {id:'fixture-image-only',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output:[],output_text:JSON.stringify({reply:'Offline envelope fixture.'})};}})(context);
 assert.ok(sent);
 assert.match(String(sent.instructions),/within enabled capabilities/i);
 assert.match(String(sent.instructions),/Video, voice and music generation are unavailable/i);
 assert.match(String(sent.instructions),/Timeline editing is unavailable/i);
 const names=toolNames(sent);
 assert.ok(names.includes('image_prepare'));
 for(const name of ['video_prepare','voice_prepare','music_prepare','audio_prepare','timeline_edit','export_prepare'])assert.ok(!names.includes(name),name+' must stay gated.');
});
