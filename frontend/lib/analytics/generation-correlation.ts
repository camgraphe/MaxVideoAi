type GenerationAnalyticsPayload = Record<string, unknown>;

export function mergeRequestGenerationFailureContext({
  payload,
  generationContextByLocalKey,
}: {
  payload: GenerationAnalyticsPayload;
  generationContextByLocalKey: Map<string, GenerationAnalyticsPayload>;
}): GenerationAnalyticsPayload {
  const localKey = typeof payload.local_key === 'string' ? payload.local_key : null;
  if (!localKey) return payload;

  const startContext = generationContextByLocalKey.get(localKey);
  if (!startContext) return payload;
  generationContextByLocalKey.delete(localKey);

  return {
    ...startContext,
    ...payload,
    generation_sequence: startContext.generation_sequence,
    is_first_generation: startContext.is_first_generation,
  };
}
