import fs from 'node:fs/promises';
import path from 'node:path';
import { listFalEngines } from '@/config/falEngines';

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

function getScoreFileCandidates() {
  return [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
}

function buildVideoEngineIdLookup() {
  const lookup = new Map<string, string>();
  listFalEngines().forEach((entry) => {
    if ((entry.category ?? 'video') === 'image') return;
    lookup.set(entry.id, entry.engine.id);
    lookup.set(entry.modelSlug, entry.engine.id);
    lookup.set(entry.engine.id, entry.engine.id);
    entry.modes.forEach((mode) => lookup.set(mode.falModelId, entry.engine.id));
  });
  return lookup;
}

export async function loadAppEngineScoreMap(): Promise<Record<string, number>> {
  const lookup = buildVideoEngineIdLookup();
  for (const candidate of getScoreFileCandidates()) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as { scores?: EngineScoreRow[] };
      const scoreMap: Record<string, number> = {};
      (parsed.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (!key) return;
        const engineId = lookup.get(key);
        if (!engineId) return;
        const overall = computeOverallFromScore(entry);
        if (overall != null) {
          scoreMap[engineId] = overall;
        }
      });
      return scoreMap;
    } catch {
      // Try next candidate path.
    }
  }
  return {};
}
