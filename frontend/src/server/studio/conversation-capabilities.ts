import {getRuntimeModelById} from '@/config/model-runtime';
import type {StudioCapabilityDetails,StudioImageCapability} from '@/lib/studio/conversation-action-contract';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import {getAgentModelGuidance,getAgentModelEditorialGuidance,getAgentModelEditorialSummary} from '@/server/agent-api/model-guidance';
import {getAgentModelPromptingSources} from '@/server/agent-api/model-prompting-sources';
import type {AgentPublicGenerationEngine} from '@/server/agent-api/model-catalog';
import {projectAudioVariantSettings,projectAudioVariantFixedOutput,type listAudioCapabilities} from '@/server/agent-api/audio-capabilities';
import {STUDIO_CONVERSATION_MAX_REFERENCES} from '@/lib/studio/conversation-creation-contract';
import {studioAudioWorkflowFacts,studioAudioVariantVoiceSample} from './conversation-audio-discovery';

/** Called only with the authorized adapter's executable and certified catalog, never a global lookup. */
export function studioVisualCapabilityDetails(candidate: AgentPublicGenerationEngine): StudioCapabilityDetails {
  return {modelId: candidate.engine.id,label: candidate.engine.label,lifecycle: getRuntimeModelById(candidate.engine.id)?.lifecycle ?? null,surface: candidate.surface,
    modes: candidate.publicModes.map(mode => {
      const canonical=projectAgentModelModeDetails(candidate,mode);
      return {...canonical,outputCount: {min: 1,max: 1,default: 1},
        settings: canonical.settings.filter(setting => setting.type !== 'multi_prompt'&&!['documentUrl','webpageUrl'].includes(setting.key)),
        references: canonical.references.filter(reference => candidate.surface==='video'||reference.type === 'image').map(reference=>({...reference,
          max: Math.min(reference.max ?? STUDIO_CONVERSATION_MAX_REFERENCES,STUDIO_CONVERSATION_MAX_REFERENCES)}))};
    }),
    referenceIdentity: candidate.surface === 'image' ? 'attached_image_asset' : 'attached_owned_media_or_ready_project_output',
    outputCount: 1,maxReferences: STUDIO_CONVERSATION_MAX_REFERENCES,guidance: getAgentModelGuidance(candidate.engine.id),
    editorialGuidance: getAgentModelEditorialGuidance(candidate.engine.id),
    promptingSources: getAgentModelPromptingSources(candidate.engine.id).flatMap(source => {
      const modes=source.modes.filter(mode=>candidate.publicModes.includes(mode));
      return modes.length ? [{...source,modes}] : [];
    }),
  };
}
export function studioVisualCapabilitySummary(candidate: AgentPublicGenerationEngine): StudioImageCapability {
  const customImageSize=candidate.surface==='image' ? candidate.publicModes.some(mode=>{
    const facts=projectAgentModelModeDetails(candidate,mode);
    return facts.resolutions.includes('custom')&&['imageWidth','imageHeight'].every(key=>facts.settings.some(setting=>setting.key===key));
  }) : undefined;
  return {modelId: candidate.engine.id,label: candidate.engine.label,lifecycle: getRuntimeModelById(candidate.engine.id)?.lifecycle ?? null,modes: candidate.publicModes,formats: candidate.engine.aspectRatios,
    ...(customImageSize===undefined ? {} : {customImageSize}),
    bestFor: getAgentModelGuidance(candidate.engine.id)?.bestFor ?? [],editorialGuidance: getAgentModelEditorialSummary(candidate.engine.id)};
}
export function studioAudioCapabilityDetails(capabilities: ReturnType<typeof listAudioCapabilities>,modelId: string): StudioCapabilityDetails | null {
  const modes=capabilities.modes.filter(mode => mode.engineId === modelId && mode.variants.some(variant=>variant.available));
  if (!modes.length) return null;
  const variants=modes.flatMap(mode=>mode.variants.filter(variant=>variant.available));
  const seed=variants.some(variant=>variant.settings.voiceModel==='seed');
  const minimax=variants.some(variant=>variant.settings.voiceModel==='minimax');
  const music=modes.some(mode=>mode.mode==='music_only'||mode.mode==='cinematic'||mode.mode==='cinematic_voice');
  const parameters=modes.flatMap(mode=>mode.variants.filter(variant=>variant.available).flatMap(variant=>projectAudioVariantSettings(mode.mode,variant)));
  const permits=(key: 'seedAudioOutputFormat' | 'seedAudioSampleRate',value: string | number)=>parameters.some(parameter=>parameter.key===key && parameter.values?.includes(value));
  const options={...capabilities.options,
    seedVoices: seed ? capabilities.options.seedVoices : [],minimaxVoices: minimax ? capabilities.options.minimaxVoices : [],
    seedFormats: capabilities.options.seedFormats.filter(format=>permits('seedAudioOutputFormat',format)),
    seedSampleRates: capabilities.options.seedSampleRates.filter(rate=>permits('seedAudioSampleRate',rate)),
    languages: seed || minimax ? capabilities.options.languages : [],moods: music ? capabilities.options.moods : [],musicBpm: music ? capabilities.options.musicBpm : [],
  };
  const references:('source_video'|'voice_sample')[]=[];
  if(modes.some(mode=>mode.references.sourceVideo!=='unsupported'))references.push('source_video');
  if(modes.some(mode=>mode.variants.some(variant=>studioAudioVariantVoiceSample(mode,variant)==='optional')))references.push('voice_sample');
  return {modelId,label: modes[0].label,surface: 'audio',options,references,outputCount: 1,
    modes: modes.map(mode=>{
      const audioWorkflow=studioAudioWorkflowFacts(mode);
      return {...mode,audioWorkflow,references:{...mode.references,voiceSample:audioWorkflow.references.voiceSample},
        variants:mode.variants.filter(variant=>variant.available).map(variant=>({...variant,voiceSample:studioAudioVariantVoiceSample(mode,variant),
          parameters:projectAudioVariantSettings(mode.mode,variant),fixedOutput:projectAudioVariantFixedOutput(mode.mode,variant)}))};
    }),
  };
}
