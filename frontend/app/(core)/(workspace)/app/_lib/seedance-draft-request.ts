import { buildWorkspacePreflightInputs, prepareGenerationInputs, type PrepareGenerationInputsOptions } from './workspace-generation-inputs';
import type { WorkspaceGeneratePayload } from './workspace-generation-payload';

/** Draft shares the ordinary workspace's media validation and field provenance. */
export function prepareSeedanceDraftWorkspaceRequest(options: PrepareGenerationInputsOptions & { prompt: string }) {
  const result = prepareGenerationInputs(options);
  if (!result.ok) return result;
  const payload: WorkspaceGeneratePayload = {
    engineId: options.selectedEngineId, mode: options.submissionMode, prompt: options.prompt,
    durationSec: options.form.durationSec, durationOption: options.form.durationOption,
    aspectRatio: options.form.aspectRatio, resolution: '480p', fps: options.form.fps, audio: options.form.audio,
    inputs: result.inputsPayload, imageUrl: result.primaryImageUrl, audioUrl: result.primaryAudioUrl,
    referenceImages: result.referenceImageUrls, endImageUrl: result.endImageUrl, extraInputValues: result.extraInputValues,
    payment: { mode: 'wallet' }, iterationCount: 1,
  };
  return { ok: true as const, payload, preflightInputs: buildWorkspacePreflightInputs(options.inputAssets) };
}
