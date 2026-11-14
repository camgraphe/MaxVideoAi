import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import type { ModelCommercialData, ModelPagePricing } from '../_lib/model-page-commercial-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { buildModelSchemaPayloads } from '../_lib/model-page-schema-payloads';
import { formatModelPublicOffer } from '../_lib/model-page-offer-display';
import { localizeSpecStatus, type KeySpecRow, type SpecSection, type SoraCopy } from '../_lib/model-page-specs';
import { serializeJsonLd } from '../../model-jsonld';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelCinematicAsset } from './ModelCinematicAsset';
import { ModelCinematicShotPlan } from './ModelCinematicShotPlan.client';
import { ModelCinematicPricing } from './ModelCinematicPricing';

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
const videoEssentials = new Set(['maxResolution', 'maxDuration', 'aspectRatios', 'referenceImageStyle', 'referenceVideo', 'firstLastFrame', 'audioOutput', 'videoToVideo']);
const moreSpecs = { en: 'All technical details', fr: 'Tous les détails techniques', es: 'Todos los detalles técnicos' };

function SpecRows({ rows, locale }: { rows: KeySpecRow[]; locale: AppLocale }) {
  return <dl className="cinema-spec-grid">{rows.map(row => <div key={row.id}><dt>{row.label}</dt><dd>{(row.valueLines?.length ? row.valueLines : [row.value]).map(value => <span key={value}>{localizeSpecStatus(value, locale)}</span>)}</dd></div>)}</dl>;
}

/** Shares exact commercial/schema data with other pages; owns its own editorial composition. */
export async function ModelCinematicDetails({ pricing, commercial, schema, decision, locale, specTitle, specNote, specSections,
  safetyRules, safetyInterpretation, boundaries, troubleshootingItems, faqList, faqTitle, copy, presentation }: CinematicDetailsProps & { presentation: CinematicPresentation }) {
  const [current, { pricingEngine, scenarios, publicOffer }] = await Promise.all([pricing, commercial]);
  const l = labels[locale];
  const offer = publicOffer ? formatModelPublicOffer(publicOffer, locale) : null;
  const panel = presentation.examples.panels.find(item => item.placement === 'details')!;
  const asset = presentation.assets.find(item => item.id === panel.assetIds[0])!;
  const plan = presentation.examples.shotPlans?.find(item => item.assetId === asset.id);
  const rows = current.keySpecRows.filter(row => !row.id.startsWith('pricePer'));
  const primaryRows = rows.filter(row => presentation.content.variant === 'image' || videoEssentials.has(row.id));
  const secondaryRows = rows.filter(row => !primaryRows.includes(row));
  return <>
    {buildModelSchemaPayloads({ ...schema, pricingEngine, publicOffer }).map((payload, index) => <script key={index} id={`model-jsonld-${index}`} type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }} />)}
    <section id="specs" className="cinema-specs cinema-section"><div className="cinema-wrap">
      <header className="cinema-section-heading"><div><p className="cinema-eyebrow">{schema.heroTitle}</p><h2>{specTitle && specTitle !== 'Specs' ? specTitle : l.specs}</h2></div><p>{specNote}</p></header>
      <div className="cinema-specs-layout"><div className="cinema-settings-proof"><ModelCinematicAsset asset={asset} ui={presentation.ui} compact />
        {plan ? <details className="cinema-disclosure"><summary>{presentation.ui.shotPlan}<span aria-hidden="true">+</span></summary><div><ModelCinematicShotPlan plan={plan} ui={presentation.ui} /></div></details> : null}
      </div><div className="cinema-settings-data">
      <SpecRows rows={primaryRows} locale={locale} />
      {secondaryRows.length ? <details className="cinema-disclosure"><summary>{moreSpecs[locale]}<span aria-hidden="true">+</span></summary><div><SpecRows rows={secondaryRows} locale={locale} /></div></details> : null}
      {specSections.map(section => <details className="cinema-disclosure" key={section.title}><summary>{section.title}<span aria-hidden="true">+</span></summary><div><p>{section.intro}</p><ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul></div></details>)}
      <ModelCinematicPricing pricing={decision.pricing} scenarios={scenarios ?? decision.pricing.scenarios} create={decision.hero.primaryCta} locale={locale} offer={offer} />
    </div></div></div></section>
    <section id="faq" className="cinema-faq cinema-section"><div className="cinema-wrap cinema-faq-grid"><header><p className="cinema-eyebrow">{faqTitle ?? 'FAQ'}</p><h2>{l.faq}</h2><nav id="compare" className="cinema-related-links" aria-label={l.related}><h3>{l.related}</h3>{decision.decisionCards.filter(card => !card.cta.href.endsWith('#prompting')).map(card => <Link key={card.title} href={card.cta.href} prefetch={false}><span>{card.title}</span><span aria-hidden="true">↗</span><small>{card.body}</small></Link>)}</nav></header><div>{faqList.map(entry => <details key={entry.question} className="cinema-disclosure"><summary>{entry.question}<span aria-hidden="true">+</span></summary><div><p>{entry.answer}</p></div></details>)}
      <details id="tips" className="cinema-disclosure"><summary>{l.limits}<span aria-hidden="true">+</span></summary><div><ul>{[...boundaries, ...troubleshootingItems].map(item => <li key={item}>{item}</li>)}</ul></div></details>
      <details id="safety" className="cinema-disclosure"><summary>{copy.safetyTitle ?? l.safety}<span aria-hidden="true">+</span></summary><div><ul>{[...safetyRules, ...safetyInterpretation].map(item => <li key={item}>{item}</li>)}</ul>{copy.safetyNote ? <p>{copy.safetyNote}</p> : null}</div></details>
    </div></div><FAQSchema questions={faqList.slice(0, 6)} /></section>
  </>;
}
