import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ContentEntry } from '@/lib/content/markdown';
import type { BestForDetailCopy, BestForEntry, EngineCatalogEntry, ExamplePreviewPick, RankedPick, RelatedGuideEntry } from '../_lib/best-for-detail-config';
import { EDITORIAL_COPY as C } from '../_lib/best-for-editorial-copy';
import { AlsoAvailableRow } from './BestForShortlistSections';
import { BestForContent } from './BestForEditorialPanels';
import { CompareCard, RelatedGuidesCard } from './BestForSidebarCards';
import { ExamplesPreview } from './BestForExamplesPreview';
import { BestForModelChoices } from './BestForModelChoices';
import { BestForCreatePaths } from './BestForCreatePaths';
import './best-for-editorial.css';

type BestForDetailViewProps = {
  alsoAvailable: EngineCatalogEntry[];
  chips: string[];
  content: ContentEntry | null;
  copy: BestForDetailCopy;
  criteria: string[];
  entry: BestForEntry;
  examplePicks: ExamplePreviewPick[];
  heroDescription: string;
  heroTitle: string;
  locale: AppLocale;
  rankedPicks: RankedPick[];
  relatedComparisons: string[];
  relatedGuides: RelatedGuideEntry[];
};

export function BestForDetailView({ alsoAvailable, content, copy, entry, examplePicks, heroDescription, heroTitle, locale, rankedPicks, relatedComparisons, relatedGuides }: BestForDetailViewProps) {
  return <div className="bf-editorial">
    <header className="bf-hero">
      <nav className="bf-breadcrumb" aria-label="Breadcrumb"><Link href="/ai-video-engines/best-for">{copy.eyebrow}</Link><ChevronRight size={13} aria-hidden /><span>{heroTitle}</span></nav>
      <div className="bf-hero-heading"><h1>{heroTitle}</h1><div><p>{heroDescription}</p><a href="#compare-shortlist" className="bf-text-link">{C.choose[locale]}<span aria-hidden>↓</span></a></div></div>
    </header>
    <ExamplesPreview picks={examplePicks} locale={locale} />
    <BestForModelChoices picks={rankedPicks} locale={locale} usecase={entry.slug} />
    <BestForCreatePaths locale={locale} />
    <section className="bf-reading" aria-label={C.details[locale]}>
      <h2>{C.details[locale]}</h2><BestForContent content={content} contentComing={copy.contentComing} />
    </section>
    <div className="bf-next"><CompareCard comparisons={relatedComparisons} copy={copy} /><RelatedGuidesCard guides={relatedGuides} copy={copy} /></div>
    {alsoAvailable.length ? <AlsoAvailableRow models={alsoAvailable} copy={copy} /> : null}
  </div>;
}
