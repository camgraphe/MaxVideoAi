import assert from 'node:assert/strict';
import test from 'node:test';

import { persistFailedImageGeneration } from '../frontend/src/server/images/image-generation-failure.ts';

test('failed direct image jobs persist their actual provider mode', async () => {
  const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = '';
  const originalWarn = console.warn;
  console.warn = () => undefined;

  try {
    await persistFailedImageGeneration({
      characterReferenceCount: 0,
      enableWebSearch: false,
      engineId: 'nano-banana-pro',
      error: new Error('transient provider failure'),
      falModelId: 'gemini-3.1-flash-image',
      jobId: 'job_direct_image',
      limitGenerations: false,
      maskUrl: null,
      mode: 't2i',
      normalizedSeed: null,
      numImages: 1,
      outputFormat: 'png',
      pendingReceipt: { jobId: 'job_direct_image' } as never,
      priceOnlyReceipts: true,
      pricing: { totalCents: 12, currency: 'USD' } as never,
      refundOnFailure: false,
      providerJobId: 'vertex-response-1',
      providerMode: 'google_vertex_image_direct',
      quality: null,
      referenceImageUrls: [],
      refundDescription: 'Refund image',
      resolvedAspectRatio: '1:1',
      resolution: '2K',
      thinkingLevel: null,
    }, {
      queryFn: async (sql: string, params?: readonly unknown[]) => {
        queries.push({ sql, params });
        return [];
      },
    } as never);
  } finally {
    console.warn = originalWarn;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }

  assert.equal(queries.length, 2);
  assert.match(queries[0]?.sql ?? '', /provider\s*=\s*\$5/);
  assert.equal(queries[0]?.params?.[4], 'google_vertex_image_direct');
});
