import { DEFAULT_ELEVEN_VOICE_ID } from '@/lib/audio-eleven-voices';
import type { AudioCreationDraft } from '@/lib/audio-creation';
import type { AudioJobSettingsSnapshot } from './audio-workspace-types';

/** Historical snapshots are the source of truth for recreation, including advanced voice settings. */
export function audioCreationReusePatch(snapshot: AudioJobSettingsSnapshot, draft: AudioCreationDraft, referenceLabel: string): Partial<AudioCreationDraft> {
  return {
    prompt: snapshot.prompt ?? '', script: snapshot.script ?? '', lyrics: snapshot.lyrics ?? '',
    voiceModel: snapshot.voiceModel === 'eleven-v4' ? 'eleven-v4' : snapshot.voiceModel === 'minimax' ? 'minimax' : 'seed',
    elevenVoiceId: snapshot.elevenVoiceId ?? DEFAULT_ELEVEN_VOICE_ID, elevenStability: snapshot.elevenStability ?? 0.5, elevenSimilarityBoost: snapshot.elevenSimilarityBoost ?? 0.75, minimaxVoiceId: snapshot.minimaxVoiceId ?? 'English_FriendlyPerson',
    voice: snapshot.seedAudioVoice ?? 'default', speed: snapshot.seedAudioSpeed ?? 1, volume: snapshot.seedAudioVolume ?? 1, pitch: snapshot.seedAudioPitch ?? 0,
    outputFormat: snapshot.seedAudioOutputFormat ?? 'mp3', sampleRate: snapshot.seedAudioSampleRate ?? 24000,
    voiceDelivery: snapshot.voiceDelivery ?? 'cinematic', voiceProfile: snapshot.voiceProfile ?? 'balanced', voiceGender: snapshot.voiceGender ?? 'female',
    language: snapshot.language ?? 'auto', mood: snapshot.mood ?? 'dreamy',
    durationSec: snapshot.requestedDurationSec ?? snapshot.durationSec ?? draft.durationSec, musicModel: snapshot.musicModel === 'pro' ? 'pro' : 'clip', bpm: snapshot.musicBpm ?? 110,
    reference: snapshot.refs?.voiceSampleUrl ? { url: snapshot.refs.voiceSampleUrl, name: referenceLabel } : null,
  };
}
