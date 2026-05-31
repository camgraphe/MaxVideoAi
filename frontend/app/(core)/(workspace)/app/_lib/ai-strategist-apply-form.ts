import {
  findAiStrategistActionValue,
  resolveAiStrategistApplyEngineId,
} from '@/lib/ai-strategist/apply-actions';
import type { EngineCaps, Mode } from '@/types/engines';
import { coerceFormState, getPreferredEngineMode, isWorkspaceModeAvailable } from './workspace-engine-helpers';
import type { FormState } from './workspace-form-state';

type AiStrategistApplyFormResult = {
  selectedModel?: string | null;
  workflow?: string | null;
  uiActions?: readonly {
    type: string;
    value?: string | null;
  }[];
};

export function buildAiStrategistApplyFormState({
  currentForm,
  engines,
  selectedEngine,
  activeMode,
  result,
}: {
  currentForm: FormState | null;
  engines: readonly EngineCaps[];
  selectedEngine: EngineCaps;
  activeMode: Mode;
  result: AiStrategistApplyFormResult;
}): FormState {
  const modelEngineId = resolveAiStrategistApplyEngineId({ engines, result });
  const targetEngine = modelEngineId
    ? engines.find((engine) => engine.id === modelEngineId) ?? selectedEngine
    : selectedEngine;
  const workflowValue = findAiStrategistActionValue(result.uiActions, 'SET_WORKFLOW') ?? result.workflow ?? undefined;
  const workflowMode = workflowValue ? workflowToMode(workflowValue) : undefined;
  const nextMode =
    workflowMode && isWorkspaceModeAvailable(targetEngine, workflowMode)
      ? workflowMode
      : getPreferredEngineMode(targetEngine, currentForm?.mode ?? activeMode);
  let previous = currentForm ? { ...currentForm, engineId: targetEngine.id, mode: nextMode } : null;

  const durationValue = findAiStrategistActionValue(result.uiActions, 'SET_DURATION');
  const durationSec = durationValue ? parseDurationSeconds(durationValue) : null;
  if (previous && durationSec !== null) {
    previous = {
      ...previous,
      durationSec,
      durationOption: durationValue,
      numFrames: null,
    };
  }

  const resolutionValue = findAiStrategistActionValue(result.uiActions, 'SET_RESOLUTION');
  if (previous && resolutionValue) {
    previous = {
      ...previous,
      resolution: normalizeApplyResolution(resolutionValue),
    };
  }

  const aspectRatioValue = findAiStrategistActionValue(result.uiActions, 'SET_ASPECT_RATIO');
  if (previous && aspectRatioValue) {
    previous = {
      ...previous,
      aspectRatio: aspectRatioValue,
    };
  }

  return coerceFormState(targetEngine, nextMode, previous);
}

export function hasAiStrategistFormApply(result: AiStrategistApplyFormResult): boolean {
  return Boolean(
    result.selectedModel ||
      findAiStrategistActionValue(result.uiActions, 'SET_MODEL') ||
      findAiStrategistActionValue(result.uiActions, 'SET_WORKFLOW') ||
      findAiStrategistActionValue(result.uiActions, 'SET_DURATION') ||
      findAiStrategistActionValue(result.uiActions, 'SET_RESOLUTION') ||
      findAiStrategistActionValue(result.uiActions, 'SET_ASPECT_RATIO') ||
      result.workflow
  );
}

function workflowToMode(value: string): Mode | undefined {
  if (value === 'text-to-video') return 't2v';
  if (value === 'image-to-video') return 'i2v';
  if (value === 'video-to-video') return 'v2v';
  if (value === 'text-to-image-then-image-to-video') return 'i2v';
  return undefined;
}

function normalizeApplyResolution(value: string): string {
  if (/4\s*k/i.test(value)) return '4K';
  if (/1080\s*p/i.test(value)) return '1080p';
  if (/720\s*p/i.test(value)) return '720p';
  return value;
}

function parseDurationSeconds(value: string): number | null {
  const numeric = Number(value.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.max(1, Math.round(numeric));
}
