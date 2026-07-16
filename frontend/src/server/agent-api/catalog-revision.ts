import { createHash } from 'node:crypto';

import type { AgentModel } from './types';

type CatalogRevisionModel = {
  id: string;
  label: string;
  surface: AgentModel['surface'];
  modes: string[];
  aspectRatios: string[];
  resolutions: string[];
  maxDurationSec: number | null;
  audio: boolean;
  referenceImages: boolean;
  availability: string;
};

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort(compareCodeUnits);
}

function projectModel(model: AgentModel): CatalogRevisionModel {
  return {
    id: model.id,
    label: model.label,
    surface: model.surface,
    modes: sorted(model.modes),
    aspectRatios: sorted(model.aspectRatios),
    resolutions: sorted(model.resolutions),
    maxDurationSec: model.maxDurationSec,
    audio: model.audio,
    referenceImages: model.referenceImages,
    availability: model.availability,
  };
}

export function computeGenerationCatalogRevision(models: readonly AgentModel[]): string {
  const projection = models
    .map(projectModel)
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  const digest = createHash('sha256')
    .update(JSON.stringify({ schemaVersion: 1, models: projection }), 'utf8')
    .digest('hex');
  return `mcp-catalog-v1:${digest}`;
}
