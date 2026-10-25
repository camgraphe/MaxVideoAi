import { isEngineModeRuntimeAvailable } from '@/lib/engine-mode-availability';
import type { EngineCaps, PreflightRequest } from '@/types/engines';
import type { EnginePickerOption } from '@/components/ui/engine-select/model-picker-types';
import { prepareWorkspaceModelCandidate, type WorkspaceModelSetup } from './workspace-model-candidate';
import { buildWorkspacePreflightRequest } from './workspace-preflight-request';
import { resolveWorkspaceWorkflow } from './workspace-workflow-projection';
import { workspaceModelReviewChangeRows } from './workspace-model-review-presentation';

type PickerPreparedOption = EnginePickerOption & { request: PreflightRequest | null; iterations: number };
export function buildWorkspacePickerOptions({ current, engines, locale, memberTier, disabledEngineReasons }: {
  current: WorkspaceModelSetup;
  engines: EngineCaps[];
  locale: string;
  memberTier: 'Member' | 'Plus' | 'Pro';
  disabledEngineReasons?: Record<string, string>;
}): Record<string, PickerPreparedOption> {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const currentEngine = engines.find(engine => engine.id === current.form.engineId);
  const source = resolveWorkspaceWorkflow({ engine: currentEngine ?? null, ...current });
  const sourceMode = source.submissionMode;
  const missingSource = ['v2v', 'extend', 'retake', 'reframe'].includes(sourceMode)
    && !Object.values(current.inputAssets).flat().some(asset => asset?.kind === 'video' && asset.status === 'ready');
  return Object.fromEntries(engines.map(engine => {
    const candidate = prepareWorkspaceModelCandidate({ engine, current, locale, currentEngine });
    const applyBlock = candidate.blockingReasons.find(reason => reason.scope === 'apply');
    const modeChanged = candidate.workflow.submissionMode !== sourceMode
      || candidate.setup.form.operation !== current.form.operation;
    const disabledReason = disabledEngineReasons?.[engine.id]
      ?? (!isEngineModeRuntimeAvailable(engine, sourceMode) ? (fr ? 'Mode temporairement indisponible' : es ? 'Modo no disponible temporalmente' : 'Mode temporarily unavailable') : undefined)
      ?? (engine.availability === 'paused' ? (fr ? 'Indisponible' : es ? 'No disponible' : 'Unavailable') : undefined)
      ?? (candidate.removedReferences.length ? (fr ? 'Incompatible avec vos références' : es ? 'Incompatible con tus referencias' : 'Incompatible with your references') : undefined)
      ?? (modeChanged ? (fr ? 'Autre opération requise' : es ? 'Requiere otra operación' : 'Requires a different operation') : undefined)
      ?? applyBlock?.message;
    const priceUnavailableReason = missingSource
      ? (fr ? 'Ajoutez une vidéo source pour estimer' : es ? 'Añade un vídeo de origen para estimar' : 'Add a source video to estimate') : undefined;
    const activeAudio = candidate.supportsAudioToggle ? candidate.setup.form.audio : Boolean(engine.audio);
    const summary = [Number.isFinite(candidate.effectiveDurationSec) ? `${candidate.effectiveDurationSec} s` : null,
      candidate.setup.form.resolution?.toLowerCase(), activeAudio ? (fr ? 'Audio inclus' : es ? 'Audio incluido' : 'Audio included') : (fr ? 'Sans audio' : es ? 'Sin audio' : 'No audio'),
      candidate.setup.form.iterations > 1 ? `×${candidate.setup.form.iterations}` : null].filter(Boolean).join(' · ');
    const settingLabels: Record<string, string> = fr ? { fps: 'Images par seconde', output_format: 'Format du fichier', enable_prompt_expansion: 'Amélioration du prompt' }
      : es ? { fps: 'Fotogramas por segundo', output_format: 'Formato del archivo', enable_prompt_expansion: 'Mejora del prompt' }
      : { fps: 'Frames per second', output_format: 'File format', enable_prompt_expansion: 'Prompt enhancement' };
    const changes = workspaceModelReviewChangeRows(candidate, currentEngine, engine, locale)
      .filter(change => !['engineId', 'durationSec', 'durationOption', 'resolutionSupported', 'aspect_ratioSupported'].includes(change.field))
      .map(change => ({ ...change, label: settingLabels[change.field.replace(/^extraInputValues\./, '')] ?? change.label }));
    const request = disabledReason || missingSource ? null : buildWorkspacePreflightRequest({
      form: candidate.setup.form, selectedEngine: engine, submissionMode: candidate.workflow.submissionMode,
      effectiveDurationSec: candidate.effectiveDurationSec, supportsAudioToggle: candidate.supportsAudioToggle,
      voiceControlEnabled: candidate.voiceControlEnabled, inputAssets: candidate.setup.inputAssets, memberTier,
    });
    return [engine.id, { summary, changes, disabledReason, priceUnavailableReason, request, iterations: candidate.setup.form.iterations || 1 }];
  }));
}
