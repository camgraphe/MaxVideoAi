import { estimateBytePlusProviderCostCents } from '../../../server/byteplus-accounting';

import type { CanonicalGenerationRequest } from './generation-types';
import { MCP_TRIAL_PRESET } from './trial-preset';

export const MCP_TRIAL_PROVIDER_COST_CEILING_DEFAULT_CENTS = 25;
export const MCP_TRIAL_PROVIDER_COST_CEILING_MAX_CENTS = 100;
export const MCP_TRIAL_PROVIDER_COST_CEILING_ENV = 'MCP_TRIAL_PROVIDER_COST_CEILING_CENTS';

export class TrialProviderCostError extends Error {
  constructor() {
    super('The included trial provider cost is unavailable.');
    this.name = 'TrialProviderCostError';
  }
}

export function resolveTrialProviderCostCeilingCents(
  rawValue: string | undefined = process.env[MCP_TRIAL_PROVIDER_COST_CEILING_ENV],
): number {
  if (rawValue === undefined) return MCP_TRIAL_PROVIDER_COST_CEILING_DEFAULT_CENTS;
  if (!/^[1-9][0-9]*$/u.test(rawValue)) throw new TrialProviderCostError();
  const ceiling = Number(rawValue);
  if (!Number.isSafeInteger(ceiling)
    || ceiling > MCP_TRIAL_PROVIDER_COST_CEILING_MAX_CENTS) {
    throw new TrialProviderCostError();
  }
  return ceiling;
}

export function requireTrialProviderCostCents(
  request: CanonicalGenerationRequest,
  rawCeiling?: string | undefined,
): number {
  const settings = request.settings;
  if (request.surface !== MCP_TRIAL_PRESET.surface
    || request.engineId !== MCP_TRIAL_PRESET.engineId
    || request.mode !== MCP_TRIAL_PRESET.mode
    || request.outputCount !== MCP_TRIAL_PRESET.outputCount
    || request.references.length !== 0
    || settings.durationSec !== MCP_TRIAL_PRESET.durationSec
    || settings.resolution !== MCP_TRIAL_PRESET.resolution
    || typeof settings.aspectRatio !== 'string'
    || !MCP_TRIAL_PRESET.aspectRatios.includes(
      settings.aspectRatio as (typeof MCP_TRIAL_PRESET.aspectRatios)[number],
    )
    || typeof settings.audio !== 'boolean') {
    throw new TrialProviderCostError();
  }
  let costCents: number;
  try {
    costCents = estimateBytePlusProviderCostCents({
      engineId: request.engineId,
      durationSec: MCP_TRIAL_PRESET.durationSec,
      resolution: MCP_TRIAL_PRESET.resolution,
      aspectRatio: settings.aspectRatio,
      billingInputType: 'no_video_input',
    });
  } catch {
    throw new TrialProviderCostError();
  }
  const ceiling = resolveTrialProviderCostCeilingCents(rawCeiling);
  if (costCents > ceiling) throw new TrialProviderCostError();
  return costCents;
}
