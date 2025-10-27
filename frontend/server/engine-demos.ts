export type EngineDemo = {
  videoUrl: string | null;
  posterUrl: string | null;
  hasAudio: boolean;
};

const STATIC_ENGINE_DEMOS: Record<string, EngineDemo> = {
  'sora-2': {
    videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/sora_t2v_output.mp4',
    posterUrl: '/hero/sora2.jpg',
    hasAudio: true,
  },
  'sora-2-pro': {
    videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/sora_2_i2v_output.mp4',
    posterUrl: '/hero/sora2.jpg',
    hasAudio: true,
  },
  'veo-3-1': {
    videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4',
    posterUrl: '/hero/veo3.jpg',
    hasAudio: true,
  },
  'veo-3-fast': {
    videoUrl: 'https://v3.fal.media/files/lion/L9nkXSW1MCj2oDimeJ4w5_output.mp4',
    posterUrl: '/hero/veo3.jpg',
    hasAudio: false,
  },
  'pika-text-to-video': {
    videoUrl: 'https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4',
    posterUrl: '/hero/pika-22.jpg',
    hasAudio: false,
  },
  'minimax-hailuo-02-image': {
    videoUrl: 'https://fal.media/files/monkey/bkT4T4uLOXr0jDsIMlNd5_output.mp4',
    posterUrl: '/hero/minimax-video01.jpg',
    hasAudio: false,
  },
};

export async function getExampleDemoForEngine(engineId: string): Promise<EngineDemo | null> {
  return STATIC_ENGINE_DEMOS[engineId] ?? null;
}

export async function getExampleDemos(): Promise<Map<string, EngineDemo>> {
  return new Map(Object.entries(STATIC_ENGINE_DEMOS));
}
