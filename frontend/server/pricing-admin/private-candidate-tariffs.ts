import { UNPUBLISHED_FAL_ENGINE_REGISTRY } from '@/config/fal-engines/registry';
import { materializeFalEngineEntry } from '@/config/fal-engine-materialization';
import { NANO21_ENGINE_ID } from '@/lib/nano-banana-2-1';
import { nano21ManualTariffContexts, buildManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';

/** Admin preparation only: these definitions never enter executable or public catalogs. */
export function privateCandidateTariffEntries() {
  return UNPUBLISHED_FAL_ENGINE_REGISTRY.filter(entry => entry.id === NANO21_ENGINE_ID).map(materializeFalEngineEntry);
}

export function privateCandidateTariffScenarios() {
  return privateCandidateTariffEntries().flatMap(entry => entry.modes.flatMap(({ mode }) =>
    nano21ManualTariffContexts(entry.engine, mode).map(context =>
      buildManualTariffCoverageScenario(context, `${entry.id}:${mode}:${context.resolution}`))));
}
