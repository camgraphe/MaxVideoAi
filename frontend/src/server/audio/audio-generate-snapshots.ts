import {
  getAudioPackConfig,
  type AudioMood,
  type AudioPackId,
} from '@/lib/audio-generation';
import type { AudioProviderError } from '@/server/audio/providers';

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

export function parseProviderFailures(error: unknown) {
  if (error && typeof error === 'object' && 'failures' in (error as Record<string, unknown>)) {
    return (error as AudioProviderError).failures;
  }
  return undefined;
}

export function isVideoBackedPack(pack: AudioPackId): boolean {
  return !getAudioPackConfig(pack).audioOnly;
}
