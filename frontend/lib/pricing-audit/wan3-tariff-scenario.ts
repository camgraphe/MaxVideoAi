import { isWan3EngineId, validateWan3PricingDuration } from '@/lib/wan3-pricing';
import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

export function supportsWan3TariffInputDuration(modelId: string, mode: string): boolean {
  return isWan3EngineId(modelId) && ['ref2v', 'v2v', 'extend'].includes(mode);
}

/** Read-only quote facts; charging still obtains source duration exclusively from owned media. */
export function withWan3TariffInputDuration(
  scenario: ManualTariffCoverageScenario, inputVideoDurationSec: number,
): ManualTariffCoverageScenario {
  if (!supportsWan3TariffInputDuration(scenario.modelId, scenario.selector.mode)
    || typeof inputVideoDurationSec !== 'number') throw new Error('Unsupported input-video duration');
  validateWan3PricingDuration({ mode: scenario.context.mode, durationSec: scenario.context.durationSec,
    inputVideoDurationSec, hasVideoInput: scenario.selector.mode !== 'ref2v' || inputVideoDurationSec > 0 });
  return buildManualTariffCoverageScenario({ ...scenario.context, inputVideoDurationSec,
    hasVideoInput: inputVideoDurationSec > 0 }, scenario.capabilityKey);
}

/** Reconstruct only a catalog-supported exact identity; never trusts client-authored extra dimensions. */
export function resolveWan3TariffScenarioId(
  scenarios: readonly ManualTariffCoverageScenario[], id: string,
): ManualTariffCoverageScenario | null {
  if (typeof id !== 'string' || id.length > 2000) return null;
  const selector: Record<string, string> = {};
  try {
    for (const part of id.split('|')) {
      const index = part.indexOf('=');
      if (index < 1) return null;
      const key = part.slice(0, index);
      if (Object.hasOwn(selector, key)) return null;
      selector[key] = decodeURIComponent(part.slice(index + 1));
    }
    if (!supportsWan3TariffInputDuration(selector.engineId, selector.mode) || !selector.inputVideoDurationSec) return null;
    const keys = (value: Record<string, string>) => Object.keys(value).filter(key => key !== 'inputVideoDurationSec');
    const template = scenarios.find(candidate => keys(candidate.selector).length === keys(selector).length
      && Object.entries(candidate.selector).every(([key, value]) => key === 'inputVideoDurationSec' || selector[key] === value));
    if (!template) return null;
    const resolved = withWan3TariffInputDuration(template, Number(selector.inputVideoDurationSec));
    return resolved.id === id ? resolved : null;
  } catch { return null; }
}
