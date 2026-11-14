import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import type { ModelCommercialData, ModelPagePricing } from '../_lib/model-page-commercial-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { buildModelSchemaPayloads } from '../_lib/model-page-schema-payloads';
import { formatModelPublicOffer } from '../_lib/model-page-offer-display';
import { localizeSpecStatus, type SpecSection, type SoraCopy } from '../_lib/model-page-specs';
import { serializeJsonLd } from '../../model-jsonld';

export type CinematicDetailsProps = {
  pricing: Promise<ModelPagePricing>; commercial: ModelCommercialData;
  schema: Omit<Parameters<typeof buildModelSchemaPayloads>[0], 'pricingEngine' | 'publicOffer'>;
  decision: ModelDecisionData; locale: AppLocale;
  specTitle: string | null; specNote: string | null; specSections: SpecSection[];
  safetyRules: string[]; safetyInterpretation: string[]; boundaries: string[]; troubleshootingItems: string[];
  faqList: { question: string; answer: string }[]; faqTitle: string | null; copy: SoraCopy;
};
const labels = {
  en: { specs: 'Specifications', pricing: 'Plan your next creation', faq: 'A few things to know.', safety: 'People, likeness & responsible use', limits: 'Limits & practical advice', related: 'Find your next direction.' },
  fr: { specs: 'Caractéristiques', pricing: 'Préparez votre prochaine création', faq: 'Quelques réponses utiles.', safety: 'Personnes, ressemblance et utilisation responsable', limits: 'Limites et conseils pratiques', related: 'Trouvez votre prochaine direction.' },
  es: { specs: 'Características', pricing: 'Prepara tu próxima creación', faq: 'Algunas respuestas útiles.', safety: 'Personas, parecido y uso responsable', limits: 'Límites y consejos prácticos', related: 'Encuentra tu próxima dirección.' },
};

/** Shares exact commercial/schema data with other pages; owns its own editorial composition. */
export async function ModelCinematicDetails({ pricing, commercial, schema, decision, locale, specTitle, specNote, specSections,
  safetyRules, safetyInterpretation, boundaries, troubleshootingItems, faqList, faqTitle, copy }: CinematicDetailsProps) {
  const [current, { pricingEngine, scenarios, publicOffer }] = await Promise.all([pricing, commercial]);
  const l = labels[locale];
  const offer = publicOffer ? formatModelPublicOffer(publicOffer, locale) : null;
  return <>
    {buildModelSchemaPayloads({ ...schema, pricingEngine, publicOffer }).map((payload, index) => <script key={index} id={`model-jsonld-${index}`} type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }} />)}
    <section id="specs" className="cinema-specs cinema-section"><div className="cinema-wrap cinema-specs-layout">
      <header className="cinema-specs-heading"><p className="cinema-eyebrow">{schema.heroTitle}</p><h2>{specTitle && specTitle !== 'Specs' ? specTitle : l.specs}</h2><p>{specNote}</p><Link href={decision.hero.primaryCta.href} prefetch={false} className="cinema-button">{decision.hero.primaryCta.label} ↗</Link></header>
      <div>
      <dl className="cinema-spec-grid">{current.keySpecRows.map(row => <div key={row.id}><dt>{row.label}</dt><dd>{row.id.startsWith('pricePer') && row.value === 'Data pending' ? <a href="#decision-pricing" className="cinema-spec-price-link">{decision.pricing.cta.label} ↗</a> : (row.valueLines?.length ? row.valueLines : [row.value]).map(value => <span key={value}>{localizeSpecStatus(value, locale)}</span>)}</dd></div>)}</dl>
      {specSections.map(section => <details className="cinema-disclosure" key={section.title}><summary>{section.title}<span aria-hidden="true">+</span></summary><div><p>{section.intro}</p><ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul></div></details>)}
    </div></div></section>
    <section id="decision-pricing" className="cinema-pricing cinema-section"><div className="cinema-wrap">
      <header className="cinema-section-heading"><div><p className="cinema-eyebrow">{l.pricing}</p><h2>{decision.pricing.title}</h2></div><div><p>{decision.pricing.subtitle}</p><Link className="cinema-source-link" href={decision.pricing.cta.href} prefetch={false}>{decision.pricing.cta.label} ↗</Link></div></header>
      <div className="cinema-price-grid">{(scenarios ?? decision.pricing.scenarios).map(item => <article key={item.id}><h3>{item.label}</h3><p className="cinema-price-value">{item.value}</p>{item.priceUnitLabel ? <p>{item.priceUnitLabel}</p> : null}<p>{item.note}</p>{item.badge ? <span>{item.badge}</span> : null}</article>)}</div>
      {offer ? <p className="cinema-price-offer">{offer.name} — <strong>{offer.price}</strong></p> : null}<p className="cinema-panel-note">{decision.pricing.footnote}</p>
    </div></section>
    <section id="faq" className="cinema-faq cinema-section"><div className="cinema-wrap cinema-faq-grid"><header><p className="cinema-eyebrow">{faqTitle ?? 'FAQ'}</p><h2>{l.faq}</h2></header><div>{faqList.map(entry => <details key={entry.question} className="cinema-disclosure"><summary>{entry.question}<span aria-hidden="true">+</span></summary><div><p>{entry.answer}</p></div></details>)}
      <details id="tips" className="cinema-disclosure"><summary>{l.limits}<span aria-hidden="true">+</span></summary><div><ul>{[...boundaries, ...troubleshootingItems].map(item => <li key={item}>{item}</li>)}</ul></div></details>
      <details id="safety" className="cinema-disclosure"><summary>{copy.safetyTitle ?? l.safety}<span aria-hidden="true">+</span></summary><div><ul>{[...safetyRules, ...safetyInterpretation].map(item => <li key={item}>{item}</li>)}</ul>{copy.safetyNote ? <p>{copy.safetyNote}</p> : null}</div></details>
    </div></div><FAQSchema questions={faqList.slice(0, 6)} /></section>
    <section id="compare" className="cinema-related cinema-section"><div className="cinema-wrap"><h2>{l.related}</h2><div>{decision.decisionCards.map(card => <article key={card.title}><h3>{card.title}</h3><p>{card.body}</p><Link href={card.cta.href} prefetch={false}>{card.cta.label} ↗</Link></article>)}</div></div></section>
  </>;
}
