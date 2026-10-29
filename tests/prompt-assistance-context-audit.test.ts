import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {getBaseEngines} from '../frontend/src/lib/engines';
import {createAgentModelCatalogDeps,listPublicAgentCatalogEngines} from '../frontend/src/server/agent-api/model-catalog';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {composerAssistanceReferences, composerAssistanceSettings} from '../frontend/src/lib/prompt-assistance/client-context';
import {promptResponseParams} from '../frontend/src/server/prompt-assistance/provider';
import type {PromptRequestRow} from '../frontend/src/server/prompt-assistance/repository';
import {ENV} from '../frontend/src/lib/env';
import {getVideoWorkflowSourceField} from '../frontend/lib/video-source-workflow';

const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};
const engine=(id:string)=>getBaseEngines().find(item=>item.id===id)!;
const request=(settings:Record<string,unknown>={},mode='t2v',engineId='seedance-2-5')=>promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:'Refine this shot',draft:{surface:'video',engineId,mode,target:'prompt',text:'A dancer on stage.',settings,references:[]}});
const asset=(id:string,kind:'image'|'video'|'audio'='image')=>({kind,name:'private filename',url:`https://private.invalid/${id}`,previewUrl:'',size:0,type:'',status:'ready' as const,ref:{type:'asset' as const,assetId:id,kind}});

test('video settings include active advanced controls without hidden-mode fields or private identities',()=>{
  const selected=engine('seedance-2-5');
  const settings=composerAssistanceSettings(selected,'t2v',{durationSec:8,resolution:'1080p',aspectRatio:'9:16',audio:false,extraInputValues:{output_format:'mov',source_job_id:'private-job',video_url:'https://private.invalid/source',imaginary:true}});
  assert.equal(settings.output_format,'mov');
  assert.equal(settings.durationSec,8);assert.equal(settings.resolution,'1080p');assert.equal(settings.aspectRatio,'9:16');assert.equal(settings.audio,false);
  assert.ok(!('extraInputValues' in settings));assert.ok(!('source_job_id' in settings));assert.ok(!('video_url' in settings));assert.ok(!('imaginary' in settings));
});

test('active references match UI labels, compact holes and retain the exact prepared excerpt identity',()=>{
  const selected=engine('seedance-2-5');
  const fields=[...selected.inputSchema!.required,...selected.inputSchema!.optional].filter(field=>['image','video','audio'].includes(field.type)).map(field=>({field,required:false}));
  const start=composerAssistanceReferences(selected,fields,{image_url:[asset('start')],end_image_url:[asset('end')],video_url:[asset('saved-modify','video')]},'i2v');
  assert.deepEqual(start.map(ref=>ref.label),['Start image','End image']);
  const refs=composerAssistanceReferences(selected,fields,{image_urls:[null,asset('image')],video_urls:[{...asset('prepared-excerpt','video'),excerptSource:{ref:{type:'asset',assetId:'original',kind:'video'}}} as never]},'ref2v');
  assert.equal(refs[0].label,'Image 1');assert.equal(refs[1].ref?.type,'asset');assert.equal((refs[1].ref as any).assetId,'prepared-excerpt');
});

test('Modify uses owned source timing and framing, not stale Create settings',async()=>{
  const previous=ENV.SEEDANCE_2_5_EDIT_TRANSPORT;ENV.SEEDANCE_2_5_EDIT_TRANSPORT='modelark';
  try {
  const input=request({durationSec:30,aspectRatio:'16:9',resolution:'720p',audio:false},'v2v');
  input.draft.references=[{fieldId:'video_url',slot:0,label:'spoofed',ref:{type:'asset',assetId:'source',kind:'video'}}];
  const context=await buildPromptAssistanceContext('owner',input,{catalog,resolveMedia:async(_owner,ref)=>({kind:'video',ref,url:'https://private.invalid/clip',width:720,height:1280,durationSec:7.25} as never)});
  assert.equal(context.settings.durationSec,7.25);assert.equal(context.settings.durationPolicy,'source_video');
  assert.equal(context.settings.aspectRatio,'source');assert.equal(context.settings.sourceWidth,720);assert.equal(context.settings.sourceHeight,1280);
  assert.equal(context.references[0].label,'Source video');
  const params=promptResponseParams({model:'gpt-6.1-terra',input_json:input} as PromptRequestRow,context,[]);
  const sent=JSON.parse((params.input as any[]).at(-1).content);
  assert.equal(sent.currentDraft.settings.durationSec,7.25);assert.equal(sent.currentDraft.settings.aspectRatio,'source');
  assert.ok(!JSON.stringify(params).includes('private.invalid'));
  } finally {ENV.SEEDANCE_2_5_EDIT_TRANSPORT=previous;}
});

test('automatic duration and native Draft distinguish actual generation from final settings',async()=>{
  const context=await buildPromptAssistanceContext('owner',request({durationSec:30,durationOption:'auto',draft:true,resolution:'1080p',aspectRatio:'9:16',audio:true}),{catalog});
  assert.equal(context.settings.durationSec,null);assert.equal(context.settings.durationPolicy,'automatic');
  assert.equal(context.settings.resolution,'480p');assert.equal(context.settings.finalResolution,'1080p');
});

test('operation-specific capabilities describe Kling Edit and reject invented operations before dispatch',async()=>{
  const input=request({operation:'kling-edit',durationSec:30,aspectRatio:'9:16',keep_audio:true},'v2v','kling-o3-pro');
  const context=await buildPromptAssistanceContext('owner',input,{catalog});
  assert.equal(context.operation,'kling-edit');assert.equal(context.settings.durationPolicy,'source_video');assert.equal(context.settings.durationSec,null);
  assert.equal((context.capabilities as any).durationPolicy,'source_video');
  assert.equal(context.settings.audioPolicy,'source');assert.equal(context.settings.keep_audio,true);
  await assert.rejects(buildPromptAssistanceContext('owner',{...input,draft:{...input.draft,settings:{operation:'invented'}}},{catalog}));
});

test('start and end identities are distinct in the actual provider payload',async()=>{
  const input=request({},'i2v');input.draft.references=[{fieldId:'image_url',slot:0,label:'wrong',ref:asset('a').ref},{fieldId:'end_image_url',slot:0,label:'wrong',ref:asset('b').ref}];
  const context=await buildPromptAssistanceContext('owner',input,{catalog,resolveMedia:async(_owner,ref)=>({kind:'image',ref,url:`https://private.invalid/${ref.type==='asset'?ref.assetId:''}`,width:100,height:200} as never)});
  assert.deepEqual(context.references.map(ref=>ref.label),['Start image','End image']);
  assert.deepEqual(context.references.map(ref=>ref.role),['start','end']);
});

test('references being edited or uploaded cannot silently reuse the old prepared clip',()=>{
  const selected=engine('seedance-2-5');
  const field=selected.inputSchema!.optional.find(field=>field.id==='video_urls')!;
  for(const state of [{excerptEditing:true},{status:'uploading' as const},{status:'error' as const}]){
    const refs=composerAssistanceReferences(selected,[{field,required:false}],{video_urls:[{...asset('old-clip','video'),...state}]},'ref2v');
    assert.equal(refs[0].ref,null);
  }
});

test('keyframe schema references and their frame positions can be sent independently of the compact picker',async()=>{
  const selected=engine('flux-3');
  const field=[...selected.inputSchema!.required,...selected.inputSchema!.optional].find(field=>field.id==='reference_image_urls')!;
  const refs=composerAssistanceReferences(selected,[{field,required:false}],{reference_image_urls:[asset('first'),asset('second')]},'ref2v');
  const settings=composerAssistanceSettings(selected,'ref2v',{extraInputValues:{keyframe_indexes:[0,120]},durationSec:10,fps:24});
  assert.equal(settings.keyframe_indexes,'[0,120]');
  const input=request(settings,'ref2v','flux-3');input.draft.references=refs;
  const context=await buildPromptAssistanceContext('owner',input,{catalog,resolveMedia:async(_owner,ref)=>({kind:'image',ref,url:`https://private.invalid/${ref.type==='asset'?ref.assetId:''}`,width:1280,height:720} as never)});
  assert.equal(context.references.length,2);assert.equal(context.settings.keyframe_indexes,'[0,120]');
});

test('Extend keeps requested continuation timing, while legacy Modify transport retains its own timing policy',async()=>{
  const input=request({durationSec:8,aspectRatio:'9:16',resolution:'720p',audio:false,output_format:'mov'},'extend');
  input.draft.references=[{fieldId:getVideoWorkflowSourceField(engine('seedance-2-5').inputSchema,'extend')!.id,slot:0,label:'Source video',ref:asset('source','video').ref}];
  const deps={catalog,resolveMedia:async(_owner:string,ref:unknown)=>({kind:'video',ref,url:'https://private.invalid/clip',width:1280,height:720,durationSec:15} as never)};
  const context=await buildPromptAssistanceContext('owner',input,deps);
  assert.equal(context.settings.durationSec,8);assert.equal(context.settings.durationPolicy,'requested');assert.equal(context.settings.output_format,'mov');assert.equal(context.settings.audio,false);
  const previous=ENV.SEEDANCE_2_5_EDIT_TRANSPORT;ENV.SEEDANCE_2_5_EDIT_TRANSPORT='las';
  try {
    const legacy=await buildPromptAssistanceContext('owner',{...input,draft:{...input.draft,mode:'v2v',references:[{...input.draft.references[0],fieldId:'video_url'}]}},deps);
    assert.equal(legacy.settings.durationPolicy,'requested');assert.equal(legacy.settings.durationSec,8);
  }finally{ENV.SEEDANCE_2_5_EDIT_TRANSPORT=previous;}
});

test('image controls and read-only negative prompt reach the provider independently of the proposed prompt',async()=>{
  const input=request({resolution:'custom',customImageWidth:1024,customImageHeight:1536,aspectRatio:'2:3',outputFormat:'png',quality:'high',numImages:2,background:'transparent'},'t2i','gpt-image-2-5-flare');
  input.draft.surface='image';input.draft.readOnlyText={negativePrompt:'Avoid lettering.'};
  const context=await buildPromptAssistanceContext('owner',input,{catalog});
  const params=promptResponseParams({model:'gpt-6.1-terra',input_json:input} as PromptRequestRow,context,[]);
  const sent=JSON.parse((params.input as any[]).at(-1).content);
  assert.deepEqual(sent.currentDraft.settings,input.draft.settings);
  assert.equal(sent.currentDraft.readOnlyText.negativePrompt,'Avoid lettering.');assert.equal(sent.currentDraft.text,input.draft.text);
});

test('all voice variants retain visible voice controls; song lyrics are read-only context',async()=>{
  const {audioAssistanceContext}=await import('../frontend/src/lib/prompt-assistance/client-context');
  const {newAudioDraft}=await import('../frontend/src/lib/audio-creation');
  const {listAudioCapabilities}=await import('../frontend/src/server/agent-api/audio-capabilities');
  const audio=()=>{const result=listAudioCapabilities();return {...result,modes:result.modes.map(mode=>({...mode,available:true,variants:mode.variants.map(variant=>({...variant,available:true}))}))};};
  for(const voiceModel of ['eleven-v4','seed','minimax'] as const){
    const draft=audioAssistanceContext('voice',{...newAudioDraft('voice'),voiceModel,language:'french',speed:1.2,outputFormat:'wav',sampleRate:48000});
    const input={...request(),draft:{...draft,target:'script' as const,text:'Bonjour.'}};
    const context=await buildPromptAssistanceContext('owner',input,{audio});
    assert.equal(context.settings.voiceModel,voiceModel);assert.equal(context.settings.language,'french');
    if(voiceModel==='seed'){assert.equal(context.settings.seedAudioOutputFormat,'wav');assert.equal(context.settings.seedAudioSampleRate,48000);}
  }
  const song=audioAssistanceContext('song',{...newAudioDraft('song'),lyrics:'Une lumière au bout du chemin'});
  assert.equal(song.readOnlyText?.lyrics,'Une lumière au bout du chemin');assert.ok(!('lyrics' in song.settings));
});

test('native Draft Modify uses source timing even when normal Edit is configured for LAS',async()=>{
  const previous=ENV.SEEDANCE_2_5_EDIT_TRANSPORT;ENV.SEEDANCE_2_5_EDIT_TRANSPORT='las';
  try {
    const context=await buildPromptAssistanceContext('owner',request({draft:true,durationSec:12,resolution:'1080p'},'v2v'),{catalog});
    assert.equal(context.settings.durationPolicy,'source_video');assert.equal(context.settings.durationSec,null);assert.equal(context.settings.resolution,'480p');
  }finally{ENV.SEEDANCE_2_5_EDIT_TRANSPORT=previous;}
});

test('published video and image operations resolve their own capability context across the catalog',async t=>{
  let covered=0;
  for(const candidate of await listPublicAgentCatalogEngines(catalog)){
    for(const mode of candidate.publicModes){
      const operations=Object.values(candidate.engine.operationCaps??{}).filter(operation=>operation.mode===mode);
      for(const operation of operations.length?operations:[undefined]){
        const input=request(operation?{operation:operation.operation}:{},mode,candidate.engine.id);input.draft.surface=candidate.surface;
        if(operation?.promptMaxChars===0||operation?.operation==='h3-relight'){await assert.rejects(buildPromptAssistanceContext('owner',input,{catalog}),/TARGET_UNSUPPORTED/);continue;}
        const context=await buildPromptAssistanceContext('owner',input,{catalog}).catch(error=>{throw new Error(`${candidate.engine.id}/${mode}/${operation?.operation??'default'}: ${error.message}`);});
        assert.equal(context.model.id,candidate.engine.id);assert.equal(context.mode,mode);assert.equal(context.referencePerception,'metadata_only');
        assert.ok(context.maxChars>0);covered++;
      }
    }
  }
  assert.ok(covered>80,`Expected broad catalog coverage, got ${covered}`);t.diagnostic(`${covered} model/mode/operation contexts resolved; provider availability deliberately mocked, no paid calls`);
});


test('Milo gets surface-specific app navigation and answers help without rewriting the draft',async()=>{
  for(const [surface,mode,id] of [['video','v2v','seedance-2-5'],['image','t2i','gpt-image-2-5-flare']] as const){
    const input=request({},mode,id);input.draft.surface=surface;input.message='How do I use this screen?';
    const context=await buildPromptAssistanceContext('owner',input,{catalog});
    assert.equal((context as any).surface,surface);
    const params=promptResponseParams({model:'gpt-6.1-terra',input_json:input} as PromptRequestRow,context,[]);
    const instructions=String(params.instructions);
    assert.match(instructions,/navigation.*text: null/i);
    assert.match(instructions,/References/);
    assert.match(instructions,/Use prompt.*does not generate/i);
    if(surface==='video'){
      assert.match(instructions,/Video to modify/);
      assert.match(instructions,/sourceGeneration.*uploaded/i);
    }else assert.doesNotMatch(instructions,/Video to modify/);
    assert.match(instructions,/not Studio/);
    assert.doesNotMatch(instructions,/How do I use this screen/);
  }
  const {audioAssistanceContext}=await import('../frontend/src/lib/prompt-assistance/client-context');
  const {newAudioDraft}=await import('../frontend/src/lib/audio-creation');
  const {listAudioCapabilities}=await import('../frontend/src/server/agent-api/audio-capabilities');
  const audio=()=>{const result=listAudioCapabilities();return {...result,modes:result.modes.map(entry=>({...entry,available:true,variants:entry.variants.map(variant=>({...variant,available:true}))}))};};
  const input={...request(),draft:{...audioAssistanceContext('voice',newAudioDraft('voice')),target:'script' as const,text:'Hello.'}};
  const context=await buildPromptAssistanceContext('owner',input,{audio});
  const params=promptResponseParams({model:'gpt-6.1-terra',input_json:input} as PromptRequestRow,context,[]);
  assert.equal((context as any).surface,'audio');
  assert.match(String(params.instructions),/Voice.*Language/);
  assert.doesNotMatch(String(params.instructions),/Video to modify/);
});
