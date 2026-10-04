import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import type {AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';
import {createStudioCallRuntime} from '../scripts/qa/studio-call-runtime';

function catalog():AgentPublicGenerationEngine[]{return ['gpt-image-2-5-flare','seedance-2-0-mini','wan-3','luma-uni-1','luma-uni-1-max'].map(id=>{
  const entry=getFalEngineById(id)!;
  return {engine:entry.engine,surface:entry.category==='image'?'image':'video',publicModes:entry.modes.map(m=>m.mode) as AgentPublicGenerationEngine['publicModes'],modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))};
});}

test('persisted Studio quotes and MCP preparations agree on optional image guidance and start/end video frames',async t=>{
  const previous=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
  const runtime=await createStudioCallRuntime(catalog(),['prior-process-case']);
  t.after(async()=>{await runtime.close();if(previous!==undefined)process.env.DATABASE_URL=previous;});
  let dispatched=false;
  await assert.rejects(runtime.submit('prior-process-case','Continue my previous brief.',[],async()=>{dispatched=true;throw new Error('must not dispatch');}),/fresh case ID/);
  assert.equal(dispatched,false);
  const ref=(id:string,role:string)=>({ref:{type:'asset',kind:'image',assetId:'ma_'+id.repeat(32)},role,slot:null});
  const cases=[
    {name:'multiple-gpt-images',tool:'image_prepare',refs:['watch','portrait','abstract'],args:{reply:'Review the image quote.',prompt:'The person wears the blue watch against an abstract background',modelId:'gpt-image-2-5-flare',mode:'i2i',aspectRatio:'3:4',outputCount:1,settings:[{name:'resolution',value:'portrait_4_3'},{name:'quality',value:'high'}],references:[ref('8','reference'),ref('a','reference'),ref('b','reference')]}},
    {name:'gpt-1080-preset',tool:'image_prepare',refs:['watch'],args:{reply:'Review one landscape image.',prompt:'The same blue watch on a pale oak desk',modelId:'gpt-image-2-5-flare',mode:'i2i',aspectRatio:'16:9',outputCount:1,settings:[{name:'resolution',value:'1920x1080'},{name:'quality',value:'high'}],references:[ref('8','reference')]}},
    {name:'gpt-valid-custom',tool:'image_prepare',refs:['watch'],args:{reply:'Review the custom portrait quote.',prompt:'The same blue watch on a pale oak desk',modelId:'gpt-image-2-5-flare',mode:'i2i',aspectRatio:'3:4',outputCount:1,settings:[{name:'resolution',value:'custom'},{name:'imageWidth',value:1024},{name:'imageHeight',value:1360},{name:'quality',value:'high'}],references:[ref('8','reference')]}},
    ...['luma-uni-1','luma-uni-1-max'].map(modelId=>({name:modelId,tool:'image_prepare',refs:['watch','portrait'],args:{reply:'Review the image quote.',prompt:'An editorial sports watch portrait',modelId,mode:'t2i',aspectRatio:'16:9',outputCount:1,settings:[{name:'resolution',value:'2K'},{name:'outputFormat',value:'jpeg'}],references:[ref('8','reference'),ref('a','reference')]}})),
    {name:'wan-start-end',tool:'video_prepare',refs:['watch','watch_end'],args:{reply:'Review the video quote.',prompt:'A slow product rotation between these frames',modelId:'wan-3',mode:'i2v',aspectRatio:'16:9',outputCount:1,source:null,settings:[{name:'durationSec',value:5},{name:'resolution',value:'720p'}],references:[ref('8','first_frame'),ref('9','last_frame')]}},
  ];
  for(const item of cases)await t.test(item.name,async()=>{
    const args={...item.args,references:item.args.references.map((reference,index)=>({...reference,ref:{...reference.ref,assetId:runtime.referenceId('parity-'+item.name,item.refs[index])}}))};
    const response=async()=>({id:'parity-response-'+item.name,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:undefined,output_text:'',output:[{type:'function_call' as const,name:item.tool,call_id:'parity-call-'+item.name,arguments:JSON.stringify(args)}]});
    const studio=await runtime.submit('parity-'+item.name,'Prepare the attached references.',item.refs,response);
    assert.equal(studio.error,undefined);assert.equal(studio.result?.state,'ready');assert.equal(studio.quotes.length,1);
    const quote=studio.quotes[0];
    if(quote.request_json.surface==='audio')throw new Error('Expected visual quote');
    assert.equal(quote.request_json.references.length,item.refs.length);
    const mcp=await runtime.prepareMcp(quote.request_json,'parity-'+item.name);
    assert.deepEqual(mcp.quote.request_json,quote.request_json);
    assert.equal(mcp.quote.price_cents,quote.price_cents);
    assert.equal(mcp.quote.currency,quote.currency);
    assert.equal(mcp.quote.auth_origin,'oauth');assert.equal(mcp.quote.studio_project_id,null);
    assert.deepEqual(studio.counts,{jobs:0,charges:0});assert.equal(studio.parity[0].matched,true);
  });
  for(let index=0;index<21;index++){
    const response=async()=>({id:'human-response-'+index,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:undefined,output_text:JSON.stringify({reply:'What would you like to create?'}),output:[]});
    const client=await runtime.submit('independent-client-'+index,'Can you help me?',[],response);
    assert.equal(client.error,undefined,'Independent customers must not consume a shared account rate limit.');
  }
});

test('live qualification refuses any configured database before allocating its disposable runtime',async()=>{
  const previous=process.env.DATABASE_URL;
  process.env.DATABASE_URL='postgresql://fixture.invalid/never-connect';
  try{await assert.rejects(createStudioCallRuntime(catalog()),/Unset DATABASE_URL/);}
  finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});

test('real conversation qualification prepares durable quotes, rejects malformed settings and replays without another Response or charge',async t=>{
  const previous=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
  const runtime=await createStudioCallRuntime(catalog());
  t.after(async()=>{await runtime.close();if(previous!==undefined)process.env.DATABASE_URL=previous;});
  let calls=0;
  const prepare=(settings:unknown,caseId='runtime-case')=>async()=>{
    calls++;
    return {id:'qa-response-'+calls,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:undefined,output_text:'',output:[{type:'function_call' as const,name:'video_prepare',call_id:'qa-call-'+calls,arguments:JSON.stringify({reply:'Review the eight-second quote.',prompt:'A subtle blink and hair movement',aspectRatio:'9:16',source:null,modelId:'seedance-2-0-mini',mode:'i2v',outputCount:1,settings,references:[{ref:{type:'asset',kind:'image',assetId:runtime.referenceId(caseId,'portrait')},role:'first_frame',slot:null}]})}]};
  };
  const requestId=randomUUID();
  const response=prepare([{name:'duration',value:8},{name:'resolution',value:'720p'}]);
  const ready=await runtime.submit('runtime-case','Animate the attached image for eight seconds.',['portrait'],response,requestId);
  assert.equal(ready.error,undefined);assert.equal(ready.result?.state,'ready');
  assert.equal(ready.quotes.length,1);assert.equal(ready.quotes[0].state,'prepared');
  if(ready.quotes[0].request_json.surface==='audio')throw new Error('Expected video quote');
  assert.equal(ready.quotes[0].request_json.settings.durationSec,8);
  assert.equal(ready.quotes[0].request_json.settings.resolution,'720p');
  assert.deepEqual(ready.counts,{jobs:0,charges:0});
  const repeated=await runtime.submit('runtime-case','Animate the attached image for eight seconds.',['portrait'],response,requestId);
  assert.equal(calls,1);assert.deepEqual(repeated.quotes,ready.quotes);
  const failed=await runtime.submit('invalid-case','Animate this image.',['portrait'],prepare([{name:'unknownField',value:true}],'invalid-case'));
  assert.ok(failed.error);assert.equal(failed.quotes.length,0);assert.deepEqual(failed.counts,{jobs:0,charges:0});
  assert.ok(failed.steps.some(step=>!step.result.ok&&step.result.error.code==='PARAMETER_INVALID'));
});
