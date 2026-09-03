import {
  MODEL_LAUNCH_WAVES,
  type ModelLaunchWaveId,
} from './model-launch-waves';

const P0_LAUNCH_WAVE = MODEL_LAUNCH_WAVES[0];
const P1_LAUNCH_WAVE = MODEL_LAUNCH_WAVES[1];

export const P0_VIDEO_EXAMPLE_MODEL_IDS = Object.freeze(P0_LAUNCH_WAVE.models.map(({ modelId }) => modelId)) as readonly (
  (typeof P0_LAUNCH_WAVE.models)[number]['modelId']
)[];
export type P0VideoExampleModelId = (typeof P0_LAUNCH_WAVE.models)[number]['modelId'];
export const P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID = Object.fromEntries(
  P0_LAUNCH_WAVE.models.map(({ modelId, familyId }) => [modelId, familyId]),
) as Record<P0VideoExampleModelId, (typeof P0_LAUNCH_WAVE.models)[number]['familyId']>;

export const P1_VIDEO_EXAMPLE_MODEL_IDS = Object.freeze(P1_LAUNCH_WAVE.models.map(({ modelId }) => modelId)) as readonly (
  (typeof P1_LAUNCH_WAVE.models)[number]['modelId']
)[];
export type P1VideoExampleModelId = (typeof P1_LAUNCH_WAVE.models)[number]['modelId'];
export const P1_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID = Object.fromEntries(
  P1_LAUNCH_WAVE.models.map(({ modelId, familyId }) => [modelId, familyId]),
) as Record<P1VideoExampleModelId, (typeof P1_LAUNCH_WAVE.models)[number]['familyId']>;

export type ModelLaunchReadinessEntry = {
  waveId: ModelLaunchWaveId;
  modelId: string;
  familyId: string;
  acceptedAssetCount: 2;
  familyPlaylistSlug: string;
  modelPlaylistSlug: string;
};

export type ModelLaunchWaveReadinessProjection = {
  waveId: ModelLaunchWaveId;
  sourceManifest: string;
  sourceStatus: 'missing' | 'validated';
  sourceDigest: string | null;
  models: ModelLaunchReadinessEntry[];
};

export type ModelLaunchReadinessProjection = {
  schemaVersion: 1;
  generatedBy: 'scripts/generate-model-launch-assets.ts';
  waves: ModelLaunchWaveReadinessProjection[];
  models: ModelLaunchReadinessEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createMissingWaveReadiness(wave: (typeof MODEL_LAUNCH_WAVES)[number]): ModelLaunchWaveReadinessProjection {
  return {
    waveId: wave.id,
    sourceManifest: wave.sourceManifest,
    sourceStatus: 'missing',
    sourceDigest: null,
    models: [],
  };
}

function parseWaveReadiness(
  value: unknown,
  wave: (typeof MODEL_LAUNCH_WAVES)[number],
): ModelLaunchWaveReadinessProjection {
  const missing = createMissingWaveReadiness(wave);
  if (
    !isRecord(value) ||
    value.waveId !== wave.id ||
    value.sourceManifest !== wave.sourceManifest ||
    !Array.isArray(value.models)
  ) {
    return missing;
  }
  if (value.sourceStatus === 'missing') return missing;
  if (value.sourceStatus !== 'validated' || typeof value.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceDigest)) {
    return missing;
  }

  const models = value.models.flatMap<ModelLaunchReadinessEntry>((entry) => {
    if (!isRecord(entry)) return [];
    const target = wave.models.find(({ modelId }) => modelId === entry.modelId);
    if (
      !target ||
      entry.waveId !== wave.id ||
      entry.familyId !== target.familyId ||
      entry.acceptedAssetCount !== target.requiredVideos ||
      entry.familyPlaylistSlug !== `family-${target.familyId}` ||
      entry.modelPlaylistSlug !== `examples-${target.modelId}`
    ) {
      return [];
    }
    return [{
      waveId: wave.id,
      modelId: target.modelId,
      familyId: target.familyId,
      acceptedAssetCount: target.requiredVideos,
      familyPlaylistSlug: entry.familyPlaylistSlug,
      modelPlaylistSlug: entry.modelPlaylistSlug,
    }];
  });
  if (models.length !== wave.models.length || new Set(models.map(({ modelId }) => modelId)).size !== models.length) {
    return missing;
  }
  return { ...missing, sourceStatus: 'validated', sourceDigest: value.sourceDigest, models };
}

export function parseModelLaunchReadinessProjection(value: unknown): ModelLaunchReadinessProjection {
  const missing: ModelLaunchReadinessProjection = {
    schemaVersion: 1,
    generatedBy: 'scripts/generate-model-launch-assets.ts',
    waves: MODEL_LAUNCH_WAVES.map(createMissingWaveReadiness),
    models: [],
  };
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.generatedBy !== missing.generatedBy ||
    !Array.isArray(value.waves)
  ) {
    return missing;
  }
  const sourceWaves = value.waves;
  if (
    sourceWaves.length !== MODEL_LAUNCH_WAVES.length ||
    new Set(sourceWaves.map((wave) => isRecord(wave) ? wave.waveId : null)).size !== sourceWaves.length
  ) {
    return missing;
  }
  const waves = MODEL_LAUNCH_WAVES.map((wave) => parseWaveReadiness(
    sourceWaves.find((candidate) => isRecord(candidate) && candidate.waveId === wave.id),
    wave,
  ));
  return {
    ...missing,
    waves,
    models: waves.flatMap(({ models }) => models),
  };
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
