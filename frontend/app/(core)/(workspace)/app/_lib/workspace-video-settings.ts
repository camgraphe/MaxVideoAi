import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import type { QuadPreviewTile } from '@/components/QuadPreviewPanel';
import type { SharedVideoPreview, SelectedVideoPreview } from '@/lib/video-preview-group';
import type { EngineCaps, Mode } from '@/types/engines';
import type { VideoGroup } from '@/types/video-groups';
import type { ReferenceAsset } from './workspace-assets';
import { coerceStoredExtraInputValues, type FormState } from './workspace-form-state';
import {
  coerceFormState,
  getPreferredEngineMode,
  isModeValue,
  matchesEngineToken,
  normalizeEngineToken,
  resolveAudioDefault,
  resolveBooleanFieldDefault,
} from './workspace-engine-helpers';
import { MULTI_PROMPT_MIN_SEC } from './workspace-input-helpers';

type MemberTier = 'Member' | 'Plus' | 'Pro';
type ShotType = 'customize' | 'intelligent';

type VideoSettingsRecord = {
  schemaVersion?: unknown;
  surface?: unknown;
  engineId?: unknown;
  engineLabel?: unknown;
  inputMode?: unknown;
  prompt?: unknown;
  negativePrompt?: unknown;
  core?: unknown;
  advanced?: unknown;
  refs?: unknown;
  meta?: unknown;
};

type CreateLocalId = (prefix: string) => string;

export type VideoSettingsSnapshotOptions = {
  engines: EngineCaps[];
  engineMap: Map<string, EngineCaps>;
  createLocalId: CreateLocalId;
  createFallbackScene: () => MultiPromptScene;
  createFallbackKlingElement: () => KlingElementState;
};

export type ResolvedVideoSettingsSnapshot = {
  engine: EngineCaps;
  mode: Mode;
  prompt: string;
  negativePrompt: string;
  memberTier: MemberTier | null;
  cfgScale: number | null;
  shotType: ShotType | null;
  voiceIdsInput: string;
  multiPrompt: {
    enabled: boolean;
    scenes: MultiPromptScene[];
  };
  formValues: {
    durationSec?: number;
    durationOption?: number | string;
    numFrames?: number;
    resolution?: string;
    aspectRatio?: string;
    fps?: number;
    iterations?: number;
    audio?: boolean;
    loop?: boolean;
    seed?: number | null;
    cameraFixed?: boolean;
    safetyChecker?: boolean;
    extraInputValues: Record<string, unknown>;
  };
  inputAssets: Record<string, (ReferenceAsset | null)[]> | null;
  klingElements: KlingElementState[] | null;
};

export type VideoJobPayload = {
  ok?: boolean;
  error?: string;
  settingsSnapshot?: unknown;
  videoUrl?: string;
  previewVideoUrl?: string;
  thumbUrl?: string;
  aspectRatio?: string;
  progress?: number;
  status?: string;
  pricing?: { totalCents?: number; currency?: string } | null;
  finalPriceCents?: number;
  currency?: string;
  createdAt?: string;
};

export type VideoJobMediaPatch = {
  videoUrl: string | null;
  previewVideoUrl: string | null;
  thumbUrl: string | null;
  aspectRatio?: string;
  progress?: number;
  status?: string;
};

export type RequestedJobPreview = {
  sharedVideo: SharedVideoPreview;
  selectedPreview: SelectedVideoPreview;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readInteger(value: unknown): number | undefined {
  const number = readFiniteNumber(value);
  return typeof number === 'number' ? Math.trunc(number) : undefined;
}

function readMemberTier(value: unknown): MemberTier | null {
  return value === 'Member' || value === 'Plus' || value === 'Pro' ? value : null;
}

function readShotType(value: unknown): ShotType | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'customize' || normalized === 'intelligent' ? normalized : null;
}

function readVoiceIdsInput(value: unknown): string {
  const ids = Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    : typeof value === 'string'
      ? value.split(',').map((entry) => entry.trim())
      : [];
  return ids.filter((entry) => entry.length > 0).join(', ');
}

function readMultiPromptScenes(value: unknown, createLocalId: CreateLocalId): MultiPromptScene[] | null {
  if (!Array.isArray(value)) return null;
  const scenes = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const prompt = typeof record.prompt === 'string' ? record.prompt : '';
      const duration =
        typeof record.duration === 'number'
          ? Math.round(record.duration)
          : typeof record.duration === 'string'
            ? Math.round(Number(record.duration.replace(/[^\d.]/g, '')))
            : 0;
      if (!prompt.trim()) return null;
      return {
        id: createLocalId('scene'),
        prompt,
        duration: duration || MULTI_PROMPT_MIN_SEC,
      };
    })
    .filter((scene): scene is MultiPromptScene => Boolean(scene));
  return scenes.length ? scenes : null;
}

function readSnapshotInputAssets(value: unknown): Record<string, (ReferenceAsset | null)[]> | null {
  if (value !== null && !Array.isArray(value)) return null;
  const next: Record<string, (ReferenceAsset | null)[]> = {};
  if (!Array.isArray(value)) return next;

  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const attachment = entry as Record<string, unknown>;
    const slotId = typeof attachment.slotId === 'string' ? attachment.slotId : '';
    const url = typeof attachment.url === 'string' ? attachment.url : '';
    if (!slotId || !url) return;
    const kind = attachment.kind === 'video' ? 'video' : attachment.kind === 'audio' ? 'audio' : 'image';
    const name = typeof attachment.name === 'string' ? attachment.name : `${kind}-${index + 1}`;
    const type =
      typeof attachment.type === 'string'
        ? attachment.type
        : kind === 'image'
          ? 'image/*'
          : kind === 'audio'
            ? 'audio/*'
            : 'video/*';
    const size = readFiniteNumber(attachment.size) ?? 0;
    const width = readFiniteNumber(attachment.width) ?? null;
    const height = readFiniteNumber(attachment.height) ?? null;
    const assetId = typeof attachment.assetId === 'string' ? attachment.assetId : undefined;
    const refAsset: ReferenceAsset = {
      id: assetId ?? `snapshot-${index}`,
      fieldId: slotId,
      previewUrl: url,
      kind,
      name,
      size,
      type,
      url,
      width,
      height,
      assetId,
      status: 'ready',
    };
    next[slotId] = [...(next[slotId] ?? []), refAsset];
  });
  return next;
}

function buildKlingAssetFromUrl(
  url: string,
  kind: 'image' | 'video',
  index: number,
  createLocalId: CreateLocalId
): KlingElementAsset {
  return {
    id: createLocalId(`kling_${kind}`),
    previewUrl: url,
    name: url.split('/').pop() ?? `${kind}-${index + 1}`,
    kind,
    status: 'ready',
    url,
  };
}

function readSnapshotKlingElements(
  value: unknown,
  createLocalId: CreateLocalId,
  createFallbackKlingElement: () => KlingElementState
): KlingElementState[] | null {
  if (value !== null && !Array.isArray(value)) return null;
  const elements = Array.isArray(value)
    ? value
        .map((entry, elementIndex) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          const frontalUrl =
            typeof record.frontalImageUrl === 'string' && record.frontalImageUrl.trim().length
              ? record.frontalImageUrl.trim()
              : null;
          const referenceUrls = Array.isArray(record.referenceImageUrls)
            ? record.referenceImageUrls
                .map((entry: unknown) => (typeof entry === 'string' ? entry.trim() : ''))
                .filter((entry): entry is string => entry.length > 0)
                .slice(0, 3)
            : [];
          const videoUrl =
            typeof record.videoUrl === 'string' && record.videoUrl.trim().length ? record.videoUrl.trim() : null;
          if (!frontalUrl && referenceUrls.length === 0 && !videoUrl) return null;
          const references = Array.from({ length: 3 }, (_, index) =>
            referenceUrls[index] ? buildKlingAssetFromUrl(referenceUrls[index], 'image', index, createLocalId) : null
          );
          return {
            id: createLocalId(`element_${elementIndex}`),
            frontal: frontalUrl ? buildKlingAssetFromUrl(frontalUrl, 'image', 0, createLocalId) : null,
            references,
            video: videoUrl ? buildKlingAssetFromUrl(videoUrl, 'video', 0, createLocalId) : null,
          } satisfies KlingElementState;
        })
        .filter((element): element is KlingElementState => Boolean(element))
    : [];
  return elements.length ? elements : [createFallbackKlingElement()];
}

export function resolveVideoSettingsSnapshot(
  snapshot: unknown,
  options: VideoSettingsSnapshotOptions
): ResolvedVideoSettingsSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Settings snapshot missing');
  }
  const record = snapshot as VideoSettingsRecord;
  if (record.schemaVersion !== 1) {
    throw new Error('Unsupported snapshot version');
  }
  if (record.surface !== 'video') {
    throw new Error('This snapshot is not for video');
  }

  const snapshotEngineId = typeof record.engineId === 'string' ? record.engineId : null;
  const snapshotToken = snapshotEngineId ? normalizeEngineToken(snapshotEngineId) : null;
  const engine =
    (snapshotEngineId ? options.engineMap.get(snapshotEngineId) : null) ??
    (snapshotToken ? options.engines.find((candidate) => matchesEngineToken(candidate, snapshotToken)) : null) ??
    options.engines[0] ??
    null;
  if (!engine) {
    throw new Error('No engines available to apply this snapshot');
  }

  const snapshotModeRaw = typeof record.inputMode === 'string' ? record.inputMode : '';
  const snapshotMode: Mode = isModeValue(snapshotModeRaw) ? snapshotModeRaw : getPreferredEngineMode(engine);
  const mode = engine.modes.includes(snapshotMode) ? snapshotMode : getPreferredEngineMode(engine);
  const core = readRecord(record.core);
  const advanced = readRecord(record.advanced);
  const refs = readRecord(record.refs);
  const meta = readRecord(record.meta);
  const multiPromptScenes = readMultiPromptScenes(advanced.multiPrompt, options.createLocalId);

  return {
    engine,
    mode,
    prompt: typeof record.prompt === 'string' ? record.prompt : '',
    negativePrompt: typeof record.negativePrompt === 'string' ? record.negativePrompt : '',
    memberTier: readMemberTier(meta.memberTier),
    cfgScale: readFiniteNumber(advanced.cfgScale) ?? null,
    shotType: readShotType(advanced.shotType),
    voiceIdsInput: readVoiceIdsInput(advanced.voiceIds),
    multiPrompt: {
      enabled: Boolean(multiPromptScenes?.length),
      scenes: multiPromptScenes ?? [options.createFallbackScene()],
    },
    formValues: {
      durationSec: readFiniteNumber(core.durationSec),
      durationOption:
        typeof core.durationOption === 'number' || typeof core.durationOption === 'string'
          ? core.durationOption
          : undefined,
      numFrames: readInteger(core.numFrames),
      resolution: typeof core.resolution === 'string' ? core.resolution : undefined,
      aspectRatio: typeof core.aspectRatio === 'string' ? core.aspectRatio : undefined,
      fps: readInteger(core.fps),
      iterations:
        typeof core.iterationCount === 'number' && Number.isFinite(core.iterationCount)
          ? Math.max(1, Math.min(4, Math.trunc(core.iterationCount)))
          : undefined,
      audio: typeof core.audio === 'boolean' ? core.audio : undefined,
      loop: typeof advanced.loop === 'boolean' ? advanced.loop : undefined,
      seed: readInteger(advanced.seed) ?? null,
      cameraFixed: typeof advanced.cameraFixed === 'boolean' ? advanced.cameraFixed : undefined,
      safetyChecker: typeof advanced.safetyChecker === 'boolean' ? advanced.safetyChecker : undefined,
      extraInputValues: coerceStoredExtraInputValues(advanced.extraInputValues) ?? {},
    },
    inputAssets: Object.prototype.hasOwnProperty.call(refs, 'inputs') ? readSnapshotInputAssets(refs.inputs) : null,
    klingElements: Object.prototype.hasOwnProperty.call(refs, 'elements')
      ? readSnapshotKlingElements(refs.elements, options.createLocalId, options.createFallbackKlingElement)
      : null,
  };
}

export function buildVideoSettingsFormState(
  snapshot: ResolvedVideoSettingsSnapshot,
  previous: FormState | null
): FormState {
  const { engine, mode, formValues } = snapshot;
  const candidate: FormState = {
    engineId: engine.id,
    mode,
    durationSec: typeof formValues.durationSec === 'number' ? formValues.durationSec : previous?.durationSec ?? 4,
    durationOption: formValues.durationOption ?? previous?.durationOption ?? undefined,
    numFrames: formValues.numFrames ?? previous?.numFrames ?? undefined,
    resolution: formValues.resolution ?? previous?.resolution ?? (engine.resolutions[0] ?? '1080p'),
    aspectRatio: formValues.aspectRatio ?? previous?.aspectRatio ?? (engine.aspectRatios[0] ?? '16:9'),
    fps: formValues.fps ?? previous?.fps ?? (engine.fps?.[0] ?? 24),
    iterations: formValues.iterations ?? previous?.iterations ?? 1,
    seedLocked: previous?.seedLocked ?? false,
    loop: typeof formValues.loop === 'boolean' ? formValues.loop : previous?.loop,
    audio: typeof formValues.audio === 'boolean' ? formValues.audio : previous?.audio ?? resolveAudioDefault(engine, mode),
    seed: formValues.seed ?? previous?.seed ?? null,
    cameraFixed:
      typeof formValues.cameraFixed === 'boolean'
        ? formValues.cameraFixed
        : previous?.cameraFixed ?? resolveBooleanFieldDefault(engine, mode, 'camera_fixed', false),
    safetyChecker:
      typeof formValues.safetyChecker === 'boolean'
        ? formValues.safetyChecker
        : previous?.safetyChecker ?? resolveBooleanFieldDefault(engine, mode, 'enable_safety_checker', true),
    extraInputValues: formValues.extraInputValues,
  };
  return coerceFormState(engine, mode, candidate);
}

export function buildVideoSettingsSnapshotFromTile(tile: QuadPreviewTile): unknown {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: tile.engineId,
    inputMode: 't2v',
    prompt: tile.prompt,
    negativePrompt: null,
    core: {
      durationSec: tile.durationSec,
      durationOption: null,
      numFrames: null,
      aspectRatio: tile.aspectRatio,
      resolution: null,
      fps: null,
      iterationCount: tile.iterationCount,
      audio: typeof tile.hasAudio === 'boolean' ? tile.hasAudio : null,
    },
    advanced: { cfgScale: null, loop: null },
    refs: { imageUrl: null, referenceImages: null, firstFrameUrl: null, lastFrameUrl: null, inputs: null },
    meta: { derived: true },
  };
}

export function buildVideoSettingsSnapshotFromSharedVideo(sharedVideo: SharedVideoPreview): unknown {
  const durationSec =
    typeof sharedVideo.durationSec === 'number' && sharedVideo.durationSec > 0 ? sharedVideo.durationSec : null;
  const aspectRatio =
    typeof sharedVideo.aspectRatio === 'string' && sharedVideo.aspectRatio.trim().length
      ? sharedVideo.aspectRatio.trim()
      : '16:9';
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: sharedVideo.engineId,
    engineLabel: sharedVideo.engineLabel,
    inputMode: 't2v',
    prompt: sharedVideo.prompt ?? sharedVideo.promptExcerpt ?? '',
    negativePrompt: null,
    core: {
      durationSec,
      durationOption: null,
      numFrames: null,
      aspectRatio,
      resolution: null,
      fps: null,
      iterationCount: 1,
      audio: null,
    },
    advanced: { cfgScale: null, loop: null },
    refs: { imageUrl: null, referenceImages: null, firstFrameUrl: null, lastFrameUrl: null, inputs: null },
    meta: { derived: true },
  };
}

export function buildVideoJobMediaPatch(payload: VideoJobPayload): VideoJobMediaPatch | null {
  const videoUrl = typeof payload.videoUrl === 'string' && payload.videoUrl.length ? payload.videoUrl : null;
  const previewVideoUrl =
    typeof payload.previewVideoUrl === 'string' && payload.previewVideoUrl.length ? payload.previewVideoUrl : null;
  const thumbUrl = typeof payload.thumbUrl === 'string' && payload.thumbUrl.length ? payload.thumbUrl : null;
  if (!videoUrl && !thumbUrl) return null;
  return {
    videoUrl,
    previewVideoUrl,
    thumbUrl,
    aspectRatio: payload.aspectRatio,
    progress: payload.progress,
    status: payload.status,
  };
}

export function applyVideoJobMediaPatchToSelectedPreview(
  current: SelectedVideoPreview | null,
  jobId: string,
  patch: VideoJobMediaPatch
): SelectedVideoPreview | null {
  if (!current || (current.id !== jobId && current.localKey !== jobId)) return current;
  return {
    ...current,
    videoUrl: patch.videoUrl ?? current.videoUrl,
    previewVideoUrl: patch.previewVideoUrl ?? current.previewVideoUrl,
    thumbUrl: patch.thumbUrl ?? current.thumbUrl,
    aspectRatio: patch.aspectRatio ?? current.aspectRatio,
    progress: typeof patch.progress === 'number' ? patch.progress : current.progress,
    status: patch.status === 'failed' ? 'failed' : patch.status === 'pending' ? 'pending' : current.status,
  };
}

export function applyVideoJobMediaPatchToCompositeOverride(
  current: VideoGroup | null,
  jobId: string,
  patch: VideoJobMediaPatch
): VideoGroup | null {
  if (!current) return current;
  let changed = false;
  const items = current.items.map((item) => {
    if (item.id !== jobId && item.jobId !== jobId) return item;
    changed = true;
    return {
      ...item,
      url: patch.videoUrl ?? item.url,
      previewUrl: patch.previewVideoUrl ?? item.previewUrl,
      thumb: patch.thumbUrl ?? item.thumb,
      aspect: patch.aspectRatio === '9:16' || patch.aspectRatio === '1:1' ? patch.aspectRatio : item.aspect,
    };
  });
  return changed ? { ...current, items } : current;
}

export function buildRequestedJobPreview(requestedJobId: string, payload: VideoJobPayload): RequestedJobPreview | null {
  const snapshot = payload.settingsSnapshot as VideoSettingsRecord | null | undefined;
  if (snapshot?.schemaVersion !== 1 || snapshot?.surface !== 'video') return null;
  const core = readRecord(snapshot.core);
  const durationSec = readFiniteNumber(core.durationSec) ?? 0;
  const engineId = typeof snapshot.engineId === 'string' ? snapshot.engineId : 'unknown-engine';
  const engineLabel = typeof snapshot.engineLabel === 'string' ? snapshot.engineLabel : engineId;
  const prompt = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
  const patch = buildVideoJobMediaPatch(payload);
  if (!patch) return null;

  return {
    sharedVideo: {
      id: requestedJobId,
      engineId,
      engineLabel,
      durationSec,
      prompt,
      thumbUrl: patch.thumbUrl ?? undefined,
      videoUrl: patch.videoUrl ?? undefined,
      previewVideoUrl: patch.previewVideoUrl ?? undefined,
      aspectRatio: payload.aspectRatio ?? undefined,
      createdAt:
        typeof payload.createdAt === 'string' && payload.createdAt.length ? payload.createdAt : new Date().toISOString(),
    },
    selectedPreview: {
      id: requestedJobId,
      videoUrl: patch.videoUrl ?? undefined,
      previewVideoUrl: patch.previewVideoUrl ?? undefined,
      thumbUrl: patch.thumbUrl ?? undefined,
      aspectRatio: payload.aspectRatio ?? undefined,
      progress: typeof payload.progress === 'number' ? payload.progress : undefined,
      status:
        payload.status === 'failed'
          ? 'failed'
          : payload.status === 'completed'
            ? 'completed'
            : ('pending' as const),
      priceCents: payload.finalPriceCents ?? payload.pricing?.totalCents ?? undefined,
      currency: payload.currency ?? payload.pricing?.currency ?? undefined,
      prompt,
    },
  };
}
