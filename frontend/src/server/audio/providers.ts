import { getFalClient } from '@/lib/fal-client';
import { assertFalModelAllowed } from '@/lib/fal-model-policy';
import type {
  AudioIntensity,
  AudioLanguage,
  AudioMood,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';

export type AudioPipelineRole = 'soundDesign' | 'music' | 'tts' | 'voiceClone';

export type AudioProviderCandidate = {
  key: string;
  model: string;
  label: string;
};

export type AudioProviderResult = {
  url: string;
  providerKey: string;
  providerLabel: string;
  model: string;
  requestId?: string | null;
  customVoiceId?: string | null;
};

export type AudioProviderAttemptFailure = {
  providerKey: string;
  model: string;
  message: string;
};

export class AudioProviderError extends Error {
  role: AudioPipelineRole;
  failures: AudioProviderAttemptFailure[];

  constructor(role: AudioPipelineRole, failures: AudioProviderAttemptFailure[]) {
    super(`All providers failed for role "${role}".`);
    this.name = 'AudioProviderError';
    this.role = role;
    this.failures = failures;
  }
}

const AUDIO_PROVIDER_ROSTER: Record<AudioPipelineRole, AudioProviderCandidate[]> = {
  soundDesign: [
    {
      key: 'mirelo_sfx_v1_5',
      label: 'Mirelo SFX V1.5',
      model: 'mirelo-ai/sfx-v1.5/video-to-audio',
    },
    {
      key: 'thinksound',
      label: 'ThinkSound',
      model: 'fal-ai/thinksound/audio',
    },
  ],
  music: [
    {
      key: 'google_lyria2',
      label: 'Google Lyria 2',
      model: 'fal-ai/lyria2',
    },
  ],
  tts: [
    {
      key: 'minimax_speech_2_8_hd',
      label: 'MiniMax Speech 2.8 HD',
      model: 'fal-ai/minimax/speech-2.8-hd',
    },
    {
      key: 'minimax_speech_02_hd',
      label: 'MiniMax Speech-02 HD',
      model: 'fal-ai/minimax/speech-02-hd',
    },
  ],
  voiceClone: [
    {
      key: 'minimax_voice_clone',
      label: 'MiniMax Voice Clone',
      model: 'fal-ai/minimax/voice-clone',
    },
  ],
};

const ENABLE_AUDIO_PROVIDER_FALLBACK = false;

const AUDIO_PROVIDER_TIMEOUT_MS: Record<AudioPipelineRole, number> = {
  soundDesign: 180_000,
  music: 120_000,
  tts: 90_000,
  voiceClone: 120_000,
};

function normalizeObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeLanguageBoost(locale?: string | null): string {
  const normalized = (locale ?? '').trim().toLowerCase();
  if (normalized.startsWith('fr')) return 'French';
  if (normalized.startsWith('es')) return 'Spanish';
  if (normalized.startsWith('de')) return 'German';
  if (normalized.startsWith('it')) return 'Italian';
  if (normalized.startsWith('pt')) return 'Portuguese';
  if (normalized.startsWith('ja')) return 'Japanese';
  if (normalized.startsWith('ko')) return 'Korean';
  return 'English';
}

function resolveLanguageBoost(language?: AudioLanguage | null, locale?: string | null): string {
  switch (language) {
    case 'english':
      return 'English';
    case 'french':
      return 'French';
    case 'spanish':
      return 'Spanish';
    case 'german':
      return 'German';
    case 'auto':
    case null:
    case undefined:
      return normalizeLanguageBoost(locale);
    default:
      return normalizeLanguageBoost(locale);
  }
}

function buildVoiceSetting(input: {
  voiceId?: string | null;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Record<string, unknown> {
  const profilePitch: Record<AudioVoiceProfile, number> = {
    balanced: 0,
    warm: -1,
    bright: 2,
    deep: -3,
  };
  const deliverySpeed: Record<AudioVoiceDelivery, number> = {
    natural: 1.0,
    cinematic: 0.96,
    trailer: 0.92,
    intimate: 0.95,
  };
  const genderPitchOffset: Record<AudioVoiceGender, number> = {
    female: 1,
    male: -3,
    neutral: 0,
  };

  return {
    ...(input.voiceId ? { voice_id: input.voiceId } : {}),
    speed: deliverySpeed[input.voiceDelivery],
    pitch: profilePitch[input.voiceProfile] + genderPitchOffset[input.voiceGender],
    emotion: 'neutral',
  };
}

function buildVoiceModify(input: {
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Record<string, unknown> {
  const profileTimbre: Record<AudioVoiceProfile, number> = {
    balanced: 0,
    warm: 14,
    bright: 22,
    deep: -28,
  };
  const deliveryIntensity: Record<AudioVoiceDelivery, number> = {
    natural: 0,
    cinematic: 12,
    trailer: 30,
    intimate: -10,
  };
  const genderTimbreOffset: Record<AudioVoiceGender, number> = {
    female: 8,
    male: -12,
    neutral: 0,
  };

  return {
    intensity: deliveryIntensity[input.voiceDelivery],
    timbre: profileTimbre[input.voiceProfile] + genderTimbreOffset[input.voiceGender],
    pitch: 0,
  };
}

function resolveStandardVoiceId(input: {
  providerKey: string;
  voiceGender: AudioVoiceGender;
}): string | undefined {
  if (input.providerKey === 'minimax_speech_02_hd' && input.voiceGender === 'female') {
    return 'Wise_Woman';
  }
  return undefined;
}

function findFileUrl(value: unknown, kind: 'audio' | 'video'): string | null {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();
  const extensionPattern =
    kind === 'audio'
      ? /\.(wav|mp3|m4a|aac|ogg|flac)(\?|$)/i
      : /\.(mp4|mov|webm|m4v)(\?|$)/i;

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (typeof current === 'string') {
      if (/^https?:\/\//i.test(current) && extensionPattern.test(current)) {
        return current;
      }
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => queue.push(entry));
      continue;
    }

    if (typeof current !== 'object') continue;
    const record = current as Record<string, unknown>;
    const keyed =
      kind === 'audio'
        ? [record.audio, record.audio_url, record.audioUrl]
        : [record.video, record.video_url, record.videoUrl];
    for (const candidate of keyed) {
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) {
        return candidate;
      }
      const nested = normalizeObject(candidate);
      if (nested && typeof nested.url === 'string' && /^https?:\/\//i.test(nested.url)) {
        return nested.url;
      }
    }

    for (const entry of Object.values(record)) {
      queue.push(entry);
    }
  }

  return null;
}

function findCustomVoiceId(value: unknown): string | null {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((entry) => queue.push(entry));
      continue;
    }
    const record = normalizeObject(current);
    if (!record) continue;
    const customVoiceId = record.custom_voice_id;
    if (typeof customVoiceId === 'string' && customVoiceId.trim().length) {
      return customVoiceId.trim();
    }
    const voiceId = record.voice_id;
    if (typeof voiceId === 'string' && voiceId.trim().length) {
      return voiceId.trim();
    }
    Object.values(record).forEach((entry) => queue.push(entry));
  }

  return null;
}

async function subscribeFalModel(model: string, input: Record<string, unknown>) {
  assertFalModelAllowed(model);
  const falClient = getFalClient();
  return falClient.subscribe(model, {
    input,
    mode: 'polling',
  });
}

async function subscribeWithTimeout(
  role: AudioPipelineRole,
  model: string,
  input: Record<string, unknown>,
  subscribe: (model: string, input: Record<string, unknown>) => Promise<{ data: unknown; requestId?: string | null }>,
  timeoutOverrideMs?: number
) {
  const timeoutMs = timeoutOverrideMs ?? AUDIO_PROVIDER_TIMEOUT_MS[role];
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      subscribe(model, input),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Provider timed out after ${Math.round(timeoutMs / 1000)}s.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function getAudioProviderRoster(role: AudioPipelineRole): AudioProviderCandidate[] {
  return AUDIO_PROVIDER_ROSTER[role].map((candidate) => ({ ...candidate }));
}

export async function runAudioRoleWithFallback(
  role: AudioPipelineRole,
  builder: (candidate: AudioProviderCandidate) => Record<string, unknown>,
  options?: {
    subscribe?: (model: string, input: Record<string, unknown>) => Promise<{ data: unknown; requestId?: string | null }>;
    timeoutMs?: number;
  }
): Promise<AudioProviderResult> {
  const failures: AudioProviderAttemptFailure[] = [];
  const subscribe = options?.subscribe ?? subscribeFalModel;
  const candidates = ENABLE_AUDIO_PROVIDER_FALLBACK
    ? AUDIO_PROVIDER_ROSTER[role]
    : AUDIO_PROVIDER_ROSTER[role].slice(0, 1);

  for (const candidate of candidates) {
    try {
      const result = await subscribeWithTimeout(role, candidate.model, builder(candidate), subscribe, options?.timeoutMs);
      const audioUrl = findFileUrl(result.data, 'audio');
      const customVoiceId = findCustomVoiceId(result.data);
      if (!audioUrl && role !== 'voiceClone') {
        throw new Error('Provider returned no audio URL.');
      }
      if (!audioUrl && !customVoiceId) {
        throw new Error('Voice clone provider returned no audio preview or custom voice id.');
      }
      return {
        url: audioUrl ?? '',
        providerKey: candidate.key,
        providerLabel: candidate.label,
        model: candidate.model,
        requestId: result.requestId ?? null,
        customVoiceId,
      };
    } catch (error) {
      failures.push({
        providerKey: candidate.key,
        model: candidate.model,
        message: error instanceof Error ? error.message : 'Unknown provider failure',
      });
    }
  }

  throw new AudioProviderError(role, failures);
}

async function renderCustomVoiceTrackFromVoiceId(input: {
  script: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  customVoiceId: string;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Promise<AudioProviderResult> {
  const result = await subscribeFalModel('fal-ai/minimax/speech-02-hd', {
    prompt: input.script,
    output_format: 'url',
    language_boost: resolveLanguageBoost(input.language, input.locale),
    voice_setting: buildVoiceSetting({
      voiceId: input.customVoiceId,
      voiceGender: input.voiceGender,
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
    voice_modify: buildVoiceModify({
      voiceGender: input.voiceGender,
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
  });
  const audioUrl = findFileUrl(result.data, 'audio');
  if (!audioUrl) {
    throw new Error('Custom voice rendering returned no audio URL.');
  }
  return {
    url: audioUrl,
    providerKey: 'minimax_custom_voice_render',
    providerLabel: 'MiniMax Custom Voice Render',
    model: 'fal-ai/minimax/speech-02-hd',
    requestId: result.requestId ?? null,
    customVoiceId: input.customVoiceId,
  };
}

function buildSoundDesignPrompt(mood: AudioMood, intensity: AudioIntensity): string {
  const intensitySuffix =
    intensity === 'subtle'
      ? 'Keep the layer restrained, realistic, and never oversized.'
      : intensity === 'intense'
        ? 'Push detail, movement, and impact harder while staying polished.'
        : 'Keep it cinematic, supportive, and balanced.';
  switch (mood) {
    case 'epic':
      return `Layer rich cinematic impacts, movement details, atmosphere, and subtle low-end energy. ${intensitySuffix}`;
    case 'tense':
      return `Build suspense with restrained tension, environment detail, and realistic transient accents. ${intensitySuffix}`;
    case 'intimate':
      return `Keep the scene close, realistic, and tactile with subtle ambience and detailed micro-sounds. ${intensitySuffix}`;
    case 'dark':
      return `Use ominous ambience, textured tails, and grounded cinematic effects with restraint. ${intensitySuffix}`;
    case 'dreamy':
      return `Add airy ambience, soft movement textures, and delicate cinematic detail. ${intensitySuffix}`;
    case 'sci-fi':
      return `Blend futuristic textures, clean impacts, and immersive environment design without becoming noisy. ${intensitySuffix}`;
    case 'documentary':
      return `Stay naturalistic, grounded, and unobtrusive with realistic ambience and clean spot effects. ${intensitySuffix}`;
  }
}

function buildMusicPrompt(mood: AudioMood, intensity: AudioIntensity): string {
  const intensitySuffix =
    intensity === 'subtle'
      ? 'Keep it very restrained and editorially supportive.'
      : intensity === 'intense'
        ? 'Lean fuller, wider, and more emotionally forward without overpowering.'
        : 'Keep it subtle, supportive, and cinematic.';
  switch (mood) {
    case 'epic':
      return `Subtle cinematic underscore, emotional lift, modern trailer-adjacent texture, never overpowering. ${intensitySuffix}`;
    case 'tense':
      return `Minimal tension underscore with pulsing energy, sparse instrumentation, and cinematic restraint. ${intensitySuffix}`;
    case 'intimate':
      return `Warm intimate score with light ambient instrumentation and understated emotion. ${intensitySuffix}`;
    case 'dark':
      return `Dark cinematic ambient score, restrained, textured, and moody. ${intensitySuffix}`;
    case 'dreamy':
      return `Dreamy ambient score with soft cinematic pads and delicate melodic movement. ${intensitySuffix}`;
    case 'sci-fi':
      return `Sci-fi ambient underscore with sleek futuristic textures and subtle propulsion. ${intensitySuffix}`;
    case 'documentary':
      return `Documentary-style ambient score, natural, understated, and editorially supportive. ${intensitySuffix}`;
  }
}

export async function generateSoundDesignTrack(input: {
  sourceVideoUrl: string;
  durationSec: number;
  mood: AudioMood;
  intensity: AudioIntensity;
}): Promise<AudioProviderResult> {
  return runAudioRoleWithFallback('soundDesign', (candidate) => {
    if (candidate.key === 'mirelo_sfx_v1_5') {
      return {
        video_url: input.sourceVideoUrl,
        text_prompt: buildSoundDesignPrompt(input.mood, input.intensity),
        duration: input.durationSec,
        num_samples: 2,
      };
    }
    return {
      video_url: input.sourceVideoUrl,
      prompt: buildSoundDesignPrompt(input.mood, input.intensity),
      duration: input.durationSec,
    };
  });
}

export async function generateMusicTrack(input: {
  durationSec: number;
  mood: AudioMood;
  intensity: AudioIntensity;
}): Promise<AudioProviderResult> {
  return runAudioRoleWithFallback('music', (candidate) => {
    if (candidate.key === 'google_lyria2') {
      return {
        prompt: `${buildMusicPrompt(input.mood, input.intensity)} Instrumental only. Keep the score cinematic and non-vocal.`,
        negative_prompt: 'vocals, singing, speech, dialogue, harsh percussion, distortion, clipping',
      };
    }
    return {
      prompt: buildMusicPrompt(input.mood, input.intensity),
      negative_prompt: 'vocals, dominant lead melody, harsh percussion, distortion, clipping',
      duration: input.durationSec,
      refinement: input.intensity === 'intense' ? 72 : input.intensity === 'subtle' ? 84 : 80,
      creativity: input.intensity === 'intense' ? 18 : input.intensity === 'subtle' ? 8 : 12,
    };
  });
}

export async function generateStandardVoiceTrack(input: {
  script: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Promise<AudioProviderResult> {
  return runAudioRoleWithFallback('tts', (candidate) => {
    return {
      prompt: input.script,
      output_format: 'url',
      language_boost: resolveLanguageBoost(input.language, input.locale),
      voice_setting: buildVoiceSetting({
        voiceId: resolveStandardVoiceId({
          providerKey: candidate.key,
          voiceGender: input.voiceGender,
        }),
        voiceGender: input.voiceGender,
        voiceProfile: input.voiceProfile,
        voiceDelivery: input.voiceDelivery,
      }),
      voice_modify: buildVoiceModify({
        voiceGender: input.voiceGender,
        voiceProfile: input.voiceProfile,
        voiceDelivery: input.voiceDelivery,
      }),
    };
  });
}

export async function generateClonedVoiceTrack(input: {
  script: string;
  voiceSampleUrl: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Promise<AudioProviderResult> {
  const cloned = await runAudioRoleWithFallback('voiceClone', () => ({
    audio_url: input.voiceSampleUrl,
    prompt: input.script,
    output_format: 'url',
    language_boost: resolveLanguageBoost(input.language, input.locale),
    model: 'speech-02-hd',
    voice_setting: buildVoiceSetting({
      voiceGender: 'neutral',
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
    voice_modify: buildVoiceModify({
      voiceGender: 'neutral',
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
  }));
  if (cloned.url) {
    return cloned;
  }
  if (cloned.customVoiceId) {
    return renderCustomVoiceTrackFromVoiceId({
      script: input.script,
      locale: input.locale,
      language: input.language,
      customVoiceId: cloned.customVoiceId,
      voiceGender: 'neutral',
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    });
  }
  throw new Error('Voice clone provider returned no usable output.');
}
