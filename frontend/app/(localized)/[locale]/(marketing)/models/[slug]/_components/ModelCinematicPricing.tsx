import { CinematicArrow, CinematicPlus } from './ModelCinematicMarks';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { getPricingHubCopy } from '../../../pricing/_lib/pricingHubCopy';
import type { KeySpecRow } from '../_lib/model-page-specs-types';
import type { ModelDecisionData, ModelDecisionLink } from '../_lib/model-page-decision-data';
import type { ModelDecisionPricingScenario } from '../_lib/model-page-decision-pricing';

/** Current quote strings are display-only. Missing quotes never become three empty price cards. */
export function ModelCinematicPricing({ pricing, scenarios, create, locale, offer, unitRates }: {
  pricing: ModelDecisionData['pricing']; scenarios: ModelDecisionPricingScenario[];
  unitRates?: KeySpecRow[];
  create: ModelDecisionLink; locale: AppLocale; offer: { name: string; price: string } | null;
}) {
  const unavailable = getPricingHubCopy(locale).liveQuote;
  const quoted = scenarios.filter(item => item.value.trim() && item.value !== unavailable && item.value !== '—');
  return <section id="decision-pricing" className="cinema-price-summary" aria-labelledby="cinema-pricing-title">
    <div className="cinema-price-intro"><h3 id="cinema-pricing-title">{pricing.title}</h3><p>{pricing.subtitle}</p></div>
    {quoted.length ? <dl className="cinema-price-list">{quoted.map(item => <div key={item.id}><dt>{item.label}<small>{item.note}</small></dt><dd>{item.value}{item.priceUnitLabel ? <small>{item.priceUnitLabel}</small> : null}</dd></div>)}</dl> : null}
    {offer ? <p className="cinema-price-offer">{offer.name} — <strong>{offer.price}</strong></p> : null}
    {unitRates?.map(rate => <details key={rate.id} className="cinema-disclosure cinema-unit-rates">
      <summary>{rate.label}<CinematicPlus /></summary>
      <ul>{(rate.valueLines?.length ? rate.valueLines : [rate.value]).map(line => <li key={line}>{line}</li>)}</ul>
    </details>)}
    <div className="cinema-price-actions"><Link href={create.href} prefetch={false} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_pricing" data-analytics-target-family="workspace">{create.label}<CinematicArrow disc /></Link>
      {pricing.cta.href !== create.href ? <Link href={pricing.cta.href} prefetch={false} className="cinema-source-link" data-analytics-event="cta_click" data-analytics-cta-name="view_pricing" data-analytics-cta-location="model_pricing" data-analytics-target-family="pricing">{pricing.cta.label} ↗</Link> : null}
    </div><p className="cinema-panel-note">{pricing.footnote}</p>
  </section>;
}
