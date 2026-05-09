import { AUDIO_PROMPT_MAX_LENGTH, type AudioIntensity, type AudioMood } from '@/lib/audio-generation';

export function limitProviderPrompt(prompt: string, maxLength = AUDIO_PROMPT_MAX_LENGTH): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trimEnd();
}

export function buildSoundDesignPrompt(mood: AudioMood, intensity: AudioIntensity, userPrompt?: string | null): string {
  const intensitySuffix =
    intensity === 'subtle'
      ? 'Keep the layer restrained, realistic, and never oversized.'
      : intensity === 'intense'
        ? 'Push detail, movement, and impact harder while staying polished.'
        : 'Keep it cinematic, supportive, and balanced.';
  const base = (() => {
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
  })();
  const custom = userPrompt?.trim();
  return custom ? `${custom}. ${base}` : base;
}

export function buildMusicPrompt(mood: AudioMood, intensity: AudioIntensity, userPrompt?: string | null): string {
  const intensitySuffix =
    intensity === 'subtle'
      ? 'Keep it very restrained and editorially supportive.'
      : intensity === 'intense'
        ? 'Lean fuller, wider, and more emotionally forward without overpowering.'
        : 'Keep it subtle, supportive, and cinematic.';
  const base = (() => {
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
  })();
  const custom = userPrompt?.trim();
  return custom ? `${custom}. ${base}` : base;
}
