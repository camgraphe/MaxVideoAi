import {promptAssistanceRequestSchema,type PromptAssistanceRequest} from '@/lib/prompt-assistance/contract';
import {listPublicAgentCatalogEngines,type AgentModelCatalogDeps} from '@/server/agent-api/model-catalog';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import {toCanonicalGenerationMode,toEngineGenerationMode} from '@/server/agent-api/generation-mode-aliases';
import {listAudioCapabilities,projectAudioVariantSettings} from '@/server/agent-api/audio-capabilities';
import {resolveStudioMedia} from '@/server/studio/media-resolver';
import {getPromptAssistanceProfile} from './profiles';
import type {EngineCaps,EngineInputField,Mode} from '@/types/engines';
import {buildReferenceMentions,selectedReferenceLabel} from '@/components/composer/workspace-reference-mentions';
import type {ComposerAttachment} from '@/components/composer/composer-types';
import {resolveVideoOperationEngine,normalizeVideoOperation} from '@/lib/video-operation';
import {assistanceReferenceRole} from '@/lib/prompt-assistance/reference-role';
import {selectedPromptSettings} from './selected-settings';
import type {AgentModelModeDetails} from '@/server/agent-api/types';
import {projectSeedance25ModeAvailability} from '@/server/engine-mode-availability';

export async function buildPromptAssistanceContext(userId:string,raw:PromptAssistanceRequest,deps:{catalog?:AgentModelCatalogDeps;resolveMedia?:typeof resolveStudioMedia;audio?:typeof listAudioCapabilities}={}) {
  const {draft}=promptAssistanceRequestSchema.parse(raw);
  let model:{id:string;label:string},capabilities:unknown,maxChars:number,mode=draft.mode;
  let engine:EngineCaps|undefined,fields:EngineInputField[]=[],operation:string|undefined,selectedMode:Mode|undefined,videoCapabilities:AgentModelModeDetails|undefined;
  if(draft.surface==='audio') {
    const entry=(deps.audio??listAudioCapabilities)().modes.find(item=>item.mode===mode&&item.engineId===draft.engineId);
    const variant=entry?.variants.find(item=>item.available&&Object.entries(item.settings).every(([key,value])=>draft.settings[key]===value));
    if(!entry||!variant)throw new Error('MODEL_UNAVAILABLE');
    const expected=mode==='voice_only'?'script':'prompt';
    if(draft.target!==expected)throw new Error('TARGET_UNSUPPORTED');
    maxChars=draft.target==='script'?entry.narration!.maxChars:entry.prompt.maxChars;
    model={id:entry.engineId,label:variant.models.map(item=>item.name).join(' · ')};
    capabilities={mode,variant:variant.settings,settings:projectAudioVariantSettings(entry.mode,variant),references:entry.references};
    if(draft.references.length>1||draft.references.some(ref=>ref.fieldId!=='voice_sample'||ref.slot!==0||ref.ref?.kind!=='audio'||variant.settings.voiceModel!=='seed'||entry.references.voiceSample==='unsupported'))throw new Error('REFERENCE_INVALID');
  } else {
    if(draft.target!=='prompt')throw new Error('TARGET_UNSUPPORTED');
    const entry=(await listPublicAgentCatalogEngines(deps.catalog,{exactId:draft.engineId,includeExecutableLegacy:true})).find(item=>item.engine.id===draft.engineId&&item.surface===draft.surface);
    const canonical=toCanonicalGenerationMode(draft.engineId,draft.surface,mode as Mode);
    if(!entry||!canonical||(!entry.publicModes.includes(canonical)&&!entry.seedanceWorkflowModes?.includes(canonical)))throw new Error('MODEL_UNAVAILABLE');
    mode=canonical;
    const engineMode=toEngineGenerationMode(entry.engine.id,canonical);
    selectedMode=engineMode;
    if(draft.surface==='video') {
      operation=normalizeVideoOperation(entry.engine.id,engineMode,draft.settings.operation);
      engine=resolveVideoOperationEngine(projectSeedance25ModeAvailability(entry.engine),engineMode,operation);
      // Native Draft always uses ModelArk, including when ordinary Edit uses LAS.
      if(engine.id==='seedance-2-5'&&draft.settings.draft===true&&engineMode==='v2v')engine={...engine,
        modeAvailability:{...engine.modeAvailability,v2v:{available:true,reason:'available',...engine.modeAvailability?.v2v,inheritsSourceVideo:true}},
        modeCaps:{...engine.modeCaps,v2v:{...engine.modeCaps?.v2v,modes:['v2v'],durationPolicy:'source_video'}}};
    }else engine=entry.engine;
    model={id:engine.id,label:engine.label};
    maxChars=engine.inputLimits.promptMaxChars??50000;
    capabilities=projectAgentModelModeDetails({...entry,engine,modeCaps:{...entry.modeCaps,...engine.modeCaps}},canonical,false);
    if(draft.surface==='video')videoCapabilities=capabilities as AgentModelModeDetails;
    fields=[...engine.inputSchema?.required??[],...engine.inputSchema?.optional??[]].filter(field=>['image','video','audio'].includes(field.type)&&(!field.modes?.length||field.modes.includes(toEngineGenerationMode(engine!.id,canonical))));
    for(const reference of draft.references){
      const field=fields.find(item=>item.id===reference.fieldId);
      if(!field||reference.ref&&reference.ref.kind!==field.type||draft.references.filter(item=>item.fieldId===reference.fieldId).length>(field.maxCount??1))throw new Error('REFERENCE_INVALID');
    }
  }
  if(new Set(draft.references.map(item=>`${item.fieldId}:${item.slot}`)).size!==draft.references.length)throw new Error('REFERENCE_INVALID');
  if(maxChars===0)throw new Error('TARGET_UNSUPPORTED');
  if(draft.text.length>maxChars)throw new Error('DRAFT_TOO_LONG');
  const resolved=await Promise.all(draft.references.map(async reference=>{
    if(!reference.ref)throw new Error('REFERENCE_REATTACH_REQUIRED');
    const media=await (deps.resolveMedia??resolveStudioMedia)(userId,reference.ref);
    if(media.kind!==reference.ref.kind)throw new Error('REFERENCE_INVALID');
    return {reference,media};
  }));
  const assets:Record<string,(ComposerAttachment|null)[]>={};
  for(const {reference,media} of resolved){(assets[reference.fieldId]??=[])[reference.slot]={kind:media.kind,url:media.url,previewUrl:media.url,name:'',size:0,type:''};}
  const mentions=engine?buildReferenceMentions(engine,fields.map(field=>({field,required:false})),assets):[];
  const references=resolved.map(({reference,media})=>{
    const mention=mentions.find(item=>item.fieldId===reference.fieldId&&item.slotIndex===reference.slot);
    const sequence=mention?Number(mention.token.match(/\d+/)?.[0]??1)+(mention.token.startsWith('<IMAGE_')?1:0):draft.references.filter(item=>item.fieldId===reference.fieldId&&item.slot<=reference.slot).length;
    const field=fields.find(item=>item.id===reference.fieldId);
    const role=engine&&field?assistanceReferenceRole(engine,field,selectedMode):'reference';
    const label=role==='start'?'Start image':role==='end'?'End image':role==='mask'?'Mask':engine&&field?selectedReferenceLabel(engine,field,media.kind,sequence,'en',role==='source'):'Audio 1';
    return {field:reference.fieldId,slot:reference.slot,label,role,token:mention?.token??null,kind:media.kind,width:media.width??null,height:media.height??null,durationSec:media.durationSec??null};
  });
  const settings=selectedPromptSettings(draft.settings,engine,selectedMode??mode as Mode,videoCapabilities,references);
  return {version:'2026-10-29-v2',model,mode,operation:operation??null,target:draft.target,maxChars,settings,capabilities,guide:getPromptAssistanceProfile(model.id,mode),references,referencePerception:'metadata_only' as const};
}
