import fs from 'node:fs/promises';
import path from 'node:path';

type EngineScoreRow = {
  modelSlug?: string;
  engineId?: string;
  fidelity?: number | null;
  motion?: number | null;
  consistency?: number | null;
  reviewStatus?: string;
};

function computeOverallFromScore(score?: EngineScoreRow | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export async function loadHubEngineScoreData(): Promise<{ scores: Map<string, number>; reviews: Record<string, 'editorial-estimated'> }> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as { scores?: EngineScoreRow[] };
      const map = new Map<string, number>();
      const reviews: Record<string, 'editorial-estimated'> = {};
      (parsed.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (!key) return;
        if (entry.reviewStatus === 'editorial-estimated') reviews[key] = entry.reviewStatus;
        const overall = computeOverallFromScore(entry);
        if (overall != null) {
          map.set(key, overall);
        }
      });
      return { scores: map, reviews };
    } catch {
      // Try next candidate path.
    }
  }
  return { scores: new Map(), reviews: {} };
}

export async function loadHubEngineScoreMap(): Promise<Map<string, number>> {
  return (await loadHubEngineScoreData()).scores;
}
