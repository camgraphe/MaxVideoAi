import { getFalEngineById } from '@/config/falEngines';
import { isStorageConfigured } from '@/server/storage';
import { resolveAgentGenerationModeExecutability } from '@/server/agent-runtime/model-executability';

export const liveRecastEnabled = () => process.env.CHARACTER_STUDIO_RECAST_LIVE_ENABLED === '1';

export function recastReadiness(mode: 'v2v' | 'ref2v' | 'i2v') {
  if (!liveRecastEnabled()) return 'RENDER_DEFERRED';
  const origin = process.env.S3_PUBLIC_BASE_URL?.trim();
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim() || process.env.AWS_ENDPOINT_URL?.trim();
  if (
    !isStorageConfigured() ||
    [origin, endpoint].some((value) => {
      if (!value) return false;
      try {
        const url = new URL(value);
        return url.protocol !== 'https:' || ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
      } catch {
        return true;
      }
    })
  )
    return 'RECAST_STORAGE_UNAVAILABLE';
  const engine = getFalEngineById('wan-3-prime')?.engine;
  return engine && resolveAgentGenerationModeExecutability(engine, mode).executable
    ? null
    : 'ENGINE_UNAVAILABLE';
}
