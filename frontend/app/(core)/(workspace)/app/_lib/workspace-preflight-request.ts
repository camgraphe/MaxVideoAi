import { getWorkspaceKlingV4ActiveAssets, getWorkspaceKlingV4MediaError } from './workspace-kling-v4-media';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import { filterVideoOperationValues } from '@/lib/video-operation';
import type { EngineCaps, Mode, PreflightRequest } from '@/types/engines';
import type { FormState } from './workspace-form-state';
import type { ReferenceAsset } from './workspace-assets';
import { buildKlingElementsPayload, buildWorkspacePreflightInputs } from './workspace-generation-inputs';
import { workspaceModeSupportsRequestField } from './workspace-mode-request-fields';

export type WorkspacePreflightRequestOptions = {
  form: FormState;
  selectedEngine: EngineCaps;
  submissionMode: Mode;
  effectiveDurationSec: number;
  supportsAudioToggle: boolean;
  voiceControlEnabled: boolean;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements?: KlingElementState[];
  memberTier: 'Member' | 'Plus' | 'Pro';
};

export function buildWorkspacePreflightRequest({
  form, selectedEngine, submissionMode, effectiveDurationSec, supportsAudioToggle,
  voiceControlEnabled, inputAssets, klingElements = [], memberTier,
}: WorkspacePreflightRequestOptions): PreflightRequest {
  const isKlingV4 = selectedEngine.id === 'kling-v4';
  const elements = isKlingV4 ? buildKlingElementsPayload({
    selectedEngineId: selectedEngine.id, submissionMode, supportsKlingV3Controls: false, klingElements,
  }) : undefined;
  if (elements && !elements.ok) throw new Error(elements.message);
  const mediaError = isKlingV4 ? getWorkspaceKlingV4MediaError({ mode: submissionMode, inputAssets, klingElements }) : null;
  if (mediaError) throw new Error(mediaError);
  const activeAssets = isKlingV4 ? getWorkspaceKlingV4ActiveAssets(submissionMode, inputAssets) : inputAssets;
  const extraInputValues = filterVideoOperationValues(selectedEngine, submissionMode, form.extraInputValues);
  const allowedMedia = new Set([...(selectedEngine.inputSchema?.required ?? []), ...(selectedEngine.inputSchema?.optional ?? [])]
    .filter(field => !field.modes?.length || field.modes.includes(submissionMode)).map(field => field.id));
  const quoteAssets = form.operation || selectedEngine.id === 'luma-ray-3-2' ? Object.fromEntries(Object.entries(activeAssets).filter(([field]) => allowedMedia.has(field))) : activeAssets;
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
  // Duration controls retain provider enums such as "5s"; the API accepts seconds or auto.
  const durationSeconds = typeof form.durationOption === 'string'
    ? form.durationOption.trim().match(/^(\d+(?:\.\d+)?)s?$/)
    : null;
  const durationOption = isKlingV4 ? effectiveDurationSec : durationSeconds
    ? Number(durationSeconds[1])
    : form.durationOption;

  return {
    engine: form.engineId,
    ...(form.operation ? { operation: form.operation } : {}),
    mode: submissionMode,
    ...((form.operation === 'flux-draft-enhance' || (form.engineId === 'luma-ray-3-2' && submissionMode === 'extend')) && form.extraInputValues.source_job_id ? {sourceJobId:String(form.extraInputValues.source_job_id),...(form.extraInputValues.source_output_id ? {sourceOutputId:String(form.extraInputValues.source_output_id)} : {})} : {}),
    durationSec: effectiveDurationSec,
    ...(durationOption !== undefined && durationOption !== null ? { durationOption } : {}),
    ...(shouldSendResolution
      ? { resolution: form.resolution as PreflightRequest['resolution'] }
      : {}),
    ...(shouldSendAspectRatio
      ? { aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'] }
      : {}),
    ...(shouldSendFps ? { fps: form.fps } : {}),
    ...(!isKlingV4 ? { seedLocked: Boolean(form.seedLocked), loop: form.loop } : {}),
    ...(supportsAudioToggle ? { audio: form.audio } : {}),
    ...(voiceControlEnabled ? { voiceControl: true } : {}),
    // Max tariffs depend on mode, duration and resolution, not reference media.
    // Keep URL-only public recipes in generation without inventing owned asset IDs for a quote.
    inputs: selectedEngine.id === 'flux-3-max' ? [] : buildWorkspacePreflightInputs(quoteAssets),
    ...(Object.keys(extraInputValues).length ? { extraInputValues } : {}),
    ...(elements?.ok && elements.klingElementsPayload ? { elements: elements.klingElementsPayload } : {}),
    user: { memberTier },
  };
}
