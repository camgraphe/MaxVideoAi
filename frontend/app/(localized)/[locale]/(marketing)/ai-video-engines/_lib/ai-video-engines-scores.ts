import fs from 'node:fs/promises';
import path from 'node:path';

type EngineScoreRow = {
  modelSlug?: string;
  engineId?: string;
  fidelity?: number | null;
  motion?: number | null;
  consistency?: number | null;
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

export async function loadHubEngineScoreMap(): Promise<Map<string, number>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as { scores?: EngineScoreRow[] };
      const map = new Map<string, number>();
      (parsed.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (!key) return;
        const overall = computeOverallFromScore(entry);
        if (overall != null) {
          map.set(key, overall);
        }
      });
      return map;
    } catch {
      // Try next candidate path.
    }
  }
  return new Map();
}
