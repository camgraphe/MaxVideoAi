export type TariffEditorSelection = {
  modelId: string;
  scenarioId: string;
  selector: Record<string, string>;
  customerCents?: number;
};

/** The coverage owner's encoded selector identity is passed intact; never guesses from a model label. */
export function tariffEditorSelection(row: { engineId: string; scenarioId: string }, customerCents?: number): TariffEditorSelection | null {
  if (customerCents !== undefined && (!Number.isSafeInteger(customerCents) || customerCents < 0)) return null;
  const selector: Record<string, string> = {};
  try {
    for (const part of row.scenarioId.split('|')) {
      const index = part.indexOf('=');
      if (index < 1) return null;
      const key = part.slice(0, index);
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || Object.hasOwn(selector, key)) return null;
      selector[key] = decodeURIComponent(part.slice(index + 1));
    }
  } catch { return null; }
  const entry = getFalEngineById(row.engineId);
  if (!entry || selector.engineId !== row.engineId || !selector.mode || !selector.resolution
    || !selector.durationSec || (!selector.aspectRatio && isSeedance2TokenPricing(entry.engine.pricingDetails))) return null;
  return { modelId: row.engineId, scenarioId: row.scenarioId, selector,
    ...(customerCents === undefined ? {} : { customerCents }) };
}
import { getFalEngineById } from '@/config/falEngines';
import { isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
