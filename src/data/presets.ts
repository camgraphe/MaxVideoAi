import type { ModelId } from "./models";
import type { ProviderId } from "@/providers/types";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "21:9" | "4:5" | "5:4" | "3:2" | "2:3";

export interface PresetAdvancedDefaults {
  fps?: number;
  motionStrength?: number;
  cfgScale?: number;
  steps?: number;
  watermark?: boolean;
  upscaling?: boolean;
  resolution?: string;
  enhancePrompt?: boolean;
  autoFix?: boolean;
}

export interface GenerationPreset {
  id: string;
  name: string;
  description: string;
  modelId: ModelId;
  provider: Exclude<ProviderId, "veo">;
  engine: string;
  ratio: AspectRatio;
  durationSeconds: number;
  withAudio: boolean;
  seed?: number;
  negativePrompt?: string;
  styleTags?: string[];
  advancedDefaults?: PresetAdvancedDefaults;
}

export const generationPresets: GenerationPreset[] = [
  {
    id: "veo3-cinematic",
    name: "Veo 3 Cinematic",
    description: "16:9, 8 s, audio on – idéal pour des trailers immersifs.",
    modelId: "fal:veo3",
    provider: "fal",
    engine: "veo3",
    ratio: "16:9",
    durationSeconds: 8,
    withAudio: true,
    seed: 42,
    negativePrompt: "soft artifacts",
    styleTags: ["cinematic", "product"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 9,
      resolution: "1080p",
      enhancePrompt: true,
      autoFix: true,
    },
  },
  {
    id: "veo3-vertical-hook",
    name: "Veo 3 Hook",
    description: "9:16, 6 s, audio on – parfait pour les hooks verticaux.",
    modelId: "fal:veo3",
    provider: "fal",
    engine: "veo3",
    ratio: "9:16",
    durationSeconds: 6,
    withAudio: true,
    seed: 84,
    negativePrompt: "grain, compression",
    styleTags: ["social", "hook"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 8.5,
      resolution: "720p",
      enhancePrompt: true,
      autoFix: true,
    },
  },
  {
    id: "veo3-fast-animate",
    name: "Veo 3 Fast Animate",
    description: "Image → vidéo 6 s, audio on – anime un visuel en un clin d’œil.",
    modelId: "fal:veo3-fast",
    provider: "fal",
    engine: "veo3-fast",
    ratio: "16:9",
    durationSeconds: 6,
    withAudio: true,
    negativePrompt: "distortions",
    styleTags: ["image-to-video", "fast"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 8,
      resolution: "720p",
      enhancePrompt: true,
      autoFix: true,
    },
  },
  {
    id: "kling-pro-trailer",
    name: "Kling Pro Trailer",
    description: "16:9, 5 s, audio off – motion control haute précision.",
    modelId: "fal:kling-pro",
    provider: "fal",
    engine: "kling-pro",
    ratio: "16:9",
    durationSeconds: 5,
    withAudio: false,
    seed: 101,
    negativePrompt: "blur, low detail",
    styleTags: ["trailer", "high-energy"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 0.5,
      resolution: "720p",
    },
  },
  {
    id: "pika-social-loop",
    name: "Pika Social Loop",
    description: "1:1, 5 s, audio off – boucle stylisée pour réseaux sociaux.",
    modelId: "fal:pika-v2-2",
    provider: "fal",
    engine: "pika-v2-2",
    ratio: "1:1",
    durationSeconds: 5,
    withAudio: false,
    seed: 128,
    negativePrompt: "jpeg artifacts",
    styleTags: ["loop", "illustration"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 0.6,
      resolution: "720p",
    },
  },
  {
    id: "luma-dream-reel",
    name: "Luma Dream Reel",
    description: "21:9, 6 s, audio off – rendu rêveur ultra wide.",
    modelId: "fal:luma-dream",
    provider: "fal",
    engine: "luma-dream",
    ratio: "21:9",
    durationSeconds: 6,
    withAudio: false,
    seed: 256,
    negativePrompt: "harsh shadows",
    styleTags: ["dream", "wide"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 7,
      resolution: "720p",
    },
  },
  {
    id: "pixverse-reel",
    name: "Pixverse Reel",
    description: "9:16, 5 s, audio off – animation stylisée Pixverse pour reels.",
    modelId: "fal:pixverse-v4-5",
    provider: "fal",
    engine: "pixverse-v4-5",
    ratio: "9:16",
    durationSeconds: 5,
    withAudio: false,
    seed: 64,
    styleTags: ["reel", "stylised"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 7,
      resolution: "720p",
    },
  },
  {
    id: "cogvideox-storyboard",
    name: "CogVideoX Storyboard",
    description: "Image → vidéo 6 s, audio off – variations storyboard rapides.",
    modelId: "fal:cogvideox-5b",
    provider: "fal",
    engine: "cogvideox-5b",
    ratio: "16:9",
    durationSeconds: 6,
    withAudio: false,
    seed: 512,
    negativePrompt: "artifact",
    styleTags: ["storyboard", "image-to-video"],
    advancedDefaults: {
      fps: 24,
      cfgScale: 6,
      steps: 30,
      resolution: "720p",
    },
  },
  {
    id: "wan25-image-to-video",
    name: "Wan 2.5 Motion",
    description: "Image → vidéo 5 s, prompt expansion activée.",
    modelId: "fal:wan-2-2-i2v-turbo",
    provider: "fal",
    engine: "wan-2-2-i2v-turbo",
    ratio: "16:9",
    durationSeconds: 5,
    withAudio: false,
    negativePrompt: "low quality",
    styleTags: ["image-to-video", "wan"],
    advancedDefaults: {
      cfgScale: 5,
      resolution: "720p",
      enhancePrompt: true,
    },
  },
];
