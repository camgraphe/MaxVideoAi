import type { VideoGenerationResponse } from './video-generation-contracts';

type ProviderLifecycleResult<TGenerationResult> =
  | { kind: 'accepted_response'; body: Record<string, unknown> }
  | { kind: 'error_response'; status: number; body: Record<string, unknown> }
  | { kind: 'generation_result'; generationResult: TGenerationResult };

export async function executeVideoGenerationLifecycle<TJob, TCreated extends { kind: 'created' }, TGenerationResult>(params: {
  trustedInitialState?: TCreated;
  reserveInitialState: () => Promise<{ kind: 'existing_job'; job: TJob } | TCreated>;
  mapExisting: (job: TJob) => VideoGenerationResponse | Promise<VideoGenerationResponse>;
  submitProvider: (created: TCreated) => Promise<ProviderLifecycleResult<TGenerationResult>>;
  completeDirect: (generationResult: TGenerationResult) => Promise<VideoGenerationResponse>;
  onReservationError: (error: unknown) => Promise<VideoGenerationResponse>;
}): Promise<VideoGenerationResponse> {
  let initialState: { kind: 'existing_job'; job: TJob } | TCreated;
  if (params.trustedInitialState) {
    initialState = params.trustedInitialState;
  } else {
    try {
      initialState = await params.reserveInitialState();
    } catch (error) {
      return params.onReservationError(error);
    }
  }
  if (initialState.kind === 'existing_job') {
    return params.mapExisting(initialState.job);
  }
  const providerResult = await params.submitProvider(initialState);
  if (providerResult.kind === 'error_response') {
    return { body: providerResult.body, status: providerResult.status };
  }
  if (providerResult.kind === 'accepted_response') {
    return { body: providerResult.body };
  }
  return params.completeDirect(providerResult.generationResult);
}
