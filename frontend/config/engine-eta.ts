const ENGINE_ETA_SECONDS: Record<string, number> = {
  'pika-text-to-video': 24,
  'pika-image-to-video': 26,
  'veo-3-1': 44,
  'veo-3-fast': 28,
  'veo-3-1-fast': 26,
  'sora-2': 38,
  'sora-2-pro': 46,
  'minimax-hailuo-02-text': 30,
  'minimax-hailuo-02-image': 32,
};

function clampSeconds(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function getEngineEtaSeconds(engineId?: string | null): number | null {
  if (!engineId) return null;
  return ENGINE_ETA_SECONDS[engineId] ?? null;
}

export function pickSimulatedDurationMs(engineId?: string | null): number {
  const baseSeconds = getEngineEtaSeconds(engineId);
  if (typeof baseSeconds === 'number') {
    const jitter = clampSeconds(Math.round(baseSeconds * 0.15), 3, 12);
    const seconds = baseSeconds + Math.random() * jitter;
    return Math.max(20, seconds) * 1000;
  }
  const minSeconds = 24;
  const maxSeconds = 30;
  const seconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
  return seconds * 1000;
}

export function formatEtaLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '~20s';
  if (seconds < 60) {
    return `~${Math.max(20, Math.round(seconds))}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (remainder === 0) {
    return `~${minutes}m`;
  }
  return `~${minutes}m ${remainder}s`;
}
