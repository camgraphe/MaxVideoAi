import {
  getAudioPackConfig,
  type AudioMood,
  type AudioPackId,
} from '@/lib/audio-generation';
import type { AudioProviderError } from '@/server/audio/providers';
import type { ValidatedAudioGenerateRequest } from './audio-generate-validation';

export function buildPromptSummary(input: {
  pack: AudioPackId;
  prompt: string | null;
  mood: AudioMood | null;
  script: string | null;
}): string {
  const base = getAudioPackConfig(input.pack).label;
  if (input.script) {
    return `${base} • ${input.script.slice(0, 80).trim()}`;
  }
  if (input.prompt) {
    return `${base} • ${input.prompt.slice(0, 80).trim()}`;
  }
  if (input.mood) {
    return `${base} • ${input.mood}`;
  }
  return base;
}

export function buildProviderSnapshot(base: Record<string, unknown>, providers: Record<string, unknown>) {
  return JSON.stringify({
    ...base,
    providers,
  });
}

export function buildInitialAudioSettingsSnapshot(params: {
  durationSec: number;
  normalized: ValidatedAudioGenerateRequest;
  sourceJobId: string | null;
  sourceVideoUrl: string | null;
}) {
  const { durationSec, normalized, sourceJobId, sourceVideoUrl } = params;
  return {
    schemaVersion: 2,
    surface: 'audio',
    pack: normalized.pack,
    prompt: normalized.prompt,
    mood: normalized.mood,
    intensity: normalized.intensity,
    musicModel: normalized.musicModel,
    musicBpm: normalized.musicBpm,
    durationSec,
    script: normalized.script,
    musicEnabled: normalized.musicEnabled,
    exportAudioFile: normalized.exportAudioFile,
    voiceMode: normalized.voiceMode,
    voiceGender: normalized.voiceGender,
    voiceProfile: normalized.voiceProfile,
    voiceDelivery: normalized.voiceDelivery,
    language: normalized.language,
    seedAudioVoice: normalized.seedAudioVoice,
    seedAudioOutputFormat: normalized.seedAudioOutputFormat,
    seedAudioSampleRate: normalized.seedAudioSampleRate,
    seedAudioSpeed: normalized.seedAudioSpeed,
    seedAudioVolume: normalized.seedAudioVolume,
    seedAudioPitch: normalized.seedAudioPitch,
    outputKind: normalized.outputKind,
    sourceJobId,
    sourceVideoUrl,
    refs: {
      sourceVideoUrl,
      voiceSampleUrl: normalized.voiceSampleUrl,
    },
    providers: null,
  };
}

export function parseProviderFailures(error: unknown) {
  if (error && typeof error === 'object' && 'failures' in (error as Record<string, unknown>)) {
    return (error as AudioProviderError).failures;
  }
  return undefined;
}

export function isVideoBackedPack(pack: AudioPackId): boolean {
  return !getAudioPackConfig(pack).audioOnly;
}
