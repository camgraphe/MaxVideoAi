import { createHash } from 'node:crypto';
import {
  AUDIO_MINIMAX_VOICE_VALUES, AUDIO_PACK_VALUES, AUDIO_MIN_DURATION_SEC, AUDIO_MAX_DURATION_SEC, AUDIO_SFX_MAX_DURATION_SEC,
  AUDIO_CINEMATIC_MAX_DURATION_SEC, AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC, AUDIO_MUSIC_DURATION_OPTIONS_SEC,
  AUDIO_SCRIPT_MAX_LENGTH, AUDIO_LYRICS_MAX_LENGTH, AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SEED_AUDIO_VOICE_VALUES, AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES, AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES,
  AUDIO_MOOD_VALUES, AUDIO_LYRIA3_BPM_VALUES, AUDIO_LYRIA3_MODEL_VALUES, AUDIO_LANGUAGE_VALUES,
  AUDIO_SEED_AUDIO_RANGE_CONSTRAINTS, AUDIO_SEED_AUDIO_DECIMAL_PRECISION, AUDIO_VOICE_GENDER_VALUES, AUDIO_VOICE_PROFILE_VALUES, AUDIO_VOICE_DELIVERY_VALUES, AUDIO_INTENSITY_VALUES,
  buildAudioVendorCostFacts, getAudioPackConfig, type AudioPackId, type AudioGenerateRequestBody,
} from '@/lib/audio-generation';
import { assertAudioProviderConfigured } from '@/server/audio/prepare-audio';
import { validateAudioGenerateRequest } from '@/server/audio/audio-generate-validation';
import { assertFalModelAllowed } from '@/lib/fal-model-policy';
import { AUDIO_PRICING_POLICY_REVISION } from '@/lib/audio-pricing-policy';
import type { ValidatedAudioGenerateRequest } from '@/server/audio/audio-generate-validation';
import type {CanonicalAudioRequest} from './audio-normalization';

export type AudioSettingDetails = {
  key: keyof CanonicalAudioRequest['settings']; type: 'text' | 'enum' | 'number'; required: boolean;
  values: readonly (string | number | boolean)[] | null; min: number | null; max: number | null;
  default: string | number | boolean | null; integer?: boolean; step?: number; maxChars?: number;
};
type AudioVariant=ReturnType<typeof listAudioCapabilities>['modes'][number]['variants'][number];
function normalizeCapabilityVariant(mode: AudioPackId,variant: AudioVariant) {
  const body=variantRequests(mode).find(body=>Object.entries(variant.settings).every(([key,value])=>body[key as keyof AudioGenerateRequestBody]===value));
  return body ? validateAudioGenerateRequest(body) : null;
}
export function projectAudioVariantFixedOutput(mode: AudioPackId,variant: AudioVariant) {
  const normalized=normalizeCapabilityVariant(mode,variant);
  return mode==='voice_only' && normalized?.voiceModel==='minimax'
    ? {format: normalized.seedAudioOutputFormat,sampleRate: normalized.seedAudioSampleRate} : null;
}

/** Discovery facts from the same variant inputs and validator, without changing quote catalog revisions. */
export function projectAudioVariantSettings(mode: AudioPackId,variant: AudioVariant): AudioSettingDetails[] {
  const normalized=normalizeCapabilityVariant(mode,variant);
  if (!normalized) return [];
  const config=getAudioPackConfig(mode);
  const choice=(key: AudioSettingDetails['key'],values: readonly (string | number | boolean)[],required=false): AudioSettingDetails=>({key,type: 'enum',required,values: Object.freeze([...values]),min: null,max: null,
    default: normalized[key as keyof ValidatedAudioGenerateRequest] as string | number | boolean | null});
  if (mode==='music_only') return [
    choice('musicModel',[normalized.musicModel!]),choice('mood',AUDIO_MOOD_VALUES,true),choice('musicBpm',AUDIO_LYRIA3_BPM_VALUES),choice('intensity',AUDIO_INTENSITY_VALUES),
    {key: 'durationSec',type: 'number',required: true,default: normalized.durationSec,integer: true,
      values: normalized.musicModel==='clip' ? [AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC] : null,
      min: normalized.musicModel==='clip' ? AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC : AUDIO_MIN_DURATION_SEC,
      max: normalized.musicModel==='clip' ? AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC : AUDIO_MAX_DURATION_SEC},
  ];
  const fields:AudioSettingDetails[]=[];
  if(config.requiresMood)fields.push(choice('mood',AUDIO_MOOD_VALUES,true));
  if(config.supportsMusicToggle)fields.push(choice('musicEnabled',[normalized.musicEnabled]));
  if(config.supportsAudioExport)fields.push(choice('exportAudioFile',[false,true]));
  if(config.requiresVideo){
    fields.push(choice('intensity',AUDIO_INTENSITY_VALUES));
    if(normalized.musicEnabled)fields.push(choice('musicModel',AUDIO_LYRIA3_MODEL_VALUES),choice('musicBpm',AUDIO_LYRIA3_BPM_VALUES));
  }
  if(mode==='song')fields.push({key:'lyrics',type:'text',required:true,values:null,min:null,max:null,default:null,maxChars:AUDIO_LYRICS_MAX_LENGTH});
  if(mode==='sfx_only'||mode==='ambience_only')fields.push({key:'durationSec',type:'number',required:true,values:null,
    min:AUDIO_MIN_DURATION_SEC,max:mode==='sfx_only'?AUDIO_SFX_MAX_DURATION_SEC:AUDIO_MAX_DURATION_SEC,default:normalized.durationSec,integer:true});
  if(!config.includesVoice)return fields;
  const voice: AudioSettingDetails[]=[...fields,
    choice('voiceModel',[normalized.voiceModel!]),choice('language',AUDIO_LANGUAGE_VALUES),
    choice('voiceGender',AUDIO_VOICE_GENDER_VALUES),choice('voiceProfile',AUDIO_VOICE_PROFILE_VALUES),choice('voiceDelivery',AUDIO_VOICE_DELIVERY_VALUES),
    {key: 'script',type: 'text',required: true,values: null,min: null,max: null,default: null,maxChars: AUDIO_SCRIPT_MAX_LENGTH},
  ];
  if (normalized.voiceModel==='minimax') voice.push(choice('minimaxVoiceId',AUDIO_MINIMAX_VOICE_VALUES));
  else voice.push(choice('seedAudioVoice',AUDIO_SEED_AUDIO_VOICE_VALUES),choice('seedAudioOutputFormat',AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES),choice('seedAudioSampleRate',AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES));
  for (const key of ['seedAudioSpeed','seedAudioVolume','seedAudioPitch'] as const) voice.push({key,type: 'number',required: false,values: null,
    default: normalized[key],step: key==='seedAudioPitch' ? 1 : 10**-AUDIO_SEED_AUDIO_DECIMAL_PRECISION,...AUDIO_SEED_AUDIO_RANGE_CONSTRAINTS[key]});
  return voice;
}

function variantRequests(pack: AudioPackId): AudioGenerateRequestBody[] {
  const config = getAudioPackConfig(pack);
  const base: AudioGenerateRequestBody = { pack, prompt: 'Audio capability validation',
    ...(config.requiresMood ? { mood: 'dreamy' } : {}),
    ...(config.includesVoice ? { script: 'Audio capability validation' } : {}),
    ...(config.requiresVideo ? { sourceVideoUrl: 'owned-source-video', musicEnabled: false } : {}),
    ...(pack === 'song' ? { lyrics: 'Audio capability validation' } : {}),
    ...(['music_only', 'sfx_only', 'ambience_only'].includes(pack) ? { durationSec: 30 } : {}),
  };
  const voices = config.includesVoice ? [{ ...base, voiceModel: 'seed' as const }, { ...base, voiceModel: 'minimax' as const }] : [base];
  if (config.supportsMusicToggle) return voices.flatMap(voice => [{ ...voice, musicEnabled: false }, { ...voice, musicEnabled: true }]);
  if (pack === 'music_only') return [{ ...base, musicModel: 'clip' }, { ...base, musicModel: 'pro', durationSec: 60 }];
  return voices;
}

/** Projects the same packs, validation, configured providers and factual pricing models as web Audio. */
export function listAudioCapabilities(env: NodeJS.ProcessEnv = process.env) {
  const modes = AUDIO_PACK_VALUES.map(mode => {
    const config = getAudioPackConfig(mode);
    const variants = variantRequests(mode).map(body => {
      const normalized = validateAudioGenerateRequest(body);
      const durationSec = config.requiresVideo ? AUDIO_CINEMATIC_MAX_DURATION_SEC : normalized.durationSec ?? AUDIO_MIN_DURATION_SEC;
      const models = buildAudioVendorCostFacts({ ...normalized, durationSec }).components.map(component => ({ id: component.model, name: component.label }));
      let available = true;
      try {
        assertAudioProviderConfigured(normalized, env);
        for (const model of models) if (!model.id.startsWith('lyria-')) assertFalModelAllowed(model.id);
      } catch { available = false; }
      return { settings: { ...(config.includesVoice ? { voiceModel: normalized.voiceModel } : {}),
        ...(config.supportsMusicToggle ? { musicEnabled: normalized.musicEnabled } : {}),
        ...(mode === 'music_only' ? { musicModel: normalized.musicModel } : {}) },
        models, available, unavailableReason: available ? null : 'The configured provider route is currently unavailable.' };
    });
    return { mode, engineId: config.engineId, label: config.label, output: config.audioOnly ? 'audio' : 'video_or_both',
      available: variants.some(variant => variant.available), variants,
      prompt: { required: ['music_only', 'sfx_only', 'song', 'ambience_only', 'cinematic'].includes(mode), maxChars: AUDIO_PROMPT_MAX_LENGTH },
      narration: config.includesVoice ? { required: true, maxChars: AUDIO_SCRIPT_MAX_LENGTH } : null,
      lyrics: mode === 'song' ? { required: true, maxChars: AUDIO_LYRICS_MAX_LENGTH } : null,
      duration: mode === 'song' ? { source: 'generated_output' } : mode === 'voice_only' ? { source: 'narration' }
        : { source: config.requiresVideo ? 'source_video' : mode === 'music_only' ? 'requested_or_source_video' : 'requested',
          minSeconds: AUDIO_MIN_DURATION_SEC, maxSeconds: config.requiresVideo ? AUDIO_CINEMATIC_MAX_DURATION_SEC : mode === 'sfx_only' ? AUDIO_SFX_MAX_DURATION_SEC : AUDIO_MAX_DURATION_SEC,
          ...(mode === 'music_only' ? { clipSeconds: AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC, suggestedSeconds: AUDIO_MUSIC_DURATION_OPTIONS_SEC } : {}) },
      references: { sourceVideo: config.requiresVideo ? 'required' : mode === 'music_only' ? 'optional' : 'unsupported',
        voiceSample: config.includesVoice ? 'optional_seed_only' : 'unsupported', identity: 'owned_asset_or_exact_job_output' },
    };
  });
  const contract = { schemaVersion: 1, surface: 'audio', modes, quality: { standard: true, high: false },
    options: { minimaxVoices: AUDIO_MINIMAX_VOICE_VALUES, seedVoices: AUDIO_SEED_AUDIO_VOICE_VALUES, seedFormats: AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES,
      seedSampleRates: AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES, languages: AUDIO_LANGUAGE_VALUES, moods: AUDIO_MOOD_VALUES, musicBpm: AUDIO_LYRIA3_BPM_VALUES },
    confirmation: { required: true, prepareTool: 'prepare_audio_generation', confirmTool: 'confirm_audio_generation', automaticRetry: false },
    pricingPolicyRevision: AUDIO_PRICING_POLICY_REVISION };
  return { ...contract, revision: createHash('sha256').update(JSON.stringify(contract)).digest('hex') };
}

export function isAudioRunCapabilityAvailable(
  capabilities: ReturnType<typeof listAudioCapabilities>,
  run: ValidatedAudioGenerateRequest,
): boolean {
  const mode = capabilities.modes.find(candidate =>
    candidate.mode === run.pack && candidate.engineId === getAudioPackConfig(run.pack).engineId);
  return Boolean(mode?.variants.some(variant => variant.available
    && Object.entries(variant.settings).every(([key, value]) =>
      run[key as keyof ValidatedAudioGenerateRequest] === value)));
}
