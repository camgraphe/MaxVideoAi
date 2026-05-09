import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type {
  BestForDetailCopy,
  BestForEntry,
  RankedPick,
} from '../_lib/best-for-detail-config';
import {
  formatScore,
  getTopPicksTitle,
  pickComparisonSlug,
} from '../_lib/best-for-detail-helpers';

type TopPicksPanelProps = {
  entry: BestForEntry;
  picks: RankedPick[];
  relatedComparisons: string[];
  locale: AppLocale;
  copy: BestForDetailCopy;
};

export function TopPicksPanel({
  entry,
  picks,
  relatedComparisons,
  locale,
  copy,
}: TopPicksPanelProps) {
  const comparisonSlug = pickComparisonSlug(picks, relatedComparisons);

  return (
    <section className="rounded-[18px] border border-hairline bg-surface p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-text-primary">{getTopPicksTitle(locale, entry.slug)}</h2>
        <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-semibold text-text-secondary">
          {copy.tier} {entry.tier}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-[14px] border border-hairline">
        {picks.map((pick) => (
          <div key={pick.slug} className="grid grid-cols-[32px_42px_minmax(0,1fr)_58px] items-center gap-3 border-b border-hairline bg-surface px-3 py-3 last:border-b-0">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-text-primary text-xs font-semibold text-surface">
              {pick.rank}
            </span>
            <EngineIcon
              engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
              size={36}
              rounded="xl"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</p>
              <p className="truncate text-xs font-semibold text-brand">{pick.rank === 1 ? copy.overall : pick.criterion}</p>
              <p className="truncate text-xs text-text-secondary">{pick.reason}</p>
            </div>
            <div className="rounded-[12px] bg-brand/10 px-2 py-2 text-center">
              <p className="text-lg font-semibold tabular-nums text-brand">{formatScore(pick.score)}</p>
              <p className="text-[10px] text-text-muted">{copy.score}</p>
            </div>
          </div>
        ))}
      </div>
      {comparisonSlug ? (
        <Link
          href={{ pathname: '/ai-video-engines/[slug]', params: { slug: comparisonSlug } }}
          className="mt-4 inline-flex items-center gap-2 px-1 text-sm font-semibold text-brand transition hover:text-brandHover"
        >
          {copy.compareShortlistCta}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
