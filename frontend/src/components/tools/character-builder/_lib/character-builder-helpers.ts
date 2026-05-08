import { dispatchAnalyticsEvent } from '@/lib/analytics-client';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import {
  CHARACTER_BUILDER_MAX_REFERENCE_IMAGES,
  CHARACTER_BUILDER_STORAGE_KEY,
  CHARACTER_BUILDER_STORAGE_VERSION,
  createDefaultCharacterBuilderState,
  getQualityEngineId,
  normalizeCharacterFormatMode,
} from '@/lib/character-builder';
import type {
  CharacterBuilderAction,
  CharacterBuilderFormatMode,
  CharacterBuilderResult,
  CharacterBuilderRun,
  CharacterBuilderSettingsSnapshot,
  CharacterBuilderState,
  CharacterBuilderTraits,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';
import type { CharacterCopy } from './character-builder-copy';
import type {
  CharacterJobPayload,
  LoadingRequestCounts,
  LoadingRequestKey,
  PendingCharacterRun,
  PersistedCharacterBuilderState,
  PersistedPendingCharacterRuns,
  UploadedAsset,
} from './character-builder-types';

export function emitClientMetric(event: string, payload?: Record<string, unknown>) {
  dispatchAnalyticsEvent(event, payload);
}

export const INITIAL_LOADING_REQUEST_COUNTS: LoadingRequestCounts = {
  'generate-1': 0,
  'generate-4': 0,
  'full-body-fix': 0,
  'lighting-variant': 0,
};

export const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;
export const CHARACTER_BUILDER_PENDING_RUNS_STORAGE_KEY = 'maxvideoai.character-builder.pending-runs.v1';

export function isAuthRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { status?: number; code?: string };
  return record.status === 401 || record.code === 'auth_required' || record.code === 'UNAUTHORIZED';
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

export function getLoadingRequestKey(action: CharacterBuilderAction, generateCount?: 1 | 4): LoadingRequestKey {
  if (action === 'generate') {
    return generateCount === 4 ? 'generate-4' : 'generate-1';
  }
  return action;
}

export function incrementLoadingRequestCount(
  counts: LoadingRequestCounts,
  key: LoadingRequestKey
): LoadingRequestCounts {
  return {
    ...counts,
    [key]: (counts[key] ?? 0) + 1,
  };
}

export function decrementLoadingRequestCount(
  counts: LoadingRequestCounts,
  key: LoadingRequestKey
): LoadingRequestCounts {
  return {
    ...counts,
    [key]: Math.max(0, (counts[key] ?? 0) - 1),
  };
}

export function getResultActionLabel(copy: CharacterCopy, action: CharacterBuilderAction): string {
  if (action === 'full-body-fix') return copy.resultCard.fullBodyFix;
  if (action === 'lighting-variant') return copy.resultCard.lightingVariant;
  return copy.resultCard.referenceOutput;
}

export function getFormatDisplayLabel(
  copy: CharacterCopy,
  formatMode: CharacterBuilderFormatMode,
  qualityMode: CharacterBuilderState['qualityMode']
): string {
  if (formatMode === '4k') return copy.options.format['4k'].label;
  if (formatMode === '2k') return copy.options.format['2k'].label;
  return qualityMode === 'final' ? '2K' : '1K';
}


export function getCharacterBillingProductKey(qualityMode: CharacterBuilderState['qualityMode']): string {
  return qualityMode === 'final' ? 'character-final' : 'character-draft';
}

export function formatUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  return `$${value.toFixed(2)}`;
}

export function getUploadTooLargeMessage(copy: CharacterCopy, maxMB: number): string {
  return formatTemplate(copy.uploadTooLarge, { maxMB });
}

export async function uploadImage(file: File, copy: CharacterCopy): Promise<UploadedAsset> {
  const preparedFile = await prepareImageFileForUpload(file, {
    maxBytes: DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024,
  });

  const formData = new FormData();
  formData.set('file', preparedFile, preparedFile.name);

  const response = await authFetch('/api/uploads/image', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        maxMB?: number;
        asset?: {
          url: string;
          width?: number | null;
          height?: number | null;
          name?: string | null;
        };
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    if (payload?.error === 'FILE_TOO_LARGE' || response.status === 413) {
      throw new Error(getUploadTooLargeMessage(copy, payload?.maxMB ?? DEFAULT_UPLOAD_LIMIT_MB));
    }
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }

  return {
    url: payload.asset.url,
    width: payload.asset.width,
    height: payload.asset.height,
    name: payload.asset.name,
  };
}

export function readPersistedState(): CharacterBuilderState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(CHARACTER_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCharacterBuilderState | null;
    if (!parsed || parsed.version !== CHARACTER_BUILDER_STORAGE_VERSION || !parsed.state) return null;
    const base = createDefaultCharacterBuilderState(parsed.state.sourceMode === 'reference-image' ? 'reference-image' : 'scratch');
    return {
      ...base,
      ...parsed.state,
      traits: normalizeHairAndOutfitModes({
        ...base.traits,
        ...parsed.state.traits,
      }),
      formatMode: normalizeCharacterFormatMode(parsed.state.formatMode, parsed.state.qualityMode ?? base.qualityMode),
      outputOptions: {
        ...base.outputOptions,
        ...parsed.state.outputOptions,
        fullBodyRequired:
          (parsed.state.outputMode ?? base.outputMode) === 'character-sheet'
            ? (parsed.state.outputOptions?.fullBodyRequired ?? base.outputOptions.fullBodyRequired)
            : false,
      },
    };
  } catch {
    return null;
  }
}

export function readPersistedPendingRuns(): PendingCharacterRun[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CHARACTER_BUILDER_PENDING_RUNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedPendingCharacterRuns | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.runs)) return [];
    return parsed.runs.filter(
      (entry): entry is PendingCharacterRun =>
        Boolean(
          entry &&
            typeof entry.id === 'string' &&
            entry.id.length &&
            typeof entry.jobId === 'string' &&
            entry.jobId.length &&
            typeof entry.createdAt === 'string' &&
            entry.createdAt.length
        )
    );
  } catch {
    return [];
  }
}

export function writePersistedPendingRuns(runs: PendingCharacterRun[]) {
  if (typeof window === 'undefined') return;
  if (!runs.length) {
    window.localStorage.removeItem(CHARACTER_BUILDER_PENDING_RUNS_STORAGE_KEY);
    return;
  }
  const payload: PersistedPendingCharacterRuns = {
    version: 1,
    runs,
  };
  window.localStorage.setItem(CHARACTER_BUILDER_PENDING_RUNS_STORAGE_KEY, JSON.stringify(payload));
}

export function writePersistedState(state: CharacterBuilderState) {
  if (typeof window === 'undefined') return;
  const payload: PersistedCharacterBuilderState = {
    version: CHARACTER_BUILDER_STORAGE_VERSION,
    state,
  };
  window.localStorage.setItem(CHARACTER_BUILDER_STORAGE_KEY, JSON.stringify(payload));
}

export function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function getFlattenedResults(runs: CharacterBuilderRun[]): CharacterBuilderResult[] {
  return runs.flatMap((run) => run.results);
}

export function getCharacterEngineLabel(qualityMode: CharacterBuilderRun['qualityMode']): string {
  return getQualityEngineId(qualityMode) === 'nano-banana-pro' ? 'Nano Banana Pro' : 'Nano Banana 2';
}

export function buildRecoveredRunFromJob(
  pendingRun: PendingCharacterRun,
  payload: CharacterJobPayload
): CharacterBuilderRun | null {
  const renderIds = Array.isArray(payload.renderIds)
    ? payload.renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  if (!renderIds.length) return null;

  const renderThumbUrls = Array.isArray(payload.renderThumbUrls)
    ? payload.renderThumbUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const snapshot =
    payload.settingsSnapshot && typeof payload.settingsSnapshot === 'object'
      ? (payload.settingsSnapshot as CharacterBuilderSettingsSnapshot)
      : null;
  const createdAt = payload.createdAt ?? pendingRun.createdAt;
  const engineId = snapshot?.engineId ?? getQualityEngineId(pendingRun.qualityMode);
  const engineLabel = snapshot?.engineLabel ?? getCharacterEngineLabel(pendingRun.qualityMode);
  const runId = `character_run_${pendingRun.jobId}`;
  const defaultBuilderState = createDefaultCharacterBuilderState();
  const fallbackSnapshot: CharacterBuilderSettingsSnapshot = {
    schemaVersion: 1,
    surface: 'character-builder',
    action: pendingRun.action,
    engineId,
    engineLabel,
    inputMode: 't2i',
    prompt: '',
    builder: {
      sourceMode: defaultBuilderState.sourceMode,
      outputMode: pendingRun.outputMode,
      consistencyMode: defaultBuilderState.consistencyMode,
      referenceStrength: defaultBuilderState.referenceStrength,
      qualityMode: pendingRun.qualityMode,
      formatMode: pendingRun.formatMode,
      referenceImages: defaultBuilderState.referenceImages,
      traits: defaultBuilderState.traits,
      outputOptions: defaultBuilderState.outputOptions,
      advancedNotes: defaultBuilderState.advancedNotes,
      mustRemainVisible: defaultBuilderState.mustRemainVisible,
    },
    lineage: {
      parentResultId: null,
      parentRunId: null,
      pinnedReferenceResultId: null,
    },
  };

  return {
    id: runId,
    jobId: pendingRun.jobId,
    action: snapshot?.action ?? pendingRun.action,
    outputMode: snapshot?.builder.outputMode ?? pendingRun.outputMode,
    qualityMode: snapshot?.builder.qualityMode ?? pendingRun.qualityMode,
    formatMode: normalizeCharacterFormatMode(snapshot?.builder.formatMode ?? pendingRun.formatMode, snapshot?.builder.qualityMode ?? pendingRun.qualityMode),
    engineId,
    engineLabel,
    createdAt,
    parentResultId: snapshot?.lineage?.parentResultId ?? null,
    results: renderIds.map((url, index) => ({
      id: `${pendingRun.jobId}:result:${index + 1}`,
      runId,
      jobId: pendingRun.jobId,
      url,
      thumbUrl: renderThumbUrls[index] ?? url,
      engineId,
      engineLabel,
      action: snapshot?.action ?? pendingRun.action,
      outputMode: snapshot?.builder.outputMode ?? pendingRun.outputMode,
      qualityMode: snapshot?.builder.qualityMode ?? pendingRun.qualityMode,
      createdAt,
      parentResultId: snapshot?.lineage?.parentResultId ?? null,
    })),
    settingsSnapshot: snapshot ?? fallbackSnapshot,
    pricing: payload.pricing,
    requestId: pendingRun.jobId,
    providerJobId: null,
  };
}

export function buildReferenceImage(
  role: CharacterBuilderReferenceImage['role'],
  asset: UploadedAsset
): CharacterBuilderReferenceImage {
  return {
    id: `${role}_${Date.now()}`,
    role,
    url: asset.url,
    width: asset.width ?? null,
    height: asset.height ?? null,
    name: asset.name ?? null,
  };
}

export function getRefByRole(
  referenceImages: CharacterBuilderReferenceImage[],
  role: CharacterBuilderReferenceImage['role']
) {
  return referenceImages.find((image) => image.role === role) ?? null;
}

export function updateReferenceImage(
  referenceImages: CharacterBuilderReferenceImage[],
  nextImage: CharacterBuilderReferenceImage
) {
  const filtered = referenceImages.filter((image) => image.role !== nextImage.role);
  return [...filtered, nextImage].slice(0, CHARACTER_BUILDER_MAX_REFERENCE_IMAGES);
}

export function removeReferenceImage(
  referenceImages: CharacterBuilderReferenceImage[],
  role: CharacterBuilderReferenceImage['role']
) {
  return referenceImages.filter((image) => image.role !== role);
}

export function hasCustomHairSettings(traits: CharacterBuilderTraits): boolean {
  if (typeof traits.customHairDescription === 'string' && traits.customHairDescription.trim().length > 0) {
    return true;
  }
  return [traits.hairColor.value, traits.hairLength.value, traits.hairstyle.value].some(
    (value) => typeof value === 'string' && value !== 'auto'
  );
}

export function hasCustomOutfitSettings(traits: CharacterBuilderTraits): boolean {
  if (typeof traits.customOutfitDescription === 'string' && traits.customOutfitDescription.trim().length > 0) {
    return true;
  }
  return typeof traits.outfitStyle.value === 'string' && traits.outfitStyle.value !== 'auto';
}

export function normalizeHairAndOutfitModes(traits: CharacterBuilderTraits): CharacterBuilderTraits {
  return {
    ...traits,
    hairEnabled: hasCustomHairSettings(traits),
    outfitEnabled: hasCustomOutfitSettings(traits),
  };
}

export function parseCharacterBuilderSnapshot(snapshot: unknown): Partial<CharacterBuilderState> | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const record = snapshot as {
    schemaVersion?: unknown;
    surface?: unknown;
    builder?: unknown;
    lineage?: unknown;
  };
  if (record.schemaVersion !== 1 || record.surface !== 'character-builder') return null;

  const builder = record.builder as CharacterBuilderSettingsSnapshot['builder'] | undefined;
  const lineage = record.lineage as CharacterBuilderSettingsSnapshot['lineage'] | undefined;
  if (!builder) return null;
  const base = createDefaultCharacterBuilderState(builder.sourceMode);

  return {
    sourceMode: builder.sourceMode ?? base.sourceMode,
    referenceImages: Array.isArray(builder.referenceImages) ? builder.referenceImages : [],
    traits: normalizeHairAndOutfitModes({
      ...base.traits,
      ...builder.traits,
    }),
    outputMode: builder.outputMode ?? base.outputMode,
    consistencyMode: builder.consistencyMode ?? base.consistencyMode,
    referenceStrength: builder.referenceStrength ?? base.referenceStrength,
    qualityMode: builder.qualityMode ?? base.qualityMode,
    formatMode: normalizeCharacterFormatMode(builder.formatMode, builder.qualityMode ?? base.qualityMode),
    outputOptions: {
      ...base.outputOptions,
      ...builder.outputOptions,
      fullBodyRequired:
        (builder.outputMode ?? base.outputMode) === 'character-sheet'
          ? (builder.outputOptions?.fullBodyRequired ?? base.outputOptions.fullBodyRequired)
          : false,
    },
    advancedNotes: builder.advancedNotes ?? '',
    mustRemainVisible: Array.isArray(builder.mustRemainVisible) ? builder.mustRemainVisible : [],
    selectedResultId: typeof lineage?.parentResultId === 'string' ? lineage.parentResultId : null,
    pinnedReferenceResultId:
      typeof lineage?.pinnedReferenceResultId === 'string' ? lineage.pinnedReferenceResultId : null,
  };
}
