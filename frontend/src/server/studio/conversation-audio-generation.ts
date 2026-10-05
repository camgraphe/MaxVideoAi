import {ZodError} from 'zod';
import {getAudioPackConfig} from '@/lib/audio-generation';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import type {StudioProjectMedia} from '@/lib/studio/conversation-action-contract';
import {conversationSelectionSettings} from '@/lib/studio/conversation-creation-contract';
import {audioGenerationSettingsSchema,normalizeAudioGenerationRequest,type CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';
import {AgentApiError} from '@/server/agent-api/errors';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {createStudioAudioGenerationService} from './audio-generation-service';
import {resolveStudioMedia} from './media-resolver';
import {StudioPreparationInputError} from './conversation-preparation-validation';

type AudioIntent=Exclude<StudioMediaIntent,{action:'video.prepare'}>;
export type StudioAudioSourceDependencies={
  readProjectMedia(actor:StudioGenerationActor):Promise<StudioProjectMedia>;
  resolveMedia?:typeof resolveStudioMedia;
};

/** This wrapper is exclusively synchronous selection validation; no reads or mutations belong here. */
function audioSelection<T>(build:()=>T):T {
  try{return build();}catch(error){
    if(error instanceof StudioPreparationInputError)throw error;
    const message=error instanceof ZodError?error.issues[0]?.message:error instanceof Error?error.message:'The Audio selection is invalid.';
    throw new StudioPreparationInputError('PARAMETER_INVALID',message??'The Audio selection is invalid.');
  }
}

/** Exact current attachments or ready outputs; Audio keeps native output identities without library promotion. */
export async function validateStudioAudioRequest(actor:StudioGenerationActor,action:AudioIntent,input:ImageTurnInput,
  factory:typeof createStudioAudioGenerationService,enabled:boolean,dependencies:StudioAudioSourceDependencies,
):Promise<{materialize():Promise<CanonicalAudioRequest>}> {
  const settings=audioSelection(()=>audioGenerationSettingsSchema.parse(conversationSelectionSettings(action.settings)));
  const mode=action.action==='audio.prepare'?action.mode:action.action==='voice.prepare'?'voice_only':'music_only';
  const config=getAudioPackConfig(mode);
  const capabilities=await factory(actor,{enabled}).catalog();
  const entry=capabilities.modes.find(candidate=>candidate.mode===mode&&(!action.modelId||candidate.engineId===action.modelId));
  if(!entry)throw new StudioPreparationInputError('ENGINE_UNAVAILABLE','Choose the top-level Audio model ID and mode from the current Studio catalog; provider selection belongs in settings.');
  const wanted={...(config.includesVoice?{voiceModel:settings.voiceModel??'seed'}:{}),
    ...(config.supportsMusicToggle?{musicEnabled:settings.musicEnabled??config.defaultMusicEnabled}:{}),
    ...(mode==='music_only'?{musicModel:settings.musicModel??'clip'}:{})};
  const fallbackKey=config.includesVoice&&settings.voiceModel===undefined&&!action.references?.some(ref=>ref.role==='voice_sample')?'voiceModel'
    :mode==='music_only'&&settings.musicModel===undefined?'musicModel':null;
  const matches=(variant:typeof entry.variants[number],fallback=false)=>Object.entries(wanted).every(([key,value])=>
    fallback&&key===fallbackKey||variant.settings[key as keyof typeof variant.settings]===value);
  const variant=entry.variants.find(candidate=>candidate.available&&matches(candidate))
    ??(fallbackKey?entry.variants.find(candidate=>candidate.available&&matches(candidate,true)):undefined);
  if(!variant)throw new AgentApiError('ENGINE_UNAVAILABLE','The selected Audio provider variant is currently unavailable.');
  const request=audioSelection(()=>{
    const defaultDuration='clipSeconds'in entry.duration&&variant.settings.musicModel==='clip'?entry.duration.clipSeconds
      :'suggestedSeconds'in entry.duration?entry.duration.suggestedSeconds?.find(seconds=>seconds>30)??30:30;
    const legacy=action.action==='voice.prepare'?{script:action.script,language:action.language,
      ...(variant.settings.voiceModel==='seed'?{seedAudioOutputFormat:'mp3' as const}:{})}
      :action.action==='music.prepare'?{mood:action.mood,durationSec:defaultDuration}:{};
    const normalized=normalizeAudioGenerationRequest({schemaVersion:1,surface:'audio',engineId:entry.engineId,mode,
      prompt:action.action==='voice.prepare'?'':action.prompt,settings:{...variant.settings,...legacy,...settings},
      references:action.references??[],outputCount:action.outputCount??1});
    for(const [name,value]of Object.entries(settings))if(normalized.settings[name as keyof CanonicalAudioRequest['settings']]!==(typeof value==='string'?value.trim():value))
      throw new Error(`${name} is not supported with the selected Audio variant.`);
    return normalized;
  });
  // Check the entire attachment selection before any source read. A later bad ID
  // must not let an earlier reference progress into probing or preparation.
  for(const reference of request.references){
    const selected=reference.asset;
    if(selected.type==='asset'&&!input.attachments?.some(attached=>attached.type==='asset'&&attached.assetId===selected.assetId&&attached.kind===selected.kind))
      throw new StudioPreparationInputError('REFERENCE_INVALID','Attach this owned video or audio file before selecting it.');
  }
  const outputs=request.references.some(reference=>reference.asset.type==='job-output')?await dependencies.readProjectMedia(actor):[];
  for(const reference of request.references){
    const selected=reference.asset;
    if(selected.type==='job-output'&&!outputs.some(output=>output.ref.type==='job-output'&&output.ref.jobId===selected.jobId&&output.ref.outputId===selected.outputId&&output.ref.kind===selected.kind))
      throw new AgentApiError('REFERENCE_INVALID','This Audio reference is not a ready output in this project.');
  }
  for(const reference of request.references)await(dependencies.resolveMedia??resolveStudioMedia)(actor.userId,reference.asset);
  return {materialize:async()=>request};
}
