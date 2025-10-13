import { createFalClient, type FalClient } from '@fal-ai/client';

let client: FalClient | null = null;

export function getFalClient(): FalClient {
  if (!client) {
    client = createFalClient({
      proxyUrl: '/api/fal/proxy',
    });
  }
  return client;
}

