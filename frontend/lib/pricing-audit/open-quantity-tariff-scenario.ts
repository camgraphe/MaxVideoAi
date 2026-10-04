import { buildManualTariffCoverageScenario, type ManualTariffCoverageScenario } from './manual-tariff-coverage';

export function openTariffQuantityKey(modelId: string, mode: string): 'durationSec' | 'referenceTokenBudget' | null {
  return ['lumaRay2', 'lumaRay2_flash'].includes(modelId) && mode === 'v2v' ? 'durationSec'
    : modelId === 'minimax-h3-max' && mode === 'ref2v' ? 'referenceTokenBudget' : null;
}
export function withOpenTariffQuantity(scenario: ManualTariffCoverageScenario, quantity: number) {
  const key = openTariffQuantityKey(scenario.modelId, scenario.selector.mode);
  if (!key || !Number.isSafeInteger(quantity) || quantity < (key === 'durationSec' ? 1 : 0)) throw new Error('Invalid supported integer tariff quantity.');
  return buildManualTariffCoverageScenario({ ...scenario.context, [key]: quantity }, scenario.capabilityKey);
}
export function resolveOpenTariffScenarioId(scenarios: readonly ManualTariffCoverageScenario[], id: string) {
  if (typeof id !== 'string' || id.length > 2000) return null;
  try {
    const selector: Record<string,string> = {};
    for (const part of id.split('|')) {
      const position = part.indexOf('=');
      if (position < 1 || Object.hasOwn(selector, part.slice(0,position))) return null;
      selector[part.slice(0,position)] = decodeURIComponent(part.slice(position+1));
    }
    const key = openTariffQuantityKey(selector.engineId, selector.mode);
    if (!key) return null;
    const template = scenarios.find(row => Object.keys(row.selector).length === Object.keys(selector).length
      && Object.entries(row.selector).every(([name,value]) => name === key || selector[name] === value));
    if (!template) return null;
    const result = withOpenTariffQuantity(template, Number(selector[key]));
    return result.id === id ? result : null;
  } catch { return null; }
}
