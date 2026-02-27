import { randomUUID } from 'crypto';
import { ApiError, ValidationError } from '@fal-ai/client';
import { getAngleToolEngine } from '@/config/tools-angle-engines';
import { isDatabaseConfigured, query } from '@/lib/db';
import { getFalClient } from '@/lib/fal-client';
import { normalizeMediaUrl } from '@/lib/media';
import { getResultProviderMode } from '@/lib/result-provider';
import { ensureBillingSchema } from '@/lib/schema';
import {
  applyCinemaSafeParams,
  estimateAngleCostUsd,
  mapTiltForEngine,
  normalizeRotation,
  sanitizeAngleParams,
} from '@/lib/tools-angle';
import type {
  AngleToolEngineDefinition,
  AngleToolOutput,
  AngleToolRequest,
  AngleToolResponse,
  AngleToolEngineId,
} from '@/types/tools-angle';

const TOOL_EVENT_NAME = 'tool_angle_generate';

function usdToCredits(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 100));
}

export class AngleToolError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'AngleToolError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'angle_tool_error';
    this.detail = options?.detail;
  }
}

type RunAngleToolInput = AngleToolRequest & {
  userId: string;
};

function normalizeFalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replace(/^\.?\/+/, '');
  return `https://fal.media/files/${normalized}`;
}

function toAngleOutput(entry: Record<string, unknown>): AngleToolOutput | null {
  const urlRaw =
    typeof entry.url === 'string'
      ? entry.url
      : typeof entry.image_url === 'string'
        ? entry.image_url
        : typeof entry.path === 'string'
          ? entry.path
          : null;
  if (!urlRaw) return null;

  const width = typeof entry.width === 'number' ? entry.width : null;
  const height = typeof entry.height === 'number' ? entry.height : null;
  const mimeType =
    typeof entry.content_type === 'string'
      ? entry.content_type
      : typeof entry.mimetype === 'string'
        ? entry.mimetype
        : typeof entry.mime === 'string'
          ? entry.mime
          : null;

  return {
    url: normalizeMediaUrl(normalizeFalUrl(urlRaw)) ?? normalizeFalUrl(urlRaw),
    width,
    height,
    mimeType,
  };
}

function extractOutputs(payload: unknown): AngleToolOutput[] {
  const roots: unknown[] = [];
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    roots.push(record);
    if (record.output && typeof record.output === 'object') roots.push(record.output);
    if (record.response && typeof record.response === 'object') roots.push(record.response);
    if (record.data && typeof record.data === 'object') roots.push(record.data);
  }

  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    const record = root as Record<string, unknown>;

    if (Array.isArray(record.images)) {
      const mapped = record.images
        .map((entry) => (entry && typeof entry === 'object' ? toAngleOutput(entry as Record<string, unknown>) : null))
        .filter((entry): entry is AngleToolOutput => Boolean(entry));
      if (mapped.length) return mapped;
    }

    if (record.image && typeof record.image === 'object') {
      const single = toAngleOutput(record.image as Record<string, unknown>);
      if (single) return [single];
    }

    if (typeof record.url === 'string') {
      const single = toAngleOutput(record);
      if (single) return [single];
    }
  }

  return [];
}

function parseRequestId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const direct = typeof record.request_id === 'string' ? record.request_id : undefined;
  if (direct) return direct;
  if (typeof record.id === 'string') return record.id;
  if (record.response && typeof record.response === 'object') {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.request_id === 'string') return responseRecord.request_id;
    if (typeof responseRecord.id === 'string') return responseRecord.id;
  }
  if (record.output && typeof record.output === 'object') {
    const outputRecord = record.output as Record<string, unknown>;
    if (typeof outputRecord.request_id === 'string') return outputRecord.request_id;
    if (typeof outputRecord.id === 'string') return outputRecord.id;
  }
  return undefined;
}

function extractActualCostUsd(payload: unknown): number | null {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  const candidates: number[] = [];

  const isCostKey = (rawKey: string): boolean => {
    const key = rawKey.toLowerCase();
    if (key.includes('zoom_amount')) return false;
    return (
      key === 'cost' ||
      key === 'price' ||
      key.includes('cost_usd') ||
      key.includes('price_usd') ||
      key.includes('actual_cost') ||
      key.includes('estimated_cost') ||
      key.endsWith('_usd') ||
      key.endsWith('usd')
    );
  };

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const { value, depth } = current;
    if (depth > 5 || value == null) continue;

    if (typeof value === 'string') {
      const cleaned = value.trim();
      const dollarMatch = cleaned.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
      if (dollarMatch) {
        const parsed = Number(dollarMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) candidates.push(parsed);
      }
      continue;
    }

    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
      continue;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      Object.entries(record).forEach(([key, field]) => {
        const costLike = isCostKey(key);

        if (costLike && typeof field === 'number' && Number.isFinite(field) && field > 0 && field < 10_000) {
          candidates.push(field);
          return;
        }

        if (costLike && typeof field === 'string') {
          const parsed = Number(field.replace(/[^0-9.]+/g, ''));
          if (Number.isFinite(parsed) && parsed > 0) {
            candidates.push(parsed);
            return;
          }
        }

        queue.push({ value: field, depth: depth + 1 });
      });
    }
  }

  if (!candidates.length) return null;
  const costCandidate = candidates.find((value) => value <= 100) ?? candidates[0];
  return Number(costCandidate.toFixed(6));
}

function buildFalInput(
  engine: AngleToolEngineDefinition,
  imageUrl: string,
  params: { rotation: number; tilt: number; zoom: number },
  options?: { generateBestAngles?: boolean }
) {
  const requestedOutputs = options?.generateBestAngles && engine.supportsMultiOutput ? 6 : 1;
  const horizontalAngle = Math.round(normalizeRotation(params.rotation));
  const verticalAngle = Math.round(mapTiltForEngine(engine.id, params.tilt));
  const zoomAmount = Number(params.zoom.toFixed(1));

  return {
    image_urls: [imageUrl],
    horizontal_angle: horizontalAngle,
    vertical_angle: verticalAngle,
    zoom_amount: zoomAmount,
    num_images: requestedOutputs,
  };
}

async function insertToolEvent(params: {
  jobId: string;
  engineId: AngleToolEngineId;
  providerJobId?: string | null;
  payload: Record<string, unknown>;
}) {
  if (!isDatabaseConfigured()) return;

  try {
    await ensureBillingSchema();
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        params.jobId,
        getResultProviderMode(),
        params.providerJobId ?? null,
        params.engineId,
        TOOL_EVENT_NAME,
        JSON.stringify(params.payload),
      ]
    );
  } catch (error) {
    console.warn('[tools/angle] failed to persist event log', error);
  }
}

function toValidationMessage(error: ValidationError): string {
  const messages = error.fieldErrors
    .map((entry) => {
      const loc = Array.isArray(entry.loc) ? entry.loc.filter((part) => part !== 'body') : [];
      const path = loc.length ? loc.join('.') : null;
      const msg = typeof entry.msg === 'string' ? entry.msg.trim() : '';
      if (!msg) return null;
      return path ? `${path}: ${msg}` : msg;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (!messages.length) {
    return error.message || 'Validation failed';
  }
  return messages.slice(0, 3).join(' · ');
}

export async function runAngleTool(input: RunAngleToolInput): Promise<AngleToolResponse> {
  const engine = getAngleToolEngine(input.engineId);
  const requested = sanitizeAngleParams(input.params);
  const safeMode = input.safeMode !== false;
  const applied = applyCinemaSafeParams(requested, safeMode);
  const generateBestAngles = input.generateBestAngles === true;
  const requestedOutputCount = generateBestAngles && engine.supportsMultiOutput ? 6 : 1;
  const estimatedCostUsd = Number(
    (estimateAngleCostUsd(engine.id, input.imageWidth, input.imageHeight) * requestedOutputCount).toFixed(4)
  );
  const estimatedCredits = usdToCredits(estimatedCostUsd) ?? 1;

  const falInput = buildFalInput(engine, input.imageUrl, applied, { generateBestAngles });
  const falClient = getFalClient();
  const jobId = `tool_angle_${randomUUID()}`;
  let providerJobId: string | null = null;
  let lastQueueUpdate: unknown = null;
  const startedAt = Date.now();

  try {
    const result = await falClient.subscribe(engine.falModelId, {
      input: falInput,
      mode: 'polling',
      onEnqueue(requestId) {
        providerJobId = requestId;
      },
      onQueueUpdate(update) {
        if (update?.request_id) {
          providerJobId = update.request_id;
        }
        lastQueueUpdate = update;
      },
    });

    const outputs = extractOutputs(result.data);
    if (!outputs.length) {
      throw new AngleToolError('The selected engine did not return any image output.', {
        status: 502,
        code: 'missing_output',
      });
    }

    const latencyMs = Date.now() - startedAt;
    const actualCostUsd = extractActualCostUsd(result.data) ?? extractActualCostUsd(lastQueueUpdate) ?? null;
    const actualCredits = usdToCredits(actualCostUsd);
    const requestId = providerJobId ?? parseRequestId(result.data) ?? result.requestId ?? null;

    await insertToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId: requestId,
      payload: {
        event: TOOL_EVENT_NAME,
        userId: input.userId,
        status: 'success',
        engine: {
          id: engine.id,
          label: engine.label,
          model: engine.falModelId,
        },
        requested,
        applied: {
          ...applied,
          safeMode,
        },
        options: {
          generateBestAngles,
          requestedOutputCount,
        },
        latencyMs,
        pricing: {
          estimatedCostUsd,
          actualCostUsd,
          currency: 'USD',
          estimatedCredits,
          actualCredits,
        },
        outputCount: outputs.length,
      },
    });

    return {
      ok: true,
      engineId: engine.id,
      engineLabel: engine.label,
      requestedOutputCount,
      requestId,
      providerJobId: requestId,
      latencyMs,
      pricing: {
        estimatedCostUsd,
        actualCostUsd,
        currency: 'USD',
        estimatedCredits,
        actualCredits,
      },
      requested,
      applied: {
        ...applied,
        safeMode,
      },
      outputs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    let message = error instanceof Error ? error.message : 'Angle generation failed';
    let status = 502;
    let detail: unknown;
    let code = 'fal_error';

    if (error instanceof AngleToolError) {
      message = error.message;
      status = error.status;
      detail = error.detail;
      code = error.code;
    } else if (error instanceof ValidationError) {
      message = toValidationMessage(error);
      status = 422;
      detail = error.fieldErrors;
      code = 'validation_error';
    } else if (error instanceof ApiError) {
      message = error.message || 'Fal request failed';
      status = typeof error.status === 'number' ? error.status : 502;
      detail = error.body;
      code = 'provider_error';
    }

    await insertToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId,
      payload: {
        event: TOOL_EVENT_NAME,
        userId: input.userId,
        status: 'error',
        engine: {
          id: engine.id,
          label: engine.label,
          model: engine.falModelId,
        },
        requested,
        applied: {
          ...applied,
          safeMode,
        },
        options: {
          generateBestAngles,
          requestedOutputCount,
        },
        latencyMs,
        pricing: {
          estimatedCostUsd,
          actualCostUsd: null,
          currency: 'USD',
          estimatedCredits,
          actualCredits: null,
        },
        error: {
          code,
          message,
          detail,
        },
      },
    });

    throw new AngleToolError(message, {
      status,
      code,
      detail,
    });
  }
}
