import type { AudioCreationDraft } from '@/lib/audio-creation';
import type { AudioJobSettingsSnapshot } from './audio-workspace-types';

/** Historical snapshots are the source of truth for recreation, including advanced voice settings. */
export function audioCreationReusePatch(snapshot: AudioJobSettingsSnapshot, draft: AudioCreationDraft, referenceLabel: string): Partial<AudioCreationDraft> {
  return {
    prompt: snapshot.prompt ?? '', script: snapshot.script ?? '', lyrics: snapshot.lyrics ?? '',
    voiceModel: snapshot.voiceModel === 'minimax' ? 'minimax' : 'seed', minimaxVoiceId: snapshot.minimaxVoiceId ?? 'English_FriendlyPerson',
    voice: snapshot.seedAudioVoice ?? 'default', speed: snapshot.seedAudioSpeed ?? 1, volume: snapshot.seedAudioVolume ?? 1, pitch: snapshot.seedAudioPitch ?? 0,
    outputFormat: snapshot.seedAudioOutputFormat ?? 'mp3', sampleRate: snapshot.seedAudioSampleRate ?? 24000,
    voiceDelivery: snapshot.voiceDelivery ?? 'cinematic', voiceProfile: snapshot.voiceProfile ?? 'balanced', voiceGender: snapshot.voiceGender ?? 'female',
    language: snapshot.language ?? 'auto', mood: snapshot.mood ?? 'dreamy',
    durationSec: snapshot.requestedDurationSec ?? snapshot.durationSec ?? draft.durationSec, musicModel: snapshot.musicModel === 'pro' ? 'pro' : 'clip', bpm: snapshot.musicBpm ?? 110,
    reference: snapshot.refs?.voiceSampleUrl ? { url: snapshot.refs.voiceSampleUrl, name: referenceLabel } : null,
  };
}
