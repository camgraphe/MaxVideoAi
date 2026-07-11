import path from 'node:path';
import { promises as fs } from 'node:fs';

export type BenchmarkScore = {
  modelSlug?: string;
  engineId?: string;
  fidelity?: number | null;
  visualQuality?: number | null;
  motion?: number | null;
  consistency?: number | null;
  anatomy?: number | null;
  textRendering?: number | null;
  lipsyncQuality?: number | null;
  sequencingQuality?: number | null;
  controllability?: number | null;
  speedStability?: number | null;
  pricing?: number | null;
  last_updated?: string | null;
};

export type BenchmarkSpec = {
  modelSlug?: string;
  engineId?: string;
  sources?: string[];
  keySpecs?: Record<string, unknown>;
};

export type BenchmarkMethodology = {
  version: string;
  effectiveDate: string;
  scoreScale: {
    minimum: number;
    maximum: number;
    anchors: Array<{ score: number; meaning: string }>;
  };
  overallFormula: {
    method: 'arithmetic_mean';
    fields: Array<'fidelity' | 'motion' | 'consistency'>;
    roundToDecimals: number;
  };
  criteria: Array<{
    id: keyof BenchmarkScore;
    label: string;
    definition: string;
    includedInOverall: boolean;
  }>;
  promptPack: Array<{
    id: string;
    title: string;
    language: 'en-US';
    appliesTo: string;
    prompt: string;
  }>;
  requiredRunMetadata: string[];
  operationalLatency: {
    windowDays: 30;
    minimumCompletedJobs: 30;
    minimumDistinctUsers: 5;
    medianPercentile: 0.5;
    slowPercentile: 0.9;
  };
  limitations: string[];
  changelog: Array<{ date: string; version: string; summary: string }>;
};

export type BenchmarkLabStaticData = {
  scores: BenchmarkScore[];
  specs: BenchmarkSpec[];
  methodology: BenchmarkMethodology;
};

let staticDataPromise: Promise<BenchmarkLabStaticData> | null = null;

function benchmarkPath(filename: string) {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', filename),
    path.join(process.cwd(), '..', 'data', 'benchmarks', filename),
  ];
  return candidates;
}

async function readFirstJson<T>(filename: string): Promise<T> {
  let lastError: unknown = null;
  for (const candidate of benchmarkPath(filename)) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf8')) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to read ${filename}`);
}

export function computeBenchmarkOverall(score: BenchmarkScore): number | null {
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average * 10) / 10;
}

export function loadBenchmarkLabStaticData(): Promise<BenchmarkLabStaticData> {
  if (!staticDataPromise) {
    staticDataPromise = Promise.all([
      readFirstJson<{ scores?: BenchmarkScore[] }>('engine-scores.v1.json'),
      readFirstJson<{ specs?: BenchmarkSpec[] }>('engine-key-specs.v1.json'),
      readFirstJson<BenchmarkMethodology>('benchmark-methodology.v1.json'),
    ]).then(([scoresFile, specsFile, methodology]) => ({
      scores: scoresFile.scores ?? [],
      specs: specsFile.specs ?? [],
      methodology,
    }));
  }
  return staticDataPromise;
}

export async function loadBenchmarkScoreSlugs(): Promise<Set<string>> {
  const data = await loadBenchmarkLabStaticData();
  return new Set(
    data.scores
      .map((row) => row.modelSlug ?? row.engineId ?? '')
      .map((slug) => slug.trim())
      .filter(Boolean)
  );
}
