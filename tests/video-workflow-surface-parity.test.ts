import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById,listFalEngines} from '../frontend/src/config/falEngines';
import {projectAgentModelModeDetails} from '../frontend/src/server/agent-api/model-details';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';
import type {AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {buildPaidVideoRequestBody} from '../frontend/src/server/agent-api/paid-video-request-body';

function candidate(id:string):AgentPublicGenerationEngine {
  const entry=getFalEngineById(id)!;
  return {engine:entry.engine,surface:'video',publicModes:entry.modes.map(m=>m.mode) as never,
    modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))};
}

test('Omni Modify advertises inherited timing while Extend retains requested timing',()=>{
  const entry=candidate('gemini-omni-flash');
  const edit=projectAgentModelModeDetails(entry,'v2v');
  assert.equal(edit.durationPolicy,'source_video');
  assert.equal(edit.settings.some(s=>s.key==='durationSec'),false);
  const extend=projectAgentModelModeDetails(entry,'extend');
  assert.equal(extend.durationPolicy,'requested');
  assert.ok(extend.settings.some(s=>s.key==='durationSec'));
});

test('runtime Seedance Edit timing and framing follow its active transport',()=>{
  const base=candidate('seedance-2-5');
  for(const inherited of [true,false]){
    const entry={...base,engine:{...base.engine,modeAvailability:{v2v:{available:true,reason:'available',inheritsSourceVideo:inherited}}}} as AgentPublicGenerationEngine;
    const edit=projectAgentModelModeDetails(entry,'v2v');
    assert.equal(edit.durationPolicy,inherited?'source_video':'requested');
    assert.equal(edit.settings.some(s=>s.key==='durationSec'),!inherited);
    assert.equal(edit.settings.some(s=>s.key==='aspectRatio'),!inherited);
    assert.equal(projectAgentModelModeDetails(entry,'extend').durationPolicy,'requested');
  }
});

for(const [id,mode,settings,expected] of [
  ['kling-o3-standard','v2v',{keepAudio:false},{keep_audio:false}],
  ['kling-o3-pro','v2v',{keepAudio:true},{keep_audio:true}],
  ['gemini-omni-flash','v2v',{promptEditInstruction:'replace_background'},{prompt_edit_instruction:'replace_background'}],
  ['veo-3-1','extend',{compressionQuality:'lossless'},{compression_quality:'lossless'}],
  ['flux-3','extend',{safetyTolerance:4},{safety_tolerance:4}],
] as const)test(`${id} ${mode} exposes and submits its model-specific controls`,()=>{
  const entry=candidate(id),details=projectAgentModelModeDetails(entry,mode);
  for(const key of Object.keys(settings))assert.ok(details.settings.some(s=>s.key===key),key);
  // Use the authored enum rather than inventing a provider value.
  const selected=Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,details.settings.find(s=>s.key===key)?.values?.[0]??value]));
  const request=normalizeGenerationRequest({surface:'video',engineId:id,mode,prompt:'Preserve the subject and change the scene.',settings:{durationSec:mode==='extend'?7:6,resolution:details.resolutions[0],aspectRatio:'9:16',...selected},references:[{kind:'asset',assetId:'ma_source',role:'source'}]});
  validateCanonicalGenerationCapabilities(request,entry);
  const body=buildPaidVideoRequestBody({request,engine:entry.engine,quoteId:'quote',canonicalPricing:{membershipTier:'member'},
    resolvedReferences:[{assetId:'ma_source',role:'source',...(request.references[0].slot===undefined?{}:{slot:request.references[0].slot}),mediaKind:'video',storageUrl:'https://cdn.maxvideoai.com/source.mp4',mimeType:'video/mp4',durationSec:6,width:720,height:1280}]} as never);
  for(const [index,field] of Object.keys(expected).entries())assert.equal((body.extraInputValues as Record<string,unknown>)[field],Object.values(selected)[index]);
});

test('Studio preserves every declared Modify and Extend reference capacity and setting',()=>{
  for(const entry of listFalEngines()){
    const current=candidate(entry.id),studio=studioVisualCapabilityDetails(current);
    if(studio.surface==='audio')throw Error('Expected visual details');
    for(const mode of current.publicModes.filter(m=>m==='v2v'||m==='extend')){
      const canonical=projectAgentModelModeDetails(current,mode),actual=studio.modes.find(m=>m.mode===mode)!;
      assert.deepEqual(actual.settings,canonical.settings,`${entry.id} ${mode} settings`);
      assert.deepEqual(actual.references,canonical.references,`${entry.id} ${mode} references`);
    }
  }
});

test('Seedance warns before Modify and Extend without disabling either workflow',()=>{
  for(const id of ['seedance-2-0','seedance-2-0-fast','seedance-2-0-mini','seedance-2-5'])for(const mode of ['v2v','extend'] as const){
    const details=projectAgentModelModeDetails(candidate(id),mode);
    assert.ok(details.notices?.some((note)=>note.code==='seedance_recognizable_people'&&/recognizable person/.test(note.message)),`${id} ${mode}`);
    assert.ok(details.references.length);
  }
  assert.equal(projectAgentModelModeDetails(candidate('wan-3'),'extend').notices,undefined);
});

test('Modify reference capacity is accepted through the canonical and Studio request boundaries',async()=>{
  const {requireStudioGenerationRequest}=await import('../frontend/src/server/agent-api/generation-actor');
  const {studioVideoActionSchema}=await import('../frontend/lib/studio/conversation-media-contract');
  for(const [id,count] of [['seedance-2-5',30],['luma-ray-3-2',64]] as const){
    const references=[{kind:'asset',assetId:'ma_'+'a'.repeat(32),role:'source'},...Array.from({length:count},(_,i)=>({kind:'asset',assetId:'ma_'+(i+1).toString(16).padStart(32,'0'),role:'reference'}))];
    const request=normalizeGenerationRequest({surface:'video',engineId:id,mode:'v2v',prompt:'Change the scene',settings:{durationSec:6,resolution:'720p'},references});
    assert.doesNotThrow(()=>requireStudioGenerationRequest(request));
    assert.ok(studioVideoActionSchema.safeParse({action:'video.prepare',reply:'Review',modelId:id,mode:'v2v',prompt:'Change the scene',aspectRatio:'9:16',source:null,
      references:request.references.map(r=>({ref:{type:'asset',kind:r.role==='source'?'video':'image',assetId:r.kind==='asset'?r.assetId:''},role:r.role,slot:r.slot??null}))}).success);
  }
});

test('MCP preparation accepts all declared new options and ordered reference slots',async()=>{
  const {prepareGenerationInputSchema}=await import('../frontend/src/server/mcp/tools/prepare-generation');
  assert.ok(prepareGenerationInputSchema.safeParse({surface:'video',engineId:'kling-o3-pro',mode:'v2v',prompt:'Preserve identity',settings:{keepAudio:false},references:[{kind:'asset',assetId:'ma_source',role:'source'},{kind:'asset',assetId:'ma_ref',role:'reference',slot:0}]}).success);
});

test('the supplied Modify review is mode-specific and available equally to MCP and Studio',()=>{
  const ids=['luma-ray-3-2','wan-3-prime','kling-o3-pro','wan-3','kling-o3-standard','gemini-omni-flash'];
  ids.forEach((id,index)=>{
    const entry=candidate(id),details=projectAgentModelModeDetails(entry,'v2v');
    assert.equal(details.editorialPreference?.rank,index+1,id);
    assert.equal(details.editorialPreference?.basis,'owner_observation');
    assert.match(details.editorialPreference?.scope??'',/single.*iPhone/i);
    const studio=studioVisualCapabilityDetails(entry);
    assert.notEqual(studio.surface,'audio');
    if(studio.surface==='audio')return;
    assert.deepEqual(studio.modes.find(m=>m.mode==='v2v')?.editorialPreference,details.editorialPreference);
    if(entry.publicModes.includes('extend'))assert.equal(projectAgentModelModeDetails(entry,'extend').editorialPreference,undefined);
  });
});

test('MCP derives omitted Modify duration from measured media and preserves exact source pricing facts',async()=>{
  const {readGenerationPricing}=await import('../frontend/src/server/agent-api/generation-pricing-read');
  const entry=candidate('gemini-omni-flash');
  const request=normalizeGenerationRequest({surface:'video',engineId:entry.engine.id,mode:'v2v',prompt:'Change the room',settings:{resolution:'720p'},references:[{kind:'asset',assetId:'ma_source',role:'source'}]});
  const references=[{assetId:'ma_source',role:'source' as const,mediaKind:'video' as const,storageUrl:'https://cdn.maxvideoai.com/phone.mov',mimeType:'video/quicktime',durationSec:5.558333,width:720,height:1280,sizeBytes:4096,originalName:'phone.mov'}];
  const result=await readGenerationPricing(request,{authMethod:'oauth',userId:'owner',clientId:'client',scopes:[]} as never,{
    listPublicEngines:async()=>[entry],resolveGenerationReferences:async()=>references,
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
    priceGeneration:async(current,tier,context)=>{assert.equal(current.settings.durationSec,6);assert.equal(context.resolvedReferences?.[0].durationSec,5.558333);return {priceCents:80,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:80,currency:'USD',membershipTier:tier}};},
  });
  assert.equal(result.request.settings.durationSec,6);
  assert.equal(request.settings.durationSec,undefined,'No caller object mutation');
});


test('Omni direction controls retain free-text instructions beyond a short enum label', async () => {
  const {prepareGenerationInputSchema} = await import('../frontend/src/server/mcp/tools/prepare-generation');
  const details = projectAgentModelModeDetails(candidate('gemini-omni-flash'), 'extend');
  for (const key of ['promptAudioDirection', 'promptCameraDirection', 'promptEditInstruction']) {
    assert.equal(details.settings.find(setting => setting.key === key)?.type, 'text');
    assert.ok(prepareGenerationInputSchema.safeParse({ surface:'video',engineId:'gemini-omni-flash',mode:'extend',prompt:'Continue the action',
      settings:{[key]:'A detailed creative direction. '.repeat(20)} }).success);
  }
});
