import { getBaseEngineIncludingHidden } from '@/lib/engines';
import { resolveTrustedPaidGenerateRouteContext } from '@/app/api/generate/_lib/route-context';
import type { VideoProviderKey } from '@/server/video-providers/types';
import { isKlingDirectV3Funded } from '@/server/video-providers/router';
import { klingV4VideoRouterEnabled } from '@/server/video-providers/videorouter/kling-v4';
import type { Mode } from '@/types/engines';

// Use the same non-submitting resolver as prepared paid requests. Examples cover every installed path.
const EXAMPLES: ReadonlyArray<[VideoProviderKey, string, Mode]> = [
  ['fal', 'minimax-h3', 'ref2v'],
  ['alibaba_model_studio', 'wan-3-prime', 't2v'],
  ['videorouter', 'wan-3', 'ref2v'],
  ['videorouter', 'kling-v4', 'ref2v'],
  ['byteplus_modelark', 'seedance-2-5', 'ref2v'],
  ['kling_direct', 'kling-o3-pro', 'ref2v'],
  ['luma_agents_direct', 'luma-ray-3-2', 't2v'],
  ['google_vertex_veo_direct', 'veo-3-1', 't2v'],
  ['google_vertex_omni_direct', 'gemini-omni-flash', 't2v'],
];
export function installedRoutes() {
  return EXAMPLES.map(([provider, engineId, mode]) => {
    const engine = getBaseEngineIncludingHidden(engineId);
    const result =
      engine && resolveTrustedPaidGenerateRouteContext({ engine, body: {}, mode, jobId: 'routing-preview' });
    const wan = engineId === 'wan-3' || engineId === 'wan-3-prime';
    const sandbase = engineId === 'kling-v4';
    const installedTargets = wan ? ['videorouter', 'alibaba_model_studio'] : sandbase ? ['videorouter', 'fal'] : [provider];
    const profile = sandbase ? '720p · three images' : engineId === 'wan-3' ? '480p portrait · one image' : wan ? '720p landscape · text' : '';
    const targets: string[] = [];
    if (result?.ok) {
      const { providerRoutingPlan: plan, providerKey } = result.context;
      if (plan.kind === 'alibaba_model_studio_primary' && plan.purchaseCanary === 'with-videorouter' ||
          sandbase && plan.kind === 'fal_only' && klingV4VideoRouterEnabled()) targets.push('videorouter');
      targets.push(providerKey);
      if ('fallbackEnabled' in plan && plan.fallbackEnabled && providerKey !== 'fal') targets.push('fal');
    }
    const standbyReason = provider === 'kling_direct' && !isKlingDirectV3Funded()
      ? 'Kling 3 API pack declared out of funds'
      : null;
    return { provider, engineId, label: engine?.label ?? engineId, mode, profile, targets, installedTargets, standbyReason };
  });
}
export type InstalledRoute = ReturnType<typeof installedRoutes>[number];
