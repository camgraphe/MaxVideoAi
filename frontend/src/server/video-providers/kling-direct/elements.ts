import { createHash } from 'node:crypto';
import { query } from '@/lib/db';
import {
  normalizeMaxVideoProviderElements,
  type MaxVideoProviderElement,
} from '@/lib/video-provider-elements';
import { computeKlingDirectProviderCostUsd } from './cost';
import { KlingDirectError } from './errors';
import { firstString, isRecord } from './response';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

export type KlingDirectElementCreatePayload = {
  element_name: string;
  element_description: string;
  reference_type: 'image_refer' | 'video_refer';
  element_image_list?: {
    frontal_image: string;
    refer_images: Array<{ image_url: string }>;
  };
  element_video_list?: {
    refer_videos: Array<{ video_url: string }>;
  };
  external_task_id: string;
};

export type NormalizedKlingDirectElementTask = {
  providerTaskId: string;
  providerElementId: string | number | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  message: string | null;
  providerCostUnits: number | null;
  providerCostUsd: number | null;
  raw: unknown;
};

export type KlingDirectElementClient = {
  createElement(payload: KlingDirectElementCreatePayload): Promise<NormalizedKlingDirectElementTask>;
  retrieveElement(params: { providerTaskId: string }): Promise<NormalizedKlingDirectElementTask>;
};

const DEFAULT_ELEMENT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_ELEMENT_MAX_WAIT_MS = 60_000;

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function firstRecord(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (isRecord(candidate)) return candidate;
  }
  return null;
}

function firstNumber(value: unknown, keys: string[]): number | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeElementStatus(rawStatus: string | null): NormalizedKlingDirectElementTask['status'] {
  const normalized = rawStatus?.toLowerCase() ?? '';
  if (normalized === 'succeed' || normalized === 'succeeded' || normalized === 'success') return 'completed';
  if (normalized === 'failed' || normalized === 'fail' || normalized === 'error') return 'failed';
  if (normalized === 'processing' || normalized === 'running') return 'running';
  return 'queued';
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshotParam(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export function buildKlingDirectElementCreatePayload(params: {
  element: MaxVideoProviderElement;
  externalTaskId: string;
  index: number;
}): KlingDirectElementCreatePayload {
  const videoUrl = cleanString(params.element.videoUrl);
  const elementName = `MaxVideoAI element ${params.index + 1}`;
  const base = {
    element_name: elementName,
    element_description: 'MaxVideoAI source element for video generation.',
    external_task_id: params.externalTaskId,
  };

  if (videoUrl) {
    return {
      ...base,
      reference_type: 'video_refer',
      element_video_list: {
        refer_videos: [{ video_url: videoUrl }],
      },
    };
  }

  const frontalImageUrl = cleanString(params.element.frontalImageUrl);
  const referenceImageUrls = (params.element.referenceImageUrls ?? [])
    .map(cleanString)
    .filter((url): url is string => Boolean(url))
    .slice(0, 3);
  if (!frontalImageUrl || referenceImageUrls.length === 0) {
    throw new KlingDirectError('Kling element registration needs a video or a frontal image plus references.', {
      status: 400,
      code: 'KLING_ELEMENT_SOURCE_INVALID',
    });
  }

  return {
    ...base,
    reference_type: 'image_refer',
    element_image_list: {
      frontal_image: frontalImageUrl,
      refer_images: referenceImageUrls.map((image_url) => ({ image_url })),
    },
  };
}

export function normalizeKlingDirectElementTask(
  raw: unknown,
  fallbackTaskId?: string | null
): NormalizedKlingDirectElementTask {
  const data = firstRecord(raw, ['data']) ?? raw;
  const result = firstRecord(data, ['task_result', 'result']) ?? null;
  const elements = isRecord(result) && Array.isArray(result.elements) ? result.elements : [];
  const firstElement = elements.find(isRecord) ?? null;
  const providerElementId =
    firstNumber(firstElement, ['element_id', 'elementId']) ?? firstString(firstElement, ['element_id', 'elementId']);
  const providerCostUnits = firstNumber(data, ['final_unit_deduction', 'finalUnitDeduction']);
  const rawStatus = firstString(data, ['task_status', 'taskStatus', 'status']);

  return {
    providerTaskId: firstString(data, ['task_id', 'taskId', 'id']) ?? fallbackTaskId ?? '',
    providerElementId,
    status: normalizeElementStatus(rawStatus),
    message:
      firstString(data, ['task_status_msg', 'taskStatusMsg', 'message', 'msg']) ??
      firstString(raw, ['message', 'msg']),
    providerCostUnits,
    providerCostUsd: computeKlingDirectProviderCostUsd(providerCostUnits),
    raw,
  };
}

function elementSourceSnapshot(element: MaxVideoProviderElement) {
  return {
    id: element.id ?? null,
    frontalAssetId: element.frontalAssetId ?? null,
    frontalImageUrl: element.frontalImageUrl ?? null,
    referenceAssetIds: element.referenceAssetIds ?? null,
    referenceImageUrls: element.referenceImageUrls ?? null,
    videoAssetId: element.videoAssetId ?? null,
    videoUrl: element.videoUrl ?? null,
  };
}

function elementSourceFingerprint(params: {
  userId: string;
  element: MaxVideoProviderElement;
}): string {
  const payload = JSON.stringify({
    userId: params.userId,
    ...elementSourceSnapshot(params.element),
  });
  return createHash('sha256').update(payload).digest('hex');
}

async function findCachedElement(params: {
  sourceFingerprint: string;
  queryFn: QueryFn;
}): Promise<string | null> {
  const rows = await params.queryFn<{ provider_element_id: string }>(
    `SELECT provider_element_id
       FROM provider_element_assets
      WHERE provider = 'kling_direct'
        AND source_fingerprint = $1
        AND status = 'completed'
        AND provider_element_id IS NOT NULL
      LIMIT 1`,
    [params.sourceFingerprint]
  );
  return cleanString(rows[0]?.provider_element_id);
}

async function upsertElementRegistrationStarted(params: {
  userId: string;
  sourceFingerprint: string;
  sourceSnapshot: unknown;
  providerTaskId: string;
  requestSnapshot: unknown;
  responseSnapshot: unknown;
  referenceType: string;
  queryFn: QueryFn;
}): Promise<number> {
  const rows = await params.queryFn<{ id: number }>(
    `INSERT INTO provider_element_assets (
       user_id,
       provider,
       provider_model,
       source_fingerprint,
       source_snapshot,
       provider_task_id,
       status,
       reference_type,
       request_snapshot,
       response_snapshot
     )
     VALUES ($1, 'kling_direct', 'kling-v3', $2, $3::jsonb, $4, 'processing', $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (provider, source_fingerprint)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       provider_model = EXCLUDED.provider_model,
       source_snapshot = EXCLUDED.source_snapshot,
       provider_task_id = EXCLUDED.provider_task_id,
       status = EXCLUDED.status,
       reference_type = EXCLUDED.reference_type,
       request_snapshot = EXCLUDED.request_snapshot,
       response_snapshot = EXCLUDED.response_snapshot,
       updated_at = NOW()
     RETURNING id`,
    [
      params.userId,
      params.sourceFingerprint,
      snapshotParam(params.sourceSnapshot),
      params.providerTaskId,
      params.referenceType,
      snapshotParam(params.requestSnapshot),
      snapshotParam(params.responseSnapshot),
    ]
  );
  const id = rows[0]?.id;
  if (typeof id !== 'number') {
    throw new Error('Unable to store Kling element registration.');
  }
  return id;
}

async function markElementRegistrationCompleted(params: {
  id: number;
  providerElementId: string | number;
  task: NormalizedKlingDirectElementTask;
  queryFn: QueryFn;
}) {
  await params.queryFn(
    `UPDATE provider_element_assets
        SET status = 'completed',
            provider_element_id = $2,
            response_snapshot = COALESCE($3::jsonb, response_snapshot),
            provider_cost_units = $4,
            provider_cost_usd = $5,
            updated_at = NOW()
      WHERE id = $1`,
    [
      params.id,
      String(params.providerElementId),
      snapshotParam(params.task.raw),
      params.task.providerCostUnits,
      params.task.providerCostUsd,
    ]
  );
}

async function markElementRegistrationFailed(params: {
  id: number;
  status: string;
  responseSnapshot?: unknown;
  queryFn: QueryFn;
}) {
  await params.queryFn(
    `UPDATE provider_element_assets
        SET status = $2,
            response_snapshot = COALESCE($3::jsonb, response_snapshot),
            updated_at = NOW()
      WHERE id = $1`,
    [params.id, params.status, snapshotParam(params.responseSnapshot)]
  );
}

async function waitForElementCompletion(params: {
  initialTask: NormalizedKlingDirectElementTask;
  client: KlingDirectElementClient;
  pollIntervalMs: number;
  maxWaitMs: number;
}): Promise<NormalizedKlingDirectElementTask> {
  let task = params.initialTask;
  const startedAt = Date.now();
  while (true) {
    if (task.status === 'completed' && task.providerElementId !== null) {
      return task;
    }
    if (task.status === 'failed') {
      throw new KlingDirectError(task.message ?? 'Kling element registration failed.', {
        code: 'KLING_ELEMENT_REGISTRATION_FAILED',
        body: task.raw,
      });
    }
    if (Date.now() - startedAt >= params.maxWaitMs) {
      throw new KlingDirectError('Kling element registration did not complete before video submit.', {
        code: 'KLING_ELEMENT_REGISTRATION_INCOMPLETE',
        body: task.raw,
      });
    }
    await sleep(params.pollIntervalMs);
    try {
      task = await params.client.retrieveElement({ providerTaskId: task.providerTaskId });
    } catch (error) {
      throw new KlingDirectError('Kling element registration could not be confirmed before video submit.', {
        code: 'KLING_ELEMENT_REGISTRATION_INCOMPLETE',
        cause: error,
      });
    }
  }
}

export async function ensureKlingDirectElementsForPayload(params: {
  elements: MaxVideoProviderElement[] | null | undefined;
  userId: string;
  jobId: string;
  client: KlingDirectElementClient;
  queryFn?: QueryFn;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<{ elements: MaxVideoProviderElement[] | undefined; registeredCount: number }> {
  const elements = normalizeMaxVideoProviderElements(params.elements);
  if (!elements.length) return { elements: undefined, registeredCount: 0 };

  const queryFn = params.queryFn ?? query;
  const resolved: MaxVideoProviderElement[] = [];
  let registeredCount = 0;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index]!;
    if (element.providerElementId !== undefined) {
      resolved.push(element);
      continue;
    }

    const sourceFingerprint = elementSourceFingerprint({ userId: params.userId, element });
    const cachedProviderElementId = await findCachedElement({ sourceFingerprint, queryFn });
    if (cachedProviderElementId) {
      resolved.push({ ...element, providerElementId: cachedProviderElementId });
      continue;
    }

    const externalTaskId = `${params.jobId}:element:${index + 1}`;
    const createPayload = buildKlingDirectElementCreatePayload({
      element,
      externalTaskId,
      index,
    });
    const createdTask = await params.client.createElement(createPayload);
    if (!createdTask.providerTaskId) {
      throw new KlingDirectError('Kling element response did not include a task id.', {
        code: 'KLING_TASK_ID_MISSING',
        body: createdTask.raw,
      });
    }
    const rowId = await upsertElementRegistrationStarted({
      userId: params.userId,
      sourceFingerprint,
      sourceSnapshot: elementSourceSnapshot(element),
      providerTaskId: createdTask.providerTaskId,
      requestSnapshot: createPayload,
      responseSnapshot: createdTask.raw,
      referenceType: createPayload.reference_type,
      queryFn,
    });

    try {
      const completedTask = await waitForElementCompletion({
        initialTask: createdTask,
        client: params.client,
        pollIntervalMs: params.pollIntervalMs ?? DEFAULT_ELEMENT_POLL_INTERVAL_MS,
        maxWaitMs: params.maxWaitMs ?? DEFAULT_ELEMENT_MAX_WAIT_MS,
      });
      await markElementRegistrationCompleted({
        id: rowId,
        providerElementId: completedTask.providerElementId!,
        task: completedTask,
        queryFn,
      });
      resolved.push({ ...element, providerElementId: completedTask.providerElementId! });
      registeredCount += 1;
    } catch (error) {
      await markElementRegistrationFailed({
        id: rowId,
        status: 'failed',
        responseSnapshot: error instanceof KlingDirectError ? error.body : error,
        queryFn,
      });
      throw error;
    }
  }

  return { elements: resolved, registeredCount };
}
