import {
  P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID,
  P0_VIDEO_EXAMPLE_MODEL_IDS,
  type ModelLaunchReadinessProjection,
  type P0VideoExampleModelId,
} from '@/config/model-launch-readiness-schema';
import { getRuntimeModelById } from '@/config/model-runtime';

const SOURCE_MANIFEST = 'docs/model-launch/p0-video-example-pack.json' as const;
export type AcceptedDurableModelAsset = {
  assetId: string;
  videoId: string;
  libraryAssetId: string;
  jobId: string;
  modelId: P0VideoExampleModelId;
  engineId: P0VideoExampleModelId;
  familyId: 'wan' | 'ltx' | 'grok' | 'flux';
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
  publicationState: 'pending_publication' | 'gallery_only';
  watchPageCandidate: boolean;
  familyPlaylistId: string;
  modelPlaylistId: string;
  playlistSlugs: readonly string[];
};

export type ModelLaunchAssetProjection = {
  schemaVersion: 1;
  generatedBy: 'scripts/generate-p0-launch-assets.ts';
  sourceManifest: typeof SOURCE_MANIFEST;
  sourceStatus: 'missing' | 'validated';
  sourceDigest: string | null;
  assets: AcceptedDurableModelAsset[];
};

type ValidationResult =
  | { ok: true; assets: AcceptedDurableModelAsset[] }
  | { ok: false; errors: string[] };

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

function isP0ModelId(value: unknown): value is P0VideoExampleModelId {
  return typeof value === 'string' && P0_VIDEO_EXAMPLE_MODEL_IDS.includes(value as P0VideoExampleModelId);
}

export function parseAcceptedDurableModelAsset(value: unknown): AcceptedDurableModelAsset | null {
  if (!isRecord(value) || value.reviewStatus !== 'accepted') return null;
  if (value.publicationState !== 'pending_publication' && value.publicationState !== 'gallery_only') return null;
  if (
    !nonEmptyString(value.assetId) ||
    !nonEmptyString(value.videoId) ||
    !nonEmptyString(value.libraryAssetId) ||
    !nonEmptyString(value.jobId) ||
    !isP0ModelId(value.modelId) ||
    !isP0ModelId(value.engineId) ||
    !nonEmptyString(value.familyId) ||
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
    typeof value.watchPageCandidate !== 'boolean' ||
    !nonEmptyString(value.familyPlaylistId) ||
    !nonEmptyString(value.modelPlaylistId) ||
    !Array.isArray(value.playlistSlugs) ||
    !value.playlistSlugs.every(nonEmptyString)
  ) {
    return null;
  }

  const model = getRuntimeModelById(value.modelId);
  const familyId = P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID[value.modelId];
  if (
    !model ||
    value.engineId !== value.modelId ||
    model.family !== familyId ||
    value.familyId !== familyId
  ) {
    return null;
  }
  if (
    (value.sourceKind === 'text' && value.sourceAssetIds.length !== 0) ||
    (value.sourceKind !== 'text' && value.sourceAssetIds.length === 0) ||
    value.familyPlaylistId === value.modelPlaylistId
  ) {
    return null;
  }
  const playlistSlugs = Array.from(new Set(value.playlistSlugs));
  if (
    playlistSlugs.length !== 2 ||
    !playlistSlugs.includes(`family-${familyId}`) ||
    !playlistSlugs.includes(`examples-${value.modelId}`)
  ) {
    return null;
  }

  return {
    assetId: value.assetId,
    videoId: value.videoId,
    libraryAssetId: value.libraryAssetId,
    jobId: value.jobId,
    modelId: value.modelId,
    engineId: value.engineId,
    familyId,
    mode: value.mode,
    prompt: value.prompt,
    sourceKind: value.sourceKind,
    sourceAssetIds: Array.from(new Set(value.sourceAssetIds)),
    videoUrl: value.videoUrl,
    thumbnailUrl: value.thumbnailUrl,
    width: value.width,
    height: value.height,
    durationSec: value.durationSec,
    acceptedAt: value.acceptedAt,
    reviewStatus: 'accepted',
    publicationState: value.publicationState,
    watchPageCandidate: value.watchPageCandidate,
    familyPlaylistId: value.familyPlaylistId,
    modelPlaylistId: value.modelPlaylistId,
    playlistSlugs,
  };
}

export function validateP0VideoExamplePackDocument(input: unknown): ValidationResult {
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.assets)) {
    return { ok: false, errors: ['Expected schemaVersion 1 and an assets array.'] };
  }

  const errors: string[] = [];
  const assets = input.assets.flatMap((asset, index) => {
    if (isRecord(asset) && asset.reviewStatus !== 'accepted') return [];
    const parsed = parseAcceptedDurableModelAsset(asset);
    if (!parsed) {
      errors.push(`assets[${index}] is not accepted durable Task 12 evidence.`);
      return [];
    }
    return [parsed];
  });

  for (const field of ['assetId', 'videoId', 'libraryAssetId', 'jobId'] as const) {
    const values = assets.map((asset) => asset[field]);
    if (new Set(values).size !== values.length) errors.push(`Accepted ${field} values must be unique.`);
  }
  if (assets.length !== P0_VIDEO_EXAMPLE_MODEL_IDS.length * 2) {
    errors.push('The accepted Task 12 pack must contain exactly fourteen assets.');
  }
  for (const modelId of P0_VIDEO_EXAMPLE_MODEL_IDS) {
    const modelAssets = assets.filter((asset) => asset.modelId === modelId);
    if (modelAssets.length !== 2) errors.push(`${modelId} must have exactly two accepted assets.`);
    if (new Set(modelAssets.map((asset) => asset.modelPlaylistId)).size > 1) {
      errors.push(`${modelId} must use one exact model playlist ID.`);
    }
    if (modelAssets.length === 2 && !modelAssets.some((asset) => asset.watchPageCandidate)) {
      errors.push(`${modelId} must have at least one watch-page candidate.`);
    }
  }
  for (const familyId of ['wan', 'ltx', 'grok', 'flux'] as const) {
    const familyPlaylistIds = assets
      .filter((asset) => asset.familyId === familyId)
      .map((asset) => asset.familyPlaylistId);
    if (new Set(familyPlaylistIds).size > 1) errors.push(`${familyId} must use one exact family playlist ID.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, assets };
}

export function createMissingModelLaunchAssetProjection(): ModelLaunchAssetProjection {
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/generate-p0-launch-assets.ts',
    sourceManifest: SOURCE_MANIFEST,
    sourceStatus: 'missing',
    sourceDigest: null,
    assets: [],
  };
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
    throw new Error('Cannot create launch readiness from incomplete or invalid Task 12 evidence.');
  }
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/generate-p0-launch-assets.ts',
    sourceManifest: SOURCE_MANIFEST,
    sourceStatus: 'validated',
    sourceDigest,
    models: P0_VIDEO_EXAMPLE_MODEL_IDS.map((modelId) => {
      const familyId = P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID[modelId];
      return {
        modelId,
        familyId,
        acceptedAssetCount: 2,
        familyPlaylistSlug: `family-${familyId}`,
        modelPlaylistSlug: `examples-${modelId}`,
      };
    }),
  };
}

export function createMissingModelLaunchReadinessProjection(): ModelLaunchReadinessProjection {
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/generate-p0-launch-assets.ts',
    sourceManifest: SOURCE_MANIFEST,
    sourceStatus: 'missing',
    sourceDigest: null,
    models: [],
  };
}

export function projectAcceptedDurableModelAssets(input: unknown): AcceptedDurableModelAsset[] {
  if (
    !isRecord(input) ||
    input.schemaVersion !== 1 ||
    input.generatedBy !== 'scripts/generate-p0-launch-assets.ts' ||
    input.sourceManifest !== SOURCE_MANIFEST ||
    input.sourceStatus !== 'validated' ||
    typeof input.sourceDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.sourceDigest) ||
    !Array.isArray(input.assets)
  ) {
    return [];
  }
  const validation = validateP0VideoExamplePackDocument({ schemaVersion: 1, assets: input.assets });
  return validation.ok ? validation.assets : [];
}

export function isAcceptedDurableModelAsset(asset: unknown): asset is AcceptedDurableModelAsset {
  return parseAcceptedDurableModelAsset(asset) !== null;
}
