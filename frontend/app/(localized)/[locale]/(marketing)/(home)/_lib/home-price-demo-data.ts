import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import es from '@/messages/es.json';
import { listFalEngines } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { getPresetQuote, isPricingDiscoveryEntry } from '../../pricing/_lib/pricingHubData';
import { HOME_PRICE_SCENARIOS, type HomePriceModel } from '@/components/marketing/home/home-price-demo-types';

/** Only the inert t2v display crosses the server/client boundary, not the catalog. */
function projectDisplayEngine(engine: HomePriceModel['engine']): HomePriceModel['engine'] {
  return {
    id: engine.id,
    label: engine.label,
    provider: engine.provider,
    version: engine.version,
    status: engine.status,
    latencyTier: engine.latencyTier,
    modes: engine.modes,
    maxDurationSec: engine.maxDurationSec,
    resolutions: engine.resolutions,
    aspectRatios: engine.aspectRatios,
    fps: engine.fps,
    audio: engine.audio,
    upscale4k: engine.upscale4k,
    extend: engine.extend,
    motionControls: engine.motionControls,
    keyframes: engine.keyframes,
    params: engine.params,
    inputLimits: engine.inputLimits,
    updatedAt: engine.updatedAt,
    ttlSec: engine.ttlSec,
    availability: engine.availability,
    modeAvailability: engine.modeAvailability?.t2v ? { t2v: engine.modeAvailability.t2v } : undefined,
    modeCaps: engine.modeCaps?.t2v ? { t2v: engine.modeCaps.t2v } : undefined,
  };
}

/** Read-only projection of Pricing's exact quotes. Never invent an unavailable quote. */
export function buildHomePriceDemo(locale: AppLocale): HomePriceModel[] {
  const entry = listFalEngines().find(item => item.modelSlug === 'wan-3' && isPricingDiscoveryEntry(item));
  if (!entry) return [];
  const steps = HOME_PRICE_SCENARIOS.flatMap(scenario => {
    const quote = getPresetQuote(entry, {id:'home-wan-demo', label:'', subLabel:'', durationSec:scenario.seconds, resolution:scenario.resolution, audio:true}, locale);
    return quote.status === 'exact' && quote.amountCents != null && quote.display
      ? [{...scenario, amountCents:quote.amountCents, display:quote.display}] : [];
  });
  const messages = {en,fr,es}[locale].workspace;
  const workspaceCopy = {header:{controlLabels:messages.header.controlLabels},generate:{controls:{...messages.generate.controls,audio:{label:'Audio',on:locale === 'fr' ? 'Oui' : locale === 'es' ? 'Sí' : 'On',off:locale === 'fr' ? 'Non' : locale === 'es' ? 'No' : 'Off'}},composer:messages.generate.composer}};
  return steps.length === HOME_PRICE_SCENARIOS.length ? [{engine:projectDisplayEngine(entry.engine), workspaceCopy, steps}] : [];
}
