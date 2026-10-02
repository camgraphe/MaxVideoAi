import { ltx25AudioTariffBounds, validateLtx25AudioTariffDuration } from '@/lib/ltx25-audio-tariff';
import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

export function withLtx25AudioTariffDuration(scenario: ManualTariffCoverageScenario, seconds: number) {
  validateLtx25AudioTariffDuration(scenario.modelId, scenario.selector.mode, seconds);
  return buildManualTariffCoverageScenario({ ...scenario.context, inputAudioDurationSec: seconds }, scenario.capabilityKey);
}

/** Only a known catalog template may supply the other price dimensions. */
export function resolveLtx25AudioTariffScenarioId(scenarios: readonly ManualTariffCoverageScenario[], id: string) {
  if (typeof id !== 'string' || id.length > 2000) return null;
  try {
    const selector: Record<string, string> = {};
    for (const part of id.split('|')) {
      const index = part.indexOf('=');
      if (index < 1 || Object.hasOwn(selector, part.slice(0, index))) return null;
      selector[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
    }
    if (!ltx25AudioTariffBounds(selector.engineId, selector.mode)) return null;
    const template = scenarios.find(candidate => Object.keys(candidate.selector).length === Object.keys(selector).length
      && Object.entries(candidate.selector).every(([key, value]) => ['durationSec', 'inputAudioDurationSec'].includes(key) || selector[key] === value));
    if (!template) return null;
    const result = withLtx25AudioTariffDuration(template, Number(selector.inputAudioDurationSec));
    return result.id === id ? result : null;
  } catch { return null; }
}
