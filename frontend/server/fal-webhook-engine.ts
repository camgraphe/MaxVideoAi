import { getFalEngineById } from '@/config/falEngines';
import { listUpscaleToolEngines } from '@/config/tools-upscale-engines';
import { resolveEngineIdFromModelSlug } from '@/lib/fal-catalog';
import type { FalWebhookPayload } from './fal-webhook-mapping-types';
import { findFirstString } from './fal-webhook-payload-search';

const PROVIDER_ENGINE_MAP: Record<string, string> = {
  openai: 'sora-2',
  'openai-sora': 'sora-2',
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'openai-sora-2-pro': 'sora-2-pro',
  'sora-pro': 'sora-2-pro',
  sora: 'sora-2',
  pika: 'pika-text-to-video',
  'pika-labs': 'pika-text-to-video',
  'pika-2.2': 'pika-text-to-video',
  'google-veo': 'veo-3-1-fast',
  google: 'veo-3-1-fast',
  veo: 'veo-3-1-fast',
  luma: 'luma-dream-machine',
  'luma-dream-machine': 'luma-dream-machine',
};

const UPSCALE_TOOL_ENGINE_BY_ID = new Map<string, { mediaType: 'image' | 'video' }>(
  listUpscaleToolEngines().map((engine) => [engine.id, { mediaType: engine.mediaType }])
);

export async function inferEngineFromPayload(
  payload: FalWebhookPayload
): Promise<{ engineId: string; engineLabel: string | null }> {
  const modelSlug =
    findFirstString(payload, ['model', 'model_slug', 'modelId', 'model_id', 'fal_model_id', 'falModelId', 'endpoint']) ??
    null;
  if (modelSlug) {
    const engineId = (await resolveEngineIdFromModelSlug(modelSlug)) ?? null;
    if (engineId) {
      const engine = getFalEngineById(engineId);
      const engineLabel =
        engine?.marketingName ??
        (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
        engineId;
      return { engineId, engineLabel };
    }
  }

  const provider = findFirstString(payload, ['provider', 'vendor', 'source'])?.toLowerCase() ?? null;
  if (provider && PROVIDER_ENGINE_MAP[provider]) {
    const engineId = PROVIDER_ENGINE_MAP[provider];
    const engine = getFalEngineById(engineId);
    const engineLabel =
      engine?.marketingName ??
      (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
      engineId;
    return { engineId, engineLabel };
  }

  const requestEngine = findFirstString(payload, ['engine_id', 'engineId', 'engine']) ?? null;
  if (requestEngine && requestEngine !== 'fal-unknown') {
    const normalized = requestEngine.trim();
    const engineId =
      PROVIDER_ENGINE_MAP[normalized.toLowerCase()] ??
      (await resolveEngineIdFromModelSlug(normalized)) ??
      normalized;
    const engine = getFalEngineById(engineId);
    const engineLabel =
      engine?.marketingName ??
      (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
      engineId;
    return { engineId, engineLabel };
  }

  return { engineId: 'fal-unknown', engineLabel: null };
}

export function getUpscaleToolMediaType(engineId: string): 'image' | 'video' | null {
  return UPSCALE_TOOL_ENGINE_BY_ID.get(engineId)?.mediaType ?? null;
}
