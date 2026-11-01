import { isEngineModeRuntimeAvailable } from '@/lib/engine-mode-availability';
import { getVideoWorkflowSourceField, isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import type { EngineCaps, PreflightRequest } from '@/types/engines';
import type { EnginePickerOption } from '@/components/ui/engine-select/model-picker-types';
import { type WorkspaceModelSetup } from './workspace-model-candidate';
import { buildWorkspacePreflightRequest } from './workspace-preflight-request';
import { resolveWorkspaceWorkflow } from './workspace-workflow-projection';
import { workspaceModelReviewChangeRows } from './workspace-model-review-presentation';
import { workspaceModelReviewCopy } from './workspace-model-review-copy';
import { getEngineModeLabel } from './workspace-engine-helpers';

import { preparePickerScenario, pickerAudioControl, type PickerScenario } from './workspace-picker-scenario';

type PickerPreparedOption = EnginePickerOption & { request: PreflightRequest | null; iterations: number };
export function buildWorkspacePickerOptions({ current, engines, locale, memberTier, disabledEngineReasons, overrides }: {
  overrides?: PickerScenario;
  current: WorkspaceModelSetup;
  engines: EngineCaps[];
  locale: string;
  memberTier: 'Member' | 'Plus' | 'Pro';
  disabledEngineReasons?: Record<string, string>;
}): Record<string, PickerPreparedOption> {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const audioCopy = workspaceModelReviewCopy(locale);
  const currentEngine = engines.find(engine => engine.id === current.form.engineId);
  const source = resolveWorkspaceWorkflow({ engine: currentEngine ?? null, ...current });
  const sourceMode = source.submissionMode;
  const sourceWorkflow = isVideoSourceWorkflow(source.activeManualMode ?? undefined) || source.activeManualMode === 'retake';
  return Object.fromEntries(engines.map(engine => {
    const candidate = preparePickerScenario({ engine, current, locale, currentEngine, overrides });
    const currentModel = engine.id === current.form.engineId;
    const candidateMode = candidate.workflow.submissionMode;
    const manualMode = candidate.workflow.activeManualMode ?? undefined;
    const sourceField = isVideoSourceWorkflow(manualMode) || manualMode === 'retake' ? getVideoWorkflowSourceField(candidate.engine.inputSchema, manualMode) : null;
    const missingSource = Boolean(sourceField && !candidate.setup.inputAssets[sourceField.id]?.some(asset => asset?.kind === 'video' && asset.status === 'ready'));
    const applyBlock = candidate.blockingReasons.find(reason => reason.scope === 'apply');
    const modeChanged = candidate.workflow.submissionMode !== sourceMode
      || candidate.setup.form.operation !== current.form.operation;
    const disabledReason = disabledEngineReasons?.[engine.id]
      ?? (!isEngineModeRuntimeAvailable(engine, candidateMode) ? (fr ? 'Mode temporairement indisponible' : es ? 'Modo no disponible temporalmente' : 'Mode temporarily unavailable') : undefined)
      ?? (engine.availability === 'paused' ? (fr ? 'Indisponible' : es ? 'No disponible' : 'Unavailable') : undefined)
      ?? (currentModel && candidate.removedReferences.length ? (fr ? 'Incompatible avec vos références' : es ? 'Incompatible con tus referencias' : 'Incompatible with your references') : undefined)
      ?? (currentModel && modeChanged ? (fr ? 'Autre opération requise' : es ? 'Requiere otra operación' : 'Requires a different operation') : undefined)
      ?? applyBlock?.message;
    const invalidQuoteInput = candidate.blockingReasons.find(reason => reason.scope === 'generation' && reason.code === 'invalid-input');
    const priceUnavailableReason = missingSource
      ? (fr ? 'Ajoutez une vidéo source pour estimer' : es ? 'Añade un vídeo de origen para estimar' : 'Add a source video to estimate') : invalidQuoteInput?.message;
    const audioControl = pickerAudioControl(candidate.setup, candidate.engine, locale);
    const audioLabel = audioControl.options
      ? audioControl.options.find(option => option.value === audioControl.value)?.label ?? audioControl.value
      : candidate.workflow.capability?.audioPresentation === 'source'
        ? audioCopy.retainedSourceAudio
        : candidate.engine.audio ? `${audioControl.label}: ${audioCopy.includedAudio}` : audioControl.value;
    const operationLabel = sourceWorkflow ? currentModel ? getEngineModeLabel(engine.id, candidateMode, locale) : (fr ? 'Créer' : es ? 'Crear' : 'Create') : null;
    const summary = [operationLabel, Number.isFinite(candidate.effectiveDurationSec) ? `${candidate.effectiveDurationSec} s` : null,
      candidate.setup.form.resolution?.toLowerCase(), audioLabel,
      candidate.setup.form.iterations > 1 ? `×${candidate.setup.form.iterations}` : null].filter(Boolean).join(' · ');
    const settingLabels: Record<string, string> = fr ? { fps: 'Images par seconde', output_format: 'Format du fichier', enable_prompt_expansion: 'Amélioration du prompt' }
      : es ? { fps: 'Fotogramas por segundo', output_format: 'Formato del archivo', enable_prompt_expansion: 'Mejora del prompt' }
      : { fps: 'Frames per second', output_format: 'File format', enable_prompt_expansion: 'Prompt enhancement' };
    const changes = workspaceModelReviewChangeRows(candidate, currentEngine, engine, locale)
      .filter(change => change.before !== change.after && !['engineId', 'durationSec', 'durationOption', 'resolutionSupported', 'aspect_ratioSupported'].includes(change.field))
      .map(change => ({ ...change, label: settingLabels[change.field.replace(/^extraInputValues\./, '')] ?? change.label }));
    const request = disabledReason || priceUnavailableReason ? null : buildWorkspacePreflightRequest({
      form: candidate.setup.form, selectedEngine: candidate.engine, submissionMode: candidate.workflow.submissionMode,
      effectiveDurationSec: candidate.effectiveDurationSec, supportsAudioToggle: candidate.supportsAudioToggle,
      voiceControlEnabled: candidate.voiceControlEnabled, inputAssets: candidate.setup.inputAssets, klingElements: candidate.setup.klingElements, memberTier,
    });
    return [engine.id, { summary, changes, disabledReason, priceUnavailableReason, request, iterations: candidate.setup.form.iterations || 1 }];
  }));
}
