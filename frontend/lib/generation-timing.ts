/** Aggregate-only timing contract; never send job identities or prompts to the browser. */
export type GenerationTimingCell = {
  mode: string | null;
  durationSec: number | null;
  resolution: string | null;
  sampleCount: number;
  averageDurationMs: number;
  recentSampleCount: number;
  recentAverageDurationMs: number | null;
  stdDevDurationMs?: number | null;
  recentStdDevDurationMs?: number | null;
};

export type GenerationTimingSelection = { averageDurationMs: number; sampleCount: number };
const MIN_REFERENCE_SAMPLES = 5;

export function normalizeTimingResolution(value: string | null | undefined): string | null {
  return value?.trim().toLowerCase() || null;
}

function cellEstimate(cell: GenerationTimingCell): GenerationTimingSelection | null {
  if (!(cell.sampleCount > 0) || !Number.isFinite(cell.averageDurationMs) || cell.averageDurationMs <= 0) return null;
  if (cell.recentSampleCount >= MIN_REFERENCE_SAMPLES && cell.recentAverageDurationMs != null) {
    return { averageDurationMs: cell.recentAverageDurationMs, sampleCount: cell.recentSampleCount };
  }
  // Old observations seed sparse cells, but cannot drown out a new provider regime.
  const recentCount = cell.recentSampleCount;
  const oldCount = cell.sampleCount - recentCount;
  const recentAverage = cell.recentAverageDurationMs ?? 0;
  const oldAverage = oldCount > 0
    ? (cell.averageDurationMs * cell.sampleCount - recentAverage * recentCount) / oldCount : 0;
  const oldWeight = Math.min(MIN_REFERENCE_SAMPLES, oldCount);
  return { averageDurationMs: (recentAverage * recentCount + oldAverage * oldWeight) / (recentCount + oldWeight), sampleCount: cell.sampleCount };
}

/** Engine -> mode -> exact duration/resolution. Sparse children borrow from their parent. */
export function selectGenerationTiming(
  cells: GenerationTimingCell[] | null | undefined,
  input: { mode?: string | null; durationSec?: number | null; resolution?: string | null }
): GenerationTimingSelection | null {
  if (!cells?.length) return null;
  const mode = input.mode?.trim().toLowerCase() || null;
  const resolution = normalizeTimingResolution(input.resolution);
  const levels = [
    cells.find((cell) => cell.mode === null && cell.durationSec === null && cell.resolution === null),
    mode ? cells.find((cell) => cell.mode === mode && cell.durationSec === null && cell.resolution === null) : undefined,
    mode && resolution && input.durationSec ? cells.find((cell) => cell.mode === mode
      && cell.durationSec === input.durationSec && cell.resolution === resolution) : undefined,
  ];
  let result: GenerationTimingSelection | null = null;
  for (const cell of levels) {
    if (!cell) continue;
    const estimate = cellEstimate(cell);
    if (!estimate) continue;
    const useRecent = cell.recentSampleCount >= MIN_REFERENCE_SAMPLES;
    const count = useRecent ? cell.recentSampleCount : cell.sampleCount;
    const deviation = useRecent ? cell.recentStdDevDurationMs : cell.stdDevDurationMs;
    // A volatile small cohort is not a better reference merely because it matches.
    // This is a stability guard, not a statistical confidence guarantee.
    if (deviation != null && deviation / Math.sqrt(count) > estimate.averageDurationMs / 4) continue;
    const weight = Math.min(1, cell.sampleCount / MIN_REFERENCE_SAMPLES);
    result = result ? { averageDurationMs: estimate.averageDurationMs * weight + result.averageDurationMs * (1 - weight), sampleCount: estimate.sampleCount } : estimate;
  }
  return result;
}
