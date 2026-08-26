import { createFalClient, type FalClient } from '@fal-ai/client';
import { ENV } from '@/lib/env';

let client: FalClient | null = null;

export function getFalClient(): FalClient {
  if (!client) {
    const falKey = ENV.FAL_API_KEY;

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
