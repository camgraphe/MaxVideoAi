import { createFalClient, type FalClient } from '@fal-ai/client';

let client: FalClient | null = null;

export function getFalClient(): FalClient {
  if (!client) {
    const falKey =
      process.env.FAL_KEY ??
      process.env.FAL_API_KEY ??
      process.env.NEXT_PUBLIC_FAL_KEY ??
      process.env.NEXT_PUBLIC_FAL_API_KEY;

    const config: Parameters<typeof createFalClient>[0] = {};

    if (typeof window === 'undefined') {
      if (falKey) {
        config.credentials = falKey;
      }
    } else {
      config.proxyUrl = '/api/fal/proxy';
    }

    client = createFalClient(config);
  }
  return client;
}
