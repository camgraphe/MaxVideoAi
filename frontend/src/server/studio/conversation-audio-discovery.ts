import {AUDIO_CINEMATIC_MAX_DURATION_SEC,AUDIO_MIN_DURATION_SEC,getAudioPackConfig} from '@/lib/audio-generation';
import type {listAudioCapabilities} from '@/server/agent-api/audio-capabilities';
import type {StudioImageCapability} from '@/lib/studio/conversation-action-contract';

type AudioMode=ReturnType<typeof listAudioCapabilities>['modes'][number];
type AudioVariant=AudioMode['variants'][number];
export type StudioAudioWorkflowFacts={
  purpose:string;
  output:'audio_file'|'video_with_new_soundtrack';
  references:{sourceVideo:'required'|'optional'|'unsupported';voiceSample:'optional_seed_only'|'unsupported'};
  video?:{
    stream:'copied_without_reencoding';duration:'source_video';sourceAudio:'replaced_by_generated_mix';
    sourceDurationSec:{min:number;max:number};optionalAudioExport:boolean;
  };
  music?:'optional'|'included'|'unavailable';
  narration?:{scriptRequired:true;mayBeTrimmedToSourceDuration:boolean;lipSync:false};
};

export function studioAudioVariantVoiceSample(mode:AudioMode,variant:AudioVariant):'optional'|'unsupported'{
  return mode.references.voiceSample==='optional_seed_only'&&variant.available&&variant.settings.voiceModel==='seed'
    ? 'optional':'unsupported';
}

/** Describes the current audio renderer; it does not add a generation mode or change its canonical contract. */
export function studioAudioWorkflowFacts(mode:AudioMode):StudioAudioWorkflowFacts{
  const config=getAudioPackConfig(mode.mode);
  const variants=mode.variants.filter(variant=>variant.available);
  const musicEnabled=variants.some(variant=>variant.settings.musicEnabled===true);
  const musicDisabled=variants.some(variant=>variant.settings.musicEnabled===false);
  return {
    purpose:config.requiresVideo
      ? `Add a generated soundtrack${config.includesVoice?' with narration':''} to an existing clip while preserving its video stream.`
      : config.includesVoice?'Generate narration or dialogue as a standalone audio file.':config.description,
    output:config.audioOnly?'audio_file':'video_with_new_soundtrack',
    references:{
      sourceVideo:mode.references.sourceVideo==='required'?'required':mode.references.sourceVideo==='optional'?'optional':'unsupported',
      voiceSample:variants.some(variant=>studioAudioVariantVoiceSample(mode,variant)==='optional')?'optional_seed_only':'unsupported',
    },
    ...(config.requiresVideo?{
      // mixAudioIntoVideo supplies only generated stems. Its mux copies 0:v:0 and replaces audio with 1:a:0.
      video:{stream:'copied_without_reencoding' as const,duration:'source_video' as const,sourceAudio:'replaced_by_generated_mix' as const,
        sourceDurationSec:{min:AUDIO_MIN_DURATION_SEC,max:AUDIO_CINEMATIC_MAX_DURATION_SEC},optionalAudioExport:config.supportsAudioExport},
      music:musicEnabled?(musicDisabled?'optional' as const:'included' as const):'unavailable' as const,
    }:{}),
    ...(config.includesVoice?{
      // The cinematic mix trims its generated stems to the measured source duration; the video is never lip-synced.
      narration:{scriptRequired:true as const,mayBeTrimmedToSourceDuration:config.requiresVideo,lipSync:false as const},
    }:{}),
  };
}

export function studioAudioCapabilitySummary(mode:AudioMode):StudioImageCapability{
  return {modelId:mode.engineId,label:mode.label,lifecycle:null,modes:[mode.mode],formats:[],audioWorkflow:studioAudioWorkflowFacts(mode)};
}
