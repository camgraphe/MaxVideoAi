import Image from 'next/image';
import { getMcpInternalLink } from '@/lib/mcp-internal-links';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import type { ModelDecisionLink } from '../_lib/model-page-decision-data';
import { buildCinematicAlternatives, cinematicDiscoveryCopy } from '../_lib/model-page-cinematic-discovery';
import { CinematicArrow } from './ModelCinematicMarks';

const copy = {
  en: { compare: 'Compare', allModels: 'All models', versions: 'More in this family' },
  fr: { compare: 'Comparer', allModels: 'Tous les modèles', versions: 'Dans la même famille' },
  es: { compare: 'Comparar', allModels: 'Todos los modelos', versions: 'Más de esta familia' },
};

export function ModelCinematicAlternatives({ content, slug, family, quickLinks, locale }: {
  content: NonNullable<ModelCinematicContent['alternatives']>;
  slug: string; family: ModelDecisionLink[]; quickLinks: ModelDecisionLink[]; locale: AppLocale;
}) {
  const links = buildCinematicAlternatives(slug, locale, content.models);
  const familyLinks = family.filter(item => !links.some(link => link.href === item.href));
  const shown = new Set([...links.flatMap(link => [link.href, link.compareHref]), ...familyLinks.map(link => link.href)]
    .filter((href): href is string => Boolean(href)).map(href => href.replace(/^\/(fr|es)\//, '/')));
  const remaining = quickLinks.filter(item => !shown.has(item.href.replace(/^\/(fr|es)\//, '/')));
  const mcpLink = getMcpInternalLink(locale, 'model');
  const l = copy[locale];
  return <nav id="compare" className="cinema-choice-guide" aria-labelledby="cinema-choose-title">
    <h2 id="cinema-choose-title">{content.title}</h2>
    <ul className="cinema-choice-list">{links.map(model => <li key={model.slug}>
      <Link href={model.href} prefetch={false} className="cinema-choice-model" data-analytics-event="cta_click"
        data-analytics-cta-name="choose_model" data-analytics-cta-location="model_related" data-analytics-target-family="models">
        {model.poster ? <Image src={model.poster} alt="" width={268} height={178} sizes="(max-width: 480px) 82px, 134px" loading="lazy" /> : null}
        <span><strong>{model.label}</strong><span>{model.reason}</span></span>
      </Link>
      {model.compareHref ? <Link href={model.compareHref} prefetch={false} className="cinema-choice-vs"
        aria-label={model.comparisonLabel} data-analytics-event="cta_click" data-analytics-cta-name="compare_models"
        data-analytics-cta-location="model_related" data-analytics-target-family="compare">{l.compare}<CinematicArrow /></Link> : null}
    </li>)}</ul>
    {familyLinks.length || remaining.length ? <div className="cinema-choice-versions">{familyLinks.length ? <span>{l.versions}</span> : null}
      {familyLinks.map(link => <Link key={link.href} href={link.href} prefetch={false}>{link.label}</Link>)}
      {remaining.map(link => <Link key={link.href} href={link.href} prefetch={false}>{link.label}</Link>)}
    </div> : null}
    <div className="cinema-choice-directory">
      <Link href="/models" prefetch={false}>{l.allModels}<CinematicArrow /></Link>
      <Link href="/ai-video-engines" prefetch={false}>{cinematicDiscoveryCopy[locale].allComparisons}<CinematicArrow /></Link>
      {mcpLink ? <Link href={mcpLink.href} prefetch={false}>{mcpLink.label}<CinematicArrow /></Link> : null}
    </div>
  </nav>;
}
