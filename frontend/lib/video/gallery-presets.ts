import presets from '@/config/model-cinematic-gallery-presets.json';

/** Exact reviewed text-to-video recipes, with no private assets or billing data. */
export function getGalleryVideoPreset(engineId: string, id: string) {
  return presets.find(preset => preset.engineId === engineId && preset.id === id) ?? null;
}

export function findGalleryVideoPreset(engineId: string, prompt: string) {
  return presets.find(preset => preset.engineId === engineId && preset.prompt === prompt) ?? null;
}
