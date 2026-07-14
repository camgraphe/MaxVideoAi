import { withDbTransaction } from '@/lib/db';
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
