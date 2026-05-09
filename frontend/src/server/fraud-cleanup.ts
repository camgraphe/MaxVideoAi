import { applyFraudCleanupPlan } from './fraud-cleanup/apply-plan';
import { buildCandidates } from './fraud-cleanup/candidates';
import { ensureFraudCleanupSchema } from './fraud-cleanup/schema';
import { planFraudTopupActions } from './fraud-cleanup/plan';
import type { FraudCleanupPlan, RunFraudCleanupParams } from './fraud-cleanup/types';

export { RESTRICTED_ACCOUNT_MESSAGE } from './fraud-cleanup/constants';
export { buildRestrictedAccountPayload, getActiveAccountRestriction } from './fraud-cleanup/restrictions';
export { ensureFraudCleanupSchema } from './fraud-cleanup/schema';
export { planFraudTopupActions } from './fraud-cleanup/plan';
export type {
  FraudCleanupPlan,
  FraudCleanupPlanItem,
  FraudTopupCandidate,
  RunFraudCleanupParams,
  StripeFraudStatus,
} from './fraud-cleanup/types';

export async function runStripeFraudWalletCleanup(params: RunFraudCleanupParams): Promise<FraudCleanupPlan> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database unavailable');
  }

  await ensureFraudCleanupSchema();
  const candidates = await buildCandidates(params);
  const plan = planFraudTopupActions({
    candidates,
    dryRun: params.dryRun !== false,
  });

  if (params.dryRun === false) {
    await applyFraudCleanupPlan(plan, params);
    return { ...plan, dryRun: false };
  }

  return plan;
}
