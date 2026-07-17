import { getWalletSummary, type WalletSummary } from '@/server/wallet-summary';

import type { AgentPrincipal } from './principal';
import {
  getTrialEligibility as resolveTrialEligibility,
  type TrialEligibilityDependencies,
} from './trial-eligibility';
import type { AgentAccountStatus, TrialStatus } from './types';

type TrialEligibilityResolver = (
  principal: AgentPrincipal,
  dependencies?: Partial<TrialEligibilityDependencies>,
) => Promise<TrialStatus>;

export type AgentAccountStatusDeps = {
  getWalletSummary(userId: string): Promise<WalletSummary>;
  accountUrl: string;
  getTrialEligibility?: TrialEligibilityResolver;
  trialEligibilityDependencies?: Partial<TrialEligibilityDependencies>;
};

export type AgentAccountStatusWalletDeps =
  & Pick<AgentAccountStatusDeps, 'getWalletSummary'>
  & Partial<Pick<
    AgentAccountStatusDeps,
    'getTrialEligibility' | 'trialEligibilityDependencies'
  >>;

const defaultDeps: AgentAccountStatusDeps = {
  getWalletSummary,
  accountUrl: 'https://maxvideoai.com/account/connections',
};

export function createAgentAccountStatusService(
  accountUrl: string,
  deps: AgentAccountStatusWalletDeps = defaultDeps
): (principal: AgentPrincipal) => Promise<AgentAccountStatus> {
  return (principal) => getAgentAccountStatus(principal, { ...deps, accountUrl });
}

export async function getAgentAccountStatus(
  principal: AgentPrincipal,
  deps: AgentAccountStatusDeps = defaultDeps
): Promise<AgentAccountStatus> {
  const wallet = await deps.getWalletSummary(principal.userId);
  let trial: TrialStatus;
  try {
    trial = await (deps.getTrialEligibility ?? resolveTrialEligibility)(principal, {
      ...deps.trialEligibilityDependencies,
      verificationUrl: deps.accountUrl,
    });
  } catch {
    trial = {
      status: 'temporarily_unavailable',
      reason: 'service_unavailable',
    };
  }
  return {
    accountId: principal.userId,
    emailVerified: principal.emailVerified,
    clientId: principal.clientId,
    wallet: {
      amountCents: wallet.balanceCents,
      currency: wallet.currency,
      pendingCents: wallet.pendingCents,
    },
    trial,
    spendingLimits: {
      perGenerationCents: null,
      dailyCents: null,
      webApprovalAboveCents: null,
    },
    accountUrl: deps.accountUrl,
  };
}
