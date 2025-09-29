import type {
  JobStatus,
  PollJobResult,
  ProviderAdapter,
  StartJobInput,
  StartJobResult,
} from "@/providers/types";
import { getModelSpecByEngine } from "@/data/models";
import type { ModelSpec } from "@/data/models";

const FAL_API_KEY = process.env.FAL_API_KEY;
const FAL_API_BASE = process.env.FAL_API_BASE ?? "https://fal.run";
const FAL_TIMEOUT_MS = Number(process.env.FAL_TIMEOUT_MS ?? 60000);

if (!FAL_API_KEY) {
  console.warn("[fal] FAL_API_KEY is not set. Provider will fail when invoked.");
}

interface FalStartResponse {
  request_id: string;
  status: string;
  eta?: number;
}

interface FalPollResponse {
  request_id: string;
  status: string;
  error?: { message?: string } | string;
  logs?: Array<{ message: string }>;
  response?: {
    output?: unknown;
    videos?: Array<{ url: string; thumbnail?: string; duration?: number }>;
    video_url?: string;
    thumbnails?: string[];
    duration?: number;
    cost_cents?: number;
  };
  usage?: { total_cost_cents?: number };
}

async function falFetch<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAL_TIMEOUT_MS);
  try {
    const response = await fetch(`${FAL_API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${FAL_API_KEY}`,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

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

function mapStatus(status: string): JobStatus {
  const normalized = status.toLowerCase();
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("success") || normalized.includes("complete")) return "completed";
  if (normalized.includes("process") || normalized.includes("running")) return "running";
  return "pending";
}

function pickVideoUrls(response?: FalPollResponse["response"]): {
  outputUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
} {
  if (!response) return {};

  if (response.videos?.length) {
    const primary = response.videos[0];
    return {
      outputUrl: primary.url,
      thumbnailUrl: primary.thumbnail ?? response.thumbnails?.[0],
      durationSeconds: primary.duration ?? response.duration,
    };
  }

  return {
    outputUrl: (response.output as { url?: string })?.url ?? response.video_url,
    thumbnailUrl: response.thumbnails?.[0],
    durationSeconds: response.duration,
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
    const duration = secondsToDurationString(input.durationSeconds);
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration,
      resolution,
      generate_audio: input.withAudio,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: input.advanced?.cfgScale ?? spec.defaults.cfgScale,
    };
  },
  "fal:veo3-fast": ({ input, spec }) => {
    const imageUrl = input.inputAssets?.initImageUrl;
    if (!imageUrl) {
      throw new Error("Veo 3 Fast requires an init image. Upload one before launching the job.");
    }
    const resolution = resolveResolution(input, spec);
    const duration = secondsToDurationString(input.durationSeconds);
    return {
      prompt: input.prompt,
      image_url: imageUrl,
      aspect_ratio: input.ratio,
      duration,
      resolution,
      generate_audio: input.withAudio,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: input.advanced?.cfgScale ?? spec.defaults.cfgScale,
    };
  },
  "fal:kling-pro": ({ input, spec }) => {
    return {
      prompt: input.prompt,
      duration: Math.max(1, Math.round(input.durationSeconds)).toString(),
      aspect_ratio: input.ratio,
      negative_prompt: input.negativePrompt,
      cfg_scale: input.advanced?.cfgScale ?? spec.defaults.cfgScale,
      seed: input.seed,
    };
  },
  "fal:pika-v2-2": ({ input, spec }) => {
    const resolution = resolveResolution(input, spec);
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration: Math.max(1, Math.round(input.durationSeconds)),
      resolution,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      guidance_scale: input.advanced?.cfgScale ?? spec.defaults.cfgScale,
    };
  },
  "fal:luma-dream": ({ input, spec }) => {
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration: secondsToDurationString(input.durationSeconds),
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: input.advanced?.cfgScale ?? spec.defaults.cfgScale,
    };
  },
  "fal:pixverse-v4-5": ({ input, spec }) => {
    const resolution = resolveResolution(input, spec);
    return {
      prompt: input.prompt,
      aspect_ratio: input.ratio,
      duration: Math.max(1, Math.round(input.durationSeconds)).toString(),
      resolution,
      negative_prompt: input.negativePrompt,
      seed: input.seed,
      cfg_scale: input.advanced?.cfgScale ?? spec.defaults.cfgScale,
    };
  },
  "fal:cogvideox-5b": ({ input, spec }) => {
    const imageUrl = input.inputAssets?.initImageUrl;
    if (!imageUrl) {
      throw new Error("CogVideoX 5B requires an init image. Upload one before launching the job.");
    }
    const { width, height } = aspectRatioToSize(input.ratio);
    const steps = input.advanced?.steps ?? spec.defaults.steps ?? 30;
    const guidance = input.advanced?.cfgScale ?? spec.defaults.cfgScale ?? 6;
    const exportFps = input.advanced?.fps ?? spec.defaults.fps ?? 24;
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
  return {
    prompt: input.prompt,
    aspect_ratio: input.ratio,
    duration: secondsToDurationString(input.durationSeconds),
    with_audio: input.withAudio,
    seed: input.seed,
  };
}

export const falProvider: ProviderAdapter = {
  async startJob(input: StartJobInput): Promise<StartJobResult> {
    if (!FAL_API_KEY) {
      throw new Error("FAL_API_KEY is not configured");
    }

    const spec = getModelSpecByEngine("fal", input.engine);
    if (!spec) {
      throw new Error(`Unknown FAL engine ${input.engine}`);
    }

    const payload = buildPayloadFromInput({ input, spec });

    const response = await falFetch<FalStartResponse>(`/${spec.falSlug}`, {
      method: "POST",
      body: JSON.stringify(payload),
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

  async pollJob(providerJobId: string): Promise<PollJobResult> {
    if (!FAL_API_KEY) {
      throw new Error("FAL_API_KEY is not configured");
    }

    const response = await falFetch<FalPollResponse>(`/requests/${providerJobId}`, {
      method: "GET",
    });

    const status = mapStatus(response.status);
    const progress = status === "completed" ? 100 : status === "running" ? 60 : 15;
    const { outputUrl, thumbnailUrl, durationSeconds } = pickVideoUrls(response.response);
    const costActualCents =
      response.response?.cost_cents ?? response.usage?.total_cost_cents ?? undefined;

    let error: string | undefined;
    if (status === "failed") {
      error = typeof response.error === "string" ? response.error : response.error?.message;
    }

    return {
      jobId: providerJobId,
      provider: "fal",
      status,
      progress,
      outputUrl,
      thumbnailUrl,
      durationSeconds,
      costActualCents,
      error,
    };
  },
};
