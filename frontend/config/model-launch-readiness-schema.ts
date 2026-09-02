export const P0_VIDEO_EXAMPLE_MODEL_IDS = [
  'wan-3',
  'wan-3-prime',
  'ltx-2-5-fast',
  'ltx-2-5-pro',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
] as const;

export type P0VideoExampleModelId = (typeof P0_VIDEO_EXAMPLE_MODEL_IDS)[number];
export const P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID: Record<
  P0VideoExampleModelId,
  'wan' | 'ltx' | 'grok' | 'flux'
> = {
  'wan-3': 'wan',
  'wan-3-prime': 'wan',
  'ltx-2-5-fast': 'ltx',
  'ltx-2-5-pro': 'ltx',
  'grok-imagine-video-1-5': 'grok',
  'flux-3': 'flux',
  'flux-3-draft': 'flux',
};

export type ModelLaunchReadinessEntry = {
  modelId: P0VideoExampleModelId;
  familyId: 'wan' | 'ltx' | 'grok' | 'flux';
  acceptedAssetCount: 2;
  familyPlaylistSlug: string;
  modelPlaylistSlug: string;
};

export type ModelLaunchReadinessProjection = {
  schemaVersion: 1;
  generatedBy: 'scripts/generate-p0-launch-assets.ts';
  sourceManifest: 'docs/model-launch/p0-video-example-pack.json';
  sourceStatus: 'missing' | 'validated';
  sourceDigest: string | null;
  models: ModelLaunchReadinessEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseModelLaunchReadinessProjection(value: unknown): ModelLaunchReadinessProjection {
  const missing: ModelLaunchReadinessProjection = {
    schemaVersion: 1,
    generatedBy: 'scripts/generate-p0-launch-assets.ts',
    sourceManifest: 'docs/model-launch/p0-video-example-pack.json',
    sourceStatus: 'missing',
    sourceDigest: null,
    models: [],
  };
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.generatedBy !== missing.generatedBy ||
    value.sourceManifest !== missing.sourceManifest ||
    !Array.isArray(value.models)
  ) {
    return missing;
  }
  if (value.sourceStatus === 'missing') {
    return missing;
  }
  if (value.sourceStatus !== 'validated' || typeof value.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceDigest)) {
    return missing;
  }

  const expectedIds = new Set<string>(P0_VIDEO_EXAMPLE_MODEL_IDS);
  const models = value.models.flatMap<ModelLaunchReadinessEntry>((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.modelId !== 'string' ||
      !expectedIds.has(entry.modelId) ||
      (entry.familyId !== 'wan' && entry.familyId !== 'ltx' && entry.familyId !== 'grok' && entry.familyId !== 'flux') ||
      entry.familyId !== P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID[entry.modelId as P0VideoExampleModelId] ||
      entry.acceptedAssetCount !== 2 ||
      entry.familyPlaylistSlug !== `family-${entry.familyId}` ||
      entry.modelPlaylistSlug !== `examples-${entry.modelId}`
    ) {
      return [];
    }
    return [entry as ModelLaunchReadinessEntry];
  });
  if (models.length !== P0_VIDEO_EXAMPLE_MODEL_IDS.length || new Set(models.map(({ modelId }) => modelId)).size !== models.length) {
    return missing;
  }
  return { ...missing, sourceStatus: 'validated', sourceDigest: value.sourceDigest, models };
}

export function findModelLaunchReadiness(
  modelId: string,
  readiness: readonly ModelLaunchReadinessEntry[],
): ModelLaunchReadinessEntry | null {
  return readiness.find((entry) => entry.modelId === modelId) ?? null;
}

export function hasModelLaunchReadiness(
  modelId: string,
  readiness: readonly ModelLaunchReadinessEntry[],
): boolean {
  return findModelLaunchReadiness(modelId, readiness) !== null;
}
