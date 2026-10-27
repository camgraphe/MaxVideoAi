import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';
import { klingV4TariffContexts } from './kling-v4-tariff-contexts';

/** Qualified admin timing classes; this inventory neither publishes V4 nor supplies a customer amount. */
export function klingV4TariffScenarios(): ManualTariffCoverageScenario[] {
  return klingV4TariffContexts().map(({ context, capabilityKey }) => buildManualTariffCoverageScenario(context, capabilityKey));
}

export function withKlingV4TariffInput(
  scenario: ManualTariffCoverageScenario,
  seconds: number,
): ManualTariffCoverageScenario {
  const supportedInputClass = scenario.modelId === 'kling-v4'
    && scenario.selector.billingInputType === 'video_input'
    && ['ref2v', 'v2v'].includes(scenario.selector.mode);
  if (!supportedInputClass) throw new Error('Unsupported Kling V4 input class.');
  return buildManualTariffCoverageScenario({
    ...scenario.context, inputVideoDurationSec: seconds,
  }, scenario.capabilityKey);
}

export function resolveKlingV4TariffScenarioId(scenarios: readonly ManualTariffCoverageScenario[], id: string) {
  const requested = Object.fromEntries(new URLSearchParams(id.replaceAll('|', '&')));
  if (requested.engineId !== 'kling-v4') return null;
  const base = scenarios.find(scenario => scenario.modelId === 'kling-v4'
    && Object.entries(scenario.selector).every(([key, value]) =>
      key === 'inputVideoDurationSec' || requested[key] === value));
  if (!base) return null;
  try {
    const resolved = base.selector.billingInputType === 'video_input'
      ? withKlingV4TariffInput(base, Number(requested.inputVideoDurationSec)) : base;
    return resolved.id === id ? resolved : null;
  } catch { return null; }
}
