import { loadPricingPolicyOverrides, type PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';

/** One render owns its first successful policy; failed attempts remain retryable. */
export function createScopedPublicPolicyLoader(
  loadOverrides: () => Promise<PricingPolicyOverrideLoadResult> = loadPricingPolicyOverrides,
): () => Promise<PricingPolicyOverrideLoadResult> {
  let loaded: Extract<PricingPolicyOverrideLoadResult, { status: 'loaded' }> | undefined;
  let pending: Promise<PricingPolicyOverrideLoadResult> | undefined;
  const loadScopedPolicy = () => {
    if (loaded) return Promise.resolve(loaded);
    if (!pending) {
      const attempt = Promise.resolve().then(loadOverrides).then((policy) => {
        if (policy.status === 'loaded') loaded = policy;
        return policy;
      }).finally(() => {
        if (pending === attempt) pending = undefined;
      });
      pending = attempt;
    }
    return pending;
  };
  return loadScopedPolicy;
}
