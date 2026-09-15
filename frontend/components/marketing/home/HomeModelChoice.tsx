import { Link } from '@/i18n/navigation';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import type { HomeComparisonData } from './home-comparison-types';
import type { AppLocale } from '@/i18n/locales';
import { HomeComparisonSection } from './HomeComparisonSection';
import { StartupFameLink } from './HomeStartupFameLink';

export function HomeModelChoice({ locale, scores, startupFameLabel, comparisons }: {
  locale: AppLocale; startupFameLabel: string;
  scores: HomeComparisonData;
  comparisons: Array<{slug:string;title:string}>;
}) {
  return <div className="home-choice home-choice-compact section"><div className="container-page">
    <HomeComparisonSection locale={locale} scores={scores}/>
    <details className="home-comparison-directory"><summary>{locale === 'fr' ? 'D’autres comparatifs pour choisir' : locale === 'es' ? 'Más comparaciones para elegir' : 'More comparisons to help you choose'}</summary><div>{comparisons.filter(item => isPublishedComparisonSlug(item.slug)).map(item => <Link key={item.slug} href={{pathname:'/ai-video-engines/[slug]',params:{slug:item.slug}}}>{item.title} <span aria-hidden>↗</span></Link>)}</div></details>
    <div className="choice-attribution"><StartupFameLink label={startupFameLabel}/></div>
  </div></div>;
}
