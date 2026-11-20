import { isKlingV4FalQueueEngineId } from '@/lib/kling-v4-family';
import { isFlux3MaxEngineId } from '@/lib/flux-3-max';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import { resolveEngineReferenceBudget } from '@/lib/reference-budget';
import { SEEDANCE_REFERENCE_AUDIO_FIELD_IDS } from '@/lib/seedance-workflow';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { getVideoWorkflowSourceField, isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { getFalEngineById } from '@/src/config/falEngines';
import type { EngineCaps } from '@/types/engines';
import { buildAssetFieldIdSet, buildReferenceAudioFieldIds, reconcileReferenceAssets, type ReferenceAsset } from './workspace-assets';
import { coerceFormState, coerceFormStateForEngineChange, getPreferredEngineModeForEngineRequest, getWorkspaceCreateMode, WORKSPACE_CREATE_MODES } from './workspace-engine-helpers';
import { normalizeExtraInputValue, type FormState } from './workspace-form-state';
import { getGenerationIterationGuardMessage, getLumaRay2GenerationContext, getStartRenderValidationMessage, getWorkspaceGenerationModeMessage } from './workspace-generation-guards';
import { prepareGenerationInputs } from './workspace-generation-inputs';
import { workspaceModeSupportsRequestField } from './workspace-mode-request-fields';
import { resolveAssetFieldRole, summarizeWorkspaceInputSchema, type WorkspaceInputSchemaSummary } from './workspace-input-schema';
import { getWorkspaceMediaFields } from './workspace-multimodal-workflow';
import { resolveWorkspaceComposerFacts, resolveWorkspaceWorkflow, type WorkspaceComposerFacts, type WorkspaceWorkflowProjection } from './workspace-workflow-projection';
import { FLUX_KEYFRAME_SLOTS_FIELD } from './luma-ray32-keyframes';

import {
  canCarryCreateReference, isParkableCreateReference, projectCreatePreferences, projectCreateReferences, projectCreateSubjects, readCreateKeyframePositions,
  rememberCreatePreferences, restoreCreateKeyframePositions, workspaceCreateReferenceRole,
  type WorkspaceParkedCreateReference,
  type WorkspaceParkedCreateMedia,
} from './workspace-create-continuity';

export type WorkspaceModelSetup = {
  parkedCreateReferences?: WorkspaceParkedCreateReference[];
  form: FormState;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
  prompt: string;
  negativePrompt: string;
  multiPromptEnabled: boolean;
  multiPromptScenes: MultiPromptScene[];
  shotType: 'customize' | 'intelligent';
  voiceIdsInput: string;
  cfgScale: number | null;
};

export type WorkspaceModelSettingChange = {
  field: string;
  before: unknown;
  after: unknown;
  reason: 'adapted' | 'inactive';
};

export type WorkspaceModelReference = {
  fieldId: string;
  index: number;
  role: string;
  elementId?: string;
  frameIndex?: number;
  asset: ReferenceAsset | KlingElementAsset;
};

export type WorkspaceModelCandidateReason = {
  code: 'not-stable' | 'unsupported-workflow' | 'uploading-reference' | 'invalid-reference' | 'prompt-too-long' | 'missing-input' | 'invalid-input';
  scope: 'apply' | 'generation';
  message: string;
  fieldId?: string;
};

export type WorkspaceModelCandidate = {
  engine: EngineCaps;
  setup: WorkspaceModelSetup;
  workflow: WorkspaceWorkflowProjection;
  composer: WorkspaceComposerFacts;
  inputSchemaSummary: WorkspaceInputSchemaSummary;
  effectiveDurationSec: number;
  supportsAudioToggle: boolean;
  voiceControlEnabled: boolean;
  changes: WorkspaceModelSettingChange[];
  keptReferences: WorkspaceModelReference[];
  removedReferences: WorkspaceModelReference[];
  comparable: boolean;
  applicable: boolean;
  blockingReasons: WorkspaceModelCandidateReason[];
};

function schemaFor(engine: EngineCaps | null, workflow: WorkspaceWorkflowProjection, locale: string) {
  return summarizeWorkspaceInputSchema({ selectedEngine: engine, ...workflow, uiLocale: locale });
}

function referencesFor(setup: WorkspaceModelSetup, summary: WorkspaceInputSchemaSummary, engine: EngineCaps | null): WorkspaceModelReference[] {
  const references: WorkspaceModelReference[] = [];
  for (const [fieldId, assets] of Object.entries(setup.inputAssets)) {
    const schemaRole = summary.assetFields.find(({ field }) => field.id === fieldId)?.role;
    const role = schemaRole ? workspaceCreateReferenceRole(engine, fieldId, schemaRole) : 'unknown';
    const positions = role === 'keyframe' ? readCreateKeyframePositions(setup.form, assets) : undefined;
    assets.forEach((asset, index) => {
      if (asset) references.push({ fieldId, index, role, asset, ...(positions?.has(index) ? { frameIndex: positions.get(index) } : {}) });
    });
  }
  for (const element of setup.klingElements) {
    for (const [slot, assets] of [['frontal', [element.frontal]], ['reference', element.references], ['video', [element.video]]] as const) {
      assets.forEach((asset, index) => {
        if (asset) references.push({ fieldId: `klingElements.${slot}`, elementId: element.id, index, role: `subject-${slot}`, asset });
      });
    }
  }
  return references;
}

function referenceKey(reference: WorkspaceModelReference) {
  return JSON.stringify([reference.fieldId, reference.elementId, reference.index, reference.role, reference.asset.id,
  reference.asset.assetId, reference.asset.kind, reference.asset.url]);
}

function engineForSetup(engine: EngineCaps, form: FormState): EngineCaps {
  return form.engineId === engine.id && form.operation && engine.operationCaps?.[form.operation]?.mode === form.mode
    ? resolveVideoOperationEngine(engine, form.mode, form.operation) : engine;
}

function normalizedSetup(setup: WorkspaceModelSetup, engine: EngineCaps, workflow: WorkspaceWorkflowProjection, summary: WorkspaceInputSchemaSummary, sourceSummary: WorkspaceInputSchemaSummary, preserveV4Draft: boolean, projectedRoles?: ReadonlyMap<string, string>) {
  const fields = summary.assetFields.map(({ field }) => field);
  const byId = new Map(summary.assetFields.map((entry) => [entry.field.id, entry]));
  const sourceById = new Map(sourceSummary.assetFields.map((entry) => [entry.field.id, entry]));
  // Exact slots only: field aliases and provider families do not establish semantic equivalence.
  const compatible = Object.fromEntries(Object.entries(setup.inputAssets).map(([fieldId, assets]) => {
    const target = byId.get(fieldId);
    const sourceRole = projectedRoles?.get(fieldId) ?? sourceById.get(fieldId)?.role;
    const targetRole = projectedRoles && target?.role ? workspaceCreateReferenceRole(engine, fieldId, target.role) : target?.role;
    return [fieldId, assets.map((asset, index) => {
      if (!asset || !target || sourceRole !== targetRole || target.field.type !== asset.kind) return null;
      if (target.field.maxCount && index >= target.field.maxCount) return null;
      if (projectedRoles && !canCarryCreateReference(asset, target.field, engine, workflow.submissionMode)) return null;
      return asset;
    })];
  }));
  // No release callback: preparation must never revoke a live draft's previews.
  const inputAssets = preserveV4Draft
    ? setup.inputAssets
    : reconcileReferenceAssets(compatible, fields, resolveEngineReferenceBudget(engine.inputSchema, workflow.submissionMode));
  const extraInputValues: Record<string, unknown> = {};
  for (const { field } of [...summary.promotedFields, ...summary.secondaryFields]) {
    const value = normalizeExtraInputValue(field, setup.form.extraInputValues[field.id]);
    if (value !== undefined) extraInputValues[field.id] = value;
  }
  const keyframeSlots = setup.form.extraInputValues[FLUX_KEYFRAME_SLOTS_FIELD];
  if (isFlux3MaxEngineId(engine.id) && workflow.submissionMode === 'ref2v' && typeof keyframeSlots === 'string') {
    extraInputValues[FLUX_KEYFRAME_SLOTS_FIELD] = keyframeSlots;
  }
  const coerced = coerceFormState(engine, workflow.activeMode, { ...setup.form, mode: workflow.activeMode });
  const form = projectedRoles ? projectCreatePreferences(coerced, engine, workflow.activeMode) : coerced;
  const cfgParam = engine.params?.cfg_scale;
  return {
    ...setup, form: { ...form, extraInputValues }, inputAssets,
    klingElements: (workflow.supportsKlingV3Controls || isKlingV4FalQueueEngineId(engine.id)) ? setup.klingElements : [],
    multiPromptEnabled: (workflow.supportsKlingV3Controls || engine.id === 'kling-v4') && setup.multiPromptEnabled,
    shotType: !workflow.supportsKlingV3Controls || workflow.activeMode === 'i2v' ? 'customize' as const : setup.shotType,
    cfgScale: cfgParam ? setup.cfgScale ?? cfgParam.default : null,
  };
}

function validateCandidate(engine: EngineCaps, setup: WorkspaceModelSetup, workflow: WorkspaceWorkflowProjection, composer: WorkspaceComposerFacts, summary: WorkspaceInputSchemaSummary, locale: string) {
  const reasons: WorkspaceModelCandidateReason[] = [];
  const modeMessage = getWorkspaceGenerationModeMessage(engine, workflow.submissionMode, locale);
  if (modeMessage) reasons.push({ code: 'unsupported-workflow', scope: 'generation', message: modeMessage });
  if (composer.promptCharLimitExceeded) reasons.push({ code: 'prompt-too-long', scope: 'generation', message: `Prompt exceeds the ${composer.promptMaxChars}-character limit.` });
  const extraInputFields = [...summary.promotedFields, ...summary.secondaryFields];
  const validation = getStartRenderValidationMessage({
    audioWorkflowUnsupported: workflow.audioWorkflowUnsupported, audioUnsupportedMessage: 'Audio input is unsupported for this workflow.',
    ...composer, promptLength: setup.prompt.length, selectedEngineLabel: engine.label,
    trimmedPrompt: composer.effectivePrompt.trim(), trimmedNegativePrompt: setup.negativePrompt.trim(),
    inputSchemaSummary: summary, inputAssets: setup.inputAssets, extraInputFields, form: setup.form,
    lumaContext: getLumaRay2GenerationContext({ selectedEngineId: engine.id, submissionMode: workflow.submissionMode, form: setup.form }),
  });
  if (validation && !composer.promptCharLimitExceeded) reasons.push({ code: 'missing-input', scope: 'generation', message: validation });
  const prepared = prepareGenerationInputs({
    selectedEngineId: engine.id, selectedEngineLabel: engine.label, ...workflow, form: setup.form,
    inputSchema: engine.inputSchema, inputSchemaSummary: summary, extraInputFields, inputAssets: setup.inputAssets,
    primaryAssetFieldIds: buildAssetFieldIdSet(summary.assetFields, ({ role }) => role === 'primary'),
    referenceAssetFieldIds: buildAssetFieldIdSet(summary.assetFields, ({ role }) => role === 'reference'),
    genericImageFieldIds: buildAssetFieldIdSet(summary.assetFields, ({ role, field }) => role === 'generic' && field.type === 'image'),
    frameAssetFieldIds: buildAssetFieldIdSet(summary.assetFields, ({ role }) => role === 'frame'),
    referenceAudioFieldIds: buildReferenceAudioFieldIds(summary.assetFields, SEEDANCE_REFERENCE_AUDIO_FIELD_IDS),
    klingElements: setup.klingElements, multiPromptActive: composer.multiPromptActive, multiPromptScenes: setup.multiPromptScenes,
  });
  if (!prepared.ok) reasons.push({ code: 'invalid-input', scope: 'generation', message: prepared.message });
  else {
    const guard = getGenerationIterationGuardMessage({
      selectedEngineId: engine.id, inputSchema: engine.inputSchema, ...workflow, ...prepared,
      primaryAssetFieldLabel: summary.assetFields.find(({ role }) => role === 'primary')?.field.label ?? 'source image',
      hasKlingElements: Boolean(prepared.klingElementsPayload?.length), extendOrRetakeSourceVideoMessage: 'Add the required source video before generating.',
    });
    if (guard) reasons.push({ code: 'missing-input', scope: 'generation', message: guard });
  }
  return { reasons, prepared };
}

/** Build an isolated preview. Never applies state, releases media, writes storage or requests a quote. */
export function prepareWorkspaceModelCandidate({ engine: targetEngine, current, locale, currentEngine, restoreSetup, returnToCreate = false }: {
  engine: EngineCaps;
  current: WorkspaceModelSetup;
  locale: string;
  /** Supply the exact live projection when it differs from the runtime catalogue. */
  currentEngine?: EngineCaps;
  /** Validated saved seed; comparisons always remain relative to current. */
  restoreSetup?: WorkspaceModelSetup;
  /** Manual other-model selection only; comparisons and explicit restoration keep their workflow. */
  returnToCreate?: boolean;
}): WorkspaceModelCandidate {
  let engine = targetEngine;
  const manualChange = returnToCreate && engine.id !== current.form.engineId;
  const manualCreate = manualChange && !restoreSetup;
  const currentBaseEngine = currentEngine ?? getFalEngineById(current.form.engineId)?.engine ?? null;
  const sourceEngine = currentBaseEngine ? engineForSetup(currentBaseEngine, current.form) : null;
  const sourceWorkflow = resolveWorkspaceWorkflow({ engine: sourceEngine, ...current });
  const sourceComposer = resolveWorkspaceComposerFacts({ engine: sourceEngine, ...current, workflow: sourceWorkflow });
  const activeSourceSummary = schemaFor(sourceEngine, sourceWorkflow, locale);
  const sourceSummary = manualChange ? { ...activeSourceSummary, assetFields: [...new Map([
    ...getWorkspaceMediaFields(currentBaseEngine).map(field => ({ field, required: false, role: resolveAssetFieldRole(field, false) })),
    ...activeSourceSummary.assetFields,
  ].map(entry => [entry.field.id, entry])).values()] } : activeSourceSummary;
  const originalReferences = referencesFor(current, sourceSummary, sourceEngine);
  const blockingReasons: WorkspaceModelCandidateReason[] = [];
  const createMode = manualChange ? getWorkspaceCreateMode(engine) : null;
  if (manualChange && !createMode) blockingReasons.push({ code: 'unsupported-workflow', scope: 'apply', message: locale.startsWith('fr') ? 'Créer est indisponible pour ce modèle.' : locale.startsWith('es') ? 'Crear no está disponible para este modelo.' : 'Create is unavailable for this model.' });
  for (const reference of originalReferences) {
    if (reference.asset.status === 'uploading') blockingReasons.push({ code: 'uploading-reference', scope: 'apply', fieldId: reference.fieldId, message: 'Wait for reference uploads to finish before changing models.' });
  }
  const seed = restoreSetup ?? current;
  if (restoreSetup && restoreSetup.form.engineId !== engine.id) blockingReasons.push({code: 'invalid-reference', scope: 'apply', message: 'Saved configuration belongs to another model.'});
  const preserveV4Draft = isKlingV4FalQueueEngineId(engine.id) && seed.form.engineId === engine.id;
  const requestedMode = getPreferredEngineModeForEngineRequest({ engine, requestedMode: null, carryoverMode: current.form.mode });
  let setup: WorkspaceModelSetup = structuredClone(seed);
  const sourceMode = sourceWorkflow.activeManualMode ?? undefined;
  const departingSource = isVideoSourceWorkflow(sourceMode) || sourceMode === 'retake';
  const sourceField = departingSource ? getVideoWorkflowSourceField(sourceEngine?.inputSchema, sourceMode)?.id : undefined;
  const createReferences = originalReferences.filter((reference): reference is WorkspaceParkedCreateMedia =>
    reference.fieldId !== sourceField && !reference.elementId && isParkableCreateReference(reference),
  );
  const parked = seed.parkedCreateReferences?.filter(reference => reference.role !== 'subject') ?? [];
  if (!restoreSetup) {
    if (manualCreate && sourceField) delete setup.inputAssets[sourceField];
    const form = manualCreate && !departingSource ? rememberCreatePreferences(setup.form) : setup.form;
    setup.form = coerceFormStateForEngineChange(engine, createMode ?? requestedMode, manualCreate ? { ...form, operation: undefined } : form);
  }
  if (setup.form.operation && engine.operationCaps?.[setup.form.operation]?.mode !== setup.form.mode) {
    blockingReasons.push({ code: 'unsupported-workflow', scope: 'apply', message: 'The saved video operation is unavailable for this model.' });
  }
  engine = engineForSetup(engine, setup.form);
  const inferenceEngine = manualCreate ? { ...engine, modes: engine.modes.filter(mode => WORKSPACE_CREATE_MODES.includes(mode)) } : engine;
  const seedSummary = restoreSetup ? schemaFor(engine, resolveWorkspaceWorkflow({ engine, ...restoreSetup }), locale) : sourceSummary;
  if (!manualCreate) {
    const initialWorkflow = resolveWorkspaceWorkflow({ engine, ...setup });
    if (initialWorkflow.klingO3UnsupportedVideoReason) blockingReasons.push({ code: 'unsupported-workflow', scope: 'apply', message: initialWorkflow.klingO3UnsupportedVideoReason });
  }

  function stabilize(initial: WorkspaceModelSetup, roles?: ReadonlyMap<string, string>) {
    let value = initial;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const workflow = resolveWorkspaceWorkflow({ engine: inferenceEngine, ...value });
      const next = normalizedSetup(value, engine, workflow, schemaFor(inferenceEngine, workflow, locale), seedSummary, preserveV4Draft, roles);
      if (JSON.stringify(next) === JSON.stringify(value)) return { setup: next, stable: true };
      value = next;
    }
    return { setup: value, stable: false };
  }
  const projected = manualCreate ? projectCreateReferences(engine, createReferences, parked) : null;
  const subjects = projected ? projectCreateSubjects({
    engine, form: { ...setup.form, mode: projected.mode }, inputAssets: projected.inputAssets,
    sourceEngineId: current.form.engineId, current: departingSource ? [] : setup.klingElements,
    parked: seed.parkedCreateReferences?.filter(reference => reference.role === 'subject') ?? [],
  }) : null;
  const normalized = projected ? stabilize({
    ...setup, form: { ...setup.form, mode: projected.mode }, inputAssets: projected.inputAssets, klingElements: subjects?.klingElements ?? [],
  }, projected.roles) : stabilize(setup);
  setup = normalized.setup;
  if (manualCreate) setup.form = restoreCreateKeyframePositions(setup.form, setup.inputAssets, [...createReferences, ...parked]);
  const stable = normalized.stable;
  if (!stable) blockingReasons.push({ code: 'not-stable', scope: 'apply', message: 'This configuration could not be stabilized for the selected model.' });
  const workflow = resolveWorkspaceWorkflow({ engine, ...setup });
  const composer = resolveWorkspaceComposerFacts({ engine, ...setup, workflow });
  const inputSchemaSummary = schemaFor(engine, workflow, locale);
  const keptReferences = referencesFor(setup, inputSchemaSummary, engine);
  const keptKeys = new Set(keptReferences.map(referenceKey));
  if (manualCreate) {
    const pending = new Map([...parked, ...createReferences].map(reference => [referenceKey(reference), reference]));
    for (const key of keptKeys) pending.delete(key);
    const remaining: WorkspaceParkedCreateReference[] = [...pending.values()].map(reference => ({
      ...reference,
      asset: reference.asset.previewUrl?.startsWith('blob:') ? { ...reference.asset, previewUrl: reference.asset.url! } : reference.asset,
    }));
    if (subjects) remaining.push(...subjects.parkedSubjects);
    if (remaining.length) setup.parkedCreateReferences = remaining;
    else delete setup.parkedCreateReferences;
  }
  const removedReferences = originalReferences.filter((reference) => !keptKeys.has(referenceKey(reference))).map((reference) => structuredClone(reference));
  if (restoreSetup) {
    const restoredKeys = new Set(keptReferences.map(referenceKey));
    if (referencesFor(restoreSetup, seedSummary, engine).some(reference => !restoredKeys.has(referenceKey(reference)))) blockingReasons.push({code:'invalid-reference',scope:'apply',message:'Some saved references no longer fit this model.'});
  }
  const validation = validateCandidate(engine, setup, workflow, composer, inputSchemaSummary, locale);
  blockingReasons.push(...validation.reasons);
  const changes: WorkspaceModelSettingChange[] = [];
  function change(field: string, before: unknown, after: unknown, reason: WorkspaceModelSettingChange['reason'] = 'adapted') {
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ field, before: structuredClone(before), after: structuredClone(after), reason });
  }
  for (const field of ['prompt', 'negativePrompt', 'voiceIdsInput', 'multiPromptScenes'] as const) change(field, current[field], setup[field]);
  change('mode', sourceWorkflow.submissionMode, workflow.submissionMode);
  change('effectiveDurationSec', sourceComposer.effectiveDurationSec, composer.effectiveDurationSec);
  for (const field of ['durationSec', 'durationOption', 'numFrames', 'resolution', 'aspectRatio', 'fps', 'iterations', 'seedLocked', 'seed', 'loop', 'audio', 'cameraFixed', 'safetyChecker'] as const) change(field, current.form[field], setup.form[field]);
  if (current.klingElements.some((element) => element.frontal || element.video || element.references.some(Boolean)) && validation.prepared.ok && !validation.prepared.klingElementsPayload?.length) {
    change('klingElements', current.klingElements, [], 'inactive');
  }
  for (const fieldId of ['resolution', 'aspect_ratio'] as const) {
    const supportedBefore = workspaceModeSupportsRequestField({ inputSchema: sourceEngine?.inputSchema, capability: sourceWorkflow.capability, fieldId, mode: sourceWorkflow.submissionMode });
    const supportedAfter = workspaceModeSupportsRequestField({ inputSchema: engine.inputSchema, capability: workflow.capability, fieldId, mode: workflow.submissionMode });
    change(`${fieldId}Supported`, supportedBefore, supportedAfter, supportedAfter ? 'adapted' : 'inactive');
  }
  const activeFieldIds = new Set([...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])].filter((field) => !field.modes?.length || field.modes.includes(workflow.submissionMode)).map((field) => field.id));
  for (const [setting, schemaField] of [['seed', 'seed'], ['cameraFixed', 'camera_fixed'], ['safetyChecker', 'enable_safety_checker']] as const) {
    const value = current.form[setting];
    const explicitlySet = setting === 'seed' ? typeof value === 'number' : setting === 'cameraFixed' ? value === true : value === false;
    if (explicitlySet && !activeFieldIds.has(schemaField)) change(setting, value, undefined, 'inactive');
  }
  change('supportsAudioToggle', sourceWorkflow.supportsAudioToggle, workflow.supportsAudioToggle);
  for (const field of ['multiPromptEnabled', 'shotType', 'cfgScale'] as const) change(field, current[field], setup[field], 'inactive');
  change('voiceControlEnabled', sourceComposer.voiceControlEnabled, composer.voiceControlEnabled, 'inactive');
  if (current.voiceIdsInput && !composer.voiceControlEnabled) change('voiceIdsInput', current.voiceIdsInput, null, 'inactive');
  if (current.negativePrompt && !inputSchemaSummary.negativePromptField) change('negativePrompt', current.negativePrompt, null, 'inactive');
  const sourceExtras = new Map([...sourceSummary.promotedFields, ...sourceSummary.secondaryFields].map(({ field }) => [field.id, field]));
  const targetExtras = new Map([...inputSchemaSummary.promotedFields, ...inputSchemaSummary.secondaryFields].map(({ field }) => [field.id, field]));
  for (const fieldId of new Set([...Object.keys(current.form.extraInputValues), ...sourceExtras.keys(), ...targetExtras.keys()])) {
    const beforeField = sourceExtras.get(fieldId);
    const afterField = targetExtras.get(fieldId);
    const before = beforeField ? normalizeExtraInputValue(beforeField, current.form.extraInputValues[fieldId] ?? beforeField.default) : current.form.extraInputValues[fieldId];
    const after = afterField ? normalizeExtraInputValue(afterField, setup.form.extraInputValues[fieldId] ?? afterField.default) : undefined;
    change(`extraInputValues.${fieldId}`, before, after, afterField ? 'adapted' : 'inactive');
  }
  return {
    engine, setup, workflow, composer, inputSchemaSummary, effectiveDurationSec: composer.effectiveDurationSec,
    supportsAudioToggle: workflow.supportsAudioToggle, voiceControlEnabled: composer.voiceControlEnabled,
    changes, keptReferences, removedReferences, blockingReasons,
    applicable: !blockingReasons.some(({ scope }) => scope === 'apply'),
    comparable: Boolean(sourceEngine) && stable && changes.length === 0 && originalReferences.length === keptReferences.length && removedReferences.length === 0 && blockingReasons.length === 0,
  };
}
