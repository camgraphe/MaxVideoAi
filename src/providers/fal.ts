import { createHash } from "node:crypto";
import sodium from "libsodium-wrappers";
import type {
  JobStatus,
  PollJobResult,
  ProviderAdapter,
  StartJobInput,
  StartJobResult,
} from "@/providers/types";
import { getModelSpecByEngine } from "@/data/models";
import type { ModelSpec } from "@/data/models";
import { normalizeDurationSeconds, normalizeNumber } from "@/lib/models/normalization";
import { getFalCredentials, shouldRequestFalLogs } from "@/lib/env";

function resolveFalBase(): string {
  const DEFAULT = "https://fal.run";
  const allowedOrigins = new Set(["https://fal.run", "https://api.fal.ai", "https://queue.fal.run"]);
  const raw = process.env.FAL_API_BASE;
  if (!raw) return DEFAULT;
  try {
    const url = new URL(raw);
    const origin = url.origin; // strip any path to avoid "https://fal.ai/models/..."
    if (allowedOrigins.has(origin)) {
      return origin;
    }
    console.warn(`[fal] Ignoring invalid FAL_API_BASE '${raw}'. Using default ${DEFAULT}.`);
    return DEFAULT;
  } catch {
    console.warn(`[fal] Invalid FAL_API_BASE '${raw}'. Using default ${DEFAULT}.`);
    return DEFAULT;
  }
}

const FAL_API_BASE = resolveFalBase();
const FAL_TIMEOUT_MS = Number(process.env.FAL_TIMEOUT_MS ?? 300000);
const FAL_JWKS_URL =
  process.env.FAL_JWKS_URL ?? "https://rest.alpha.fal.ai/.well-known/jwks.json";

interface FalStartResponse {
  request_id: string;
  status: string;
  eta?: number;
}

export interface FalPollResponse {
  request_id: string;
  status: string;
  error?: { message?: string } | string;
  logs?: Array<{ message: string; timestamp?: string }>;
  video?: Record<string, unknown>;
  videos?: Array<Record<string, unknown>>;
  output?: unknown;
  outputs?: unknown;
  thumbnails?: string[];
  duration?: number;
  response?: {
    output?: unknown;
    outputs?: unknown;
    videos?: Array<Record<string, unknown>>;
    video?: Record<string, unknown>;
    video_url?: string;
    thumbnails?: string[];
    duration?: number;
    cost_cents?: number;
  };
  usage?: { total_cost_cents?: number };
}
interface FalFetchOptions extends RequestInit {
  searchParams?: Record<string, string | number | boolean | undefined>;
  baseUrl?: string;
}

let cachedFalKey: string | null = null;

function requireFalKey(): string {
  if (!cachedFalKey) {
    cachedFalKey = getFalCredentials();
  }
  return cachedFalKey;
}

async function falFetch<T>(path: string, init: FalFetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAL_TIMEOUT_MS);
  try {
    const baseUrl = init.baseUrl ?? FAL_API_BASE;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, baseUrl);

    if (init.searchParams) {
      for (const [key, value] of Object.entries(init.searchParams)) {
        if (typeof value === "undefined") continue;
        url.searchParams.set(key, String(value));
      }
    }

    const finalHeaders = new Headers(init.headers as HeadersInit);
    if (!finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
    finalHeaders.set("Authorization", `Key ${requireFalKey()}`);

    const requestInit: RequestInit = {
      ...init,
      headers: finalHeaders,
      signal: controller.signal,
    };

    delete (requestInit as FalFetchOptions).searchParams;
    delete (requestInit as FalFetchOptions).baseUrl;

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FAL request failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `FAL request timed out after ${FAL_TIMEOUT_MS}ms. Please retry or increase FAL_TIMEOUT_MS.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mapStatus(status: string | undefined | null): JobStatus {
  if (!status) {
    return "pending";
  }

  const normalized = status.toLowerCase();
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("success") || normalized.includes("complete")) return "completed";
  if (normalized.includes("process") || normalized.includes("running")) return "running";
  return "pending";
}

export interface FalVideoResource {
  url: string;
  thumbnail?: string;
  durationSeconds?: number;
  contentType?: string;
  fileName?: string;
  fileSizeBytes?: number;
}

function coerceFalVideoResource(
  candidate: unknown,
  fallbacks: { thumbnail?: string; durationSeconds?: number },
): FalVideoResource | undefined {
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  const record = candidate as Record<string, unknown>;

  const urlCandidate = (() => {
    if (typeof record.url === "string") return record.url;
    if (typeof record.video_url === "string") return record.video_url;
    if (typeof record.file === "object" && record.file && typeof (record.file as Record<string, unknown>).url === "string") {
      return (record.file as Record<string, unknown>).url as string;
    }
    return undefined;
  })();

  if (!urlCandidate) {
    return undefined;
  }

  const thumbnail =
    typeof record.thumbnail === "string"
      ? record.thumbnail
      : typeof record.thumbnail_url === "string"
        ? record.thumbnail_url
        : fallbacks.thumbnail;

  const duration =
    typeof record.duration === "number"
      ? record.duration
      : typeof record.seconds === "number"
        ? record.seconds
        : fallbacks.durationSeconds;

  return {
    url: urlCandidate,
    thumbnail,
    durationSeconds: duration,
    contentType:
      typeof record.content_type === "string"
        ? record.content_type
        : typeof record.mime_type === "string"
          ? record.mime_type
          : undefined,
    fileName:
      typeof record.file_name === "string"
        ? record.file_name
        : typeof record.filename === "string"
          ? record.filename
          : undefined,
    fileSizeBytes: typeof record.file_size === "number" ? record.file_size : undefined,
  };
}

export function extractFalVideoResource(
  response?: FalPollResponse["response"],
): FalVideoResource | undefined {
  if (!response) {
    return undefined;
  }

  const fallbackThumbnail = response.thumbnails?.[0];
  const fallbacks = {
    thumbnail: fallbackThumbnail,
    durationSeconds: typeof response.duration === "number" ? response.duration : undefined,
  };

  if (Array.isArray(response.videos) && response.videos.length > 0) {
    const resource = coerceFalVideoResource(response.videos[0], fallbacks);
    if (resource) {
      return resource;
    }
  }

  const directVideo = coerceFalVideoResource(response.video, fallbacks);
  if (directVideo) {
    return directVideo;
  }

  if (response.output) {
    if (Array.isArray(response.output) && response.output.length > 0) {
      const resource = coerceFalVideoResource(response.output[0], fallbacks);
      if (resource) {
        return resource;
      }
    } else {
      const resource = coerceFalVideoResource(response.output, fallbacks);
      if (resource) {
        return resource;
      }

      if (
        typeof response.output === "object" &&
        response.output &&
        "video" in (response.output as Record<string, unknown>)
      ) {
        const nested = (response.output as Record<string, unknown>).video;
        const resourceFromNested = coerceFalVideoResource(nested, fallbacks);
        if (resourceFromNested) {
          return resourceFromNested;
        }
      }
    }
  }

  if (response.outputs) {
    if (Array.isArray(response.outputs) && response.outputs.length > 0) {
      for (const candidate of response.outputs) {
        const resource = coerceFalVideoResource(candidate, fallbacks);
        if (resource) {
          return resource;
        }
      }
    } else {
      const resource = coerceFalVideoResource(response.outputs, fallbacks);
      if (resource) {
        return resource;
      }
    }
  }

  if (typeof response.video_url === "string") {
    return {
      url: response.video_url,
      thumbnail: fallbackThumbnail,
      durationSeconds:
        typeof response.duration === "number" ? response.duration : undefined,
    };
  }

  return undefined;
}

export function extractFalVideoResourceFromPayload(
  payload: FalPollResponse,
): FalVideoResource | undefined {
  const fromResponse = extractFalVideoResource(payload.response);
  if (fromResponse) {
    return fromResponse;
  }

  const fallbacks = {
    thumbnail: payload.thumbnails?.[0],
    durationSeconds: typeof payload.duration === "number" ? payload.duration : undefined,
  };

  if (payload.videos?.length) {
    const resource = coerceFalVideoResource(payload.videos[0], fallbacks);
    if (resource) {
      return resource;
    }
  }

  const directVideo = coerceFalVideoResource(payload.video, fallbacks);
  if (directVideo) {
    return directVideo;
  }

  if (payload.output) {
    if (Array.isArray(payload.output) && payload.output.length > 0) {
      for (const candidate of payload.output) {
        const resource = coerceFalVideoResource(candidate, fallbacks);
        if (resource) {
          return resource;
        }
      }
    } else {
      const resource = coerceFalVideoResource(payload.output, fallbacks);
      if (resource) {
        return resource;
      }

      if (
        typeof payload.output === "object" &&
        payload.output &&
        "video" in (payload.output as Record<string, unknown>)
      ) {
        const resource = coerceFalVideoResource(
          (payload.output as Record<string, unknown>).video,
          fallbacks,
        );
        if (resource) {
          return resource;
        }
      }
    }
  }

  if (payload.outputs) {
    if (Array.isArray(payload.outputs) && payload.outputs.length > 0) {
      for (const candidate of payload.outputs) {
        const resource = coerceFalVideoResource(candidate, fallbacks);
        if (resource) {
          return resource;
        }
      }
    } else {
      const resource = coerceFalVideoResource(payload.outputs, fallbacks);
      if (resource) {
        return resource;
      }
    }
  }

  return undefined;
}

export function mapFalPollResponse(
  requestId: string,
  response: FalPollResponse,
  includeLogs: boolean,
): PollJobResult {
  const status = mapStatus(response.status);
  const progress = status === "completed" ? 100 : status === "running" ? 60 : 15;
  const videoResource = extractFalVideoResourceFromPayload(response);
  const outputUrl = videoResource?.url;
  const thumbnailUrl = videoResource?.thumbnail;
  const durationSeconds = videoResource?.durationSeconds;
  const costActualCents =
    response.response?.cost_cents ?? response.usage?.total_cost_cents ?? undefined;

  let error: string | undefined;
  if (status === "failed") {
    error = typeof response.error === "string" ? response.error : response.error?.message;
  }

  const logs = includeLogs
    ? response.logs?.map((entry) => ({ message: entry.message, timestamp: entry.timestamp })) ?? []
    : undefined;

  return {
    jobId: requestId,
    provider: "fal",
    status,
    progress,
    outputUrl,
    thumbnailUrl,
    durationSeconds,
    costActualCents,
    error,
    logs,
    asset: videoResource,
  };
}

function secondsToDurationString(value: number): string {
  return `${Math.max(1, Math.round(value))}s`;
}

function resolveResolution(input: StartJobInput, spec: ModelSpec): string {
  const metadataValue = typeof input.metadata?.resolution === "string" ? input.metadata.resolution : undefined;
  return metadataValue ?? spec.defaults.resolution ?? "720p";
}

function aspectRatioToSize(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case "9:16":
      return { width: 720, height: 1280 };
    case "1:1":
      return { width: 720, height: 720 };
    case "21:9":
      return { width: 1920, height: 822 };
    default:
      return { width: 1280, height: 720 };
  }
}

type PayloadBuilder = (params: { input: StartJobInput; spec: ModelSpec }) => Record<string, unknown>;

const payloadBuilders: Record<string, PayloadBuilder> = {
  "fal:veo3": ({ input, spec }) => {
    const resolution = resolveResolution(input, spec);
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds, spec);
    const duration = secondsToDurationString(durationSeconds);
    const cfgScale = normalizeNumber(input.advanced?.cfgScale, spec.constraints.cfgScale, spec.defaults.cfgScale);
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration,
      resolution,
      generate_audio: input.withAudio,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: cfgScale,
    };
  },
  "fal:veo3-fast": ({ input, spec }) => {
    const imageUrl = input.inputAssets?.initImageUrl;
    if (!imageUrl) {
      throw new Error("Veo 3 Fast requires an init image. Upload one before launching the job.");
    }
    const resolution = resolveResolution(input, spec);
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds, spec);
    const duration = secondsToDurationString(durationSeconds);
    const cfgScale = normalizeNumber(input.advanced?.cfgScale, spec.constraints.cfgScale, spec.defaults.cfgScale);
    return {
      prompt: input.prompt,
      image_url: imageUrl,
      aspect_ratio: input.ratio,
      duration,
      resolution,
      generate_audio: input.withAudio,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: cfgScale,
    };
  },
  "fal:kling-pro": ({ input, spec }) => {
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds, spec);
    const cfgScale = normalizeNumber(input.advanced?.cfgScale, spec.constraints.cfgScale, spec.defaults.cfgScale);
    return {
      prompt: input.prompt,
      duration: Math.max(1, Math.round(durationSeconds)).toString(),
      aspect_ratio: input.ratio,
      negative_prompt: input.negativePrompt,
      cfg_scale: cfgScale,
      seed: input.seed,
    };
  },
  "fal:pika-v2-2": ({ input, spec }) => {
    const supportedRatios = spec.constraints.ratios;
    if (!supportedRatios.includes(input.ratio)) {
      throw new Error(
        `Pika v2.2 only supports ${supportedRatios.join(", ")}. Pick a supported ratio and try again.`,
      );
    }
    const resolution = resolveResolution(input, spec);
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds, spec);
    const guidance = normalizeNumber(input.advanced?.cfgScale, spec.constraints.cfgScale, spec.defaults.cfgScale);
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration_seconds: Math.max(1, Math.round(durationSeconds)),
      resolution,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      guidance_scale: guidance,
    };
  },
  "fal:luma-dream": ({ input, spec }) => {
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds, spec);
    const cfgScale = normalizeNumber(input.advanced?.cfgScale, spec.constraints.cfgScale, spec.defaults.cfgScale);
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration: secondsToDurationString(durationSeconds),
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: cfgScale,
    };
  },
  "fal:pixverse-v4-5": ({ input, spec }) => {
    const resolution = resolveResolution(input, spec);
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds, spec);
    const cfgScale = normalizeNumber(input.advanced?.cfgScale, spec.constraints.cfgScale, spec.defaults.cfgScale);
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration: Math.max(1, Math.round(durationSeconds)).toString(),
      resolution,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: cfgScale,
    };
  },
  "fal:cogvideox-5b": ({ input, spec }) => {
    const imageUrl = input.inputAssets?.initImageUrl;
    if (!imageUrl) {
      throw new Error("CogVideoX 5B requires an init image. Upload one before launching the job.");
    }
    const { width, height } = aspectRatioToSize(input.ratio);
    const steps = normalizeNumber(input.advanced?.steps, spec.constraints.steps, spec.defaults.steps ?? 30);
    const guidance = normalizeNumber(
      input.advanced?.cfgScale,
      spec.constraints.cfgScale,
      spec.defaults.cfgScale ?? 6,
    );
    const exportFps = normalizeNumber(input.advanced?.fps, spec.constraints.fps, spec.defaults.fps ?? 24);
    return {
      prompt: input.prompt,
      image_url: imageUrl,
      video_size: { width, height },
      num_inference_steps: steps,
      guidance_scale: guidance,
      export_fps: exportFps,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
    };
  },
};

function buildPayloadFromInput({ input, spec }: { input: StartJobInput; spec: ModelSpec }) {
  const builder = payloadBuilders[spec.id];
  if (builder) {
    return builder({ input, spec });
  }

  // Fallback: basic mapping
  const normalizedDuration = normalizeDurationSeconds(input.durationSeconds, spec);
  return {
    prompt: input.prompt,
    aspect_ratio: input.ratio,
    duration: secondsToDurationString(normalizedDuration),
    with_audio: input.withAudio,
    seed: input.seed,
  };
}

function resolveQueueRoot(spec?: ModelSpec): string | undefined {
  if (!spec) return undefined;
  if (spec.falQueueRoot) {
    return spec.falQueueRoot;
  }
  const segments = spec.falSlug.split("/").filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[0]}/${segments[1]}`;
  }
  return spec.falSlug;
}

let jwksCache: JsonWebKey[] = [];
let jwksFetchedAt = 0;
const JWKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchFalJwks(): Promise<JsonWebKey[]> {
  const now = Date.now();
  if (!jwksCache.length || now - jwksFetchedAt > JWKS_CACHE_TTL_MS) {
    const response = await fetch(FAL_JWKS_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch Fal JWKS (${response.status})`);
    }
    const json = (await response.json()) as { keys?: JsonWebKey[] };
    jwksCache = json.keys ?? [];
    jwksFetchedAt = now;
  }
  return jwksCache;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "===".slice((normalized.length % 4) || 4);
  return Uint8Array.from(Buffer.from(normalized + padding, "base64"));
}

function getHeader(headers: Headers | Record<string, string>, key: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }
  const lowerKey = key.toLowerCase();
  for (const [headerKey, value] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === lowerKey) {
      return value;
    }
  }
  return undefined;
}

export async function verifyFalWebhook(
  headers: Headers | Record<string, string>,
  body: Buffer,
): Promise<boolean> {
  await sodium.ready;

  const requestId = getHeader(headers, "x-fal-webhook-request-id");
  const userId = getHeader(headers, "x-fal-webhook-user-id");
  const timestamp = getHeader(headers, "x-fal-webhook-timestamp");
  const signatureHex = getHeader(headers, "x-fal-webhook-signature");

  if (!requestId || !userId || !timestamp || !signatureHex) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const skewSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (skewSeconds > 300) {
    return false;
  }

  const digest = createHash("sha256").update(body).digest("hex");
  const message = Buffer.from(`${requestId}\n${userId}\n${timestamp}\n${digest}`, "utf8");
  const signature = Buffer.from(signatureHex, "hex");

  const keys = await fetchFalJwks();

  for (const key of keys) {
    if (key.kty !== "OKP" || key.crv !== "Ed25519" || !key.x) {
      continue;
    }
    try {
      const publicKey = decodeBase64Url(key.x);
      const ok = sodium.crypto_sign_verify_detached(signature, message, publicKey);
      if (ok) {
        return true;
      }
    } catch {
      // Ignore and try next key.
    }
  }

  return false;
}

export const falProvider: ProviderAdapter = {
  async startJob(input: StartJobInput): Promise<StartJobResult> {
    const spec = getModelSpecByEngine("fal", input.engine);
    if (!spec) {
      throw new Error(`Unknown FAL engine ${input.engine}`);
    }

    const payload = buildPayloadFromInput({ input, spec });
    const requestPayload: Record<string, unknown> = { ...payload };
    if (input.webhookUrl) {
      requestPayload.fal_webhook = input.webhookUrl;
    }

    // Submit via Queue API to get request_id immediately and align with queue status/result endpoints
    const response = await falFetch<FalStartResponse>(`/${spec.falSlug}`, {
      method: "POST",
      body: JSON.stringify(requestPayload),
      baseUrl: "https://queue.fal.run",
    });

    const requestId = response.request_id;
    const status = mapStatus(response.status);

    return {
      jobId: requestId,
      provider: "fal",
      status,
      estimatedSeconds: response.eta ?? input.durationSeconds,
      externalId: requestId,
    };
  },

  async pollJob(
    providerJobId: string,
    options?: { withLogs?: boolean; engine?: string },
  ): Promise<PollJobResult> {
    const includeLogs = options?.withLogs ?? shouldRequestFalLogs();
    const searchParams = includeLogs ? { logs: "1" } : undefined;
    const spec = options?.engine ? getModelSpecByEngine("fal", options.engine) : undefined;
    const queueRoot = resolveQueueRoot(spec);

    type EndpointCandidate = {
      base: string;
      path: string;
      searchParams?: Record<string, string | number | boolean | undefined>;
      description: string;
    };

    const candidates: EndpointCandidate[] = [];
    const addCandidate = (candidate: EndpointCandidate) => {
      const key = `${candidate.base}${candidate.path}`;
      if (!candidates.some((c) => `${c.base}${c.path}` === key)) {
        candidates.push(candidate);
      }
    };

    if (queueRoot) {
      if (includeLogs) {
        addCandidate({
          base: "https://queue.fal.run",
          path: `/${queueRoot}/requests/${providerJobId}/status`,
          searchParams: { logs: "1" },
          description: "queue status",
        });
      }
      addCandidate({
        base: "https://queue.fal.run",
        path: `/${queueRoot}/requests/${providerJobId}`,
        description: "queue result",
      });
    }

    const baseFallbacks = [FAL_API_BASE, "https://fal.run"];
    for (const base of baseFallbacks) {
      addCandidate({
        base,
        path: `/requests/${providerJobId}`,
        searchParams,
        description: `base ${base}`,
      });
    }

    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const response = await falFetch<FalPollResponse>(candidate.path, {
          method: "GET",
          searchParams: candidate.searchParams ?? searchParams,
          baseUrl: candidate.base,
        });
        const mapped = mapFalPollResponse(providerJobId, response, includeLogs);
        // If we hit the status endpoint first and it didn't include outputUrl yet,
        // fall through to the result endpoint before giving up.
        const isStatusCandidate = /status/i.test(candidate.description);
        if (isStatusCandidate && !mapped.outputUrl) {
          // try next candidate (likely the result endpoint)
          lastError = undefined;
          continue;
        }
        return mapped;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
        const causeCode =
          (cause && typeof cause === "object" && "code" in cause && typeof (cause as { code?: unknown }).code === "string"
            ? (cause as { code: string }).code
            : undefined) ||
          (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
            ? (error as { code: string }).code
            : undefined);

        const isDnsError = causeCode === "ENOTFOUND" || /ENOTFOUND/.test(message);
        const isMethodNotAllowed = /405|Method\s*Not\s*Allowed/i.test(message);
        const isUnauthorized = /401|Unauthorized/i.test(message);

        if (!/404|Not\s*Found/i.test(message) && !isDnsError && !isMethodNotAllowed && !isUnauthorized) {
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Unknown Fal poll error"));
  },
};
