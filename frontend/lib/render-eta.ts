import type { EngineCaps } from '@/types/engines';
import { selectGenerationTiming } from './generation-timing';

type TimingSettings = { resolution?: string | null; mode?: string | null };

const ENGINE_RENDER_ETAS: Record<string, number> = {
  sora2: 42,
  sora2pro: 48,
  veo31: 38,
  veo3fast: 24,
  veo31fast: 22,
  pikatexttovideo: 18,
  pikaimagetovideo: 20,
  minimaxhailuo02text: 24,
  minimaxhailuo02image: 26
};

const MIN_RENDER_SECONDS = 15;
const FAST_DEFAULT_SECONDS = 18;
const STANDARD_DEFAULT_SECONDS = 28;

export function estimateRenderSeconds(engine: EngineCaps | null | undefined, durationSec: number | null | undefined, settings?: TimingSettings): number {
  const matched = selectGenerationTiming(engine?.timingCells, { ...settings, durationSec });
  if (matched) return Math.max(1, Math.round(matched.averageDurationMs / 1000));
  if (typeof engine?.avgDurationMs === 'number' && Number.isFinite(engine.avgDurationMs) && engine.avgDurationMs > 0) {
    return Math.max(1, Math.round(engine.avgDurationMs / 1000));
  }
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

export function getRenderEta(engine: EngineCaps | null | undefined, durationSec: number | null | undefined, settings?: TimingSettings): { seconds: number; label: string; source: 'observed' | 'heuristic'; sampleCount: number | null } {
  const seconds = estimateRenderSeconds(engine, durationSec, settings);
  const matched = selectGenerationTiming(engine?.timingCells, { ...settings, durationSec });
  const observed = typeof engine?.avgDurationMs === 'number' && Number.isFinite(engine.avgDurationMs) && engine.avgDurationMs > 0;
  return { seconds, label: formatEtaLabel(seconds), source: matched || observed ? 'observed' : 'heuristic', sampleCount: matched?.sampleCount ?? (observed ? engine?.durationSampleCount ?? null : null) };
}
