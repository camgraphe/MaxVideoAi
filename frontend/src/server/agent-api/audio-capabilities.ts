import { createHash } from 'node:crypto';
import {
  AUDIO_MINIMAX_VOICE_VALUES, AUDIO_PACK_VALUES, AUDIO_MIN_DURATION_SEC, AUDIO_MAX_DURATION_SEC, AUDIO_SFX_MAX_DURATION_SEC,
  AUDIO_CINEMATIC_MAX_DURATION_SEC, AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC, AUDIO_MUSIC_DURATION_OPTIONS_SEC,
  AUDIO_SCRIPT_MAX_LENGTH, AUDIO_LYRICS_MAX_LENGTH, AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SEED_AUDIO_VOICE_VALUES, AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES, AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES,
  AUDIO_MOOD_VALUES, AUDIO_LYRIA3_BPM_VALUES, AUDIO_LANGUAGE_VALUES,
  buildAudioVendorCostFacts, getAudioPackConfig, type AudioPackId, type AudioGenerateRequestBody,
} from '@/lib/audio-generation';
import { assertAudioProviderConfigured } from '@/server/audio/prepare-audio';
import { validateAudioGenerateRequest } from '@/server/audio/audio-generate-validation';
import { assertFalModelAllowed } from '@/lib/fal-model-policy';
import { AUDIO_PRICING_POLICY_REVISION } from '@/lib/audio-pricing-policy';
import type { ValidatedAudioGenerateRequest } from '@/server/audio/audio-generate-validation';

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
