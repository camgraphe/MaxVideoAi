import type {
  AudioLanguage,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';

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

export function resolveLanguageBoost(language?: AudioLanguage | null, locale?: string | null): string {
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

export function resolveGeminiLanguageCode(language?: AudioLanguage | null, locale?: string | null): string | undefined {
  switch (language) {
    case 'english':
      return 'English (US)';
    case 'french':
      return 'French (France)';
    case 'spanish':
      return 'Spanish (Spain)';
    case 'german':
      return 'German (Germany)';
    case 'auto':
    case null:
    case undefined: {
      const normalized = (locale ?? '').trim().toLowerCase();
      if (normalized.startsWith('fr')) return 'French (France)';
      if (normalized.startsWith('es')) return 'Spanish (Spain)';
      if (normalized.startsWith('de')) return 'German (Germany)';
      return undefined;
    }
    default:
      return undefined;
  }
}

export function resolveGeminiVoice(input: {
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
}): string {
  if (input.voiceGender === 'male') {
    if (input.voiceProfile === 'bright') return 'Puck';
    if (input.voiceProfile === 'deep') return 'Charon';
    return 'Orus';
  }
  if (input.voiceGender === 'neutral') {
    if (input.voiceProfile === 'warm') return 'Aoede';
    if (input.voiceProfile === 'deep') return 'Enceladus';
    return 'Zephyr';
  }
  if (input.voiceProfile === 'warm') return 'Aoede';
  if (input.voiceProfile === 'bright') return 'Zephyr';
  if (input.voiceProfile === 'deep') return 'Kore';
  return 'Kore';
}

export function buildGeminiStyleInstructions(input: {
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): string {
  const profileInstruction: Record<AudioVoiceProfile, string> = {
    balanced: 'Use a clear, polished, natural voice.',
    warm: 'Use a warm, reassuring, close-mic voice.',
    bright: 'Use a bright, articulate, energetic voice.',
    deep: 'Use a deeper, authoritative, grounded voice.',
  };
  const deliveryInstruction: Record<AudioVoiceDelivery, string> = {
    natural: 'Read conversationally with natural pacing.',
    cinematic: 'Read with cinematic pacing and controlled emotion.',
    trailer: 'Read like a premium trailer voice-over with deliberate pauses.',
    intimate: 'Read softly and intimately with subtle pauses.',
  };
  return `${profileInstruction[input.voiceProfile]} ${deliveryInstruction[input.voiceDelivery]}`;
}

export function buildVoiceSetting(input: {
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

export function buildVoiceModify(input: {
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

export function resolveStandardVoiceId(input: {
  providerKey: string;
  voiceGender: AudioVoiceGender;
}): string | undefined {
  if (input.providerKey === 'minimax_speech_02_hd' && input.voiceGender === 'female') {
    return 'Wise_Woman';
  }
  return undefined;
}
