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
  // Match generation: the editor's frame clock is not an unsupported provider control.
  const shouldSendFps = !capability
    || (Array.isArray(capability.fps) ? capability.fps.length > 0 : typeof capability.fps === 'number');
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
  // Duration enums retain string values in the form; preflight expects numeric seconds or auto.
  const durationOption = typeof form.durationOption === 'string' && /^\d+(?:\.\d+)?$/.test(form.durationOption.trim())
    ? Number(form.durationOption)
    : form.durationOption;

  return {
    engine: form.engineId,
    mode: submissionMode,
    durationSec: effectiveDurationSec,
    ...(durationOption !== undefined && durationOption !== null ? { durationOption } : {}),
    ...(shouldSendResolution
      ? { resolution: form.resolution as PreflightRequest['resolution'] }
      : {}),
    ...(shouldSendAspectRatio
      ? { aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'] }
      : {}),
    ...(shouldSendFps ? { fps: form.fps } : {}),
    seedLocked: Boolean(form.seedLocked),
    loop: form.loop,
    ...(supportsAudioToggle ? { audio: form.audio } : {}),
    ...(voiceControlEnabled ? { voiceControl: true } : {}),
    // Max tariffs depend on mode, duration and resolution, not reference media.
    // Keep URL-only public recipes in generation without inventing owned asset IDs for a quote.
    inputs: selectedEngine.id === 'flux-3-max' ? [] : buildWorkspacePreflightInputs(inputAssets),
    ...(Object.keys(form.extraInputValues).length ? { extraInputValues: form.extraInputValues } : {}),
    user: { memberTier },
  };
}
