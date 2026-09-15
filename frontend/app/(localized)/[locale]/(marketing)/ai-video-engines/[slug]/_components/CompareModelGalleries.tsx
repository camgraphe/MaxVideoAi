import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { getExamplesHref } from '@/lib/examples-links';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { formatEngineName } from '../_lib/compare-page-helpers';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';
import type { CompareGalleryVideo } from '../_lib/compare-gallery-data';
import { getCompareEditorialCopy } from '../_lib/compare-editorial-copy';
import { CompareGalleryCard } from './CompareGalleryCard.client';

export function CompareModelGalleries({ locale, left, right, galleries, returnPath }: {
  locale: AppLocale; left: EngineCatalogEntry; right: EngineCatalogEntry;
  galleries: { left: CompareGalleryVideo[]; right: CompareGalleryVideo[] }; returnPath: string;
}) {
  const copy = getCompareEditorialCopy(locale);
  return <section className="compare-galleries" id="examples">
    <div className="compare-gallery-heading"><h2>{copy.examples}</h2><p>{copy.galleryNote}</p></div>
    <div className="compare-gallery-pair">
      {([['left', left], ['right', right]] as const).map(([side, entry]) => {
        const name = formatEngineName(entry);
        return <article key={entry.modelSlug} aria-label={`${copy.examples} · ${name}`}>
          <h3><EngineIcon engine={{ id: entry.engineId, brandId: entry.brandId, label: name }} size={28} framed={false} />{name}</h3>
          {galleries[side].length ? <div className="compare-gallery-strip">
            {galleries[side].map(item => <CompareGalleryCard key={item.id} locale={locale} item={item} name={name} watchLabel={copy.watch} returnPath={returnPath} />)}
          </div> : <p className="compare-gallery-empty">{copy.empty}</p>}
          <Link href={getExamplesHref(entry.modelSlug) ?? '/examples'} prefetch={false} className="compare-gallery-link">{copy.allExamples}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </article>;
      })}
    </div>
  </section>;
}
