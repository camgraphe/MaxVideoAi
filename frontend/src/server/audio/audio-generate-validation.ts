import {
  AUDIO_MAX_DURATION_SEC,
  AUDIO_MIN_DURATION_SEC,
  AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SCRIPT_MAX_LENGTH,
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioMood,
  coerceAudioPackId,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  estimateVoiceScriptDurationSec,
  formatAudioDurationLabel,
  getAudioPackConfig,
  resolveAudioOutputKind,
  resolveAudioVoiceMode,
  type AudioGenerateRequestBody,
  type AudioIntensity,
  type AudioLanguage,
  type AudioMood,
  type AudioOutputKind,
  type AudioPackId,
  type AudioVoiceDelivery,
  type AudioVoiceGender,
  type AudioVoiceMode,
  type AudioVoiceProfile,
} from '@/lib/audio-generation';

type NormalizedAudioGenerateInput = {
  sourceVideoUrl: string | null;
  sourceJobId: string | null;
  pack: AudioPackId;
  prompt: string | null;
  mood: AudioMood | null;
  intensity: AudioIntensity;
  script: string | null;
  voiceSampleUrl: string | null;
  voiceGender: AudioVoiceGender | null;
  voiceProfile: AudioVoiceProfile | null;
  voiceDelivery: AudioVoiceDelivery | null;
  language: AudioLanguage | null;
  durationSec: number | null;
  musicEnabled: boolean;
  exportAudioFile: boolean;
  locale: string | null;
  voiceMode: AudioVoiceMode | null;
  outputKind: AudioOutputKind;
};

export type ValidatedAudioGenerateRequest = NormalizedAudioGenerateInput;

type AudioGenerationErrorOptions = {
  status?: number;
  code?: string;
  field?: string;
  providerFailures?: Array<{ providerKey: string; model: string; message: string }>;
};

export class AudioGenerationError extends Error {
  status: number;
  code: string;
  field?: string;
  providerFailures?: Array<{ providerKey: string; model: string; message: string }>;

  constructor(message: string, options: AudioGenerationErrorOptions = {}) {
    super(message);
    this.name = 'AudioGenerationError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'audio_generation_failed';
    this.field = options.field;
    this.providerFailures = options.providerFailures;
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeOptionalInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

function validateTextLength(value: string | null, maxLength: number, field: string, label: string): void {
  if (value && value.length > maxLength) {
    throw new AudioGenerationError(`${label} must be ${maxLength} characters or fewer.`, {
      status: 400,
      code: `${field}_too_long`,
      field,
    });
  }
}

function validateAudioDurationInRange(
  durationSec: number,
  options: { field: string; code: string; label: string }
): number {
  if (!Number.isFinite(durationSec) || durationSec < AUDIO_MIN_DURATION_SEC || durationSec > AUDIO_MAX_DURATION_SEC) {
    throw new AudioGenerationError(
      `${options.label} must be between ${formatAudioDurationLabel(AUDIO_MIN_DURATION_SEC)} and ${formatAudioDurationLabel(AUDIO_MAX_DURATION_SEC)}.`,
      {
        status: 400,
        code: options.code,
        field: options.field,
      }
    );
  }
  return Math.round(durationSec);
}

export function validateAudioGenerateRequest(body: AudioGenerateRequestBody): ValidatedAudioGenerateRequest {
  const pack = coerceAudioPackId(body.pack);
  if (!pack) {
    throw new AudioGenerationError('Audio mode is required.', {
      status: 400,
      code: 'audio_pack_required',
      field: 'pack',
    });
  }

  const packConfig = getAudioPackConfig(pack);
  const prompt = normalizeString(body.prompt);
  validateTextLength(prompt, AUDIO_PROMPT_MAX_LENGTH, 'prompt', 'Audio prompt');

  const sourceVideoUrl = normalizeString(body.sourceVideoUrl);
  const sourceJobId = normalizeString(body.sourceJobId);
  if (packConfig.requiresVideo && !sourceVideoUrl && !sourceJobId) {
    throw new AudioGenerationError('A source video is required.', {
      status: 400,
      code: 'source_video_required',
      field: 'sourceVideoUrl',
    });
  }
  if ((pack === 'music_only' || pack === 'cinematic') && !prompt) {
    throw new AudioGenerationError('An audio prompt is required for this mode.', {
      status: 400,
      code: 'audio_prompt_required',
      field: 'prompt',
    });
  }

  const moodValue = normalizeString(body.mood);
  const mood = moodValue ? coerceAudioMood(moodValue) : null;
  if (packConfig.requiresMood && !mood) {
    throw new AudioGenerationError('Audio mood is required.', {
      status: 400,
      code: 'audio_mood_required',
      field: 'mood',
    });
  }
  if (moodValue && !mood) {
    throw new AudioGenerationError('Audio mood is invalid.', {
      status: 400,
      code: 'audio_mood_invalid',
      field: 'mood',
    });
  }

  const intensityValue = normalizeString(body.intensity);
  const intensity = intensityValue ? coerceAudioIntensity(intensityValue) : 'standard';
  if (intensityValue && !intensity) {
    throw new AudioGenerationError('Intensity is invalid.', {
      status: 400,
      code: 'audio_intensity_invalid',
      field: 'intensity',
    });
  }

  const script = normalizeString(body.script);
  validateTextLength(script, AUDIO_SCRIPT_MAX_LENGTH, 'script', 'Narration script');
  if (packConfig.requiresScript && !script) {
    throw new AudioGenerationError('A narration script is required for this mode.', {
      status: 400,
      code: 'audio_script_required',
      field: 'script',
    });
  }

  const voiceSampleUrl = normalizeString(body.voiceSampleUrl);
  if (voiceSampleUrl && !packConfig.includesVoice) {
    throw new AudioGenerationError('Voice samples are only supported on voice modes.', {
      status: 400,
      code: 'voice_sample_not_supported',
      field: 'voiceSampleUrl',
    });
  }

  const voiceGenderValue = normalizeString(body.voiceGender);
  const voiceGender = voiceGenderValue ? coerceAudioVoiceGender(voiceGenderValue) : packConfig.includesVoice ? 'female' : null;
  if (voiceGenderValue && !voiceGender) {
    throw new AudioGenerationError('Voice type is invalid.', {
      status: 400,
      code: 'audio_voice_gender_invalid',
      field: 'voiceGender',
    });
  }
  if (!packConfig.includesVoice && voiceGenderValue) {
    throw new AudioGenerationError('Voice type is only supported on voice modes.', {
      status: 400,
      code: 'audio_voice_gender_not_supported',
      field: 'voiceGender',
    });
  }

  const voiceProfileValue = normalizeString(body.voiceProfile);
  const voiceProfile = voiceProfileValue ? coerceAudioVoiceProfile(voiceProfileValue) : packConfig.includesVoice ? 'balanced' : null;
  if (voiceProfileValue && !voiceProfile) {
    throw new AudioGenerationError('Voice option is invalid.', {
      status: 400,
      code: 'audio_voice_profile_invalid',
      field: 'voiceProfile',
    });
  }
  if (!packConfig.includesVoice && voiceProfileValue) {
    throw new AudioGenerationError('Voice options are only supported on voice modes.', {
      status: 400,
      code: 'audio_voice_profile_not_supported',
      field: 'voiceProfile',
    });
  }

  const voiceDeliveryValue = normalizeString(body.voiceDelivery);
  const voiceDelivery = voiceDeliveryValue
    ? coerceAudioVoiceDelivery(voiceDeliveryValue)
    : packConfig.includesVoice
      ? 'cinematic'
      : null;
  if (voiceDeliveryValue && !voiceDelivery) {
    throw new AudioGenerationError('Voice delivery is invalid.', {
      status: 400,
      code: 'audio_voice_delivery_invalid',
      field: 'voiceDelivery',
    });
  }
  if (!packConfig.includesVoice && voiceDeliveryValue) {
    throw new AudioGenerationError('Voice delivery is only supported on voice modes.', {
      status: 400,
      code: 'audio_voice_delivery_not_supported',
      field: 'voiceDelivery',
    });
  }

  const languageValue = normalizeString(body.language);
  const language = languageValue ? coerceAudioLanguage(languageValue) : packConfig.includesVoice ? 'auto' : null;
  if (languageValue && !language) {
    throw new AudioGenerationError('Voice language is invalid.', {
      status: 400,
      code: 'audio_language_invalid',
      field: 'language',
    });
  }
  if (!packConfig.includesVoice && languageValue) {
    throw new AudioGenerationError('Voice language is only supported on voice modes.', {
      status: 400,
      code: 'audio_language_not_supported',
      field: 'language',
    });
  }

  const musicEnabledInput = normalizeOptionalBoolean(body.musicEnabled);
  if (!packConfig.supportsMusicToggle && musicEnabledInput !== null) {
    throw new AudioGenerationError('Music toggle is not supported for this mode.', {
      status: 400,
      code: 'music_toggle_not_supported',
      field: 'musicEnabled',
    });
  }
  const exportAudioFileInput = normalizeOptionalBoolean(body.exportAudioFile);
  if (!packConfig.supportsAudioExport && exportAudioFileInput !== null) {
    throw new AudioGenerationError('Audio export is not supported for this mode.', {
      status: 400,
      code: 'audio_export_not_supported',
      field: 'exportAudioFile',
    });
  }

  const durationInput = normalizeOptionalInteger(body.durationSec);
  const requestedDurationSec =
    durationInput == null
      ? null
      : validateAudioDurationInRange(durationInput, {
          field: 'durationSec',
          code: 'audio_duration_invalid',
          label: 'Duration',
        });
  if (pack === 'music_only' && !sourceVideoUrl && !sourceJobId && durationInput == null) {
    throw new AudioGenerationError('Duration is required when generating music without a video.', {
      status: 400,
      code: 'audio_duration_required',
      field: 'durationSec',
    });
  }

  const locale = normalizeString(body.locale);

  return {
    sourceVideoUrl,
    sourceJobId,
    pack,
    prompt,
    mood,
    intensity: intensity ?? 'standard',
    script,
    voiceSampleUrl,
    voiceGender,
    voiceProfile,
    voiceDelivery,
    language,
    durationSec: requestedDurationSec,
    musicEnabled: packConfig.supportsMusicToggle ? musicEnabledInput ?? packConfig.defaultMusicEnabled : false,
    exportAudioFile: packConfig.supportsAudioExport ? exportAudioFileInput ?? false : false,
    locale,
    voiceMode: resolveAudioVoiceMode({ pack, voiceSampleUrl }),
    outputKind: resolveAudioOutputKind({ pack, exportAudioFile: packConfig.supportsAudioExport ? exportAudioFileInput ?? false : false }),
  };
}

export function resolveAudioRenderDuration(params: {
  pack: AudioPackId;
  sourceVideoUrl: string | null;
  requiresVideo: boolean;
  probedDurationSec: number | null;
  requestedDurationSec: number | null;
  script: string | null;
}): number {
  if (params.requiresVideo) {
    if (!params.probedDurationSec) {
      throw new AudioGenerationError('Unable to inspect the source video duration.', {
        status: 422,
        code: 'source_video_probe_failed',
        field: 'sourceVideoUrl',
      });
    }
    validateAudioDurationInRange(params.probedDurationSec, {
      field: 'sourceVideoUrl',
      code: 'source_video_duration_invalid',
      label: 'Source video',
    });
  } else if (params.sourceVideoUrl && params.probedDurationSec) {
    validateAudioDurationInRange(params.probedDurationSec, {
      field: 'sourceVideoUrl',
      code: 'source_video_duration_invalid',
      label: 'Source video',
    });
  }

  if (params.pack === 'voice_only') {
    return estimateVoiceScriptDurationSec(params.script ?? '');
  }

  if (params.pack === 'music_only') {
    return validateAudioDurationInRange(params.probedDurationSec ?? params.requestedDurationSec ?? AUDIO_MIN_DURATION_SEC, {
      field: 'durationSec',
      code: 'audio_duration_invalid',
      label: 'Duration',
    });
  }

  return validateAudioDurationInRange(params.probedDurationSec ?? AUDIO_MIN_DURATION_SEC, {
    field: 'sourceVideoUrl',
    code: 'source_video_duration_invalid',
    label: 'Source video',
  });
}
