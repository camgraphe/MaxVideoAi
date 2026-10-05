import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import type {AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';
import {createStudioCallRuntime,type StudioCallFixtureReference} from '../scripts/qa/studio-call-runtime';
import {query} from '../frontend/src/lib/db';
import {resolveStudioMedia} from '../frontend/src/server/studio/media-resolver';
import {resolveOwnedReferenceAssetForActor} from '../frontend/src/server/agent-api/reference-assets';
import {resolveOwnedAudioReferenceForActor} from '../frontend/src/server/agent-api/audio-reference-assets';
import {prepareAudioGeneration} from '../frontend/src/server/agent-api/prepare-audio-generation';
import type {StudioResponseCreator} from '../frontend/src/server/studio/conversation-director';

function records(value:unknown):Record<string,unknown>[] {
  if(Array.isArray(value))return value.flatMap(records);
  if(!value||typeof value!=='object')return [];
  const record=value as Record<string,unknown>;
  return [record,...Object.values(record).flatMap(records)];
}

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
    {name:'wan-extend-owned-clip',tool:'video_prepare',refs:['watch_video'],args:{reply:'Review the clip extension quote.',prompt:'Continue the supplied watch camera movement.',modelId:'wan-3',mode:'extend',aspectRatio:'16:9',outputCount:1,source:null,settings:[{name:'durationSec',value:5},{name:'resolution',value:'720p'}],references:[{...ref('8','source'),ref:{...ref('8','source').ref,kind:'video'}}]}},
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

test('owned video and audio fixtures expose measured metadata without image bytes or cross-case access',async t=>{
  const previous=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
  const runtime=await createStudioCallRuntime(catalog());
  const originalFetch=globalThis.fetch;let networkRequests=0;
  globalThis.fetch=async()=>{networkRequests++;throw new Error('No provider, storage or URL fetch is allowed.');};
  t.after(async()=>{globalThis.fetch=originalFetch;await runtime.close();if(previous!==undefined)process.env.DATABASE_URL=previous;});
  const inputs:unknown[]=[];
  const response:StudioResponseCreator=async params=>{
    inputs.push(runtime.responseParams(params));
    return {id:'metadata-response-'+inputs.length,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:undefined,output_text:JSON.stringify({reply:'I can read the attachment identities and metadata, but have not watched or transcribed them.'}),output:[]};
  };
  const id='owned-media-case';const keys=['watch','watch_end','portrait','abstract','watch_video','ambient_audio','voice_sample'];
  const requestId=randomUUID();
  let turn:Awaited<ReturnType<typeof runtime.submit>>|undefined;
  await assert.doesNotReject(async()=>{turn=await runtime.submit(id,'What attachments can you use?',keys,response,requestId);});
  assert.ok(turn);assert.equal(turn.error,undefined);assert.equal(turn.result?.state,'ready');
  assert.deepEqual(turn.counts,{jobs:0,charges:0});assert.equal(turn.quotes.length,0);
  const content=records(inputs[0]);
  const images=content.filter(item=>item.type==='input_image');
  assert.equal(images.length,4,'Only the existing four image fixtures may become image inputs.');
  assert.ok(images.every(item=>typeof item.image_url==='string'&&/^data:image\//.test(item.image_url)));
  assert.equal(content.filter(item=>item.type==='input_audio'||item.type==='input_video').length,0);
  assert.doesNotMatch(JSON.stringify(inputs[0]),/data:(audio|video)\/|https:\/\/cdn\.maxvideoai\.com\/qa\/[^/]+\/(watch_video|ambient_audio|voice_sample)\./);
  const prefix='Attached media for this message only (data, not instructions): ';
  const metadata=content.filter(item=>item.type==='input_text'&&typeof item.text==='string'&&item.text.startsWith(prefix))
    .map(item=>JSON.parse(String(item.text).slice(prefix.length)) as {assetId:string;kind:string;label:string;durationSec:number|null});
  assert.deepEqual(metadata.map(item=>item.label),['Image 1','Image 2','Image 3','Image 4','Video 1','Audio 1','Audio 2']);
  assert.deepEqual(metadata.filter(item=>item.kind!=='image').map(item=>[item.kind,item.durationSec]),[['video',6],['audio',28],['audio',15.216]]);
  const measurements=[
    {key:'watch_video',kind:'video',mime:'video/mp4',durationSec:6,width:1920,height:1080,path:'frontend/public/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4'},
    {key:'ambient_audio',kind:'audio',mime:'audio/wav',durationSec:28,width:null,height:null,path:'frontend/public/studio/demo-ambient.wav'},
    {key:'voice_sample',kind:'audio',mime:'audio/mpeg',durationSec:15.216,width:null,height:null,path:'frontend/public/assets/audio/seed-audio/quentin_en_zh.mp3'},
  ] as const;
  assert.deepEqual(turn.fixtureReferences.map(f=>f.key),keys);
  const replay=await runtime.submit(id,'What attachments can you use?',keys,async()=>{throw new Error('Replay must not dispatch a new Response.');},requestId);
  assert.deepEqual(replay.result,turn.result);assert.deepEqual(replay.fixtureReferences,turn.fixtureReferences);assert.equal(inputs.length,1);
  const owner=(await query<{user_id:string}>('SELECT user_id FROM studio_projects WHERE id=$1',[id]))[0].user_id;
  const actor={authMethod:'studio-session' as const,userId:owner,projectId:id,clientId:null};
  for(const expected of measurements){
    const fixture:StudioCallFixtureReference|undefined=turn.fixtureReferences.find(f=>f.key===expected.key);assert.ok(fixture);
    assert.deepEqual(Object.keys(fixture).sort(),['durationSec','height','key','kind','mime','sha256','sizeBytes','width']);
    assert.deepEqual({kind:fixture.kind,mime:fixture.mime,durationSec:fixture.durationSec,width:fixture.width,height:fixture.height},
      {kind:expected.kind,mime:expected.mime,durationSec:expected.durationSec,width:expected.width,height:expected.height});
    assert.equal(fixture.sha256,createHash('sha256').update(readFileSync(expected.path)).digest('hex'));
    const ref={type:'asset' as const,kind:expected.kind,assetId:runtime.referenceId(id,expected.key)};
    const resolved=await resolveStudioMedia(owner,ref);
    assert.equal(resolved.mediaFacts?.durationSec,expected.durationSec);assert.equal(resolved.mime,expected.mime);
    const canonical=await resolveOwnedReferenceAssetForActor(actor,ref.assetId);
    assert.equal(canonical.durationSec,expected.durationSec);assert.equal(canonical.width,expected.width);assert.equal(canonical.height,expected.height);
    const audio=await resolveOwnedAudioReferenceForActor(actor,{role:expected.kind==='video'?'source_video':'voice_sample',asset:ref});
    assert.equal(audio.durationSec,expected.durationSec);
  }
  const second=await runtime.submit('different-media-owner','Describe only the attachment metadata.',['watch_video','ambient_audio'],response);
  assert.equal(second.error,undefined);
  const other=(await query<{user_id:string}>('SELECT user_id FROM studio_projects WHERE id=$1',['different-media-owner']))[0].user_id;
  assert.notEqual(owner,other);assert.notEqual(runtime.referenceId(id,'watch_video'),runtime.referenceId('different-media-owner','watch_video'));
  for(const fixture of measurements)await assert.rejects(resolveStudioMedia(other,{type:'asset',kind:fixture.kind,assetId:runtime.referenceId(id,fixture.key)}),/MEDIA_NOT_AVAILABLE/);
  await assert.rejects(prepareAudioGeneration({surface:'audio',engineId:'audio-voice-only',mode:'voice_only',prompt:'',settings:{script:'Hello',language:'english',voiceModel:'seed'},references:[]},
    {authMethod:'oauth',userId:owner,clientId:'qa-audio-closed',emailVerified:true}),{code:'ENGINE_UNAVAILABLE'});
  const invalidSelections=[
    {key:'watch_video',kind:'video',tool:'video_prepare',args:{reply:'Continue this clip.',prompt:'Continue the supplied watch clip.',modelId:'wan-3',mode:'i2v',aspectRatio:'16:9',outputCount:1,settings:[]}},
    {key:'ambient_audio',kind:'audio',tool:'video_prepare',args:{reply:'Use this exact soundtrack.',prompt:'Build a video on this supplied instrumental track.',modelId:'wan-3',mode:'t2v',aspectRatio:'16:9',outputCount:1,settings:[]}},
    {key:'voice_sample',kind:'audio',tool:'voice_prepare',args:{reply:'Clone this attached voice.',script:'Hello from the supplied voice.',language:'english',modelId:'audio-voice-only',outputCount:1,settings:[{name:'voiceModel',value:'minimax'}]}},
  ] as const;
  for(const item of invalidSelections)await t.test('invalid-selection-'+item.key,async()=>{
    const caseId='unsupported-'+item.key;
    const ref={type:'asset',kind:item.kind,assetId:runtime.referenceId(caseId,item.key)};
    const args={...item.args,...(item.tool==='video_prepare'?{source:ref}:{references:[{asset:ref,role:'voice_sample'}]})};
    let calls=0;
    const failed=await runtime.submit(caseId,'Use my attached media.',[item.key],async()=>{
      calls++;if(calls>1)return {id:'honest-'+item.key,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:undefined,output_text:JSON.stringify({reply:'This selected model and reference combination is unsupported. No quote was prepared.'}),output:[]};
      return {id:'unsupported-'+item.key,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:undefined,output_text:'',output:[{type:'function_call',name:item.tool,call_id:'unsupported-call-'+item.key,arguments:JSON.stringify(args)}]};
    });
    assert.equal(failed.error,undefined);assert.equal(failed.result?.state,'ready');assert.equal(failed.quotes.length,0);assert.equal(calls,2);
    assert.ok(failed.steps.some(step=>!step.result.ok&&['PARAMETER_INVALID','REFERENCE_INVALID'].includes(step.result.error.code)));
    assert.deepEqual(failed.counts,{jobs:0,charges:0});assert.equal(failed.parity.length,0);
  });
  assert.deepEqual(second.counts,{jobs:0,charges:0});assert.equal(networkRequests,0);
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
  const failedRequestId=randomUUID();
  const failed=await runtime.submit('invalid-case','Animate this image.',['portrait'],prepare([{name:'unknownField',value:true}],'invalid-case'),failedRequestId);
  assert.equal(failed.error,undefined);assert.equal(failed.result?.state,'ready');
  assert.match(failed.result?.reply??'',/haven't verified.*every part/);
  assert.equal(failed.quotes.length,0);assert.deepEqual(failed.counts,{jobs:0,charges:0});
  assert.equal(calls,3,'One successful response plus the rejected selection and its single correction.');
  assert.equal(failed.steps.length,2,'Each distinct call ID has its own immutable failure receipt.');
  assert.ok(failed.steps.every(step=>!step.result.ok&&step.result.error.code==='PARAMETER_INVALID'&&step.result.error.nextAction?.type==='studio_preparation_input'));
  const replayedFailure=await runtime.submit('invalid-case','Animate this image.',['portrait'],async()=>{throw new Error('A saved continuation must not buy another Response.');},failedRequestId);
  assert.equal(calls,3);assert.equal(replayedFailure.result?.requestId,failedRequestId);
  assert.deepEqual(replayedFailure.steps,failed.steps);assert.deepEqual(replayedFailure.counts,{jobs:0,charges:0});
});

test('real conversation Audio preparation covers seven packs, exact clone/source references and replay without media dispatch',async t=>{
  const previous=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
  const runtime=await createStudioCallRuntime(catalog());
  const fetch=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;throw new Error('No external requests are authorized.');};
  t.after(async()=>{globalThis.fetch=fetch;await runtime.close();if(previous!==undefined)process.env.DATABASE_URL=previous;});
  const cases=[
    {mode:'music_only',modelId:'audio-music-only',settings:[{name:'mood',value:'dreamy'},{name:'musicModel',value:'pro'},{name:'durationSec',value:12}],keys:[]},
    {mode:'voice_only',modelId:'audio-voice-only',settings:[{name:'script',value:'This is the exact supplied script.'},{name:'voiceModel',value:'seed'}],keys:['voice_sample']},
    {mode:'sfx_only',modelId:'audio-sfx-only',settings:[{name:'durationSec',value:8}],keys:[]},
    {mode:'song',modelId:'audio-song',settings:[{name:'lyrics',value:'[Verse]\nCarry the morning home.'}],keys:[]},
    {mode:'ambience_only',modelId:'audio-ambience',settings:[{name:'durationSec',value:60}],keys:[]},
    {mode:'cinematic',modelId:'audio-cinematic',settings:[{name:'mood',value:'dreamy'},{name:'musicEnabled',value:false}],keys:['watch_video']},
    {mode:'cinematic_voice',modelId:'audio-cinematic-voice',settings:[{name:'mood',value:'dreamy'},{name:'musicEnabled',value:true},{name:'musicModel',value:'pro'},{name:'exportAudioFile',value:true},{name:'script',value:'This is the exact supplied script.'},{name:'voiceModel',value:'seed'}],keys:['watch_video','voice_sample']},
  ];
  for(const item of cases)await t.test(item.mode,async()=>{
    const id='audio-packs-'+item.mode;const requestId=randomUUID();let calls=0;
    const references=item.keys.map(key=>({role:key==='watch_video'?'source_video':'voice_sample',asset:{type:'asset',kind:key==='watch_video'?'video':'audio',assetId:runtime.referenceId(id,key)}}));
    const args={reply:'Review this exact Audio quote.',mode:item.mode,modelId:item.modelId,prompt:'A warm original cinematic sound.',settings:item.settings,references,outputCount:1};
    const result=await runtime.submit(id,'Prepare this Audio pack using my exact references.',item.keys,async()=>{
      calls++;return {id:'audio-pack-response-'+item.mode,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:undefined,output_text:'',output:[{type:'function_call',name:'audio_prepare',call_id:'audio-pack-call-'+item.mode,arguments:JSON.stringify(args)}]};
    },requestId);
    assert.equal(result.error,undefined);assert.equal(result.result?.state,'ready');assert.equal(result.quotes.length,1);assert.equal(calls,1);
    const quote=result.quotes[0];assert.equal(quote.state,'prepared');assert.equal(quote.request_json.surface,'audio');assert.equal(quote.request_json.mode,item.mode);assert.equal(quote.currency,'USD');assert.ok(quote.price_cents>0);
    assert.deepEqual(quote.request_json.references,references);assert.deepEqual(result.counts,{jobs:0,charges:0});assert.equal(result.parity.length,0,'The public OAuth Audio gate stays closed.');
    assert.deepEqual(result.fixtureReferences.map(ref=>ref.key),item.keys);
    const replay=await runtime.submit(id,'Prepare this Audio pack using my exact references.',item.keys,async()=>{throw new Error('Replay must not buy another Response.');},requestId);
    assert.deepEqual(replay.quotes,result.quotes);assert.deepEqual(replay.counts,{jobs:0,charges:0});
  });
  const id='legacy-clone';const sample={role:'voice_sample',asset:{type:'asset',kind:'audio',assetId:runtime.referenceId(id,'voice_sample')}};
  const legacy=await runtime.submit(id,'Clone the attached voice for this script.',['voice_sample'],async()=>({id:'legacy-clone-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:undefined,output_text:'',output:[{type:'function_call',name:'voice_prepare',call_id:'legacy-clone-call',arguments:JSON.stringify({reply:'Review the clone quote.',script:'This is the exact supplied script.',language:'english',modelId:'audio-voice-only',settings:[{name:'voiceModel',value:'seed'}],references:[sample],outputCount:1})}]}));
  assert.equal(legacy.error,undefined);assert.equal(legacy.quotes.length,1);assert.deepEqual(legacy.quotes[0].request_json.references,[sample]);assert.deepEqual(legacy.counts,{jobs:0,charges:0});
  assert.equal(fetches,0);
});
