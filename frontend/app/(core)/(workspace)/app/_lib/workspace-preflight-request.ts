import type { EngineCaps, Mode, PreflightRequest } from '@/types/engines';
import type { FormState } from './workspace-form-state';
import type { ReferenceAsset } from './workspace-assets';
import { buildWorkspacePreflightInputs } from './workspace-generation-inputs';
import { workspaceModeSupportsRequestField } from './workspace-mode-request-fields';

export type WorkspacePreflightRequestOptions = {
  form: FormState;
  selectedEngine: EngineCaps;
  submissionMode: Mode;
  effectiveDurationSec: number;
  supportsAudioToggle: boolean;
  voiceControlEnabled: boolean;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  memberTier: 'Member' | 'Plus' | 'Pro';
};

export function buildWorkspacePreflightRequest({
  form, selectedEngine, submissionMode, effectiveDurationSec, supportsAudioToggle,
  voiceControlEnabled, inputAssets, memberTier,
}: WorkspacePreflightRequestOptions): PreflightRequest {
  const capability = selectedEngine.modeCaps?.[submissionMode];
  const shouldSendResolution = workspaceModeSupportsRequestField({
    inputSchema: selectedEngine.inputSchema,
    capability,
    fieldId: 'resolution',
    mode: submissionMode,
  });
  const shouldSendAspectRatio = workspaceModeSupportsRequestField({
    inputSchema: selectedEngine.inputSchema,
    capability,
    fieldId: 'aspect_ratio',
    mode: submissionMode,
  });

  return {
    engine: form.engineId,
    mode: submissionMode,
    durationSec: effectiveDurationSec,
    ...(shouldSendResolution
      ? { resolution: form.resolution as PreflightRequest['resolution'] }
      : {}),
    ...(shouldSendAspectRatio
      ? { aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'] }
      : {}),
    fps: form.fps,
    seedLocked: Boolean(form.seedLocked),
    loop: form.loop,
    ...(supportsAudioToggle ? { audio: form.audio } : {}),
    ...(voiceControlEnabled ? { voiceControl: true } : {}),
    inputs: buildWorkspacePreflightInputs(inputAssets),
    ...(Object.keys(form.extraInputValues).length ? { extraInputValues: form.extraInputValues } : {}),
    user: { memberTier },
  };
}
