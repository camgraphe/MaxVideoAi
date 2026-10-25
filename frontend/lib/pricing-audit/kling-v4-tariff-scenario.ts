import { KLING_V4_ENGINE, KLING_V4_MODES, KLING_V4_DURATIONS, KLING_V4_RESOLUTIONS } from '@/config/fal-engines/kling-v4';
import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

/** Admin preparation only. This inventory neither publishes V4 nor supplies a customer amount. */
export function klingV4TariffScenarios(): ManualTariffCoverageScenario[] {
  return KLING_V4_MODES.flatMap(mode => KLING_V4_RESOLUTIONS.flatMap(resolution =>
    KLING_V4_DURATIONS.flatMap(duration => {
      const videoInputClasses = mode === 'ref2v' ? [false, true] : [mode === 'v2v'];
      return videoInputClasses.map(hasVideoInput => buildManualTariffCoverageScenario({
        engine: KLING_V4_ENGINE,
        mode,
        resolution,
        durationSec: Number(duration),
        hasVideoInput,
        ...(hasVideoInput ? { inputVideoDurationSec: 3 } : {}),
      }, `kling-v4:${mode}:${resolution}`));
    })));
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
