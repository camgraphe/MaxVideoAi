import { z } from 'zod';

import type { PreflightRequest, PreflightResponse } from '@/types/engines';

export const MAX_PREFLIGHT_BODY_BYTES = 32 * 1024;
export const MAX_PREFLIGHT_INPUTS = 16;

const modes = [
  't2v',
  'i2v',
  'ref2v',
  'fl2v',
  'v2v',
  'r2v',
  'a2v',
  'extend',
  'retake',
  'reframe',
  't2i',
  'i2i',
] as const;

const resolutions = [
  '0.5k', '540p', '480p', '720p', '1080p', '1440p', '4k', '1k', '2k', '2K', '3K', '4K',
  '2048x2048', '1920x1080', '1080x1920', '2304x1728', '1728x2304', '2848x1600',
  '1600x2848', '2496x1664', '1664x2496', '3136x1344', '3072x3072', '3456x2592',
  '2592x3456', '4096x2304', '2304x4096', '2496x3744', '3744x2496', '4704x2016',
  '4096x4096', '3520x4704', '4704x3520', '5504x3040', '3040x5504', '3328x4992',
  '4992x3328', '6240x2656', '512P', '768P', 'square', 'square_hd', 'landscape_hd',
  'portrait_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9',
  'custom', 'auto',
] as const;

const aspectRatios = [
  '16:9', '9:16', '9:21', '1:1', '4:1', '1:4', '8:1', '1:8', '4:5', '5:4', '4:3',
  '3:4', '3:2', '2:3', '21:9', 'custom', 'source', 'auto',
] as const;

const forbiddenObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const safeKey = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/u);
const extraScalar = z.union([
  z.string().max(2_048),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const extraValue = z.union([extraScalar, z.array(extraScalar).max(32)]);
const extraInputValuesSchema = z.record(safeKey, extraValue).superRefine((value, context) => {
  if (Object.keys(value).length > 64) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Too many extra input values.' });
  }
});

const persistedReferenceSchema = z.object({
  assetId: z.string().trim().min(1).max(256),
  slotId: z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/u),
  kind: z.enum(['image', 'video', 'audio']),
  url: z.string().trim().min(1).max(2_048).refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }),
}).strict();

const preflightRequestSchema = z.object({
  engine: z.string().trim().min(1).max(128),
  mode: z.enum(modes),
  durationSec: z.number().finite().positive().max(3_600),
  resolution: z.enum(resolutions),
  aspectRatio: z.enum(aspectRatios).optional(),
  fps: z.number().finite().positive().max(240),
  seedLocked: z.boolean().optional(),
  loop: z.boolean().optional(),
  audio: z.boolean().optional(),
  hasVideoInput: z.boolean().optional(),
  voiceControl: z.boolean().optional(),
  inputs: z.array(persistedReferenceSchema).max(MAX_PREFLIGHT_INPUTS).optional(),
  extraInputValues: extraInputValuesSchema.optional(),
  user: z.object({ memberTier: z.string().trim().min(1).max(32).optional() }).strict().optional(),
}).strict();

type PreflightRequestFailure = {
  ok: false;
  status: 400 | 413;
  response: PreflightResponse;
};

type PreflightRequestSuccess = {
  ok: true;
  request: PreflightRequest;
};

export type PreflightRequestParseResult = PreflightRequestSuccess | PreflightRequestFailure;

function failure(
  status: 400 | 413,
  code: 'PREFLIGHT_REQUEST_INVALID' | 'PREFLIGHT_REQUEST_TOO_LARGE',
  message: string,
): PreflightRequestFailure {
  return {
    ok: false,
    status,
    response: {
      ok: false,
      messages: [message],
      error: { code, message },
    },
  };
}

function containsForbiddenObjectKey(value: unknown): boolean {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    for (const key of Object.keys(current)) {
      if (forbiddenObjectKeys.has(key)) return true;
      pending.push((current as Record<string, unknown>)[key]);
    }
  }
  return false;
}

export function parsePreflightRequestPayload(payload: unknown): PreflightRequestParseResult {
  if (containsForbiddenObjectKey(payload)) {
    return failure(400, 'PREFLIGHT_REQUEST_INVALID', 'Invalid preflight request.');
  }
  const parsed = preflightRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return failure(400, 'PREFLIGHT_REQUEST_INVALID', 'Invalid preflight request.');
  }
  return { ok: true, request: parsed.data };
}

type PreflightBodyRequest = Pick<Request, 'headers' | 'text'> & {
  body?: Request['body'];
};

async function readBoundedRequestText(request: PreflightBodyRequest): Promise<
  | { ok: true; text: string }
  | PreflightRequestFailure
> {
  if (!request.body) {
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > MAX_PREFLIGHT_BODY_BYTES) {
        return failure(413, 'PREFLIGHT_REQUEST_TOO_LARGE', 'Preflight request body is too large.');
      }
      return { ok: true, text };
    } catch {
      return failure(400, 'PREFLIGHT_REQUEST_INVALID', 'Invalid preflight request.');
    }
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > MAX_PREFLIGHT_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return failure(413, 'PREFLIGHT_REQUEST_TOO_LARGE', 'Preflight request body is too large.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    await reader.cancel().catch(() => undefined);
    return failure(400, 'PREFLIGHT_REQUEST_INVALID', 'Invalid preflight request.');
  } finally {
    reader.releaseLock();
  }
}

export async function readPreflightRequest(request: PreflightBodyRequest): Promise<PreflightRequestParseResult> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/u.test(declaredLength)) {
    if (BigInt(declaredLength) > BigInt(MAX_PREFLIGHT_BODY_BYTES)) {
      await request.body?.cancel().catch(() => undefined);
      return failure(413, 'PREFLIGHT_REQUEST_TOO_LARGE', 'Preflight request body is too large.');
    }
  }

  const body = await readBoundedRequestText(request);
  if (!body.ok) return body;

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return failure(400, 'PREFLIGHT_REQUEST_INVALID', 'Invalid preflight request.');
  }
  return parsePreflightRequestPayload(payload);
}
