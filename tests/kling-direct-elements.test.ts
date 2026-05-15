import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildKlingDirectElementCreatePayload,
  ensureKlingDirectElementsForPayload,
  normalizeKlingDirectElementTask,
} from '../frontend/src/server/video-providers/kling-direct/elements';
import { KlingDirectError } from '../frontend/src/server/video-providers/kling-direct/errors';

test('Kling direct element payload maps MaxVideoAI source assets to the Element API', () => {
  assert.deepEqual(
    buildKlingDirectElementCreatePayload({
      element: {
        id: 'element_a',
        frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
        referenceImageUrls: ['https://cdn.maxvideoai.com/ref-a.png', 'https://cdn.maxvideoai.com/ref-b.png'],
      },
      externalTaskId: 'job_123:element:1',
      index: 0,
    }),
    {
      element_name: 'MaxVideoAI element 1',
      element_description: 'MaxVideoAI source element for video generation.',
      reference_type: 'image_refer',
      element_image_list: {
        frontal_image: 'https://cdn.maxvideoai.com/front.png',
        refer_images: [
          { image_url: 'https://cdn.maxvideoai.com/ref-a.png' },
          { image_url: 'https://cdn.maxvideoai.com/ref-b.png' },
        ],
      },
      external_task_id: 'job_123:element:1',
    }
  );

  assert.deepEqual(
    buildKlingDirectElementCreatePayload({
      element: {
        id: 'element_b',
        videoUrl: 'https://cdn.maxvideoai.com/subject.mp4',
      },
      externalTaskId: 'job_123:element:2',
      index: 1,
    }),
    {
      element_name: 'MaxVideoAI element 2',
      element_description: 'MaxVideoAI source element for video generation.',
      reference_type: 'video_refer',
      element_video_list: {
        refer_videos: [{ video_url: 'https://cdn.maxvideoai.com/subject.mp4' }],
      },
      external_task_id: 'job_123:element:2',
    }
  );
});

test('Kling direct element response normalization extracts element id and cost', () => {
  const normalized = normalizeKlingDirectElementTask({
    code: 0,
    data: {
      task_id: 'element_task_1',
      task_status: 'succeed',
      final_unit_deduction: '0.25',
      task_result: {
        elements: [
          {
            element_id: 160,
            status: 'succeed',
          },
        ],
      },
    },
  });

  assert.equal(normalized.providerTaskId, 'element_task_1');
  assert.equal(normalized.providerElementId, 160);
  assert.equal(normalized.status, 'completed');
  assert.equal(normalized.providerCostUnits, 0.25);
});

test('Kling direct element registration reuses cached provider element ids', async () => {
  const calls: string[] = [];
  const queryFn = async <T = unknown>(sql: string): Promise<T[]> => {
    calls.push(sql);
    if (/SELECT provider_element_id/.test(sql)) {
      return [{ provider_element_id: '160' }] as T[];
    }
    return [] as T[];
  };
  const client = {
    createElement: async () => {
      throw new Error('createElement should not be called for cached elements');
    },
    retrieveElement: async () => {
      throw new Error('retrieveElement should not be called for cached elements');
    },
  };

  const result = await ensureKlingDirectElementsForPayload({
    elements: [
      {
        id: 'element_cached',
        frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
        referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
      },
    ],
    userId: 'user_1',
    jobId: 'job_cached',
    client,
    queryFn,
  });

  assert.deepEqual(result.elements, [
    {
      id: 'element_cached',
      providerElementId: '160',
      frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
      frontalAssetId: undefined,
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
      referenceAssetIds: undefined,
      videoUrl: undefined,
      videoAssetId: undefined,
    },
  ]);
  assert.equal(result.registeredCount, 0);
  assert.ok(calls.some((sql) => /FROM provider_element_assets/.test(sql)));
});

test('Kling direct element registration creates, polls, and stores missing elements', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const queryFn = async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
    queries.push({ sql, params });
    if (/SELECT provider_element_id/.test(sql)) return [] as T[];
    if (/INSERT INTO provider_element_assets/.test(sql)) return [{ id: 7 }] as T[];
    return [] as T[];
  };
  const client = {
    createElement: async () => ({
      providerTaskId: 'element_task_1',
      providerElementId: null,
      status: 'running' as const,
      providerCostUnits: null,
      providerCostUsd: null,
      raw: { data: { task_id: 'element_task_1', task_status: 'processing' } },
    }),
    retrieveElement: async () => ({
      providerTaskId: 'element_task_1',
      providerElementId: 161,
      status: 'completed' as const,
      providerCostUnits: 0.25,
      providerCostUsd: 0.035,
      raw: { data: { task_id: 'element_task_1', task_status: 'succeed' } },
    }),
  };

  const result = await ensureKlingDirectElementsForPayload({
    elements: [
      {
        id: 'element_new',
        videoUrl: 'https://cdn.maxvideoai.com/subject.mp4',
        videoAssetId: 'asset_video',
      },
    ],
    userId: 'user_1',
    jobId: 'job_new',
    client,
    queryFn,
    pollIntervalMs: 0,
    maxWaitMs: 1000,
  });

  assert.equal(result.elements[0]?.providerElementId, 161);
  assert.equal(result.registeredCount, 1);
  assert.ok(queries.some((entry) => /INSERT INTO provider_element_assets/.test(entry.sql)));
  assert.ok(queries.some((entry) => /provider_element_id = \$2/.test(entry.sql)));
});

test('Kling direct element registration does not fallback after element task acceptance stalls', async () => {
  const client = {
    createElement: async () => ({
      providerTaskId: 'element_task_1',
      providerElementId: null,
      status: 'running' as const,
      providerCostUnits: null,
      providerCostUsd: null,
      raw: {},
    }),
    retrieveElement: async () => ({
      providerTaskId: 'element_task_1',
      providerElementId: null,
      status: 'running' as const,
      providerCostUnits: null,
      providerCostUsd: null,
      raw: {},
    }),
  };

  await assert.rejects(
    () =>
      ensureKlingDirectElementsForPayload({
        elements: [{ id: 'element_stalled', videoUrl: 'https://cdn.maxvideoai.com/subject.mp4' }],
        userId: 'user_1',
        jobId: 'job_stalled',
        client,
        queryFn: async <T = unknown>(sql: string): Promise<T[]> =>
          /INSERT INTO provider_element_assets/.test(sql) ? ([{ id: 8 }] as T[]) : ([] as T[]),
        pollIntervalMs: 0,
        maxWaitMs: 0,
      }),
    (error) => error instanceof KlingDirectError && error.code === 'KLING_ELEMENT_REGISTRATION_INCOMPLETE'
  );
});
