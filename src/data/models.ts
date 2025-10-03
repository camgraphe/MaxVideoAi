export type ModelId =
  | "fal:veo3"
  | "fal:veo3-fast"
  | "fal:kling-pro"
  | "fal:kling-pro-t2v"
  | "fal:pika-v2-2"
  | "fal:pika-v2-2-i2v"
  | "fal:luma-dream"
  | "fal:luma-ray2-reframe"
  | "fal:pixverse-v4-5"
  | "fal:cogvideox-5b"
  | "fal:wan-25-preview"
  | "fal:wan-2-1-t2v"
  | "fal:wan-2-2-v2v"
  | "fal:wan-2-2-i2v-turbo"
  | "fal:hunyuan-video"
  | "fal:hailuo-02-standard"
  | "fal:hailuo-02-pro"
  | "fal:seedvr2-upscale"
  | "fal:topaz-upscale";

export type ContentType = "video" | "image";

export interface RangeOption {
  min: number;
  max: number;
  step?: number;
  default?: number;
}

type AspectRatio =
  | "9:16"
  | "16:9"
  | "1:1"
  | "21:9"
  | "9:21"
  | "4:5"
  | "5:4"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4";

export interface ModelSpec {
  id: ModelId;
  label: string;
  description: string;
  provider: "fal";
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
    promptEnhancement: boolean;
    autoFix: boolean;
    audioTrack: boolean;
  };
  constraints: {
    ratios: Array<AspectRatio>;
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
    enhancePrompt?: boolean;
    autoFix?: boolean;
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
      promptEnhancement: true,
      autoFix: true,
      audioTrack: false,
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
      enhancePrompt: true,
      autoFix: true,
    },
    resolutions: ["720p", "1080p"],
  },
  "fal:luma-ray2-reframe": {
    id: "fal:luma-ray2-reframe",
    label: "Luma Ray-2 Reframe",
    description: "Reframe vidéo ↔ vidéo Ray-2 avec suivi du sujet.",
    provider: "fal",
    falSlug: "fal-ai/luma-dream-machine/ray-2/reframe",
    falQueueRoot: "fal-ai/luma-dream-machine",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: false,
      mask: false,
      refVideo: true,
      audio: false,
      seed: false,
      negativePrompt: false,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"],
      fps: { min: 24, max: 24, default: 24 },
      resolution: "Sortie calée sur la source",
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      withAudio: false,
      resolution: "source",
    },
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
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: false,
      watermarkToggle: false,
      promptEnhancement: true,
      autoFix: true,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 4, max: 8, step: 2, default: 6 },
      fps: { min: 24, max: 30, default: 24 },
      resolution: "720p ou 1080p",
      cfgScale: { min: 1, max: 12, step: 0.5, default: 8 },
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      cfgScale: 8,
      withAudio: false,
      resolution: "720p",
      enhancePrompt: true,
      autoFix: true,
    },
    resolutions: ["720p", "1080p"],
  },
  "fal:kling-pro": {
    id: "fal:kling-pro",
    label: "Kling 2.5 Turbo Pro",
    description: "Image-to-video Kling 2.5 Turbo Pro via FAL.",
    provider: "fal",
    falSlug: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    falQueueRoot: "fal-ai/kling-video",
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
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9"],
      durationSeconds: { min: 5, max: 10, step: 5, default: 5 },
      fps: { min: 24, max: 24, default: 24 },
      resolution: "480p, 720p ou 1080p",
      cfgScale: { min: 0, max: 1, step: 0.05, default: 0.5 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 0.5,
      withAudio: false,
      resolution: "1080p",
    },
    resolutions: ["480p", "720p", "1080p"],
  },
  "fal:kling-pro-t2v": {
    id: "fal:kling-pro-t2v",
    label: "Kling 2.5 Turbo Pro (texte → vidéo)",
    description: "Pipeline texte → vidéo de Kling 2.5 Turbo Pro pour drafts rapides.",
    provider: "fal",
    falSlug: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    falQueueRoot: "fal-ai/kling-video",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: false,
      mask: false,
      refVideo: false,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 5, max: 10, step: 1, default: 5 },
      fps: { min: 24, max: 24, default: 24 },
      resolution: "720p",
      cfgScale: { min: 0, max: 1, step: 0.05, default: 0.5 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 0.5,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["720p"],
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
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1", "4:5", "5:4", "3:2", "2:3"],
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
  "fal:pika-v2-2-i2v": {
    id: "fal:pika-v2-2-i2v",
    label: "Pika v2.2 (image → vidéo)",
    description: "Pika 2.2 image-to-video pour boucles stylisées.",
    provider: "fal",
    falSlug: "fal-ai/pika/v2.2/image-to-video",
    falQueueRoot: "fal-ai/pika",
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
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1", "4:5", "5:4", "3:2", "2:3"],
      durationSeconds: { min: 3, max: 10, step: 1, default: 5 },
      fps: { min: 24, max: 30, default: 24 },
      resolution: "720p ou 1080p",
      cfgScale: { min: 0, max: 1, step: 0.1, default: 0.5 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 0.5,
      withAudio: false,
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
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
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
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
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
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
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
  "fal:wan-2-1-t2v": {
    id: "fal:wan-2-1-t2v",
    label: "WAN 2.1 (texte → vidéo)",
    description: "WAN 2.1 text-to-video pour drafts à grand volume.",
    provider: "fal",
    falSlug: "fal-ai/wan-t2v",
    falQueueRoot: "fal-ai/wan-t2v",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: false,
      mask: false,
      refVideo: false,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 5, max: 8, step: 1, default: 5 },
      fps: { min: 12, max: 24, default: 16 },
      resolution: "480p, 580p ou 720p",
    },
    defaults: {
      durationSeconds: 5,
      fps: 16,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["480p", "580p", "720p"],
  },
  "fal:wan-2-2-v2v": {
    id: "fal:wan-2-2-v2v",
    label: "WAN 2.2 A14B (vidéo → vidéo)",
    description: "WAN 2.2 A14B pour styliser une séquence existante.",
    provider: "fal",
    falSlug: "fal-ai/wan/v2.2-a14b/video-to-video",
    falQueueRoot: "fal-ai/wan/v2.2-a14b",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: true,
      mask: false,
      refVideo: true,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 6, max: 10, step: 1, default: 6 },
      fps: { min: 12, max: 24, default: 16 },
      resolution: "480p, 580p ou 720p",
    },
    defaults: {
      durationSeconds: 6,
      fps: 16,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["480p", "580p", "720p"],
  },
  "fal:wan-2-2-i2v-turbo": {
    id: "fal:wan-2-2-i2v-turbo",
    label: "WAN 2.2 A14B Turbo (image → vidéo)",
    description: "WAN 2.2 Turbo pour animer une image avec cadence accélérée.",
    provider: "fal",
    falSlug: "fal-ai/wan/v2.2-a14b/image-to-video/turbo",
    falQueueRoot: "fal-ai/wan/v2.2-a14b",
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
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 6, max: 10, step: 1, default: 6 },
      fps: { min: 12, max: 24, default: 16 },
      resolution: "480p, 580p ou 720p",
    },
    defaults: {
      durationSeconds: 6,
      fps: 16,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["480p", "580p", "720p"],
  },
  "fal:wan-25-preview": {
    id: "fal:wan-25-preview",
    label: "Wan 2.5 Image to Video",
    description: "Wan 2.5 image-to-video model.",
    provider: "fal",
    falSlug: "fal-ai/wan-25-preview/image-to-video",
    falQueueRoot: "fal-ai/wan-25-preview",
    contentType: "video",
    supports: {
      imageInit: true,
      imageReference: false,
      mask: false,
      refVideo: false,
      audio: false,
      seed: true,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: true,
      watermarkToggle: false,
      promptEnhancement: true,
      autoFix: false,
      audioTrack: true,
    },
    constraints: {
      ratios: ["16:9"],
      durationSeconds: { min: 5, max: 10, step: 5, default: 5 },
      fps: { min: 24, max: 24, default: 24 },
      resolution: "480p, 720p ou 1080p",
      cfgScale: { min: 1, max: 10, step: 1, default: 5 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 5,
      withAudio: false,
      resolution: "1080p",
      enhancePrompt: true,
    },
    resolutions: ["480p", "720p", "1080p"],
  },
  "fal:hunyuan-video": {
    id: "fal:hunyuan-video",
    label: "Hunyuan Video",
    description: "Hunyuan text-to-video model with 16:9 et 9:16 support.",
    provider: "fal",
    falSlug: "fal-ai/hunyuan-video",
    falQueueRoot: "fal-ai/hunyuan-video",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: false,
      mask: false,
      refVideo: false,
      audio: false,
      seed: false,
      negativePrompt: true,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: false,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 5, max: 8, step: 1, default: 5 },
      fps: { min: 16, max: 24, default: 16 },
      resolution: "480p, 580p ou 720p",
    },
    defaults: {
      durationSeconds: 5,
      fps: 16,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["480p", "580p", "720p"],
  },
  "fal:hailuo-02-standard": {
    id: "fal:hailuo-02-standard",
    label: "Hailuo-02 Standard (image → vidéo)",
    description: "MiniMax Hailuo-02 standard pour variations rapides.",
    provider: "fal",
    falSlug: "fal-ai/minimax/hailuo-02/standard/image-to-video",
    falQueueRoot: "fal-ai/minimax/hailuo-02",
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
      upscaling: false,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 4, max: 6, step: 1, default: 5 },
      fps: { min: 16, max: 24, default: 24 },
      resolution: "512p ou 768p",
      cfgScale: { min: 0, max: 10, step: 1, default: 5 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 5,
      withAudio: false,
      resolution: "768p",
    },
    resolutions: ["512p", "768p"],
  },
  "fal:hailuo-02-pro": {
    id: "fal:hailuo-02-pro",
    label: "Hailuo-02 Pro (image → vidéo)",
    description: "MiniMax Hailuo-02 Pro 720p pour rendus premium.",
    provider: "fal",
    falSlug: "fal-ai/minimax/hailuo-02/pro/image-to-video",
    falQueueRoot: "fal-ai/minimax/hailuo-02",
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
      upscaling: false,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16"],
      durationSeconds: { min: 4, max: 6, step: 1, default: 5 },
      fps: { min: 16, max: 24, default: 24 },
      resolution: "720p",
      cfgScale: { min: 0, max: 10, step: 1, default: 5 },
    },
    defaults: {
      durationSeconds: 5,
      fps: 24,
      cfgScale: 5,
      withAudio: false,
      resolution: "720p",
    },
    resolutions: ["720p"],
  },
  "fal:seedvr2-upscale": {
    id: "fal:seedvr2-upscale",
    label: "SeedVR2 Upscale",
    description: "Upscale vidéo SeedVR2 avec cohérence temporelle.",
    provider: "fal",
    falSlug: "fal-ai/seedvr/upscale/video",
    falQueueRoot: "fal-ai/seedvr",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: true,
      mask: false,
      refVideo: true,
      audio: false,
      seed: false,
      negativePrompt: false,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: false,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 1, max: 12, step: 1, default: 6 },
      fps: { min: 12, max: 30, default: 24 },
      resolution: "Sortie jusqu'à 4K selon la source",
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      withAudio: false,
      resolution: "source",
    },
  },
  "fal:topaz-upscale": {
    id: "fal:topaz-upscale",
    label: "Topaz Video Upscale",
    description: "Upscale vidéo Topaz optimisé pour détails fins.",
    provider: "fal",
    falSlug: "fal-ai/topaz/upscale/video",
    falQueueRoot: "fal-ai/topaz",
    contentType: "video",
    supports: {
      imageInit: false,
      imageReference: true,
      mask: false,
      refVideo: true,
      audio: false,
      seed: false,
      negativePrompt: false,
      multiPrompt: false,
      frameInterpolation: false,
      upscaling: false,
      watermarkToggle: false,
      promptEnhancement: false,
      autoFix: false,
      audioTrack: false,
    },
    constraints: {
      ratios: ["16:9", "9:16", "1:1"],
      durationSeconds: { min: 1, max: 12, step: 1, default: 6 },
      fps: { min: 12, max: 30, default: 24 },
      resolution: "Sortie jusqu'à 4K selon preset",
    },
    defaults: {
      durationSeconds: 6,
      fps: 24,
      withAudio: false,
      resolution: "source",
    },
  },
};

export function getModelSpec(provider: "fal", engine: string): ModelSpec | undefined {
  switch (engine) {
    case "veo3":
      return models["fal:veo3"];
    case "veo3-fast":
      return models["fal:veo3-fast"];
    case "kling-pro":
      return models["fal:kling-pro"];
    case "kling-pro-t2v":
      return models["fal:kling-pro-t2v"];
    case "pika-v2-2":
      return models["fal:pika-v2-2"];
    case "pika-v2-2-i2v":
      return models["fal:pika-v2-2-i2v"];
    case "luma-dream":
      return models["fal:luma-dream"];
    case "luma-ray2-reframe":
      return models["fal:luma-ray2-reframe"];
    case "pixverse-v4-5":
      return models["fal:pixverse-v4-5"];
    case "cogvideox-5b":
      return models["fal:cogvideox-5b"];
    case "wan-25-preview":
      return models["fal:wan-25-preview"];
    case "wan-2-1-t2v":
      return models["fal:wan-2-1-t2v"];
    case "wan-2-2-v2v":
      return models["fal:wan-2-2-v2v"];
    case "wan-2-2-i2v-turbo":
      return models["fal:wan-2-2-i2v-turbo"];
    case "hunyuan-video":
      return models["fal:hunyuan-video"];
    case "hailuo-02-standard":
      return models["fal:hailuo-02-standard"];
    case "hailuo-02-pro":
      return models["fal:hailuo-02-pro"];
    case "seedvr2-upscale":
      return models["fal:seedvr2-upscale"];
    case "topaz-upscale":
      return models["fal:topaz-upscale"];
    default:
      return undefined;
  }
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
  "kling-pro-t2v": "Kling 2.5 Turbo Pro (texte → vidéo)",
  "pika-v2-2": "Pika v2.2",
  "pika-v2-2-i2v": "Pika v2.2 (image → vidéo)",
  "luma-dream": "Luma Dream Machine",
  "luma-ray2-reframe": "Luma Ray-2 Reframe",
  "pixverse-v4-5": "Pixverse v4.5",
  "cogvideox-5b": "CogVideoX 5B",
  "wan-25-preview": "Wan 2.5 Image to Video",
  "wan-2-1-t2v": "WAN 2.1 (texte → vidéo)",
  "wan-2-2-v2v": "WAN 2.2 A14B (vidéo → vidéo)",
  "wan-2-2-i2v-turbo": "WAN 2.2 A14B Turbo (image → vidéo)",
  "hunyuan-video": "Hunyuan Video",
  "hailuo-02-standard": "Hailuo-02 Standard",
  "hailuo-02-pro": "Hailuo-02 Pro",
  "seedvr2-upscale": "SeedVR2 Upscale",
  "topaz-upscale": "Topaz Video Upscale",
};

export const FAL_INIT_IMAGE_REQUIRED_ENGINES: ReadonlySet<ModelId> = new Set([
  "fal:veo3-fast",
  "fal:kling-pro",
  "fal:pika-v2-2-i2v",
  "fal:cogvideox-5b",
  "fal:wan-25-preview",
  "fal:hailuo-02-standard",
  "fal:hailuo-02-pro",
  "fal:wan-2-2-i2v-turbo",
]);

export const FAL_REF_VIDEO_REQUIRED_ENGINES: ReadonlySet<ModelId> = new Set([
  "fal:luma-ray2-reframe",
  "fal:wan-2-2-v2v",
  "fal:seedvr2-upscale",
  "fal:topaz-upscale",
]);
