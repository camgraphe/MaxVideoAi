import type { VideoProviderKey } from '@/server/video-providers/types';

const refreshers = {
  alibaba_model_studio: async (jobId: string) => (await import('./alibaba-model-studio-poll')).runAlibabaModelStudioPoll({ jobId }),
  byteplus_modelark: async (jobId: string) => (await import('./byteplus-poll')).runBytePlusPoll({ jobId }),
  kling_direct: async (jobId: string) => (await import('./kling-direct-poll')).runKlingDirectPoll({ jobId }),
  google_vertex_veo_direct: async (jobId: string) => (await import('./google-vertex-veo-poll')).runGoogleVertexVeoPoll({ jobId }),
  google_vertex_omni_direct: async (jobId: string) => (await import('./google-vertex-omni-poll')).runGoogleVertexOmniPoll({ jobId }),
  luma_agents_direct: async (jobId: string) => (await import('./luma-agents-poll')).runLumaAgentsPoll({ jobId }),
} satisfies Record<Exclude<VideoProviderKey, 'fal'>, (jobId: string) => Promise<unknown>>;

/** Reuse existing provider owners, scoped to one already-authorized active job. */
export async function refreshDirectGeneration(provider: string | null, jobId: string): Promise<void> {
  if (provider && Object.hasOwn(refreshers, provider)) {
    await refreshers[provider as keyof typeof refreshers](jobId);
  }
}
