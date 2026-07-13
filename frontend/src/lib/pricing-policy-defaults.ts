import { validatePricingPolicyDocument, type PricingPolicyDocument } from '@maxvideoai/pricing';
import policySource from '@/config/pricing-policy.json';
import { listFalEngines } from '@/config/falEngines';

const entries = listFalEngines();
const engineIds = new Set<string>(['audio-generation', 'angle', 'background-removal', 'storyboarder', 'upscale']);
const modesByEngineId = new Map<string, ReadonlySet<string>>();
const resolutionsByEngineId = new Map<string, ReadonlySet<string>>();

for (const entry of entries) {
  engineIds.add(entry.id);
  engineIds.add(entry.engine.id);
  const modes = new Set(entry.modes.map((mode) => mode.mode));
  modesByEngineId.set(entry.id, modes);
  modesByEngineId.set(entry.engine.id, modes);
  const resolutions = new Set<string>(entry.engine.resolutions ?? []);
  Object.keys(entry.engine.pricingDetails?.perSecondCents?.byResolution ?? {}).forEach((value) => resolutions.add(value));
  Object.keys(entry.engine.pricingDetails?.flatCents?.byResolution ?? {}).forEach((value) => resolutions.add(value));
  resolutionsByEngineId.set(entry.id, resolutions);
  resolutionsByEngineId.set(entry.engine.id, resolutions);
}
modesByEngineId.set('storyboarder', new Set(['storyboard', 'storyboard_edit']));

const validatedPolicy = validatePricingPolicyDocument(policySource, {
  engineIds,
  modesByEngineId,
  resolutionsByEngineId,
});

function clonePolicy(policy: PricingPolicyDocument): PricingPolicyDocument {
  return {
    version: 1,
    supportedCurrencies: [...policy.supportedCurrencies],
    compatibilityProfiles: policy.compatibilityProfiles.map((profile) => ({ ...profile })),
    rules: policy.rules.map((rule) => ({ ...rule })),
  };
}

export function getVersionedPricingPolicy(): PricingPolicyDocument {
  return clonePolicy(validatedPolicy);
}
