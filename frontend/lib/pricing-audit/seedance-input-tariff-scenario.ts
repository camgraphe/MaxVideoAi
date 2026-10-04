import { supportsSeedanceInputTariff, validateSeedanceInputTariffDuration } from '@/lib/seedance-input-tariff';
import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

export function withSeedanceTariffInputDuration(scenario: ManualTariffCoverageScenario, seconds: number): ManualTariffCoverageScenario {
  if (scenario.context.workflowStep || !supportsSeedanceInputTariff(scenario.modelId, scenario.selector.mode, scenario.selector.billingInputType)) {
    throw new Error('Unsupported normal Seedance input tariff.');
  }
  validateSeedanceInputTariffDuration(scenario.modelId, seconds);
  return buildManualTariffCoverageScenario({ ...scenario.context, hasVideoInput: true,
    inputVideoDurationSec: seconds }, scenario.capabilityKey);
}

/** Rebuild from an authored catalogue class; no extra or duplicate selector dimensions. */
export function resolveSeedanceTariffScenarioId(scenarios: readonly ManualTariffCoverageScenario[], id: string) {
  if (typeof id !== 'string' || id.length > 2000) return null;
  try {
    const selector: Record<string, string> = {};
    for (const part of id.split('|')) {
      const index = part.indexOf('=');
      const key = part.slice(0, index);
      if (index < 1 || Object.hasOwn(selector, key)) return null;
      selector[key] = decodeURIComponent(part.slice(index + 1));
    }
    if (!supportsSeedanceInputTariff(selector.engineId, selector.mode, selector.billingInputType) || !selector.inputVideoDurationSec) return null;
    const template = scenarios.find(candidate => Object.keys(candidate.selector).length === Object.keys(selector).length
      && Object.entries(candidate.selector).every(([key,value]) => key === 'inputVideoDurationSec' || selector[key] === value));
    if (!template) return null;
    const scenario = withSeedanceTariffInputDuration(template, Number(selector.inputVideoDurationSec));
    return scenario.id === id ? scenario : null;
  } catch { return null; }
}
