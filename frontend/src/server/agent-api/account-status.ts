import { getWalletSummary, type WalletSummary } from '@/server/wallet-summary';

import type { AgentPrincipal } from './principal';
import type { AgentAccountStatus } from './types';

export type AgentAccountStatusDeps = {
  getWalletSummary(userId: string): Promise<WalletSummary>;
  accountUrl: string;
};

export type AgentAccountStatusWalletDeps = Pick<AgentAccountStatusDeps, 'getWalletSummary'>;

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
  return {
    accountId: principal.userId,
    emailVerified: principal.emailVerified,
    clientId: principal.clientId,
    wallet: {
      amountCents: wallet.balanceCents,
      currency: wallet.currency,
      pendingCents: wallet.pendingCents,
    },
    trial: { status: 'disabled' },
    spendingLimits: {
      perGenerationCents: null,
      dailyCents: null,
      webApprovalAboveCents: null,
    },
    accountUrl: deps.accountUrl,
  };
}
