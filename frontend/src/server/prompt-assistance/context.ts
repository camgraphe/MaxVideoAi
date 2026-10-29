import {promptAssistanceRequestSchema,type PromptAssistanceRequest} from '@/lib/prompt-assistance/contract';
import {listPublicAgentCatalogEngines,type AgentModelCatalogDeps} from '@/server/agent-api/model-catalog';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import {toCanonicalGenerationMode} from '@/server/agent-api/generation-mode-aliases';
import {listAudioCapabilities,projectAudioVariantSettings} from '@/server/agent-api/audio-capabilities';
import {resolveStudioMedia} from '@/server/studio/media-resolver';
import {getPromptAssistanceProfile} from './profiles';
import type {Mode} from '@/types/engines';

export async function buildPromptAssistanceContext(userId:string,raw:PromptAssistanceRequest,deps:{catalog?:AgentModelCatalogDeps;resolveMedia?:typeof resolveStudioMedia;audio?:typeof listAudioCapabilities}={}) {
  const {draft}=promptAssistanceRequestSchema.parse(raw);
  let model:{id:string;label:string},capabilities:unknown,maxChars:number,mode=draft.mode;
  if(draft.surface==='audio') {
    const entry=(deps.audio??listAudioCapabilities)().modes.find(item=>item.mode===mode&&item.engineId===draft.engineId);
    const variant=entry?.variants.find(item=>item.available&&Object.entries(item.settings).every(([key,value])=>draft.settings[key]===value));
    if(!entry||!variant)throw new Error('MODEL_UNAVAILABLE');
    const expected=mode==='voice_only'?'script':'prompt';
    if(draft.target!==expected)throw new Error('TARGET_UNSUPPORTED');
    maxChars=draft.target==='script'?entry.narration!.maxChars:entry.prompt.maxChars;
    model={id:entry.engineId,label:entry.label};
    capabilities={mode,variant:variant.settings,settings:projectAudioVariantSettings(entry.mode,variant),references:entry.references};
  } else {
    if(draft.target!=='prompt')throw new Error('TARGET_UNSUPPORTED');
    const entry=(await listPublicAgentCatalogEngines(deps.catalog,{exactId:draft.engineId,includeExecutableLegacy:true})).find(item=>item.engine.id===draft.engineId&&item.surface===draft.surface);
    const canonical=toCanonicalGenerationMode(draft.engineId,draft.surface,mode as Mode);
    if(!entry||!canonical||(!entry.publicModes.includes(canonical)&&!entry.seedanceWorkflowModes?.includes(canonical)))throw new Error('MODEL_UNAVAILABLE');
    mode=canonical;
    model={id:entry.engine.id,label:entry.engine.label};
    maxChars=entry.engine.inputLimits.promptMaxChars??50000;
    capabilities=projectAgentModelModeDetails(entry,canonical);
  }
  if(draft.text.length>maxChars)throw new Error('DRAFT_TOO_LONG');
  const references=await Promise.all(draft.references.map(async reference=>{
    if(!reference.ref)throw new Error('REFERENCE_REATTACH_REQUIRED');
    const media=await (deps.resolveMedia??resolveStudioMedia)(userId,reference.ref);
    return {field:reference.fieldId,slot:reference.slot,label:reference.label,kind:media.kind,width:media.width??null,height:media.height??null,durationSec:media.durationSec??null};
  }));
  return {model,mode,target:draft.target,maxChars,capabilities,guide:getPromptAssistanceProfile(model.id,mode),references,referencePerception:'metadata_only' as const};
}
