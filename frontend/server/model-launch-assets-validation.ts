import { createHash } from 'node:crypto';

import {
  MODEL_LAUNCH_WAVES,
  type ModelLaunchWaveId,
} from '@/config/model-launch-waves';
import {
  P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID,
  type ModelLaunchReadinessEntry,
  type ModelLaunchReadinessProjection,
  type ModelLaunchWaveReadinessProjection,
  type P0VideoExampleModelId,
} from '@/config/model-launch-readiness-schema';
import { getRuntimeModelById } from '@/config/model-runtime';
import { RAW_FAL_ENGINE_REGISTRY } from '@/src/config/fal-engines/registry';

const GENERATED_BY = 'scripts/generate-model-launch-assets.ts' as const;

export type AcceptedDurableModelAsset = {
  waveId: ModelLaunchWaveId;
  assetId: string;
  videoId: string;
  libraryAssetId: string;
  jobId: string;
  modelId: string;
  engineId: string;
  familyId: string;
  mode: string;
  prompt: string;
  sourceKind: 'text' | 'image' | 'video' | 'references';
  sourceAssetIds: readonly string[];
  videoUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  durationSec: number;
  acceptedAt: string;
  reviewStatus: 'accepted';
  publicationState: 'gallery_only';
  watchPageCandidate: false;
  familyPlaylistId: string;
  modelPlaylistId: string;
  playlistSlugs: readonly string[];
};

export type ModelLaunchAssetWaveProjection = {
  waveId: ModelLaunchWaveId;
  sourceManifest: string;
  sourceStatus: 'missing' | 'validated';
  sourceDigest: string | null;
};

export type ModelLaunchAssetProjection = {
  schemaVersion: 1;
  generatedBy: typeof GENERATED_BY;
  waves: ModelLaunchAssetWaveProjection[];
  assets: AcceptedDurableModelAsset[];
};

type ValidationResult =
  | { ok: true; assets: AcceptedDurableModelAsset[] }
  | { ok: false; errors: string[] };

export type ModelLaunchProjections = {
  full: ModelLaunchAssetProjection;
  readiness: ModelLaunchReadinessProjection;
};

export type P0LaunchProjections = ModelLaunchProjections;
export type ModelLaunchSourceByWave = Record<ModelLaunchWaveId, string | null>;

type LaunchSourceRule = {
  sourceKind: AcceptedDurableModelAsset['sourceKind'];
  minCount: number;
  maxCount: number;
};

const PLANNED_P0_LAUNCH_MODES = ['t2v', 'i2v'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isDurableMediaUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'media.maxvideoai.com';
  } catch {
    return false;
  }
}

function getConfiguredTarget(waveId: ModelLaunchWaveId, modelId: unknown) {
  if (typeof modelId !== 'string') return null;
  const wave = MODEL_LAUNCH_WAVES.find((candidate) => candidate.id === waveId);
  return wave?.models.find((candidate) => candidate.modelId === modelId) ?? null;
}

function getCanonicalP0LaunchSourceRule(modelId: P0VideoExampleModelId, mode: string): LaunchSourceRule | null {
  const entry = RAW_FAL_ENGINE_REGISTRY.find((candidate) => candidate.id === modelId);
  if (!entry || !PLANNED_P0_LAUNCH_MODES.includes(mode as (typeof PLANNED_P0_LAUNCH_MODES)[number])) {
    return null;
  }
  const canonicalMode = entry.engine.modes.find((candidate) => candidate === mode);
  if (!canonicalMode || !entry.modes.some((candidate) => candidate.mode === canonicalMode)) return null;

  const requiredMediaFields = (entry.engine.inputSchema?.required ?? []).filter((field) => (
    (field.type === 'image' || field.type === 'video' || field.type === 'audio') &&
    (field.requiredInModes?.includes(canonicalMode) ?? field.modes?.includes(canonicalMode) ?? false)
  ));
  if (!requiredMediaFields.length) return { sourceKind: 'text', minCount: 0, maxCount: 0 };

  const mediaTypes = new Set(requiredMediaFields.map(({ type }) => type));
  if (mediaTypes.size !== 1 || mediaTypes.has('audio')) return null;
  const mediaType = requiredMediaFields[0]?.type;
  if (mediaType !== 'image' && mediaType !== 'video') return null;
  return {
    sourceKind: mediaType,
    minCount: requiredMediaFields.reduce((total, field) => total + (field.minCount ?? 1), 0),
    maxCount: requiredMediaFields.reduce((total, field) => total + (field.maxCount ?? field.minCount ?? 1), 0),
  };
}

function parseAcceptedDurableModelAssetForWave(
  value: unknown,
  waveId: ModelLaunchWaveId,
): AcceptedDurableModelAsset | null {
  if (!isRecord(value) || value.reviewStatus !== 'accepted') return null;
  if (value.publicationState !== 'gallery_only' || value.watchPageCandidate !== false) return null;
  if (value.waveId !== undefined && value.waveId !== waveId) return null;
  const target = getConfiguredTarget(waveId, value.modelId);
  if (
    !target ||
    !nonEmptyString(value.assetId) ||
    !nonEmptyString(value.videoId) ||
    !nonEmptyString(value.libraryAssetId) ||
    !nonEmptyString(value.jobId) ||
    value.engineId !== target.modelId ||
    value.familyId !== target.familyId ||
    !nonEmptyString(value.mode) ||
    !nonEmptyString(value.prompt) ||
    (value.sourceKind !== 'text' && value.sourceKind !== 'image' && value.sourceKind !== 'video' && value.sourceKind !== 'references') ||
    !Array.isArray(value.sourceAssetIds) ||
    !value.sourceAssetIds.every(nonEmptyString) ||
    !isDurableMediaUrl(value.videoUrl) ||
    !isDurableMediaUrl(value.thumbnailUrl) ||
    !isPositiveNumber(value.width) ||
    !isPositiveNumber(value.height) ||
    !isPositiveNumber(value.durationSec) ||
    !nonEmptyString(value.acceptedAt) ||
    !Number.isFinite(Date.parse(value.acceptedAt)) ||
    !nonEmptyString(value.familyPlaylistId) ||
    !nonEmptyString(value.modelPlaylistId) ||
    !Array.isArray(value.playlistSlugs) ||
    !value.playlistSlugs.every(nonEmptyString)
  ) {
    return null;
  }

  const uniqueSourceAssetIds = new Set(value.sourceAssetIds);
  const playlistSlugs = Array.from(new Set(value.playlistSlugs));
  if (
    uniqueSourceAssetIds.size !== value.sourceAssetIds.length ||
    value.familyPlaylistId === value.modelPlaylistId ||
    playlistSlugs.length !== 2 ||
    !playlistSlugs.includes(`family-${target.familyId}`) ||
    !playlistSlugs.includes(`examples-${target.modelId}`)
  ) {
    return null;
  }

  if (waveId === 'p0') {
    const modelId = target.modelId as P0VideoExampleModelId;
    const model = getRuntimeModelById(modelId);
    const sourceRule = getCanonicalP0LaunchSourceRule(modelId, value.mode);
    if (
      !model ||
      model.family !== P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID[modelId] ||
      !sourceRule ||
      value.sourceKind !== sourceRule.sourceKind ||
      value.sourceAssetIds.length < sourceRule.minCount ||
      value.sourceAssetIds.length > sourceRule.maxCount
    ) {
      return null;
    }
  }

  return {
    waveId,
    assetId: value.assetId,
    videoId: value.videoId,
    libraryAssetId: value.libraryAssetId,
    jobId: value.jobId,
    modelId: target.modelId,
    engineId: target.modelId,
    familyId: target.familyId,
    mode: value.mode,
    prompt: value.prompt,
    sourceKind: value.sourceKind,
    sourceAssetIds: [...value.sourceAssetIds],
    videoUrl: value.videoUrl,
    thumbnailUrl: value.thumbnailUrl,
    width: value.width,
    height: value.height,
    durationSec: value.durationSec,
    acceptedAt: value.acceptedAt,
    reviewStatus: 'accepted',
    publicationState: 'gallery_only',
    watchPageCandidate: false,
    familyPlaylistId: value.familyPlaylistId,
    modelPlaylistId: value.modelPlaylistId,
    playlistSlugs,
  };
}

export function parseAcceptedDurableModelAsset(value: unknown): AcceptedDurableModelAsset | null {
  if (!isRecord(value) || typeof value.modelId !== 'string') return null;
  const wave = MODEL_LAUNCH_WAVES.find((candidate) => candidate.models.some(({ modelId }) => modelId === value.modelId));
  return wave ? parseAcceptedDurableModelAssetForWave(value, wave.id) : null;
}

export function validateModelLaunchWaveDocument(
  waveId: ModelLaunchWaveId,
  input: unknown,
): ValidationResult {
  const wave = MODEL_LAUNCH_WAVES.find((candidate) => candidate.id === waveId);
  if (!wave || !isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.assets)) {
    return { ok: false, errors: ['Expected schemaVersion 1 and an assets array.'] };
  }

  const errors: string[] = [];
  const assets = input.assets.flatMap((asset, index) => {
    if (isRecord(asset) && asset.reviewStatus !== 'accepted') return [];
    const parsed = parseAcceptedDurableModelAssetForWave(asset, waveId);
    if (!parsed) {
      errors.push(`assets[${index}] is not accepted durable ${wave.id} launch evidence.`);
      return [];
    }
    return [parsed];
  });

  for (const field of ['assetId', 'videoId', 'libraryAssetId', 'jobId'] as const) {
    const values = assets.map((asset) => asset[field]);
    if (new Set(values).size !== values.length) errors.push(`Accepted ${field} values must be unique.`);
  }
  if (assets.length !== wave.models.reduce((total, model) => total + model.requiredVideos, 0)) {
    errors.push(`The accepted ${wave.id} pack must contain exactly ${wave.models.length * 2} assets.`);
  }
  for (const target of wave.models) {
    const modelAssets = assets.filter((asset) => asset.modelId === target.modelId);
    if (modelAssets.length !== target.requiredVideos) {
      errors.push(`${target.modelId} must have exactly ${target.requiredVideos} accepted assets.`);
    }
    if (new Set(modelAssets.map((asset) => asset.modelPlaylistId)).size > 1) {
      errors.push(`${target.modelId} must use one exact model playlist ID.`);
    }
    if (
      waveId === 'p0' &&
      modelAssets.length === target.requiredVideos &&
      !PLANNED_P0_LAUNCH_MODES.every((mode) => modelAssets.some((asset) => asset.mode === mode))
    ) {
      errors.push(`${target.modelId} must have one text-to-video and one image-to-video asset.`);
    }
  }
  for (const familyId of new Set(wave.models.map(({ familyId }) => familyId))) {
    const familyPlaylistIds = assets
      .filter((asset) => asset.familyId === familyId)
      .map((asset) => asset.familyPlaylistId);
    if (new Set(familyPlaylistIds).size > 1) errors.push(`${familyId} must use one exact family playlist ID.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, assets };
}

export function validateP0VideoExamplePackDocument(input: unknown): ValidationResult {
  return validateModelLaunchWaveDocument('p0', input);
}

function createMissingAssetWaveProjection(
  wave: (typeof MODEL_LAUNCH_WAVES)[number],
): ModelLaunchAssetWaveProjection {
  return {
    waveId: wave.id,
    sourceManifest: wave.sourceManifest,
    sourceStatus: 'missing',
    sourceDigest: null,
  };
}

function createMissingReadinessWaveProjection(
  wave: (typeof MODEL_LAUNCH_WAVES)[number],
): ModelLaunchWaveReadinessProjection {
  return {
    ...createMissingAssetWaveProjection(wave),
    models: [],
  };
}

function buildValidatedReadinessWaveProjection(
  wave: (typeof MODEL_LAUNCH_WAVES)[number],
  sourceDigest: string,
): ModelLaunchWaveReadinessProjection {
  const models: ModelLaunchReadinessEntry[] = wave.models.map(({ modelId, familyId, requiredVideos }) => ({
    waveId: wave.id,
    modelId,
    familyId,
    acceptedAssetCount: requiredVideos,
    familyPlaylistSlug: `family-${familyId}`,
    modelPlaylistSlug: `examples-${modelId}`,
  }));
  return {
    waveId: wave.id,
    sourceManifest: wave.sourceManifest,
    sourceStatus: 'validated',
    sourceDigest,
    models,
  };
}

export function buildModelLaunchProjectionsFromSources(sources: ModelLaunchSourceByWave): ModelLaunchProjections {
  const fullWaves: ModelLaunchAssetWaveProjection[] = [];
  const readinessWaves: ModelLaunchWaveReadinessProjection[] = [];
  const assets: AcceptedDurableModelAsset[] = [];

  for (const wave of MODEL_LAUNCH_WAVES) {
    const source = sources[wave.id];
    if (source === null) {
      fullWaves.push(createMissingAssetWaveProjection(wave));
      readinessWaves.push(createMissingReadinessWaveProjection(wave));
      continue;
    }

    let document: unknown;
    try {
      document = JSON.parse(source) as unknown;
    } catch {
      throw new Error(`Invalid ${wave.id} launch pack: source manifest is not valid JSON.`);
    }
    const validation = validateModelLaunchWaveDocument(wave.id, document);
    if (!validation.ok) {
      throw new Error(`Invalid ${wave.id} launch pack:\n${validation.errors.join('\n')}`);
    }
    const sourceDigest = createHash('sha256').update(source).digest('hex');
    fullWaves.push({
      waveId: wave.id,
      sourceManifest: wave.sourceManifest,
      sourceStatus: 'validated',
      sourceDigest,
    });
    readinessWaves.push(buildValidatedReadinessWaveProjection(wave, sourceDigest));
    assets.push(...validation.assets);
  }

  const duplicateVideoIds = assets.filter((asset, index) => assets.findIndex(({ videoId }) => videoId === asset.videoId) !== index);
  if (duplicateVideoIds.length) {
    throw new Error('Accepted videoId values must be unique across launch waves.');
  }
  const waveOrder = new Map(MODEL_LAUNCH_WAVES.map(({ id }, index) => [id, index]));
  const modelOrder = new Map(MODEL_LAUNCH_WAVES.flatMap(({ id, models }) => models.map(({ modelId }, index) => [`${id}:${modelId}`, index])));
  assets.sort((left, right) => (
    waveOrder.get(left.waveId)! - waveOrder.get(right.waveId)! ||
    modelOrder.get(`${left.waveId}:${left.modelId}`)! - modelOrder.get(`${right.waveId}:${right.modelId}`)! ||
    left.videoId.localeCompare(right.videoId)
  ));

  const readiness: ModelLaunchReadinessProjection = {
    schemaVersion: 1,
    generatedBy: GENERATED_BY,
    waves: readinessWaves,
    models: readinessWaves.flatMap(({ models }) => models),
  };
  return {
    full: { schemaVersion: 1, generatedBy: GENERATED_BY, waves: fullWaves, assets },
    readiness,
  };
}

export function createMissingModelLaunchAssetProjection(): ModelLaunchAssetProjection {
  return buildModelLaunchProjectionsFromSources({ p0: null, p1: null }).full;
}

export function createMissingModelLaunchReadinessProjection(): ModelLaunchReadinessProjection {
  return buildModelLaunchProjectionsFromSources({ p0: null, p1: null }).readiness;
}

export function createModelLaunchReadinessProjection({
  sourceDigest,
  assets,
}: {
  sourceDigest: string;
  assets: readonly AcceptedDurableModelAsset[];
}): ModelLaunchReadinessProjection {
  const validation = validateP0VideoExamplePackDocument({ schemaVersion: 1, assets });
  if (!validation.ok || !/^[a-f0-9]{64}$/.test(sourceDigest)) {
    throw new Error('Cannot create launch readiness from incomplete or invalid P0 evidence.');
  }
  const p0 = MODEL_LAUNCH_WAVES[0];
  const p0Readiness = buildValidatedReadinessWaveProjection(p0, sourceDigest);
  const p1Readiness = createMissingReadinessWaveProjection(MODEL_LAUNCH_WAVES[1]);
  return {
    schemaVersion: 1,
    generatedBy: GENERATED_BY,
    waves: [p0Readiness, p1Readiness],
    models: p0Readiness.models,
  };
}

export function buildP0LaunchProjectionsFromSource(source: string | null): P0LaunchProjections {
  return buildModelLaunchProjectionsFromSources({ p0: source, p1: null });
}

export function checkModelLaunchProjectionFreshness({
  sources,
  full,
  readiness,
}: {
  sources: ModelLaunchSourceByWave;
  full: unknown;
  readiness: unknown;
}): { ok: boolean; stale: Array<'full' | 'readiness'> } {
  const expected = buildModelLaunchProjectionsFromSources(sources);
  const stale: Array<'full' | 'readiness'> = [];
  if (JSON.stringify(full) !== JSON.stringify(expected.full)) stale.push('full');
  if (JSON.stringify(readiness) !== JSON.stringify(expected.readiness)) stale.push('readiness');
  return { ok: stale.length === 0, stale };
}

export function checkP0LaunchProjectionFreshness({
  source,
  full,
  readiness,
}: {
  source: string | null;
  full: unknown;
  readiness: unknown;
}): { ok: boolean; stale: Array<'full' | 'readiness'> } {
  return checkModelLaunchProjectionFreshness({ sources: { p0: source, p1: null }, full, readiness });
}

export function projectAcceptedDurableModelAssets(input: unknown): AcceptedDurableModelAsset[] {
  if (
    !isRecord(input) ||
    input.schemaVersion !== 1 ||
    input.generatedBy !== GENERATED_BY ||
    !Array.isArray(input.waves) ||
    !Array.isArray(input.assets)
  ) {
    return [];
  }
  const assets = input.assets.map(parseAcceptedDurableModelAsset).filter((asset): asset is AcceptedDurableModelAsset => asset !== null);
  if (assets.length !== input.assets.length) return [];
  const parsedWaves = input.waves.filter(isRecord);
  if (parsedWaves.length !== MODEL_LAUNCH_WAVES.length) return [];
  for (const wave of MODEL_LAUNCH_WAVES) {
    const metadata = parsedWaves.find((candidate) => candidate.waveId === wave.id);
    const waveAssets = assets.filter((asset) => asset.waveId === wave.id);
    if (!metadata || metadata.sourceManifest !== wave.sourceManifest) return [];
    if (metadata.sourceStatus === 'missing' && (metadata.sourceDigest !== null || waveAssets.length !== 0)) return [];
    if (
      metadata.sourceStatus === 'validated' &&
      (typeof metadata.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(metadata.sourceDigest) ||
        !validateModelLaunchWaveDocument(wave.id, { schemaVersion: 1, assets: waveAssets }).ok)
    ) {
      return [];
    }
  }
  if (new Set(assets.map(({ videoId }) => videoId)).size !== assets.length) return [];
  return assets;
}

export function isAcceptedDurableModelAsset(asset: unknown): asset is AcceptedDurableModelAsset {
  return parseAcceptedDurableModelAsset(asset) !== null;
}
