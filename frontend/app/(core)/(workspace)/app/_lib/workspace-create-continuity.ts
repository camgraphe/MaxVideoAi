import { parseDurationOptionValue } from '@/components/settings-controls/settings-control-duration';
import type { AssetFieldRole } from '@/components/composer/composer-types';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import { parseFlux3MaxKeyframeIndexes } from '@/lib/flux-3-max';
import { isKlingV4FalQueueEngineId } from '@/lib/kling-v4-family';
import { getMediaInputEligibility } from '@/lib/media-input-eligibility';
import { resolveEngineReferenceBudget } from '@/lib/reference-budget';
import { getVideoSchemaControlConstraintViolation } from '@/lib/video-input-schema';
import { videoDurationPolicy } from '@/lib/video-workflow-capabilities';
import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import { reconcileReferenceAssets, type ReferenceAsset } from './workspace-assets';
import { coerceFormState, framesToSeconds, getModeCaps, isWorkspaceModeAvailable, WORKSPACE_CREATE_MODES } from './workspace-engine-helpers';
import { resolveExampleResolution } from './workspace-example-resolution';
import type { FormState, WorkspaceCreatePreferences } from './workspace-form-state';
import { resolveAssetFieldRole } from './workspace-input-schema';
import { fieldAcceptsMode, getAlternateCreateOpeningFrame, getWorkspaceMediaFields, workspaceAssetsSupportMode } from './workspace-multimodal-workflow';
import { FLUX_KEYFRAME_SLOTS_FIELD, formatIndexes, formatKeyframeSlots, getPayloadIndexes, hasFluxCreateKeyframes, parseEditorKeyframeSlots, parseKeyframeSlots } from './luma-ray32-keyframes';
import { buildKlingElementsPayload, workspaceKlingSubjectsActive } from './workspace-generation-inputs';
import { getWorkspaceKlingV4MediaError } from './workspace-kling-v4-media';
import { resolveWorkspaceWorkflow } from './workspace-workflow-projection';

const FLUX_KEYFRAME_ASSET_FIELD = 'reference_image_urls';
const LUMA_KEYFRAME_ASSET_FIELD = 'keyframe_urls';
const FLUX_KEYFRAME_SLOT_LIMIT = 10;
const FLUX_KEYFRAME_FPS = 24;
const CREATE_REFERENCE_ROLES = ['primary', 'frame', 'reference', 'generic', 'keyframe'] as const;
export type WorkspaceParkedCreateMedia = {
  fieldId: string;
  index: number;
  role: (typeof CREATE_REFERENCE_ROLES)[number];
  asset: ReferenceAsset;
  frameIndex?: number;
};
type WorkspaceParkedCreateSubject = { role: 'subject'; engineId: string; element: KlingElementState };
export type WorkspaceParkedCreateReference = WorkspaceParkedCreateMedia | WorkspaceParkedCreateSubject;

export function isCreateReferenceRole(role: unknown): role is WorkspaceParkedCreateMedia['role'] {
  return CREATE_REFERENCE_ROLES.some(value => value === role);
}

export function workspaceCreateReferenceRole(engine: EngineCaps | null, fieldId: string, role: AssetFieldRole) {
  const isFluxKeyframe = fieldId === FLUX_KEYFRAME_ASSET_FIELD && hasFluxCreateKeyframes(engine?.inputSchema);
  const isLumaKeyframe = fieldId === LUMA_KEYFRAME_ASSET_FIELD && engine?.id === 'luma-ray-3-2';
  return isFluxKeyframe || isLumaKeyframe ? 'keyframe' : role;
}

function keyframeLimit(form: FormState) {
  return Math.max(5, Math.min(20, Number(form.durationOption ?? form.durationSec) || 5)) * FLUX_KEYFRAME_FPS;
}

export function readCreateKeyframePositions(form: FormState, fieldId: string, assets: readonly (ReferenceAsset | null)[]) {
  const values = form.extraInputValues;
  if (fieldId === FLUX_KEYFRAME_ASSET_FIELD) {
    const slots = parseEditorKeyframeSlots(values[FLUX_KEYFRAME_SLOTS_FIELD], values.keyframe_indexes, assets, FLUX_KEYFRAME_SLOT_LIMIT, keyframeLimit(form));
    return new Map(slots.map(({ assetSlot, frameIndex }) => [assetSlot, frameIndex]));
  }
  // Luma stores only the positions of selected images, in attachment order.
  const indexes = parseFlux3MaxKeyframeIndexes(values.keyframe_indexes) ?? [];
  const positions = new Map<number, number>();
  let next = 0;
  assets.forEach((asset, slot) => {
    if (asset && next < indexes.length) positions.set(slot, indexes[next++]!);
  });
  return positions;
}

export function restoreCreateKeyframePositions(
  form: FormState,
  inputAssets: Record<string, (ReferenceAsset | null)[]>,
  references: WorkspaceParkedCreateMedia[],
  engine: EngineCaps,
  requestedDurationSec?: number,
): FormState {
  const isLuma = engine.id === 'luma-ray-3-2';
  if (!isLuma && !hasFluxCreateKeyframes(engine.inputSchema)) return form;
  const fieldId = isLuma ? LUMA_KEYFRAME_ASSET_FIELD : FLUX_KEYFRAME_ASSET_FIELD;
  const assets = inputAssets[fieldId] ?? [];
  const positions = references.flatMap(reference =>
    reference.role === 'keyframe' && reference.fieldId === fieldId && reference.frameIndex !== undefined
      && assets[reference.index]?.id === reference.asset.id
      ? [{ assetSlot: reference.index, frameIndex: reference.frameIndex }] : []);
  if (!positions.length) return form;
  if (isLuma) return {
    ...form,
    extraInputValues: { ...form.extraInputValues, keyframe_indexes: formatIndexes(getPayloadIndexes(positions, assets)) },
  };

  const lastFrame = Math.max(...positions.map(position => position.frameIndex));
  const duration = getModeCaps(engine, 'ref2v')?.duration;
  // An automatic fallback must leave enough room for the authored frame positions.
  if (form.durationSec !== requestedDurationSec && lastFrame > keyframeLimit(form) && duration && 'options' in duration) {
    const preferredSeconds = form.createPreferences?.durationSec ?? form.durationSec;
    const compatible = duration.options.map(parseDurationOptionValue).filter(option =>
      option.value * FLUX_KEYFRAME_FPS >= lastFrame && option.value <= engine.maxDurationSec
      && !getVideoSchemaControlConstraintViolation({
        inputSchema: engine.inputSchema, duration: option.value, resolution: form.resolution, fps: form.fps,
      }));
    const [closest] = compatible.sort((a, b) => Math.abs(a.value - preferredSeconds) - Math.abs(b.value - preferredSeconds) || a.value - b.value);
    if (closest) form = { ...form, durationSec: closest.value, durationOption: closest.raw, numFrames: null };
  }
  const slots = parseKeyframeSlots(formatKeyframeSlots(positions), assets, FLUX_KEYFRAME_SLOT_LIMIT, keyframeLimit(form))
    .sort((first, second) => first.assetSlot - second.assetSlot);
  return {
    ...form,
    extraInputValues: {
      ...form.extraInputValues,
      keyframe_indexes: formatIndexes(getPayloadIndexes(slots, assets)),
      [FLUX_KEYFRAME_SLOTS_FIELD]: formatKeyframeSlots(slots),
    },
  };
}

export function parkedCreateReferenceKey(reference: WorkspaceParkedCreateReference): string {
  if (reference.role === 'subject') return JSON.stringify([reference.engineId, reference.element.id]);
  return JSON.stringify([reference.fieldId, reference.index, reference.role, reference.asset.id]);
}

function subjectAssets(element: KlingElementState) {
  return [element.video, element.frontal, ...element.references].filter(asset => asset !== null);
}

export function parkedCreateReferenceName(reference: WorkspaceParkedCreateReference): string {
  return reference.role === 'subject' ? subjectAssets(reference.element).map(asset => asset.name).join(', ') : reference.asset.name;
}

function withDurablePreview<T extends { previewUrl: string; url?: string }>(asset: T | null): T | null {
  return asset?.url && asset.previewUrl.startsWith('blob:') ? { ...asset, previewUrl: asset.url } : asset;
}

export function rememberCreatePreferences(form: FormState, edited: WorkspaceCreatePreferences = {}): FormState {
  const { durationSec, durationOption, resolution, aspectRatio } = form;
  return {
    ...form,
    createPreferences: { durationSec, durationOption, resolution, aspectRatio, ...form.createPreferences, ...edited },
  };
}

export function projectCreatePreferences(form: FormState, engine: EngineCaps, mode: Mode): FormState {
  const preferences = form.createPreferences;
  if (!preferences) return form;

  const defaults = coerceFormState(engine, mode, null);
  const caps = getModeCaps(engine, mode);
  const resolution = (!caps?.resolutionLocked && preferences.resolution
    ? resolveExampleResolution(engine, mode, preferences.resolution) : null) ?? defaults.resolution;
  const aspectRatio = caps?.aspectRatio?.find(value => value === preferences.aspectRatio) ?? defaults.aspectRatio;
  if (videoDurationPolicy(engine, mode, caps) !== 'requested') return { ...form, resolution, aspectRatio };

  const seconds = preferences.durationSec;
  const wantsAuto = preferences.durationOption === 'auto';
  const duration = caps?.duration;
  const frames = !wantsAuto ? caps?.frames?.find(value => framesToSeconds(value) === seconds) : undefined;
  const option = duration && 'options' in duration
    ? duration.options.map(parseDurationOptionValue).find(value => wantsAuto ? value.raw === 'auto' : value.raw !== 'auto' && value.value === seconds)
    : undefined;
  const range = !wantsAuto && !caps?.frames?.length && (!duration || 'min' in duration)
    && seconds !== undefined && Number.isInteger(seconds) && seconds >= (duration && 'min' in duration ? duration.min : 1)
    && seconds <= engine.maxDurationSec;
  const durationSec = frames ? framesToSeconds(frames) : option ? (option.raw === 'auto' ? engine.maxDurationSec : option.value)
    : range ? seconds : defaults.durationSec;

  const projected = {
    ...form, durationSec, resolution, aspectRatio,
    durationOption: frames ?? option?.raw ?? (range ? seconds : defaults.durationOption),
    numFrames: frames ?? (option || range ? undefined : defaults.numFrames),
  };
  const fitsControls = (resolution: string, fps: number) => !getVideoSchemaControlConstraintViolation({
    inputSchema: engine.inputSchema, duration: durationSec, resolution, fps,
  });
  if (fitsControls(projected.resolution, projected.fps)) return projected;

  // Keep the selected timing when another resolution or frame rate can support it.
  const resolutions = caps?.resolutionLocked ? [resolution] : [resolution, defaults.resolution, ...(caps?.resolution ?? engine.resolutions)];
  for (const fps of new Set([projected.fps, defaults.fps])) {
    const supported = resolutions.find(value => fitsControls(value, fps));
    if (supported) return { ...projected, resolution: supported, fps };
  }
  return {
    ...projected, resolution: defaults.resolution, fps: defaults.fps, durationSec: defaults.durationSec,
    durationOption: defaults.durationOption, numFrames: defaults.numFrames,
  };
}

export function isParkableCreateReference(reference: { fieldId: string; role: string; index: number; asset: { status?: string; fieldId?: string; url?: string; excerptEditing?: boolean } }): reference is WorkspaceParkedCreateMedia {
  const { fieldId, role, asset } = reference;
  return isCreateReferenceRole(role) && asset.fieldId === fieldId
    && asset.status === 'ready' && Boolean(asset.url) && !asset.excerptEditing;
}

export function canCarryCreateReference(asset: ReferenceAsset, field: EngineInputField, engine: EngineCaps, mode: Mode): boolean {
  if (!asset.url) return false;
  const { status } = getMediaInputEligibility({ asset: { ...asset, url: asset.url, mime: asset.type }, field, engine, mode });
  return status === 'usable' || status === 'unverified';
}

function fitsCombinedReferenceDuration(engine: EngineCaps, mode: Mode, assets: (ReferenceAsset | null)[]) {
  const constraints = engine.inputSchema?.constraints;
  if (!constraints || (Array.isArray(constraints.combinedDurationModes) && !constraints.combinedDurationModes.includes(mode))) return true;
  for (const [kind, limit] of [
    ['video', constraints.maxCombinedVideoDurationSec], ['audio', constraints.maxCombinedAudioDurationSec],
  ] as const) {
    if (typeof limit !== 'number') continue;
    const durations = new Map<string, number>();
    for (const asset of assets) {
      if (asset?.kind === kind && asset.url && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
        // Kling 4 charges and validates each occurrence. Seedance Create counts distinct originals.
        durations.set(isKlingV4FalQueueEngineId(engine.id) ? String(durations.size) : asset.url, asset.durationSec);
      }
    }
    if ([...durations.values()].reduce((sum, duration) => sum + duration, 0) > limit) return false;
  }
  return true;
}

export function projectCreateReferences(engine: EngineCaps, active: WorkspaceParkedCreateMedia[], parked: WorkspaceParkedCreateMedia[]) {
  const fields = getWorkspaceMediaFields(engine);
  const required = new Set(engine.inputSchema?.required);
  const modes = WORKSPACE_CREATE_MODES.filter(mode => isWorkspaceModeAvailable(engine, mode));
  const options = modes.map(mode => {
    const opening = getAlternateCreateOpeningFrame(engine, mode);
    const available = fields.filter(field => fieldAcceptsMode(field, mode) || field === opening?.alternate);
    const budget = resolveEngineReferenceBudget(engine.inputSchema, mode);
    const roles = new Map<string, WorkspaceParkedCreateMedia['role']>();
    let inputAssets: Record<string, (ReferenceAsset | null)[]> = {};

    const put = (reference: WorkspaceParkedCreateMedia) => {
      const { fieldId, asset, index, role } = reference;
      const field = available.find(candidate =>
        candidate.id === fieldId && candidate.type === asset.kind && index < (candidate.maxCount ?? 1)
        && workspaceCreateReferenceRole(engine, fieldId, resolveAssetFieldRole(candidate, required.has(candidate))) === role
        && canCarryCreateReference(asset, candidate, engine, mode),
      );
      if (!field) return;
      const slots = [...(inputAssets[fieldId] ?? [])];
      if (slots[index]) return;
      while (slots.length < index) slots.push(null);
      slots[index] = asset;
      const proposed = { ...inputAssets, [fieldId]: slots };
      const reconciled = reconcileReferenceAssets(proposed, available, budget);
      // A lower-index parked slot cannot evict a reference already accepted for this workflow.
      if (Object.entries(proposed).some(([id, entries]) =>
        entries.some((entry, slot) => entry && reconciled[id]?.[slot] !== entry))) return;
      if (!fitsCombinedReferenceDuration(engine, mode, Object.values(proposed).flat())) return;
      inputAssets = proposed;
      roles.set(fieldId, role);
    };
    for (const reference of active) put(reference);
    const kept = (reference: WorkspaceParkedCreateMedia) =>
      inputAssets[reference.fieldId]?.[reference.index]?.id === reference.asset.id && roles.get(reference.fieldId) === reference.role;
    for (const reference of parked) put(reference);
    if (mode === 'ref2v' && engine.inputSchema?.constraints?.referenceAudioRequiresVisual &&
      !Object.values(inputAssets).some(slots => slots.some(asset => asset?.kind === 'image' || asset?.kind === 'video'))) {
      for (const field of available) {
        if (field.type === 'audio') delete inputAssets[field.id];
      }
    }
    const missingRequiredMedia = available.filter(field => {
      if (!fieldAcceptsMode(field, mode) || !(field.requiredInModes?.includes(mode) ?? required.has(field))) return false;
      const slots = inputAssets[field.id];
      const promoted = field.id === opening?.primary.id && inputAssets[opening.alternate.id]?.some(Boolean);
      return !promoted && (slots?.filter(Boolean).length ?? 0) < Math.max(1, field.minCount ?? 0);
    }).length;
    return {
      inputAssets, roles, mode,
      activeCount: active.filter(kept).length, parkedCount: parked.filter(kept).length, missingRequiredMedia,
    };
  });
  // One target Create workflow owns the selected inputs. A newly usable parked
  // reference cannot displace an attachment already active in the draft.
  return options.sort((a, b) => b.activeCount - a.activeCount || b.parkedCount - a.parkedCount
    || a.missingRequiredMedia - b.missingRequiredMedia)[0] ?? null;
}

export function projectCreateSubjects({
  engine, form, inputAssets, sourceEngineId, current, parked,
}: {
  engine: EngineCaps;
  form: FormState;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  sourceEngineId: string;
  current: KlingElementState[];
  parked: WorkspaceParkedCreateSubject[];
}) {
  const active = current.flatMap(element => {
    const assets = subjectAssets(element);
    return assets.length && assets.every(asset => asset.status === 'ready' && asset.url)
      ? [{ role: 'subject' as const, engineId: sourceEngineId, element }] : [];
  });
  const klingElements: KlingElementState[] = [];
  const remaining = new Map<string, WorkspaceParkedCreateSubject>();
  const targetV4 = isKlingV4FalQueueEngineId(engine.id);
  const fields = getWorkspaceMediaFields(engine);
  for (const entry of [...active, ...parked]) {
    if (klingElements.some(element => element.id === entry.element.id)) continue;
    const proposed = [...klingElements, entry.element];
    const { submissionMode, supportsKlingV3Controls } = resolveWorkspaceWorkflow({ engine, form, inputAssets, klingElements: proposed });
    const mode = { selectedEngineId: engine.id, submissionMode, supportsKlingV3Controls };
    if (
      targetV4 === isKlingV4FalQueueEngineId(entry.engineId)
      && WORKSPACE_CREATE_MODES.includes(submissionMode)
      && workspaceKlingSubjectsActive(mode)
      && workspaceAssetsSupportMode(fields, inputAssets, submissionMode)
      && (!targetV4 || !getWorkspaceKlingV4MediaError({ engineId: engine.id, mode: submissionMode, inputAssets, klingElements: proposed }))
      && (entry.engineId === engine.id || buildKlingElementsPayload({ ...mode, klingElements: proposed }).ok)
    ) {
      klingElements.push(entry.element);
    } else {
      const { frontal, references, video } = entry.element;
      remaining.set(parkedCreateReferenceKey(entry), { ...entry, element: {
        ...entry.element,
        frontal: withDurablePreview(frontal), references: references.map(withDurablePreview), video: withDurablePreview(video),
      } });
    }
  }
  return { klingElements, parkedSubjects: [...remaining.values()] };
}
