import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';
import { klingV4TariffContexts } from './kling-v4-tariff-contexts';

/** Qualified admin timing classes; this inventory neither publishes V4 nor supplies a customer amount. */
export function klingV4TariffScenarios(engineId: 'kling-v4' | 'kling-v4-flash' = 'kling-v4'): ManualTariffCoverageScenario[] {
  return klingV4TariffContexts(engineId).map(({ context, capabilityKey }) => buildManualTariffCoverageScenario(context, capabilityKey));
}

export function withKlingV4TariffInput(
  scenario: ManualTariffCoverageScenario,
  seconds: number,
): ManualTariffCoverageScenario {
  const supportedInputClass = ['kling-v4', 'kling-v4-flash'].includes(scenario.modelId)
    && scenario.selector.billingInputType === 'video_input'
    && ['ref2v', 'v2v'].includes(scenario.selector.mode);
  if (!supportedInputClass) throw new Error('Unsupported Kling V4 input class.');
  return buildManualTariffCoverageScenario({
    ...scenario.context, inputVideoDurationSec: seconds,
  }, scenario.capabilityKey);
}

export function resolveKlingV4TariffScenarioId(scenarios: readonly ManualTariffCoverageScenario[], id: string) {
  const requested = Object.fromEntries(new URLSearchParams(id.replaceAll('|', '&')));
  if (!['kling-v4', 'kling-v4-flash'].includes(requested.engineId)) return null;
  const base = scenarios.find(scenario => scenario.modelId === requested.engineId
    && Object.entries(scenario.selector).every(([key, value]) =>
      key === 'inputVideoDurationSec' || requested[key] === value));
  if (!base) return null;
  try {
    const resolved = base.selector.billingInputType === 'video_input'
      ? withKlingV4TariffInput(base, Number(requested.inputVideoDurationSec)) : base;
    return resolved.id === id ? resolved : null;
  } catch { return null; }
}

export function klingV4FamilyTariffScenarios(): ManualTariffCoverageScenario[] {
  return [...klingV4TariffScenarios(), ...klingV4TariffScenarios('kling-v4-flash')];
}
