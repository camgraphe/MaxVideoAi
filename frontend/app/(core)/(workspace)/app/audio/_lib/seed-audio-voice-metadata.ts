import {
  AUDIO_SEED_AUDIO_VOICE_VALUES,
  type AudioSeedAudioVoice,
} from '@/lib/audio-generation';

export type SeedAudioVoiceLanguage = {
  code: string;
  flag: string;
  label: string;
};

export type SeedAudioVoiceOption = {
  value: AudioSeedAudioVoice;
  name: string;
  mixed: boolean;
  mixedTooltip: string;
  languages: SeedAudioVoiceLanguage[];
  sampleUrl: string | null;
};

export const SEED_AUDIO_VOICE_SAMPLE_TEXT =
  'In the silence before the camera moves, a hidden journey begins, and every frame carries the weight of a choice.';

export const SEED_AUDIO_VOICE_SAMPLE_GENERATION_SETTINGS = {
  outputFormat: 'mp3',
  sampleRate: 24000,
  speed: 1,
  volume: 1,
  pitch: 0,
  styleInstruction:
    'Confidential fiction narrator voice-over. Close to the microphone, intimate and restrained, as if sharing a secret with one listener. Use short natural pauses and small breaths; avoid long dramatic silences. Keep the pace conversational and unhurried but not slow. Suspenseful, not loud. No trailer announcer. Do not read punctuation aloud.',
} as const;

const SEED_AUDIO_LANGUAGE_META: Record<string, SeedAudioVoiceLanguage> = {
  en: { code: 'en', flag: '🇺🇸', label: 'English' },
  es: { code: 'es', flag: '🇪🇸', label: 'Spanish' },
  id: { code: 'id', flag: '🇮🇩', label: 'Indonesian' },
  ja: { code: 'ja', flag: '🇯🇵', label: 'Japanese' },
  pt: { code: 'pt', flag: '🇵🇹', label: 'Portuguese' },
  zh: { code: 'zh', flag: '🇨🇳', label: 'Chinese' },
};

export const SEED_AUDIO_VOICE_SAMPLE_URLS = Object.fromEntries(
  AUDIO_SEED_AUDIO_VOICE_VALUES.map((voice) => [voice, `/assets/audio/seed-audio/${voice}.mp3`])
) as Record<AudioSeedAudioVoice, string>;

export function getSeedAudioVoiceSampleUrl(voice: AudioSeedAudioVoice): string | null {
  if (voice === 'default') return null;
  return SEED_AUDIO_VOICE_SAMPLE_URLS[voice] ?? null;
}

function getSeedAudioVoiceLanguageCodes(voice: AudioSeedAudioVoice): string[] {
  if (voice === 'default') return [];
  const tokens = voice.split('_');
  return Object.keys(SEED_AUDIO_LANGUAGE_META).filter((code) => tokens.includes(code));
}

export function buildSeedAudioVoiceOption(
  voice: AudioSeedAudioVoice,
  label: string
): SeedAudioVoiceOption {
  const name = label.split(' - ')[0]?.trim() || voice.split('_')[0] || voice;
  const mixed = voice.split('_').includes('mixed');
  return {
    value: voice,
    name,
    mixed,
    mixedTooltip: mixed
      ? 'Mixed voices blend multiple language/tone characteristics in one preset.'
      : '',
    languages: getSeedAudioVoiceLanguageCodes(voice).map((code) => SEED_AUDIO_LANGUAGE_META[code]!),
    sampleUrl: getSeedAudioVoiceSampleUrl(voice),
  };
}

function formatLanguageList(languages: SeedAudioVoiceLanguage[]): string {
  const labels = languages.map((language) => language.label);
  if (!labels.length) return 'the provider default voice';
  if (labels.length === 1) return labels[0] ?? 'English';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export function buildSeedAudioVoiceSampleScript(option: SeedAudioVoiceOption): string {
  const languages = formatLanguageList(option.languages);
  return [
    `I'm ${option.name} - I can perform in ${languages}.`,
    'The store is quiet now.',
    'The lights hum above the empty aisles.',
    'I lean closer and tell you what happened next, like a secret the night kept too long.',
  ].join(' ');
}

export function buildSeedAudioVoiceSamplePrompt(option: SeedAudioVoiceOption): string {
  return [
    'Guidance:',
    SEED_AUDIO_VOICE_SAMPLE_GENERATION_SETTINGS.styleInstruction,
    '',
    'Text:',
    buildSeedAudioVoiceSampleScript(option),
  ].join('\n');
}
