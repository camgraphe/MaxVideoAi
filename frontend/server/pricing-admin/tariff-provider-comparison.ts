import { getFalEngineById } from '@/config/falEngines';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { resolveVideoProviderRoutingPlan } from '@/server/video-providers/router';
import { getBytePlusSeedanceAllowedModes, isBytePlusSeedanceSubmissionEnabled,
  resolveBytePlusSeedanceModelId, resolveBytePlusSeedanceRouteProfile } from '@/server/video-providers/byteplus-modelark-profile-policy';
import { assertBytePlusTransportConfigured, getBytePlusArkConfig, isBytePlusModelArkEnabled } from '@/server/video-providers/byteplus-modelark';
import { lumaAgentsImageDirectEnabled } from '@/server/images/luma-agents-execution';
import { providerComparisonInputFromScenario, type ProviderCostComparisonInput } from './provider-cost-comparison';

/** Uses the same route policy as generation. A disabled direct route never silently becomes Fal. */
export function providerComparisonForTariffScenario(scenario: ManualTariffCoverageScenario): ProviderCostComparisonInput {
  const entry = getFalEngineById(scenario.modelId);
  if (!entry) throw new Error('Unknown supplier comparison model');
  const { context } = scenario;
  const declared = entry.engine.providerMeta?.provider;
  let executionProvider = 'fal';
  let routeConfigured: boolean | null = null;
  if (entry.category === 'image') {
    if (declared === 'google_vertex_image' || declared === 'byteplus_modelark') executionProvider = declared;
    else if (declared === 'luma_agents_direct' && lumaAgentsImageDirectEnabled({ isAdmin: true })) {
      executionProvider = 'luma_agents_direct';
    }
  } else if (resolveBytePlusSeedanceRouteProfile(entry.id, declared)) {
    executionProvider = 'byteplus_modelark';
    routeConfigured = false;
    try {
      if (context.mode && isBytePlusSeedanceSubmissionEnabled(entry.id) && isBytePlusModelArkEnabled()
        && getBytePlusSeedanceAllowedModes(entry.id).includes(context.mode)) {
        resolveBytePlusSeedanceModelId(entry.id, getBytePlusArkConfig());
        assertBytePlusTransportConfigured(entry.id, context.mode);
        routeConfigured = true;
      }
    } catch { /* Missing model selectors or transport credentials keep this read-only route unavailable. */ }
  } else {
    const plan = resolveVideoProviderRoutingPlan({ engineId: entry.id, mode: context.mode ?? 't2v', isAdmin: true });
    if ('primaryProvider' in plan) executionProvider = plan.primaryProvider;
    else {
      executionProvider = plan.kind === 'alibaba_model_studio_unavailable' ? 'alibaba_model_studio'
        : entry.id === 'gemini-omni-flash' ? 'google_vertex_omni_direct' : 'google_vertex_veo_direct';
      routeConfigured = false;
    }
  }
  if (process.env.PRICING_SANDBOX === '1') routeConfigured = false;
  return { ...providerComparisonInputFromScenario({
    scenario: { id: scenario.id, engineId: scenario.modelId, mode: context.mode,
      resolution: context.resolution, durationSec: Number(scenario.selector.durationSec), surface: 'billing', membershipTier: 'member',
      input: { ...scenario.selector, ...(typeof context.aspectRatio === 'string' ? { aspectRatio: context.aspectRatio } : {}),
        ...(typeof context.addons?.audio === 'boolean' ? { audio: context.addons.audio } : {}) } },
    context, quote: null, engine: entry.engine, brandId: entry.brandId, familyId: entry.family,
    executionProvider, mediaType: entry.category === 'image' ? 'image' : 'video',
  }), routeConfigured };
}
