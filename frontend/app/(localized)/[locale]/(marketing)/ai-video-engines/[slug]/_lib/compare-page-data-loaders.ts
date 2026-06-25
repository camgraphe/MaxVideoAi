import path from 'node:path';
import { promises as fs } from 'node:fs';
import { isDatabaseConfigured } from '@/lib/db';
import { getPublicVideosByIds } from '@/server/videos';
import type { EngineKeySpecsEntry, EngineKeySpecsFile, EngineScore, EngineScoresFile, ShowdownEntry } from './compare-page-types';

export async function loadEngineScores(): Promise<Map<string, EngineScore>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineScoresFile;
      const map = new Map<string, EngineScore>();
      (data.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, entry);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

export async function loadEngineKeySpecs(): Promise<Map<string, EngineKeySpecsEntry>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-key-specs.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-key-specs.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineKeySpecsFile;
      const map = new Map<string, EngineKeySpecsEntry>();
      (data.specs ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, {
            modelSlug: entry.modelSlug,
            engineId: entry.engineId,
            keySpecs: entry.keySpecs,
          });
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

export async function hydrateShowdowns(
  entries: Array<ShowdownEntry | null>
): Promise<Array<ShowdownEntry | null>> {
  const jobIds = new Set<string>();
  entries.forEach((entry) => {
    if (!entry) return;
    if (entry.left.jobId) jobIds.add(entry.left.jobId);
    if (entry.right.jobId) jobIds.add(entry.right.jobId);
  });
  if (!jobIds.size || !isDatabaseConfigured()) {
    return entries;
  }
  try {
    const videos = await getPublicVideosByIds(Array.from(jobIds));
    return entries.map((entry) => {
      if (!entry) return entry;
      const leftVideo = entry.left.jobId ? videos.get(entry.left.jobId) : null;
      const rightVideo = entry.right.jobId ? videos.get(entry.right.jobId) : null;
      return {
        ...entry,
        left: {
          ...entry.left,
          videoUrl: leftVideo?.videoUrl ?? entry.left.videoUrl,
          posterUrl: leftVideo?.thumbUrl ?? entry.left.posterUrl,
        },
        right: {
          ...entry.right,
          videoUrl: rightVideo?.videoUrl ?? entry.right.videoUrl,
          posterUrl: rightVideo?.thumbUrl ?? entry.right.posterUrl,
        },
      };
    });
  } catch {
    return entries;
  }
}
