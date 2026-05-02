export type EngineDemo = {
  videoUrl: string | null;
  posterUrl: string | null;
  hasAudio: boolean;
};

const STATIC_ENGINE_DEMOS: Record<string, EngineDemo> = {
  'sora-2': {
    videoUrl: 'https://media.maxvideoai.com/renders/marketing/15d61929-c1ef-4173-bb8c-75cb74b3ee19.mp4',
    posterUrl:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
    hasAudio: true,
  },
  'sora-2-pro': {
    videoUrl: 'https://media.maxvideoai.com/renders/marketing/15d61929-c1ef-4173-bb8c-75cb74b3ee19.mp4',
    posterUrl:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
    hasAudio: true,
  },
  'veo-3-1': {
    videoUrl: 'https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4',
    posterUrl: '/hero/veo-3-1-hero.jpg',
    hasAudio: true,
  },
  'veo-3-1-lite': {
    videoUrl: 'https://media.maxvideoai.com/renders/marketing/658ecb2b-d9ea-467e-93d4-67f445ca25fc.mp4',
    posterUrl:
      'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/0a6e2df3-0107-4ea7-8f70-6e03e406f39b.jpg',
    hasAudio: true,
  },
  'pika-text-to-video': {
    videoUrl: 'https://media.maxvideoai.com/renders/marketing/5e0ea541-cd07-48e9-841d-42b5679e1f3f.mp4',
    posterUrl: '/hero/pika-22.jpg',
    hasAudio: false,
  },
  'minimax-hailuo-02-text': {
    videoUrl: '/hero/minimax-video01.mp4',
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
