import type { EngineCaps } from '@/types/engines';
import type { PickerControl } from '@/components/ui/engine-select/model-picker-types';
import { videoDurationPolicy, videoInheritsSourceFraming, videoSourceDurationLabel } from '@/lib/video-workflow-capabilities';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { getVideoWorkflowSourceField, isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { parseDurationOptionValue } from '@/components/settings-controls/settings-control-duration';
import { coerceFormState, getModeCaps, getWorkspaceCreateMode, framesToSeconds, findInputFieldById } from './workspace-engine-helpers';
import { prepareWorkspaceModelCandidate, type WorkspaceModelSetup } from './workspace-model-candidate';
import { resolveWorkspaceWorkflow } from './workspace-workflow-projection';

export type PickerScenario = Partial<Pick<WorkspaceModelSetup['form'], 'resolution' | 'aspectRatio' | 'audio' | 'iterations'>> & { durationSec?: number | 'auto'; keepAudio?: boolean };
function projected(engine: EngineCaps, current: WorkspaceModelSetup) {
  return current.form.operation && engine.operationCaps?.[current.form.operation]?.mode === current.form.mode
    ? resolveVideoOperationEngine(engine, current.form.mode, current.form.operation) : engine;
}

/** Header controls describe other-model Create quotes; the current model keeps its source workflow. */
export function pickerScenarioBasis(current: WorkspaceModelSetup, engine: EngineCaps): WorkspaceModelSetup {
  const activeEngine = projected(engine, current);
  const sourceMode = resolveWorkspaceWorkflow({ engine: activeEngine, ...current }).activeManualMode ?? undefined;
  const createMode = getWorkspaceCreateMode(engine);
  if ((!isVideoSourceWorkflow(sourceMode) && sourceMode !== 'retake') || !createMode) return current;
  const sourceField = getVideoWorkflowSourceField(activeEngine.inputSchema, sourceMode);
  const inputAssets = { ...current.inputAssets };
  if (sourceField) delete inputAssets[sourceField.id];
  return { ...current, inputAssets, form: coerceFormState(engine, createMode, { ...current.form, operation: undefined }) };
}

/** The same pure preparation is used for estimates and the transactional commit. */
export function preparePickerScenario({ current, engine, currentEngine, locale, overrides = {} }: {
  current: WorkspaceModelSetup; engine: EngineCaps; currentEngine?: EngineCaps; locale: string; overrides?: PickerScenario;
}) {
  if (!Object.keys(overrides).length) return prepareWorkspaceModelCandidate({ current, engine, currentEngine, locale,
    returnToCreate: true, restoreSetup: engine.id === current.form.engineId ? current : undefined });
  const sourceEngine = currentEngine ? projected(currentEngine, current) : undefined;
  const durationEditable = engine.id !== current.form.engineId || (sourceEngine && videoDurationPolicy(sourceEngine, resolveWorkspaceWorkflow({ engine: sourceEngine, ...current }).submissionMode) === 'requested' && !current.multiPromptEnabled);
  const { durationSec, keepAudio, ...rest } = overrides;
  const seed = { ...current, form: { ...current.form, ...rest,
    ...(keepAudio !== undefined ? { extraInputValues: { ...current.form.extraInputValues, keep_audio: keepAudio } } : {}),
    ...(durationEditable && durationSec !== undefined ? { durationSec: durationSec === 'auto' ? current.form.durationSec : durationSec, durationOption: durationSec, numFrames: null } : {}) } };
  const prepared = prepareWorkspaceModelCandidate({ current: seed, engine, currentEngine, locale,
    returnToCreate: true, restoreSetup: engine.id === current.form.engineId ? seed : undefined });
  // Engine switches normally reset audio to that model's default. An explicit comparison choice takes precedence.
  if (overrides.audio !== undefined && prepared.supportsAudioToggle) prepared.setup.form.audio = overrides.audio;
  return prepareWorkspaceModelCandidate({ current, engine, currentEngine, locale, returnToCreate: true, restoreSetup: prepared.setup });
}

export function pickerScenarioControls(current: WorkspaceModelSetup, engine: EngineCaps, overrides: PickerScenario, locale: string): PickerControl[] {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const copy = fr ? { duration: 'Durée', resolution: 'Résolution', aspect: 'Format', audio: 'Son', on: 'Avec audio', off: 'Sans audio', outputs: 'Vidéos', scenes: 'Durée des scènes', sourceAudio: 'Durée de l’audio' }
    : es ? { duration: 'Duración', resolution: 'Resolución', aspect: 'Formato', audio: 'Audio', on: 'Con audio', off: 'Sin audio', outputs: 'Vídeos', scenes: 'Duración de escenas', sourceAudio: 'Duración del audio' }
    : { duration: 'Duration', resolution: 'Resolution', aspect: 'Format', audio: 'Audio', on: 'Audio on', off: 'Audio off', outputs: 'Videos', scenes: 'Scene timing', sourceAudio: 'Source audio duration' };
  const activeEngine = projected(engine, current);
  const mode = resolveWorkspaceWorkflow({ engine: activeEngine, ...current }).submissionMode, caps = getModeCaps(activeEngine, mode);
  const form = { ...current.form, ...overrides };
  const durationPolicy = videoDurationPolicy(activeEngine, mode, caps);
  const choices = (values: Array<string | number>, label: (value: string) => string = value => value) => [...new Set(values.map(String))].map(value => ({ value, label: label(value) }));
  const duration = caps?.duration;
  const seconds = caps?.frames?.map(framesToSeconds) ?? (duration && 'options' in duration
    ? duration.options.map(value => parseDurationOptionValue(value)).filter(value => value.raw !== 'auto' && value.value > 0).map(value => value.value)
    : Array.from({ length: Math.min(60, activeEngine.maxDurationSec || 20) - (duration && 'min' in duration ? duration.min : 1) + 1 }, (_, index) => index + (duration && 'min' in duration ? duration.min : 1)));
  const managed = durationPolicy !== 'requested' || current.multiPromptEnabled;
  const durationValue = overrides.durationSec ?? (current.form.durationOption === 'auto' ? 'auto' : current.form.durationSec);
  const durationChoices: Array<string | number> = [...new Set([...seconds, current.form.durationSec])].sort((a,b) => a-b);
  if (duration && 'options' in duration && duration.options.includes('auto')) durationChoices.unshift('auto');
  const controls: PickerControl[] = [{ id: 'durationSec', label: copy.duration,
    value: managed ? durationPolicy === 'source_video' ? videoSourceDurationLabel(locale) : durationPolicy === 'source_audio' ? copy.sourceAudio : current.multiPromptEnabled ? copy.scenes : 'Auto' : String(durationValue),
    options: managed ? undefined : choices(durationChoices, value => value === 'auto' ? 'Auto' : `${value} s`) }];
  const resolutions = caps?.resolution?.length ? caps.resolution : activeEngine.resolutions;
  if (resolutions.length) controls.push({ id: 'resolution', label: copy.resolution, value: form.resolution, options: caps?.resolutionLocked ? undefined : choices([...resolutions, form.resolution]) });
  if (!videoInheritsSourceFraming(activeEngine, mode) && caps?.aspectRatio?.length) controls.push({ id: 'aspectRatio', label: copy.aspect, value: form.aspectRatio, options: choices([...caps.aspectRatio, form.aspectRatio]) });
  controls.push(pickerAudioControl(current, activeEngine, locale, overrides));
  controls.push({ id: 'iterations', label: copy.outputs, value: String(form.iterations), options: choices([1, 2, 3, 4, form.iterations], value => `×${value}`) });
  return controls;
}

export function updatePickerScenario(current: WorkspaceModelSetup, engine: EngineCaps, overrides: PickerScenario, id: string, value: string): PickerScenario {
  const control = pickerScenarioControls(current, engine, overrides, 'en').find(control => control.id === id);
  if (!control?.options?.some(option => option.value === value)) return overrides;
  return { ...overrides, [id]: ['audio', 'keepAudio'].includes(id) ? value === 'true' : ['durationSec', 'iterations'].includes(id) && value !== 'auto' ? Number(value) : value };
}

/** Source-audio retention and generated audio are different provider inputs. */
export function pickerAudioControl(current: WorkspaceModelSetup, engine: EngineCaps, locale: string, overrides: PickerScenario = {}): PickerControl {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const workflow = resolveWorkspaceWorkflow({ engine, ...current });
  const keepAudio = findInputFieldById(engine, workflow.submissionMode, 'keep_audio');
  if (keepAudio?.type === 'boolean') {
    const value = overrides.keepAudio ?? current.form.extraInputValues.keep_audio ?? keepAudio.default ?? true;
    return { id: 'keepAudio', label: fr ? 'Audio source' : es ? 'Audio original' : 'Source audio', value: String(value), options: [
      { value: 'true', label: fr ? 'Audio source conservé' : es ? 'Conservar audio original' : 'Keep source audio' },
      { value: 'false', label: fr ? 'Sans audio source' : es ? 'Sin audio original' : 'Mute source audio' },
    ] };
  }
  const on = fr ? 'Avec audio' : es ? 'Con audio' : 'Audio on';
  const off = fr ? 'Sans audio' : es ? 'Sin audio' : 'Audio off';
  return { id: 'audio', label: fr ? 'Son' : 'Audio', value: workflow.supportsAudioToggle ? String(overrides.audio ?? current.form.audio) : engine.audio ? on : off,
    options: workflow.supportsAudioToggle ? [{ value: 'true', label: on }, { value: 'false', label: off }] : undefined };
}
