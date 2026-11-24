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
import { CompareGalleryReader } from './CompareGalleryReader.client';

export function CompareModelGalleries({ locale, left, right, galleries }: {
  locale: AppLocale; left: EngineCatalogEntry; right: EngineCatalogEntry;
  galleries: { left: CompareGalleryVideo[]; right: CompareGalleryVideo[] };
}) {
  const copy = getCompareEditorialCopy(locale);
  const groups = [['left', left], ['right', right]] as const;
  const videos = groups.flatMap(([side, entry]) =>
    galleries[side].map(({ id, href }) => ({ id, href, engine: entry.modelSlug })),
  );
  return <section className="compare-galleries" id="examples">
    <div className="compare-gallery-heading"><h2>{copy.examples}</h2><p>{copy.galleryNote}</p></div>
    <CompareGalleryReader locale={locale} videos={videos}>
      <div className="compare-gallery-pair">
        {groups.map(([side, entry]) => {
          const name = formatEngineName(entry);
          const originalModels = [...new Set(galleries[side].map(item => item.engineLabel).filter(label => label && label !== name))];
          const originalLabel = locale === 'fr' ? 'Modèles des exemples' : locale === 'es' ? 'Modelos de los ejemplos' : 'Models used in these examples';
          return <article key={entry.modelSlug} aria-label={`${copy.examples} · ${name}`}>
            <h3><EngineIcon engine={{ id: entry.engineId, brandId: entry.brandId, label: name }} size={28} framed={false} />{name}</h3>
            {originalModels.length ? <p>{originalLabel}: {originalModels.join(', ')}</p> : null}
            {galleries[side].length ? <div className="compare-gallery-strip">
              {galleries[side].map(item => <CompareGalleryCard key={item.id} item={item} name={item.engineLabel || name} watchLabel={copy.watch} />)}
            </div> : <p className="compare-gallery-empty">{copy.empty}</p>}
            <Link href={getExamplesHref(entry.modelSlug) ?? '/examples'} prefetch={false} className="compare-gallery-link">{copy.allExamples}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </article>;
        })}
      </div>
    </CompareGalleryReader>
  </section>;
}
