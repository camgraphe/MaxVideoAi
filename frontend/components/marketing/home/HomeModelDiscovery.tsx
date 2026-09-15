import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { HomeExampleCard, ProviderItem, SectionCopy } from './home-redesign-types';

const COPY = {
  en: { title: 'Already have a model in mind?', body: 'Find more videos, prompts and model details for your next idea.' },
  fr: { title: 'Vous avez déjà un modèle en tête ?', body: 'Retrouvez les vidéos, les prompts et les caractéristiques des modèles pour votre prochaine création.' },
  es: { title: '¿Ya tienes un modelo en mente?', body: 'Encuentra más videos, prompts y detalles de los modelos para tu próxima idea.' },
};

export function HomeModelDiscovery({ locale, examples, providers, copy }: {
  locale: AppLocale;
  examples: HomeExampleCard[];
  providers: ProviderItem[];
  copy: SectionCopy & { featuredModelCta: string };
}) {
  const text = COPY[locale];
  const labels = { en: ['Examples', 'Specs & pricing'], fr: ['Exemples', 'Tarifs et détails'], es: ['Ejemplos', 'Detalles y precios'] }[locale];
  const linked = new Set(examples.flatMap(example => [JSON.stringify(example.href), JSON.stringify(example.modelHref)]));
  const extraProviders = providers.filter(provider => provider.href && !linked.has(JSON.stringify(provider.href)));
  return <>
    <div id="explore-models" className="creative-discovery">
      <header><h3>{text.title}</h3></header>
      <div className="creative-discovery-models">
        {examples.map(example => <div key={example.id}>
          <Link href={example.examplesCtaVisible !== false ? example.href : example.modelHref ?? example.href} className="discovery-cover" aria-label={familyLabel(example.engine)}>
            <Image src={example.imageSrc} alt={example.imageAlt} fill sizes="64px" loading="lazy" />
          </Link>
          <strong>{familyLabel(example.engine)}</strong>
          <div>
            {example.examplesCtaVisible !== false ? <Link href={example.href}
              data-analytics-event="example_category_click" data-analytics-cta-name={example.id}
              data-analytics-cta-location="examples_preview_cta" data-analytics-target-family="examples">
              {labels[0]}<span className="sr-only"> — {familyLabel(example.engine)}</span> <span aria-hidden>↗</span>
            </Link> : null}
            <Link href={example.engine.includes('Seedance') ? { pathname: '/models/[slug]', params: { slug: 'seedance-2-5' } } : example.modelHref ?? example.href}
              data-analytics-event="model_card_click" data-analytics-cta-name={example.id}
              data-analytics-cta-location="examples_preview_model" data-analytics-target-family="models">
              {labels[1]}<span className="sr-only"> — {familyLabel(example.engine)}</span> <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>)}
      </div>
      <div className="creative-discovery-more">
        <Link href="/models">{copy.modelsCta}</Link>
        <Link href={{pathname:'/models/[slug]',params:{slug:'seedance-2-5'}}}>{copy.featuredModelCta}</Link>
        <Link href={{pathname:'/examples/[model]',params:{model:'grok'}}}>Grok · {labels[0]}</Link>
        <Link href={{pathname:'/examples/[model]',params:{model:'flux'}}}>Flux · {labels[0]}</Link>
        <Link href={{pathname:'/models/[slug]',params:{slug:'flux-3'}}}>Flux 3 · {labels[1]}</Link>
        {extraProviders.map(provider => <Link key={provider.model} href={provider.href!}>{provider.model}</Link>)}
      </div>
    </div>
  </>;
}

function familyLabel(engine: string) {
  return ['Happy Horse', 'Seedance', 'Kling', 'Veo', 'LTX', 'Wan'].find(name => engine.includes(name)) ?? engine;
}
