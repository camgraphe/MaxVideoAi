import type { StoryboardGeneratorHandoff } from '@/lib/storyboard-generator-handoff';
import type { EngineCaps } from '@/types/engines';
import { coerceFormState, getPreferredEngineMode } from './workspace-engine-helpers';
import type { ReferenceAsset } from './workspace-assets';
import type { FormState } from './workspace-form-state';

export type WorkspaceStoryboardHandoffState = {
  form: FormState;
  prompt: string;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
};

function buildStoryboardReferenceAsset(handoff: StoryboardGeneratorHandoff): ReferenceAsset {
  return {
    id: handoff.jobId ?? `storyboard_${handoff.createdAt}`,
    fieldId: handoff.referenceFieldId,
    previewUrl: handoff.thumbUrl ?? handoff.imageUrl,
    kind: 'image',
    name: 'Storyboard reference',
    size: 0,
    type: 'image/png',
    url: handoff.imageUrl,
    width: handoff.width ?? null,
    height: handoff.height ?? null,
    assetId: handoff.jobId ?? undefined,
    status: 'ready',
  };
}

export function buildWorkspaceStoryboardHandoffState(
  handoff: StoryboardGeneratorHandoff,
  engines: EngineCaps[],
  currentForm: FormState | null
): WorkspaceStoryboardHandoffState {
  const engine = engines.find((entry) => entry.id === handoff.engineId);
  if (!engine) {
    throw new Error('Storyboard target model is unavailable.');
  }

  const mode = engine.modes.includes(handoff.mode) ? handoff.mode : getPreferredEngineMode(engine, handoff.mode);
  const previousForm: FormState = {
    ...(currentForm ?? {
      engineId: engine.id,
      mode,
      durationSec: handoff.durationSec,
      durationOption: handoff.durationSec,
      resolution: engine.resolutions[0] ?? '720p',
      aspectRatio: handoff.aspectRatio,
      fps: engine.fps[0] ?? 24,
      iterations: 1,
      seedLocked: false,
      audio: true,
      seed: null,
      cameraFixed: false,
      safetyChecker: true,
      extraInputValues: {},
    }),
    engineId: engine.id,
    mode,
    durationSec: handoff.durationSec,
    durationOption: handoff.durationSec,
    numFrames: null,
    aspectRatio: handoff.aspectRatio,
    audio: handoff.audioEnabled,
  };
  const form = coerceFormState(engine, mode, previousForm);

  return {
    form,
    prompt: handoff.prompt,
    inputAssets: {
      [handoff.referenceFieldId]: [buildStoryboardReferenceAsset(handoff)],
    },
  };
}
