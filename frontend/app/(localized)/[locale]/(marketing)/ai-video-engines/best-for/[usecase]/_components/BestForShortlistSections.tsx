import { Check, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type {
  BestForDetailCopy,
  EngineCatalogEntry,
  RankedPick,
} from '../_lib/best-for-detail-config';
import {
  findComparisonForPick,
  formatScore,
  getExamplesSlug,
} from '../_lib/best-for-detail-helpers';

export function RankedShortlistCard({
  pick,
  relatedComparisons,
  copy,
}: {
  pick: RankedPick;
  relatedComparisons: string[];
  copy: BestForDetailCopy;
}) {
  const compareSlug = findComparisonForPick(pick.slug, relatedComparisons);
  return (
    <article className="group flex min-h-[20rem] flex-col rounded-[14px] border border-hairline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          {pick.rank === 1 ? copy.topPick : `${copy.rank} ${pick.rank}`}
        </span>
        <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-surface-2 text-base font-semibold tabular-nums text-text-primary">
          {formatScore(pick.score)}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-text-primary text-[11px] font-semibold text-surface">
          {pick.rank}
        </span>
        <EngineIcon
          engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
          size={38}
          rounded="xl"
        />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-text-primary">{pick.engine?.marketingName ?? pick.slug}</h3>
          <p className="truncate text-xs text-text-secondary">{pick.engine?.provider ?? copy.provider}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-micro text-brand">{copy.fit}</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-text-primary">{pick.criterion}</p>
        <div className="mt-3 h-px bg-hairline" />
        <ul className="mt-3 space-y-2">
          {pick.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-5 text-xs font-semibold">
        <Link href={{ pathname: '/models/[slug]', params: { slug: pick.slug } }} className="text-brand transition hover:text-brandHover">
          {copy.viewModel} →
        </Link>
        <Link
          href={{ pathname: '/examples/[model]', params: { model: getExamplesSlug(pick) } }}
          className="text-brand transition hover:text-brandHover"
        >
          {copy.viewExamples} →
        </Link>
        {compareSlug ? (
          <Link href={{ pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug } }} className="text-brand transition hover:text-brandHover">
            {copy.compareWith} →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function AlsoAvailableRow({ models, copy }: { models: EngineCatalogEntry[]; copy: BestForDetailCopy }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-hairline bg-surface-2 px-4 py-3">
      <p className="mr-1 text-xs font-semibold text-text-primary">{copy.alsoAvailable}:</p>
      {models.map((engine) => (
        <Link
          key={engine.modelSlug}
          href={{ pathname: '/models/[slug]', params: { slug: engine.modelSlug } }}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:border-brand/30 hover:text-brand"
        >
          {engine.marketingName}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      ))}
    </div>
  );
}

export function ChooseEngineStrip({ picks, copy }: { picks: RankedPick[]; copy: BestForDetailCopy }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-text-primary">{copy.chooseTitle}</h2>
      <div className="grid overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {picks.map((pick) => (
          <article key={pick.slug} className="border-b border-hairline p-4 last:border-b-0 md:border-r md:last:border-r-0 xl:border-b-0">
            <div className="flex items-center gap-3">
              <EngineIcon
                engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
                size={36}
                rounded="xl"
              />
              <h3 className="font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{pick.reason}</p>
            <p className="mt-4 inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {pick.rank === 1 ? copy.overall : pick.criterion}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
