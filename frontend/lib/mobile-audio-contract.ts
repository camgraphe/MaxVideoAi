import type { GenerationJob, GenerationQuote, SettingValue } from './mobile-generation-contract';

export const audioModeIds = [
  'voice_only',
  'music_only',
  'sfx_only',
  'ambience_only',
  'song',
  'cinematic',
  'cinematic_voice',
] as const;
export type AudioModeId = (typeof audioModeIds)[number];
export function isMobileAudioMode(mode: string): mode is AudioModeId {
  return audioModeIds.some((id) => id === mode);
}

export interface MobileAudioControl {
  key: string;
  type: 'text' | 'enum' | 'number';
  required: boolean;
  values: readonly SettingValue[] | null;
  min: number | null;
  max: number | null;
  default: SettingValue | null;
  integer?: boolean;
  step?: number;
  maxChars?: number;
}
export interface MobileAudioVariant {
  settings: Record<string, string | boolean>;
  available: boolean;
  controls: MobileAudioControl[];
}
interface TextInputRule {
  required: boolean;
  maxChars: number;
}
export interface MobileAudioMode {
  mode: AudioModeId;
  engineId: string;
  label: string;
  available: boolean;
  prompt: TextInputRule;
  narration: TextInputRule | null;
  lyrics: TextInputRule | null;
  duration: {
    source: string;
    minSeconds?: number;
    maxSeconds?: number;
    clipSeconds?: number;
    suggestedSeconds?: readonly number[];
  };
  references?: { sourceVideo: 'required' | 'optional' | 'unsupported'; voiceSample: 'optional_seed_only' | 'unsupported' };
  variants: MobileAudioVariant[];
}
export interface MobileAudioCatalog {
  modes: MobileAudioMode[];
  options: {
    elevenVoices: {
      id: string;
      name: string;
      language: string;
      gender: string;
      description: string;
      accent: string;
      previewUrl: string;
    }[];
    minimaxVoices: string[];
    seedVoices: string[];
    seedFormats: string[];
    seedSampleRates: number[];
    languages: readonly string[];
    moods: string[];
    musicBpm: number[];
  };
}
export type MobileAudioReference =
  | { role: 'source_video'; asset: { type: 'asset'; kind: 'video'; assetId: string } }
  | { role: 'voice_sample'; asset: { type: 'asset'; kind: 'audio'; assetId: string } };
export interface MobileAudioDraft {
  references?: MobileAudioReference[];
  surface: 'audio';
  engineId: string;
  mode: AudioModeId;
  prompt: string;
  settings: Record<string, SettingValue>;
}
export interface MobileAudioQuote extends Omit<GenerationQuote, 'summary'> {
  summary: MobileAudioDraft;
}
export interface RestoredAudioQuote {
  job: GenerationJob | null;
  canConfirm: boolean;
  terminal: boolean;
  quote: Pick<MobileAudioQuote, 'quoteId' | 'expiresAt' | 'price' | 'summary'>;
}
