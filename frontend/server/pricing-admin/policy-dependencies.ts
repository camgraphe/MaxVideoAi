import { query, withDbTransaction } from '@/lib/db';
import { customerTariffsEnabledByCode } from '@/server/pricing/customer-tariff-store';
import { PricingAdminError } from './errors';
import {
  deletePricingRuleWithExecutor,
  invalidatePricingRulesCache,
  loadPricingPolicyOverrides,
  loadPricingPolicyOverridesWithExecutor,
  upsertPricingRuleWithExecutor,
} from '@/lib/pricing-rule-store';

import {
  getPricingChangeEventById,
  insertPricingChangeEvent,
  listLatestPricingChangeEventsByTargets,
  listPricingChangeEvents,
} from './event-store';
import type { PricingPolicyServiceDependencies } from './policy-contract';
import { revalidatePricingChangeSurfaces } from './revalidation';

export const DEFAULT_POLICY_SERVICE_DEPENDENCIES: PricingPolicyServiceDependencies = {
  loadManualTariffsActive: async executor => {
    if (!customerTariffsEnabledByCode()) return false;
    try {
      const [state] = await (executor ?? { query }).query<{ active: boolean }>(
        `SELECT active FROM app_customer_tariff_state WHERE singleton = TRUE${executor ? ' FOR UPDATE' : ''}`);
      if (!state) throw new Error('Missing tariff state');
      return state.active;
    } catch { throw new PricingAdminError('database_unavailable', 'Customer tariff state is unavailable.'); }
  },
  loadOverrides: (executor) =>
    executor
      ? loadPricingPolicyOverridesWithExecutor(executor, { lock: true })
      : loadPricingPolicyOverrides(),
  getEvent: (id, domain, executor) =>
    getPricingChangeEventById(id, domain, executor),
  listLatestEventsByTargets: listLatestPricingChangeEventsByTargets,
  listEvents: listPricingChangeEvents,
  withTransaction: (callback) =>
    withDbTransaction((executor) => callback(executor)),
  upsertRule: (executor, rule, actorId) =>
    upsertPricingRuleWithExecutor(executor, rule, actorId),
  deleteRule: deletePricingRuleWithExecutor,
  insertEvent: insertPricingChangeEvent,
  invalidateCache: invalidatePricingRulesCache,
  revalidate: revalidatePricingChangeSurfaces,
};
