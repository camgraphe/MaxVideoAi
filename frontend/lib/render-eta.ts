import type { EngineCaps } from '@/types/engines';

const ENGINE_RENDER_ETAS: Record<string, number> = {
  sora2: 45,
  sora2pro: 55,
  veo3: 40,
  veo3fast: 24,
  lumadm: 20,
  lumaray2: 22,
  lumaray2flash: 16,
  pika22: 12,
  minimaxvideo01: 18,
  minimaxhailuo02pro: 20,
  hunyuanvideo: 28
};

const MIN_RENDER_SECONDS = 15;
const FAST_DEFAULT_SECONDS = 18;
const STANDARD_DEFAULT_SECONDS = 28;

export function estimateRenderSeconds(engine: EngineCaps | null | undefined, durationSec: number | null | undefined): number {
  const baseId = engine?.id?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? null;
  const mapped = baseId ? ENGINE_RENDER_ETAS[baseId] : undefined;
  const baseSeconds =
    typeof mapped === 'number'
      ? mapped
      : engine?.latencyTier === 'fast'
        ? FAST_DEFAULT_SECONDS
        : STANDARD_DEFAULT_SECONDS;
  const duration = typeof durationSec === 'number' && durationSec > 0 ? durationSec : 8;
  const durationFactor = Math.max(0.8, Math.min(1.8, duration / 8));
  const seconds = Math.round(baseSeconds * durationFactor);
  return Math.max(MIN_RENDER_SECONDS, seconds);
}

export function formatEtaLabel(seconds: number): string {
  if (seconds >= 120) {
    const minutes = seconds / 60;
    return `≈ ${minutes.toFixed(1)} min`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds - minutes * 60;
    if (remaining === 0) {
      return `≈ ${minutes} min`;
    }
    return `≈ ${minutes} min ${remaining}s`;
  }
  return `≈ ${seconds}s`;
}

export function getRenderEta(engine: EngineCaps | null | undefined, durationSec: number | null | undefined): { seconds: number; label: string } {
  const seconds = estimateRenderSeconds(engine, durationSec);
  return { seconds, label: formatEtaLabel(seconds) };
}
