import { cinematicVideoPromptLinks } from '../_lib/model-page-workflow-proofs';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import type { ModelCommercialData, ModelPagePricing } from '../_lib/model-page-commercial-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { buildModelSchemaPayloads } from '../_lib/model-page-schema-payloads';
import { formatModelPublicOffer } from '../_lib/model-page-offer-display';
import type { SpecSection, SoraCopy } from '../_lib/model-page-specs';
import { serializeJsonLd } from '../../model-jsonld';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelCinematicAsset } from './ModelCinematicAsset';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { ModelCinematicPricing } from './ModelCinematicPricing';
import { ModelCinematicOverview } from './ModelCinematicOverview';
import { buildCinematicSpecRows, cinematicSpecCopy } from '../_lib/model-page-cinematic-specs';
import { ModelCinematicSpecTable } from './ModelCinematicSpecTable';
import { ModelCinematicSpecActions } from './ModelCinematicSpecActions.client';
import { CinematicArrow, CinematicPlus } from './ModelCinematicMarks';
import { buildCinematicFamilyLinks, cinematicDiscoveryCopy } from '../_lib/model-page-cinematic-discovery';

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
const videoEssentials = new Set(['textToVideo', 'imageToVideo', 'maxResolution', 'maxDuration', 'aspectRatios', 'referenceImageStyle', 'referenceVideo', 'firstLastFrame', 'audioOutput', 'videoToVideo']);
const moreSpecs = { en: 'All technical details', fr: 'Tous les détails techniques', es: 'Todos los detalles técnicos' };

/** Shares exact commercial/schema data with other pages; owns its own editorial composition. */
export async function ModelCinematicDetails({ pricing, commercial, schema, decision, locale, specTitle, specNote, specSections,
  safetyRules, safetyInterpretation, boundaries, troubleshootingItems, faqList, faqTitle, copy, presentation }: CinematicDetailsProps & { presentation: CinematicPresentation }) {
  const [current, { pricingEngine, scenarios, publicOffer }] = await Promise.all([pricing, commercial]);
  const l = labels[locale];
  const offer = publicOffer ? formatModelPublicOffer(publicOffer, locale) : null;
  const panel = presentation.examples.panels.find(item => item.placement === 'details')!;
  const asset = presentation.assets.find(item => item.id === panel.assetIds[0])!;
  const plan = presentation.examples.shotPlans?.find(item => item.assetId === asset.id);
  const workflows = presentation.content.workflows;
  const videoDetails = plan && workflows ? <ModelCinematicVideoPrompt title={asset.title}
    prompt={plan.prompt ?? `${presentation.ui.animateFrame} ${plan.motion}\n${presentation.ui.sound}: ${plan.sound}`}
    note={plan.proofNote ?? workflows.promptNote} imageDetailsLabel={workflows.imageDetailsLabel} ui={presentation.ui} asset={asset.video ? undefined : asset} creation={cinematicVideoPromptLinks(presentation.assistantHref, asset.id)} /> : undefined;
  const rows = buildCinematicSpecRows(current.keySpecRows, pricingEngine, locale, presentation.content.variant === 'image');
  const primaryRows = rows.filter(row => presentation.content.variant === 'image' || videoEssentials.has(row.id));
  const secondaryRows = rows.filter(row => !primaryRows.includes(row));
  const detailedSections = presentation.content.variant === 'video' ? specSections : [];
  const specCopy = cinematicSpecCopy[locale];
  const tableTitle = `${schema.heroTitle} — ${specTitle && specTitle !== 'Specs' ? specTitle : l.specs}`;
  const source = `${schema.localizedCanonical}#specs`;
  const related = decision.decisionCards.filter(card => !card.cta.href.endsWith('#prompting'));
  const familyLinks = workflows ? buildCinematicFamilyLinks(presentation.content.modelSlug, locale) : [];
  const discovery = cinematicDiscoveryCopy[locale];
  return <>
    {buildModelSchemaPayloads({ ...schema, pricingEngine, publicOffer }).map((payload, index) => <script key={index} id={`model-jsonld-${index}`} type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }} />)}
    <section id="specs" className="cinema-specs cinema-section"><div className="cinema-wrap">
      <header className="cinema-section-heading cinema-spec-heading"><div><h2>{tableTitle}</h2><p>{specNote}</p></div>
        <ModelCinematicSpecActions title={tableTitle} rows={rows} source={source} locale={locale} slug={presentation.content.modelSlug} />
      </header>
      <div className="cinema-specs-layout"><div className="cinema-settings-proof"><ModelCinematicAsset asset={asset} ui={presentation.ui} compact details={videoDetails} />
      </div><div className="cinema-settings-data">
      <ModelCinematicSpecTable rows={primaryRows} title={tableTitle} locale={locale} />
      {secondaryRows.length || detailedSections.length ? <details className="cinema-disclosure"><summary>{moreSpecs[locale]}<CinematicPlus /></summary><div>
        {secondaryRows.length ? <ModelCinematicSpecTable rows={secondaryRows} title={tableTitle} locale={locale} /> : null}
        {detailedSections.map(section => <div key={section.title}><h3>{section.title}</h3><p>{section.intro}</p><ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul></div>)}
      </div></details> : null}
      <p className="cinema-spec-source">{specCopy.context} <a href={source}>{specCopy.source}: MaxVideoAI</a></p>
      <ModelCinematicOverview presentation={presentation} />
    </div></div></div></section>
    <div className="cinema-next-band"><div className="cinema-wrap cinema-spec-next">
      <ModelCinematicPricing pricing={decision.pricing} scenarios={scenarios ?? decision.pricing.scenarios} create={decision.hero.primaryCta} locale={locale} offer={offer} />
      {related.length || familyLinks.length ? <nav id="compare" className="cinema-related-links" aria-label={specCopy.related}><h3>{familyLinks.length ? discovery.title : specCopy.related}</h3>{related.map(card => <Link key={card.title} href={card.cta.href} prefetch={false} data-analytics-event="cta_click" data-analytics-cta-name="choose_model" data-analytics-cta-location="model_related"><span>{card.title}</span><CinematicArrow /><small>{card.body}</small></Link>)}
        {familyLinks.length ? <div className="cinema-family-links"><p>{discovery.versions}</p><ul>{familyLinks.map(link => <li key={link.href}><Link href={link.href} prefetch={false} data-analytics-event="cta_click" data-analytics-cta-name="choose_model" data-analytics-cta-location="model_related" data-analytics-target-family="models">{link.label}<CinematicArrow /></Link></li>)}</ul></div> : null}
        {workflows ? <Link href="/ai-video-engines" prefetch={false} className="cinema-source-link" data-analytics-event="cta_click" data-analytics-cta-name="all_comparisons" data-analytics-cta-location="model_related" data-analytics-target-family="compare">{discovery.allComparisons}<CinematicArrow /></Link> : null}
      </nav> : null}
    </div></div>
    <section id="faq" className="cinema-faq cinema-section"><div className="cinema-wrap cinema-faq-grid"><header><p className="cinema-eyebrow">{faqTitle ?? 'FAQ'}</p><h2>{l.faq}</h2></header><div>{faqList.map(entry => <details key={entry.question} className="cinema-disclosure"><summary>{entry.question}<CinematicPlus /></summary><div><p>{entry.answer}</p></div></details>)}
      <details id="tips" className="cinema-disclosure"><summary>{l.limits}<CinematicPlus /></summary><div><ul>{[...boundaries, ...troubleshootingItems].map(item => <li key={item}>{item}</li>)}</ul></div></details>
      <details id="safety" className="cinema-disclosure"><summary>{copy.safetyTitle ?? l.safety}<CinematicPlus /></summary><div><ul>{[...safetyRules, ...safetyInterpretation].map(item => <li key={item}>{item}</li>)}</ul>{copy.safetyNote ? <p>{copy.safetyNote}</p> : null}</div></details>
    </div></div><FAQSchema questions={faqList} /></section>
  </>;
}
