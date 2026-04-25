export type EngineDemo = {
  videoUrl: string | null;
  posterUrl: string | null;
  hasAudio: boolean;
};

const STATIC_ENGINE_DEMOS: Record<string, EngineDemo> = {
  'sora-2': {
    videoUrl: 'https://v3b.fal.media/files/b/elephant/ch7vRQJfqfY__OPr6sl6Z_output.mp4',
    posterUrl:
      'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
    hasAudio: true,
  },
  'sora-2-pro': {
    videoUrl: 'https://v3b.fal.media/files/b/elephant/ch7vRQJfqfY__OPr6sl6Z_output.mp4',
    posterUrl:
      'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
    hasAudio: true,
  },
  'veo-3-1': {
    videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4',
    posterUrl: '/hero/veo-3-1-hero.jpg',
    hasAudio: true,
  },
  'veo-3-1-lite': {
    videoUrl: 'https://v3b.fal.media/files/b/0a949299/CRknSuYHK6oMgLxp9a1RD_87571c2de4194c71a1a495b45f875914.mp4',
    posterUrl:
      'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/0a6e2df3-0107-4ea7-8f70-6e03e406f39b.jpg',
    hasAudio: true,
  },
  'pika-text-to-video': {
    videoUrl: 'https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4',
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
