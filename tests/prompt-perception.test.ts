import test from 'node:test';
import assert from 'node:assert/strict';
import {studioAnalysisCapabilities} from '../frontend/lib/studio/media-analysis-contract';
import {buildStudioAnalysisVisualInput,buildStudioAnalysisAudioInput,readStudioAnalysisAudioReport} from '../frontend/src/server/studio/media-analysis/provider';

test('Lite has image vision; Standard and Max also have qualified video and audio perception',()=>{
  assert.deepEqual(studioAnalysisCapabilities('gpt-6-luna',{video:true,audio:true}),{imageVision:true,simpleEditing:true,videoAnalysis:false,audioAnalysis:false});
  for(const model of ['gpt-6.1-terra','gpt-6.1-sol'] as const)assert.equal(studioAnalysisCapabilities(model,{video:true,audio:true}).audioAnalysis,true);
});
test('native audio returns a typed report through its supported function-calling interface',()=>{
  const request={ref:{type:'asset' as const,assetId:'x',kind:'audio' as const},goal:'Describe sound',reason:'requested' as const,startSec:3,endSec:6};
  const params=buildStudioAnalysisAudioInput(request,'AAAA',1200);
  assert.equal(params.model,'gpt-audio-1.5');assert.equal(params.store,false);
  assert.deepEqual(params.tool_choice,{type:'function',function:{name:'report_analysis'}});
  assert.equal(params.tools?.[0].function.parameters.properties.summary.type,'string');
});
test('native audio stop with one completed report is valid; truncated, refused or foreign tool output is not',()=>{
 const choice:any={finish_reason:'stop',message:{content:null,refusal:null,tool_calls:[{type:'function',function:{name:'report_analysis',arguments:'{"summary":"Music.","observations":[]}'}}]}};
 assert.equal(readStudioAnalysisAudioReport(choice),choice.message.tool_calls[0].function.arguments);
 assert.equal(readStudioAnalysisAudioReport({...choice,finish_reason:'length'}),'');
 assert.equal(readStudioAnalysisAudioReport({...choice,message:{...choice.message,refusal:'Refused'}}),'');
 assert.equal(readStudioAnalysisAudioReport({...choice,message:{...choice.message,tool_calls:[...choice.message.tool_calls,...choice.message.tool_calls]}}),'');
});
test('a Standard video analysis preserves Terra instead of silently switching to Max',()=>{
  const request={ref:{type:'asset' as const,assetId:'x',kind:'video' as const},goal:'Describe motion',reason:'requested' as const,startSec:0,endSec:5};
  const input=buildStudioAnalysisVisualInput(request,[{atSec:0,imageUrl:'data:image/jpeg;base64,AAAA'}],'gpt-6.1-terra');
  assert.equal(input.model,'gpt-6.1-terra');
  assert.match(JSON.stringify(input.input),/Return JSON/,'Token preflight must accept JSON mode, independently of instructions');
});
test('image perception pairs owned pixels with canonical labels without persisting URLs',async()=>{
  const module=await import('../frontend/src/server/prompt-assistance/perception').catch(()=>null);
  assert.ok(module,'Composer perception adapter must exist');
  const ref={type:'asset' as const,assetId:'ma_'+'a'.repeat(32),kind:'image' as const};
  const request={sessionId:'s',draft:{references:[{fieldId:'image_url',slot:0,label:'spoofed',ref}]}} as never;
  const context={references:[{field:'image_url',slot:0,label:'Start image',role:'start',kind:'image'}],referencePerception:'metadata_only'} as never;
  let reads=0;
  const result=await module.preparePromptPerception('owner',request,'gpt-6-luna',context,{enabled:true,resolve:async(user:string)=>{assert.equal(user,'owner');reads++;return {ref,kind:'image',url:'https://private.invalid/source',mime:'image/jpeg',originalAccess:{type:'external'}} as never;},image:async()=> 'data:image/jpeg;base64,AAAA',analyses:async()=>{throw new Error('Lite must not load paid video/audio observations');}});
  assert.equal(reads,1);assert.equal(result.content[0].text,'Start image (start)');assert.equal(result.content[1].type,'input_image');
  assert.ok(!JSON.stringify(result.context).includes('private.invalid'));assert.ok(!JSON.stringify(result.context).includes('base64'));
  assert.equal(result.context.references[0].perception.image,'provided');
});
