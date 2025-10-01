export type ModelId =
  | "fal:veo3"
  | "fal:veo3-fast"
  | "fal:kling-pro"
  | "fal:pika-v2-2"
  | "fal:luma-dream"
  | "fal:pixverse-v4-5"
  | "fal:cogvideox-5b"
  | "kiwi:sandbox";

export type ContentType = "video" | "image";

export interface RangeOption {
  min: number;
  max: number;
  step?: number;
  default?: number;
}

export interface ModelSpec {
  id: ModelId;
  label: string;
  description: string;
  provider: "fal" | "kiwi";
  falSlug?: string;
  falQueueRoot?: string;
  contentType: ContentType;
  supports: {
    imageInit: boolean;
    imageReference: boolean;
    mask: boolean;
    refVideo: boolean;
    audio: boolean;
    seed: boolean;
    negativePrompt: boolean;
    multiPrompt: boolean;
    frameInterpolation: boolean;
    upscaling: boolean;
    watermarkToggle: boolean;
  };
  constraints: {
    ratios: Array<"9:16" | "16:9" | "1:1" | "21:9">;
    durationSeconds?: RangeOption;
    fps?: RangeOption;
    resolution: string;
    cfgScale?: RangeOption;
    steps?: RangeOption;
  };
  defaults: {
    durationSeconds?: number;
    fps?: number;
    cfgScale?: number;
    steps?: number;
    withAudio?: boolean;
    resolution?: string;
  };
  resolutions?: string[];
}

export const models: Record<ModelId, ModelSpec> = {
  "fal:veo3": {
    id: "fal:veo3",
    label: "Veo 3 (texte → vidéo)",
    description: "Pipeline Veo 3 orchestré via FAL pour des rendus cinématiques.",
    provider: "fal",
    falSlug: "fal-ai/veo3",
    falQueueRoot: "fal-ai/veo3",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: true,
      mask: false,
      refVideo: false,
      audio: true,
      seed: true,
      negativePrompt: true,
      multiPrompt: true,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 4, max: 12, step: 2, default: 8 },
      fps: { min: 24, max: 30, default: 24 },
      resolution: "720p ou 1080p",
      cfgScale: { min: 1, max: 18, step: 0.5, default: 9 },
    },
    defaults: {
      durationSeconds: 8,
      fps: 24,
      cfgScale: 9,
      withAudio: true,
      resolution: "720p",
    },
    resolutions: ["720p", "1080p"],
  },
  "fal:veo3-fast": {
    id: "fal:veo3-fast",
    label: "Veo 3 Fast (image → vidéo)",
    description: "Version rapide de Veo 3 pour animer des images sources.",
    provider: "fal",
    falSlug: "fal-ai/veo3/fast/image-to-video",
    falQueueRoot: "fal-ai/veo3",
    contentType: "video",
    supports: {
      imageInit: true,
      imageReference: true,
      mask: false,
      refVideo: false,
      audio: true,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: false,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 4, max: 8, step: 2, default: 6 },
      fps: { min: 24, max: 30, default: 24 },
      resolution: "Jusqu'à 720p",
      cfgScale: { min: 1, max: 12, step: 0.5, default: 8 },
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      cfgScale: 8,
      withAudio: true,
      resolution: "720p",
    },
    resolutions: ["720p"],
  },
  "fal:kling-pro": {
    id: "fal:kling-pro",
    label: "Kling 2.5 Turbo Pro",
    description: "Modèle Tencent Kling v2.5 Turbo Pro via FAL.",
    provider: "fal",
    falSlug: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    falQueueRoot: "fal-ai/kling-video",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: true,
      mask: false,
      refVideo: false,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 5, max: 10, step: 5, default: 5 },
      fps: { min: 24, max: 24, default: 24 },
      resolution: "720p ou 1080p",
      cfgScale: { min: 1, max: 14, step: 0.5, default: 7 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 7,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["720p", "1080p"],
  },
  "fal:pika-v2-2": {
    id: "fal:pika-v2-2",
    label: "Pika v2.2",
    description: "Pika 2.2 text-to-video pour rendus sociaux.",
    provider: "fal",
    falSlug: "fal-ai/pika/v2.2/text-to-video",
    falQueueRoot: "fal-ai/pika",
    contentType: "video",
    supports: {
      imageInit: true,
      imageReference: true,
      mask: false,
      refVideo: false,
      audio: true,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: false,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 3, max: 8, step: 1, default: 5 },
      fps: { min: 24, max: 30, default: 24 },
      resolution: "720p ou 1080p",
      cfgScale: { min: 0, max: 1, step: 0.05, default: 0.6 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 0.6,
      withAudio: true,
      resolution: "720p",
    },
    resolutions: ["720p", "1080p"],
  },
  "fal:luma-dream": {
    id: "fal:luma-dream",
    label: "Luma Dream Machine",
    description: "Dream Machine via FAL pour scènes oniriques.",
    provider: "fal",
    falSlug: "fal-ai/luma-dream-machine",
    falQueueRoot: "fal-ai/luma-dream-machine",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: true,
      mask: false,
      refVideo: false,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["21:9", "16:9", "9:16"],
      durationSeconds: { min: 4, max: 10, step: 2, default: 6 },
      fps: { min: 24, max: 24, default: 24 },
      resolution: "720p",
      cfgScale: { min: 1, max: 12, step: 0.5, default: 7 },
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      cfgScale: 7,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["720p"],
  },
  "fal:pixverse-v4-5": {
    id: "fal:pixverse-v4-5",
    label: "Pixverse v4.5",
    description: "Pixverse v4.5 text-to-video multi-styles.",
    provider: "fal",
    falSlug: "fal-ai/pixverse/v4.5/text-to-video",
    falQueueRoot: "fal-ai/pixverse",
    contentType: "video",
    supports: {
      imageInit: true,
      imageReference: true,
      mask: false,
      refVideo: false,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 5, max: 8, step: 3, default: 5 },
      fps: { min: 24, max: 30, default: 24 },
      resolution: "360p à 1080p",
      cfgScale: { min: 1, max: 12, step: 0.5, default: 7 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 7,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["360p", "720p", "1080p"],
  },
  "fal:cogvideox-5b": {
    id: "fal:cogvideox-5b",
    label: "CogVideoX 5B",
    description: "CogVideoX 5B image-to-video via FAL.",
    provider: "fal",
    falSlug: "fal-ai/cogvideox-5b/image-to-video",
    falQueueRoot: "fal-ai/cogvideox-5b",
    contentType: "video",
    supports: {
      imageInit: true,
      imageReference: true,
      mask: false,
      refVideo: false,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 4, max: 12, step: 2, default: 6 },
      fps: { min: 12, max: 24, default: 24 },
      resolution: "Jusqu'à 720p",
      cfgScale: { min: 1, max: 10, step: 0.5, default: 6 },
      steps: { min: 10, max: 50, step: 5, default: 30 },
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      cfgScale: 6,
      steps: 30,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["480p", "720p"],
  },
  "kiwi:sandbox": {
    id: "kiwi:sandbox",
    label: "Kiwi Sandbox",
    description: "Modeleur interne pour tests rapides sans appel provider externe.",
    provider: "kiwi",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: false,
      mask: false,
      refVideo: false,
      audio: true,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: false,
      watermarkToggle: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 3, max: 12, step: 1, default: 6 },
      fps: { min: 24, max: 30, default: 24 },
      resolution: "Mock 720p",
      cfgScale: { min: 0, max: 10, step: 1, default: 5 },
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      cfgScale: 5,
      withAudio: true,
      resolution: "720p",
    },
    resolutions: ["720p"],
  },
};

export function getModelSpec(provider: "fal" | "kiwi", engine: string): ModelSpec | undefined {
  if (provider === "fal") {
    switch (engine) {
      case "veo3":
        return models["fal:veo3"];
      case "veo3-fast":
        return models["fal:veo3-fast"];
      case "kling-pro":
        return models["fal:kling-pro"];
      case "pika-v2-2":
        return models["fal:pika-v2-2"];
      case "luma-dream":
        return models["fal:luma-dream"];
      case "pixverse-v4-5":
        return models["fal:pixverse-v4-5"];
      case "cogvideox-5b":
        return models["fal:cogvideox-5b"];
      default:
        return undefined;
    }
  }

  if (provider === "kiwi") {
    switch (engine) {
      case "kiwi-sandbox":
        return models["kiwi:sandbox"];
      default:
        return undefined;
    }
  }

  return undefined;
}

export function formatModelSummary(spec: ModelSpec): string {
  const features = [
    spec.supports.imageInit ? "Image init" : null,
    spec.supports.mask ? "Mask" : null,
    spec.supports.refVideo ? "Reference video" : null,
    spec.supports.audio ? "Audio" : null,
    spec.supports.seed ? "Seed" : null,
  ].filter(Boolean);

  const ratioLabel = `Ratios ${spec.constraints.ratios.join(", ")}`;
  const durationLabel = spec.constraints.durationSeconds
    ? `${spec.constraints.durationSeconds.min}-${spec.constraints.durationSeconds.max}s`
    : spec.constraints.resolution;

  return `${spec.label} • ${ratioLabel} • ${durationLabel} • ${features.join(" · ")}`;
}

export const ENGINE_LABELS: Record<string, string> = {
  "veo3": "Veo 3 (texte → vidéo)",
  "veo3-fast": "Veo 3 Fast (image → vidéo)",
  "kling-pro": "Kling 2.5 Turbo Pro",
  "pika-v2-2": "Pika v2.2",
  "luma-dream": "Luma Dream Machine",
  "pixverse-v4-5": "Pixverse v4.5",
  "cogvideox-5b": "CogVideoX 5B",
  "kiwi-sandbox": "Kiwi Sandbox",
};

export const FAL_INIT_IMAGE_REQUIRED_ENGINES: ReadonlySet<ModelId> = new Set([
  "fal:veo3-fast",
  "fal:cogvideox-5b",
]);

export const FAL_REF_VIDEO_REQUIRED_ENGINES: ReadonlySet<ModelId> = new Set();
