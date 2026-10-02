import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

export function supportsOmniTariffMedia(modelId: string, mode: string) {
  return modelId === 'gemini-omni-flash' && ['v2v', 'retake', 'extend'].includes(mode);
}

/** Estimated read-only media facts; charging exclusively reads owned source/interaction metadata. */
export function withOmniTariffMedia(scenario: ManualTariffCoverageScenario, input: {
  inputVideoDurationSec: number; inheritedDurationSec?: number;
}) {
  if (!supportsOmniTariffMedia(scenario.modelId, scenario.selector.mode)) throw new Error('Unsupported Omni media pricing.');
  if (scenario.selector.mode === 'v2v' && input.inheritedDurationSec !== undefined
    && input.inheritedDurationSec !== input.inputVideoDurationSec) throw new Error('Source and inherited output duration disagree.');
  const context = { ...scenario.context, inputVideoDurationSec: input.inputVideoDurationSec,
    hasVideoInput: input.inputVideoDurationSec > 0,
    ...(scenario.selector.mode === 'extend' ? {} : { inheritedDurationSec: scenario.selector.mode === 'v2v'
      ? input.inputVideoDurationSec : input.inheritedDurationSec ?? scenario.context.inheritedDurationSec }) };
  const result = buildManualTariffCoverageScenario(context, scenario.capabilityKey);
  if (!continuousInputTariffSelector(result.selector)) throw new Error('Invalid source/inherited media duration.');
  return result;
}

export function resolveOmniTariffScenarioId(scenarios: readonly ManualTariffCoverageScenario[], id: string) {
  if (typeof id !== 'string' || id.length > 2000) return null;
  try {
    const selector: Record<string, string> = {};
    for (const part of id.split('|')) {
      const index = part.indexOf('=');
      if (index < 1 || Object.hasOwn(selector, part.slice(0, index))) return null;
      selector[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
    }
    if (!supportsOmniTariffMedia(selector.engineId, selector.mode)) return null;
    const varying = selector.mode === 'extend' ? ['inputVideoDurationSec'] : ['inputVideoDurationSec', 'inheritedDurationSec', 'durationSec'];
    const keys = (value: Record<string, string>) => Object.keys(value).filter(key => !varying.includes(key));
    const template = scenarios.find(candidate => keys(candidate.selector).length === keys(selector).length
      && Object.entries(candidate.selector).every(([key, value]) => varying.includes(key) || selector[key] === value));
    if (!template) return null;
    const result = withOmniTariffMedia(template, { inputVideoDurationSec: Number(selector.inputVideoDurationSec ?? 0),
      ...(selector.mode === 'extend' ? {} : { inheritedDurationSec: Number(selector.inheritedDurationSec) }) });
    return result.id === id ? result : null;
  } catch { return null; }
}
