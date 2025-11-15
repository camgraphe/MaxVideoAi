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
    'luma-dm': 'minimax-hailuo-02-text',
    'lumadreammachine': 'minimax-hailuo-02-text',
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
