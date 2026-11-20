import { parseDurationOptionValue } from '@/components/settings-controls/settings-control-duration';
import type { AssetFieldRole } from '@/components/composer/composer-types';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import { isFlux3MaxEngineId } from '@/lib/flux-3-max';
import { isKlingV4FalQueueEngineId } from '@/lib/kling-v4-family';
import { getMediaInputEligibility } from '@/lib/media-input-eligibility';
import { resolveEngineReferenceBudget } from '@/lib/reference-budget';
import { videoDurationPolicy } from '@/lib/video-workflow-capabilities';
import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import { reconcileReferenceAssets, type ReferenceAsset } from './workspace-assets';
import { coerceFormState, framesToSeconds, getModeCaps, isWorkspaceModeAvailable, WORKSPACE_CREATE_MODES } from './workspace-engine-helpers';
import { resolveExampleResolution } from './workspace-example-resolution';
import type { FormState, WorkspaceCreatePreferences } from './workspace-form-state';
import { resolveAssetFieldRole } from './workspace-input-schema';
import { fieldAcceptsMode, getWorkspaceMediaFields, workspaceAssetsSupportMode } from './workspace-multimodal-workflow';
import { FLUX_KEYFRAME_SLOTS_FIELD, formatIndexes, formatKeyframeSlots, getPayloadIndexes, parseEditorKeyframeSlots, parseKeyframeSlots } from './luma-ray32-keyframes';
import { buildKlingElementsPayload, workspaceKlingSubjectsActive } from './workspace-generation-inputs';
import { getWorkspaceKlingV4MediaError } from './workspace-kling-v4-media';
import { resolveWorkspaceWorkflow } from './workspace-workflow-projection';

const KEYFRAME_ASSET_FIELD = 'reference_image_urls';
const KEYFRAME_SLOT_LIMIT = 10;
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
  return isFlux3MaxEngineId(engine?.id) && fieldId === KEYFRAME_ASSET_FIELD ? 'keyframe' : role;
}

function keyframeLimit(form: FormState) {
  return Math.max(5, Math.min(20, Number(form.durationOption ?? form.durationSec) || 5)) * 24;
}

export function readCreateKeyframePositions(form: FormState, assets: readonly (ReferenceAsset | null)[]) {
  const values = form.extraInputValues;
  const slots = parseEditorKeyframeSlots(values[FLUX_KEYFRAME_SLOTS_FIELD], values.keyframe_indexes, assets, KEYFRAME_SLOT_LIMIT, keyframeLimit(form));
  return new Map(slots.map(({ assetSlot, frameIndex }) => [assetSlot, frameIndex]));
}

export function restoreCreateKeyframePositions(
  form: FormState,
  inputAssets: Record<string, (ReferenceAsset | null)[]>,
  references: WorkspaceParkedCreateMedia[],
): FormState {
  const assets = inputAssets[KEYFRAME_ASSET_FIELD] ?? [];
  const positions = references.flatMap(({ role, index, asset, frameIndex }) =>
    role === 'keyframe' && frameIndex !== undefined && assets[index]?.id === asset.id
      ? [{ assetSlot: index, frameIndex }] : []);
  if (!positions.length) return form;
  const slots = parseKeyframeSlots(formatKeyframeSlots(positions), assets, KEYFRAME_SLOT_LIMIT, keyframeLimit(form))
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

  return {
    ...form, durationSec, resolution, aspectRatio,
    durationOption: frames ?? option?.raw ?? (range ? seconds : defaults.durationOption),
    numFrames: frames ?? (option || range ? undefined : defaults.numFrames),
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
  const required = new Set(engine.inputSchema?.required?.map(field => field.id));
  const modes = WORKSPACE_CREATE_MODES.filter(mode => isWorkspaceModeAvailable(engine, mode));
  const options = modes.map(mode => {
    const available = fields.filter(field => fieldAcceptsMode(field, mode));
    const budget = resolveEngineReferenceBudget(engine.inputSchema, mode);
    const roles = new Map<string, WorkspaceParkedCreateMedia['role']>();
    let inputAssets: Record<string, (ReferenceAsset | null)[]> = {};

    const put = (reference: WorkspaceParkedCreateMedia) => {
      const { fieldId, asset, index, role } = reference;
      const field = available.find(candidate =>
        candidate.id === fieldId && candidate.type === asset.kind && index < (candidate.maxCount ?? 1)
        && workspaceCreateReferenceRole(engine, fieldId, resolveAssetFieldRole(candidate, required.has(fieldId))) === role
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
    const activeCount = active.filter(kept).length;
    for (const reference of parked) put(reference);
    return {
      inputAssets, roles, mode,
      activeCount, parkedCount: parked.filter(kept).length,
    };
  });
  // One target Create workflow owns the selected inputs. A newly usable parked
  // reference cannot displace an attachment already active in the draft.
  return options.sort((a, b) => b.activeCount - a.activeCount || b.parkedCount - a.parkedCount)[0] ?? null;
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
