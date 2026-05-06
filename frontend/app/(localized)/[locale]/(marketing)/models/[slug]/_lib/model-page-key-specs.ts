import path from 'node:path';
import { promises as fs } from 'node:fs';

export type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
  sources?: string[];
};

type EngineKeySpecsFile = {
  version?: string;
  last_updated?: string;
  specs?: EngineKeySpecsEntry[];
};

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

