import { listFalEngines } from '@/config/falEngines';

const ENGINE_ID_ALIASES = (() => {
  const map = new Map<string, string>();

  const register = (raw: string | null | undefined, target: string) => {
    if (!raw) return;
    const key = raw.trim().toLowerCase();
    if (!key || map.has(key)) return;
    map.set(key, target);
  };

  listFalEngines().forEach((entry) => {
    register(entry.id, entry.id);
    register(entry.modelSlug, entry.id);
    register(entry.defaultFalModelId, entry.id);
    entry.modes.forEach((mode) => register(mode.falModelId, entry.id));
  });

  const manualAliases: Record<string, string> = {
    'veo3': 'veo-3-1-fast',
    'veo-3': 'veo-3-1',
    'veo3.1': 'veo-3-1',
    'veo3-fast': 'veo-3-1-fast',
    'pika22': 'pika-text-to-video',
    'pika-22': 'pika-text-to-video',
    'kling25': 'kling-2-5-turbo',
    'kling-25': 'kling-2-5-turbo',
    'kling-2-5': 'kling-2-5-turbo',
    'kling25_turbo': 'kling-2-5-turbo',
    'kling3': 'kling-3-pro',
    'kling-3': 'kling-3-pro',
    'kling-v3-pro': 'kling-3-pro',
    'wan25': 'wan-2-5',
    'wan-25': 'wan-2-5',
    'wan-25-preview': 'wan-2-5',
    'wan26': 'wan-2-6',
    'wan-26': 'wan-2-6',
    'luma-dm': 'minimax-hailuo-02-text',
    'lumadreammachine': 'minimax-hailuo-02-text',
    'minimax-hailuo-02-image': 'minimax-hailuo-02-text',
    'runway-gen2': 'sora-2',
    'runwaygen-2': 'sora-2',
    'sora2pro': 'sora-2-pro',
    'sora-pro': 'sora-2-pro',
    'openai-sora-2-pro': 'sora-2-pro',
  };

  Object.entries(manualAliases).forEach(([alias, target]) => register(alias, target));
  return map;
})();

export function normalizeEngineId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return ENGINE_ID_ALIASES.get(key) ?? raw;
}
