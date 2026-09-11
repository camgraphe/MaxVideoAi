type UpscaleFalQueue = {
  submit(
    modelId: string,
    options: { input: Record<string, unknown> }
  ): Promise<{ request_id?: string | null }>;
  subscribeToStatus(
    modelId: string,
    options: {
      requestId: string;
      mode: 'polling';
      onQueueUpdate(update: unknown): void;
    }
  ): Promise<unknown>;
  result(modelId: string, options: { requestId: string }): Promise<unknown>;
};

export async function runDurablyTrackedUpscaleRequest(params: {
  modelId: string;
  input: Record<string, unknown>;
  persistProviderJobId(requestId: string): Promise<void>;
  onQueueUpdate(update: unknown): void;
  queue: UpscaleFalQueue;
}): Promise<{ providerJobId: string; result: unknown }> {
  const queued = await params.queue.submit(params.modelId, { input: params.input });
  const providerJobId = queued.request_id?.trim();
  if (!providerJobId) {
    throw new Error('Fal queue response did not contain a request ID.');
  }

  await params.persistProviderJobId(providerJobId);
  await params.queue.subscribeToStatus(params.modelId, {
    requestId: providerJobId,
    mode: 'polling',
    onQueueUpdate: params.onQueueUpdate,
  });
  const result = await params.queue.result(params.modelId, { requestId: providerJobId });
  return { providerJobId, result };
}
