import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import es from '@/messages/es.json';
import { listFalEngines } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { getPresetQuote, isPricingDiscoveryEntry } from '../../pricing/_lib/pricingHubData';
import { HOME_PRICE_SCENARIOS, type HomePriceModel } from '@/components/marketing/home/home-price-demo-types';

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
  return steps.length === HOME_PRICE_SCENARIOS.length ? [{engine:entry.engine, workspaceCopy, steps}] : [];
}
