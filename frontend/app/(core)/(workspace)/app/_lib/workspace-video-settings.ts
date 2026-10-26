import { normalizeVideoOperation } from '@/lib/video-operation';
import { snapshotReferenceInputs } from './workspace-snapshot-reference-inputs';
import { resolveExampleResolution } from './workspace-example-resolution';
import { resolveRecalledWorkspaceEngine } from './workspace-recall-engine';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { QuadPreviewTile } from '@/components/QuadPreviewPanel';
import type { EngineCaps, Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';
import { coerceStoredExtraInputValues, type FormState } from './workspace-form-state';
import {
  coerceFormState,
  getPreferredEngineMode,
  isModeValue,
  resolveAudioDefault,
  resolveBooleanFieldDefault,
} from './workspace-engine-helpers';
import { resolveDerivedAspectRatio } from './workspace-derived-aspect-ratio';
import { MULTI_PROMPT_MIN_SEC } from './workspace-input-helpers';
import { readSnapshotKlingElements } from './workspace-video-settings-kling-elements';

type MemberTier = 'Member' | 'Plus' | 'Pro';
type ShotType = 'customize' | 'intelligent';

type VideoSettingsRecord = {
  sourceJobId?: unknown;
  sourceOutputId?: unknown;
  operation?: unknown;
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

export function claimSharedVideoHydration(
  appliedVideoId: string | null,
  sharedVideoId: string | null | undefined,
  engineCount: number
): { nextAppliedVideoId: string | null; shouldApply: boolean } {
  const nextVideoId = sharedVideoId || null;
  if (appliedVideoId === nextVideoId) {
    return { nextAppliedVideoId: appliedVideoId, shouldApply: false };
  }
  if (!nextVideoId || engineCount <= 0) {
    return { nextAppliedVideoId: null, shouldApply: false };
  }
  return { nextAppliedVideoId: nextVideoId, shouldApply: true };
}

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
    operation?: import('@/lib/video-operation').VideoOperation;
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

function readMultiPromptScenes(value: unknown, createLocalId: CreateLocalId, preserveExact = false): MultiPromptScene[] | null {
  if (!Array.isArray(value)) return null;
  if (preserveExact) return value.map((entry) => {
    const record = readRecord(entry);
    if (typeof record.prompt !== 'string' || typeof record.duration !== 'number' || !Number.isFinite(record.duration)) throw new Error('Invalid Kling 4.0 shot plan in saved settings.');
    return { id: typeof record.id === 'string' ? record.id : createLocalId('scene'), prompt: record.prompt, duration: record.duration };
  });
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
      durationSec: readFiniteNumber(attachment.durationSec) ?? null,
      assetId,
      status: 'ready',
    };
    next[slotId] = [...(next[slotId] ?? []), refAsset];
  });
  return next;
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
  const engine = resolveRecalledWorkspaceEngine(snapshotEngineId, options.engines, options.engineMap);
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
  const multiPromptScenes = readMultiPromptScenes(advanced.multiPrompt, options.createLocalId, engine.id === 'kling-v4');

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
      ...(record.operation !== undefined ? { operation: normalizeVideoOperation(engine.id, mode, record.operation) } : {}),
      durationSec: readFiniteNumber(core.durationSec),
      durationOption:
        typeof core.durationOption === 'number' || typeof core.durationOption === 'string'
          ? core.durationOption
          : undefined,
      numFrames: readInteger(core.numFrames),
      resolution: typeof core.resolution === 'string'
        ? meta.derived === true ? resolveExampleResolution(engine, mode, core.resolution) ?? core.resolution : core.resolution
        : undefined,
      aspectRatio:
        typeof core.aspectRatio === 'string'
          ? meta.derived === true
            ? resolveDerivedAspectRatio(core.aspectRatio, engine, mode)
            : core.aspectRatio
          : undefined,
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
      extraInputValues: { ...(coerceStoredExtraInputValues(advanced.extraInputValues) ?? {}), ...(typeof record.sourceJobId === 'string' ? { source_job_id: record.sourceJobId } : {}), ...(typeof record.sourceOutputId === 'string' ? { source_output_id: record.sourceOutputId } : {}) },
    },
    inputAssets: readSnapshotInputAssets(snapshotReferenceInputs(refs, engine, mode)),
    klingElements: Object.prototype.hasOwnProperty.call(refs, 'elements')
      ? readSnapshotKlingElements(refs.elements, options.createLocalId, options.createFallbackKlingElement, engine.id === 'kling-v4')
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
    ...(formValues.operation ? { operation: formValues.operation } : {}),
    mode,
    durationSec: typeof formValues.durationSec === 'number' ? formValues.durationSec : previous?.durationSec ?? 4,
    durationOption:
      formValues.durationOption ??
      (typeof formValues.durationSec === 'number' ? formValues.durationSec : previous?.durationOption ?? undefined),
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

export { buildVideoSettingsSnapshotFromSharedVideo } from './workspace-shared-video-snapshot';

export {
  applyVideoJobMediaPatchToCompositeOverride,
  applyVideoJobMediaPatchToSelectedPreview,
  buildRequestedJobPreview,
  buildVideoJobMediaPatch,
} from './workspace-video-job-media';
export type { RequestedJobPreview, VideoJobMediaPatch, VideoJobPayload } from './workspace-video-job-media';
