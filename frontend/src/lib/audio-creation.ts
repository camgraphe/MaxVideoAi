import {
  AUDIO_LANGUAGE_VALUES,
  AUDIO_AMBIENCE_DURATION_OPTIONS_SEC,
  AUDIO_LYRIA3_BPM_VALUES,
  AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC,
  AUDIO_LYRIA3_MODEL_VALUES,
  AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC,
  AUDIO_MINIMAX_VOICE_VALUES,
  AUDIO_MOOD_VALUES,
  AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES,
  AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES,
  AUDIO_SEED_AUDIO_VOICE_VALUES,
  AUDIO_SFX_DURATION_OPTIONS_SEC,
  AUDIO_VOICE_DELIVERY_VALUES,
  AUDIO_VOICE_GENDER_VALUES,
  AUDIO_VOICE_PROFILE_VALUES,
  type AudioGenerateRequestBody,
  type AudioPackId,
  type AudioVoiceModel,
} from './audio-generation';
import type { ToolAssetRef } from './toolbox/contract';
import type { MediaFacts } from '@/lib/media-identity';

export const AUDIO_CREATION_INTENTS = ['voice', 'music', 'song', 'sfx', 'ambience'] as const;
export type AudioCreationIntent = typeof AUDIO_CREATION_INTENTS[number];
export const AUDIO_INTENT_PACK: Record<AudioCreationIntent, AudioPackId> = {
  voice: 'voice_only', music: 'music_only', song: 'song', sfx: 'sfx_only', ambience: 'ambience_only',
};
export type AudioCreationDraft = {
  prompt: string; script: string; lyrics: string; durationSec: number;
  voiceModel: AudioVoiceModel; voice: string; minimaxVoiceId: string; speed: number; volume: number; pitch: number;
  outputFormat: string; sampleRate: number; voiceDelivery: string; voiceProfile: string; voiceGender: string;
  language: string; musicModel: 'clip' | 'pro'; bpm: number; mood: string;
  reference: { url: string; name: string; ref?: ToolAssetRef; mediaFacts?: MediaFacts } | null;
};
export function newAudioDraft(intent: AudioCreationIntent): AudioCreationDraft {
  return { prompt: '', script: '', lyrics: '', durationSec: intent === 'sfx' ? 8 : intent === 'ambience' ? 60 : 30,
    voiceModel: 'minimax', voice: 'default', minimaxVoiceId: 'English_FriendlyPerson', speed: 1.06, volume: 1, pitch: 0,
    outputFormat: 'mp3', sampleRate: 24000, voiceDelivery: 'cinematic', voiceProfile: 'balanced', voiceGender: 'female',
    language: 'auto', musicModel: 'clip', bpm: 110, mood: 'dreamy', reference: null };
}
function oneOf<T>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}
/** Repairs stored drafts against the current controls before they can be quoted. */
export function repairAudioCreationDraft(intent: AudioCreationIntent, draft: AudioCreationDraft): AudioCreationDraft {
  const defaults = newAudioDraft(intent);
  const hasLongMusicDuration = AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC.includes(draft.durationSec as typeof AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC[number]) && draft.durationSec > 30;
  const musicModel = hasLongMusicDuration
    ? 'pro'
    : oneOf(draft.musicModel, AUDIO_LYRIA3_MODEL_VALUES, defaults.musicModel);
  const durationSec = intent === 'music'
    ? musicModel === 'clip'
      ? AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC[0]
      : oneOf(draft.durationSec, AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC, AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC[0])
    : intent === 'sfx'
      ? oneOf(draft.durationSec, AUDIO_SFX_DURATION_OPTIONS_SEC, defaults.durationSec)
      : intent === 'ambience'
        ? oneOf(draft.durationSec, AUDIO_AMBIENCE_DURATION_OPTIONS_SEC, defaults.durationSec)
        : defaults.durationSec;
  return {
    ...draft,
    durationSec,
    voiceModel: oneOf(draft.voiceModel, ['seed', 'minimax'] as const, defaults.voiceModel),
    minimaxVoiceId: oneOf(draft.minimaxVoiceId, AUDIO_MINIMAX_VOICE_VALUES, defaults.minimaxVoiceId),
    voice: oneOf(draft.voice, AUDIO_SEED_AUDIO_VOICE_VALUES, defaults.voice),
    speed: typeof draft.speed === 'number' && draft.speed >= 0.5 && draft.speed <= 2 ? draft.speed : defaults.speed,
    volume: typeof draft.volume === 'number' && draft.volume >= 0.5 && draft.volume <= 2 ? draft.volume : defaults.volume,
    pitch: typeof draft.pitch === 'number' && draft.pitch >= -12 && draft.pitch <= 12 ? draft.pitch : defaults.pitch,
    outputFormat: oneOf(draft.outputFormat, AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES, defaults.outputFormat),
    sampleRate: oneOf(draft.sampleRate, AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES, defaults.sampleRate),
    voiceDelivery: oneOf(draft.voiceDelivery, AUDIO_VOICE_DELIVERY_VALUES, defaults.voiceDelivery),
    voiceProfile: oneOf(draft.voiceProfile, AUDIO_VOICE_PROFILE_VALUES, defaults.voiceProfile),
    voiceGender: oneOf(draft.voiceGender, AUDIO_VOICE_GENDER_VALUES, defaults.voiceGender),
    language: oneOf(draft.language, AUDIO_LANGUAGE_VALUES, defaults.language),
    musicModel,
    bpm: oneOf(draft.bpm, AUDIO_LYRIA3_BPM_VALUES, defaults.bpm),
    mood: oneOf(draft.mood, AUDIO_MOOD_VALUES, defaults.mood),
  };
}
export function isAudioIntent(value: unknown): value is AudioCreationIntent {
  return typeof value === 'string' && (AUDIO_CREATION_INTENTS as readonly string[]).includes(value);
}
export function buildAudioCreationRequest(intent: AudioCreationIntent, draft: AudioCreationDraft, locale: string): AudioGenerateRequestBody {
  const base = { pack: AUDIO_INTENT_PACK[intent], locale };
  if (intent === 'voice') return { ...base, script: draft.script.trim(), voiceModel: draft.reference ? 'seed' : draft.voiceModel,
    ...(!draft.reference && draft.voiceModel === 'minimax' ? { minimaxVoiceId: draft.minimaxVoiceId } : {
      seedAudioVoice: draft.voice, voiceSampleUrl: draft.reference?.url, seedAudioOutputFormat: draft.outputFormat,
      seedAudioSampleRate: draft.sampleRate, voiceDelivery: draft.voiceDelivery, voiceProfile: draft.voiceProfile, voiceGender: draft.voiceGender,
    }),
    seedAudioSpeed: draft.speed, seedAudioVolume: draft.volume, seedAudioPitch: draft.pitch, language: draft.language };
  if (intent === 'song') return { ...base, prompt: draft.prompt.trim(), lyrics: draft.lyrics.trim() };
  if (intent === 'music') return { ...base, prompt: draft.prompt.trim(), durationSec: draft.durationSec, musicModel: draft.musicModel, musicBpm: draft.bpm, mood: draft.mood };
  return { ...base, prompt: draft.prompt.trim(), durationSec: draft.durationSec };
}
export function isAudioDraftReady(intent: AudioCreationIntent, draft: AudioCreationDraft) {
  if (intent === 'voice') return draft.script.trim().length > 0 && draft.script.length <= 5000;
  if (intent === 'song') return draft.prompt.trim().length >= 10 && draft.prompt.length <= 2000 && draft.lyrics.trim().length > 0 && draft.lyrics.length <= 3500;
  return draft.prompt.trim().length > 0 && draft.prompt.length <= 2000 && draft.durationSec >= 3 && draft.durationSec <= (intent === 'sfx' ? 30 : 184);
}
