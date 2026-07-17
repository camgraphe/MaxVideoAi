import { FEATURES } from '@/content/feature-flags';
import { ENV } from '@/lib/env';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';

import {
  listPublicAgentGenerationEngines,
  type AgentPublicGenerationEngine,
} from './model-catalog';
import type { AgentPrincipal } from './principal';
import {
  getTrialStatus,
  type TrialEntitlement,
} from './trial-entitlement-repository';
import {
  MCP_TRIAL_PRESET,
  TrialPresetUnsupportedError,
  assertTrialPresetSupported,
} from './trial-preset';
import type { TrialPresetSummary, TrialStatus } from './types';

type AccountRestriction = Awaited<ReturnType<typeof getActiveAccountRestriction>>;

export type TrialEligibilityDependencies = {
  featureEnabled: boolean;
  environmentEnabled: string | undefined;
  verificationUrl: string;
  getAccountRestriction(userId: string): Promise<AccountRestriction>;
  getEntitlement(input: { userId: string }): Promise<TrialEntitlement | null>;
  listPublicEngines(): Promise<AgentPublicGenerationEngine[]>;
  assertPresetSupported(candidate: AgentPublicGenerationEngine): void;
};

const DEFAULT_VERIFICATION_URL = 'https://maxvideoai.com/account/connections';
const DISABLED = Object.freeze({ status: 'disabled' } as const);
const ACCOUNT_RESTRICTED = Object.freeze({
  status: 'temporarily_unavailable',
  reason: 'account_restricted',
} as const);
const PRESET_UNAVAILABLE = Object.freeze({
  status: 'temporarily_unavailable',
  reason: 'preset_unavailable',
} as const);
const SERVICE_UNAVAILABLE = Object.freeze({
  status: 'temporarily_unavailable',
  reason: 'service_unavailable',
} as const);

const defaultDependencies: TrialEligibilityDependencies = {
  featureEnabled: FEATURES.mcp.trial as boolean,
  environmentEnabled: ENV.MCP_TRIAL_ENABLED,
  verificationUrl: DEFAULT_VERIFICATION_URL,
  getAccountRestriction: getActiveAccountRestriction,
  getEntitlement: getTrialStatus,
  listPublicEngines: () => listPublicAgentGenerationEngines(),
  assertPresetSupported: assertTrialPresetSupported,
};

function availableStatus(candidate: AgentPublicGenerationEngine): TrialStatus {
  const preset: TrialPresetSummary = Object.freeze({
    engineId: MCP_TRIAL_PRESET.engineId,
    surface: MCP_TRIAL_PRESET.surface,
    mode: MCP_TRIAL_PRESET.mode,
    durationSec: MCP_TRIAL_PRESET.durationSec,
    resolution: MCP_TRIAL_PRESET.resolution,
    aspectRatios: Object.freeze([...MCP_TRIAL_PRESET.aspectRatios]),
    audioOptional:
      candidate.modeCaps[MCP_TRIAL_PRESET.mode]?.audioToggle === true,
    outputCount: MCP_TRIAL_PRESET.outputCount,
  });
  return Object.freeze({ status: 'available', preset });
}

function terminalStatus(entitlement: TrialEntitlement): TrialStatus | null {
  if (entitlement.status === 'reserved' || entitlement.status === 'consumed') {
    return Object.freeze({ status: entitlement.status, jobId: entitlement.jobId });
  }
  return null;
}

export async function getTrialEligibility(
  principal: AgentPrincipal,
  overrides: Partial<TrialEligibilityDependencies> = {},
): Promise<TrialStatus> {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (
    dependencies.featureEnabled !== true
    || dependencies.environmentEnabled !== 'true'
  ) {
    return DISABLED;
  }

  if (principal.emailVerified !== true) {
    return Object.freeze({
      status: 'verification_required',
      nextAction: Object.freeze({
        type: 'verify_email',
        url: dependencies.verificationUrl,
      }),
    });
  }

  let restriction: AccountRestriction;
  try {
    restriction = await dependencies.getAccountRestriction(principal.userId);
  } catch {
    return SERVICE_UNAVAILABLE;
  }
  if (restriction) return ACCOUNT_RESTRICTED;

  let entitlement: TrialEntitlement | null;
  try {
    entitlement = await dependencies.getEntitlement({ userId: principal.userId });
  } catch {
    return SERVICE_UNAVAILABLE;
  }
  if (entitlement) {
    const terminal = terminalStatus(entitlement);
    if (terminal) return terminal;
  }

  try {
    const candidates = await dependencies.listPublicEngines();
    const candidate = candidates.find(
      (entry) =>
        entry.surface === MCP_TRIAL_PRESET.surface
        && entry.engine.id === MCP_TRIAL_PRESET.engineId,
    );
    if (!candidate) return PRESET_UNAVAILABLE;
    dependencies.assertPresetSupported(candidate);
    return availableStatus(candidate);
  } catch (error) {
    return error instanceof TrialPresetUnsupportedError
      ? PRESET_UNAVAILABLE
      : SERVICE_UNAVAILABLE;
  }
}
