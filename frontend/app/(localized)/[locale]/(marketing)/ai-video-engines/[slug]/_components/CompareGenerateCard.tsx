import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';
import { formatEngineName } from '../_lib/compare-page-helpers';

export function CompareGenerateCard({ canGenerate, entry, fullProfileLabel, generateButtonLabel, generateWithLabel, side }: {
  canGenerate: boolean; entry: EngineCatalogEntry; fullProfileLabel: string;
  generateButtonLabel: string; generateWithLabel: string; side: 'left' | 'right';
}) {
  return <article className="compare-create-card" data-side={side}>
    <div className="compare-create-identity">
      <EngineIcon engine={{ id: entry.engineId, label: formatEngineName(entry), brandId: entry.brandId }} size={36} framed={false} />
      <div><p>{canGenerate ? generateWithLabel : fullProfileLabel}</p><h3>{formatEngineName(entry)}</h3></div>
    </div>
    {canGenerate ? <Link href={`/app?engine=${entry.modelSlug}`} className="compare-create-button">
      {generateButtonLabel}<ArrowRight size={19} aria-hidden="true" />
    </Link> : null}
    <Link href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }} className="compare-create-profile">
      {fullProfileLabel}<ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  </article>;
}
