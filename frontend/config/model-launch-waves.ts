export type ModelLaunchWave = {
  id: 'p0' | 'p1';
  sourceManifest: string;
  models: readonly {
    modelId: string;
    familyId: string;
    requiredVideos: 2;
  }[];
};

// This is the authored launch-readiness ownership. Generated projections must
// derive their wave, target, family, and required video count from this file.
export const MODEL_LAUNCH_WAVES = [
  {
    id: 'p0',
    sourceManifest: 'docs/model-launch/p0-video-example-pack.json',
    models: [
      { modelId: 'wan-3', familyId: 'wan', requiredVideos: 2 },
      { modelId: 'wan-3-prime', familyId: 'wan', requiredVideos: 2 },
      { modelId: 'ltx-2-5-fast', familyId: 'ltx', requiredVideos: 2 },
      { modelId: 'ltx-2-5-pro', familyId: 'ltx', requiredVideos: 2 },
      { modelId: 'grok-imagine-video-1-5', familyId: 'grok', requiredVideos: 2 },
      { modelId: 'flux-3', familyId: 'flux', requiredVideos: 2 },
      { modelId: 'flux-3-draft', familyId: 'flux', requiredVideos: 2 },
    ],
  },
  {
    id: 'p1',
    sourceManifest: 'docs/model-launch/p1-video-example-pack.json',
    models: [
      { modelId: 'gemini-omni-flash', familyId: 'veo', requiredVideos: 2 },
      { modelId: 'kling-3-turbo-standard', familyId: 'kling', requiredVideos: 2 },
      { modelId: 'kling-3-turbo-pro', familyId: 'kling', requiredVideos: 2 },
      { modelId: 'minimax-h3-max', familyId: 'hailuo', requiredVideos: 2 },
    ],
  },
] as const satisfies readonly ModelLaunchWave[];

export type ModelLaunchWaveId = (typeof MODEL_LAUNCH_WAVES)[number]['id'];
