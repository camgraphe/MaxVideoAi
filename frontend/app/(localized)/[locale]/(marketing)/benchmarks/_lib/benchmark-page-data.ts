import { listFalEngines } from '@/config/falEngines';
import { supportsVideoGeneration } from '@/lib/models/catalog';
import { computeBenchmarkOverall, type BenchmarkLabStaticData, type BenchmarkScore } from '@/server/benchmark-lab-data';
import type { PublicBenchmarkLatencySnapshot } from '@/server/benchmark-lab-metrics';

const METRIC_IDS = ['fidelity', 'visualQuality', 'motion', 'consistency', 'anatomy', 'textRendering', 'lipsyncQuality', 'sequencingQuality', 'controllability', 'speedStability', 'pricing'] as const;

export type BenchmarkScoreRow = {
  modelSlug: string;
  modelName: string;
  overall: number | null;
  updatedAt: string | null;
  metrics: Record<(typeof METRIC_IDS)[number], number | null>;
};

export type BenchmarkSpecRow = {
  modelSlug: string;
  modelName: string;
  maxDuration: string;
  maxResolution: string;
  releaseDate: string;
  inputModes: Array<'textToVideo' | 'imageToVideo' | 'videoToVideo'>;
  audio: string;
  references: string;
  sourceUrl: string | null;
};

export type PublicBenchmarkMethodology = Pick<
  BenchmarkLabStaticData['methodology'],
  'version' | 'effectiveDate' | 'scoreScale' | 'overallFormula' | 'criteria' | 'promptPack' | 'limitations' | 'changelog'
>;

export type BenchmarkPageData = {
  scores: BenchmarkScoreRow[];
  specs: BenchmarkSpecRow[];
  methodology: PublicBenchmarkMethodology;
  latency: PublicBenchmarkLatencySnapshot;
};

function value(value: unknown): string {
  return value == null || String(value).trim() === '' ? '—' : String(value).trim();
}

function isSupported(value: unknown): boolean {
  return /^supported\b|^yes$|^true$/i.test(value == null ? '' : String(value).trim());
}

function sourceUrl(sources: string[] | undefined): string | null {
  const urls = (sources ?? []).filter((source) => {
    try {
      const parsed = new URL(source);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  });
  return urls.find((url) => !url.includes('maxvideoai.com')) ?? urls[0] ?? null;
}

function metricMap(score: BenchmarkScore): BenchmarkScoreRow['metrics'] {
  return Object.fromEntries(METRIC_IDS.map((id) => [id, typeof score[id] === 'number' ? score[id] : null])) as BenchmarkScoreRow['metrics'];
}

function publicLatencySnapshot(latency: PublicBenchmarkLatencySnapshot): PublicBenchmarkLatencySnapshot {
  return {
    status: latency.status,
    windowDays: latency.windowDays,
    asOf: latency.asOf,
    rows: latency.rows.map((row) => ({
      engineId: row.engineId,
      modelSlug: row.modelSlug,
      medianDurationMs: row.medianDurationMs,
      p90DurationMs: row.p90DurationMs,
      asOf: row.asOf,
    })),
  };
}

export function buildBenchmarkPageData(
  staticData: BenchmarkLabStaticData,
  latency: PublicBenchmarkLatencySnapshot
): BenchmarkPageData {
  const engines = listFalEngines().filter((engine) => supportsVideoGeneration(engine));
  const engineBySlug = new Map(engines.map((engine) => [engine.modelSlug, engine]));
  const scoreBySlug = new Map(staticData.scores.map((score) => [score.modelSlug ?? score.engineId ?? '', score]));
  const scores = staticData.scores.flatMap((score) => {
    const modelSlug = score.modelSlug ?? score.engineId;
    const engine = modelSlug ? engineBySlug.get(modelSlug) : null;
    if (!modelSlug || !engine) return [];
    return [{ modelSlug, modelName: engine.marketingName, overall: computeBenchmarkOverall(score), updatedAt: score.last_updated ?? null, metrics: metricMap(score) }];
  }).sort((left, right) => (right.overall ?? -1) - (left.overall ?? -1) || left.modelName.localeCompare(right.modelName));

  const specs = staticData.specs.flatMap((spec) => {
    const modelSlug = spec.modelSlug ?? spec.engineId;
    const engine = modelSlug ? engineBySlug.get(modelSlug) : null;
    const score = modelSlug ? scoreBySlug.get(modelSlug) : null;
    if (!modelSlug || !engine || !score || !spec.keySpecs) return [];
    const inputModes = [
      isSupported(spec.keySpecs.textToVideo) ? 'textToVideo' : null,
      isSupported(spec.keySpecs.imageToVideo) ? 'imageToVideo' : null,
      isSupported(spec.keySpecs.videoToVideo) ? 'videoToVideo' : null,
    ].filter((entry): entry is 'textToVideo' | 'imageToVideo' | 'videoToVideo' => Boolean(entry));
    return [{
      modelSlug,
      modelName: engine.marketingName,
      maxDuration: value(spec.keySpecs.maxDuration),
      maxResolution: value(spec.keySpecs.maxResolution),
      releaseDate: value(spec.keySpecs.releaseDate),
      inputModes,
      audio: value(spec.keySpecs.nativeAudioGeneration ?? spec.keySpecs.audioOutput),
      references: value(spec.keySpecs.referenceImageStyle ?? spec.keySpecs.referenceVideo),
      sourceUrl: sourceUrl(spec.sources),
    }];
  }).sort((left, right) => left.modelName.localeCompare(right.modelName));

  const methodology: PublicBenchmarkMethodology = {
    version: staticData.methodology.version,
    effectiveDate: staticData.methodology.effectiveDate,
    scoreScale: staticData.methodology.scoreScale,
    overallFormula: staticData.methodology.overallFormula,
    criteria: staticData.methodology.criteria,
    promptPack: staticData.methodology.promptPack,
    limitations: staticData.methodology.limitations,
    changelog: staticData.methodology.changelog,
  };

  return { scores, specs, methodology, latency: publicLatencySnapshot(latency) };
}
