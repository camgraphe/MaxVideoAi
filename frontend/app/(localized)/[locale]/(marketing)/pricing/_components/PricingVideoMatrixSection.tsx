import {
  BadgeCheck,
  ExternalLink,
  Gem,
  Grid2X2,
  Image,
  Music2,
  Sparkles,
  Video,
  Volume2,
  WandSparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { Link } from '@/i18n/navigation';
import type {
  PresetQuote,
  PricingHubLink,
  VideoPricePreset,
  VideoPricingMatrixData,
  VideoPricingRow,
} from '../_lib/pricingHubData';

const highlightStyles = [
  { icon: Zap, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Sparkles, tone: 'bg-blue-50 text-[#356BE8] dark:bg-blue-400/10 dark:text-blue-200' },
  { icon: WandSparkles, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Volume2, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Gem, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200' },
  { icon: Grid2X2, tone: 'bg-blue-50 text-[#356BE8] dark:bg-blue-400/10 dark:text-blue-200' },
] as const;

const surfaceTabs = [
  { label: 'Video', href: '#video-pricing', icon: Video, active: true },
  { label: 'Image', href: '#image-pricing', icon: Image, active: false },
  { label: 'Audio', href: '#audio-pricing', icon: Music2, active: false },
  { label: 'Tools & Upscale', href: '#tool-pricing', icon: Wrench, active: false },
] as const;

const quoteStatusRank: Record<PresetQuote['status'], number> = {
  exact: 0,
  closest: 1,
  live_quote: 2,
  unsupported: 3,
};

function rankRowsForPreset(rows: VideoPricingRow[], preset: VideoPricePreset) {
  return rows
    .filter((row) => row.quotes[preset.id].status !== 'unsupported')
    .sort((left, right) => {
      const leftQuote = left.quotes[preset.id];
      const rightQuote = right.quotes[preset.id];
      return (
        quoteStatusRank[leftQuote.status] - quoteStatusRank[rightQuote.status] ||
        (leftQuote.amountCents ?? Number.POSITIVE_INFINITY) - (rightQuote.amountCents ?? Number.POSITIVE_INFINITY) ||
        left.sortValue - right.sortValue
      );
    });
}

function PriceCell({ quote, canHighlight }: { quote: PresetQuote; canHighlight: boolean }) {
  if (quote.status === 'exact') {
    return (
      <div className="flex min-h-9 flex-col items-end justify-center gap-0.5">
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            quote.isCheapest && canHighlight ? 'text-emerald-700 dark:text-emerald-200' : 'text-text-primary'
          }`}
        >
          {quote.display}
        </span>
        {quote.isCheapest && canHighlight ? (
          <span className="text-[10px] font-semibold uppercase tracking-normal text-emerald-700 dark:text-emerald-200">
            Cheapest
          </span>
        ) : quote.note ? (
          <span className="text-[10px] leading-4 text-text-muted">{quote.note}</span>
        ) : null}
      </div>
    );
  }

  if (quote.status === 'live_quote') {
    return (
      <div className="flex min-h-9 flex-col items-end justify-center gap-0.5">
        <span className="text-[12px] font-semibold text-[#1F5EFF]">Live quote</span>
        {quote.note ? <span className="text-[10px] leading-4 text-text-muted">{quote.note}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-9 flex-col items-end justify-center gap-0.5 text-text-muted">
      <span className="text-[13px] tabular-nums">—</span>
      <span className="max-w-[110px] text-right text-[10px] leading-4">{quote.note}</span>
    </div>
  );
}

function InlineLinks({ links }: { links: PricingHubLink[] }) {
  return (
    <div className="flex flex-nowrap items-center gap-x-2 whitespace-nowrap text-xs font-semibold">
      {links.map((link, index) => (
        <span key={`${link.label}-${link.href}`} className="inline-flex items-center gap-2">
          {index > 0 ? <span className="text-text-muted">·</span> : null}
          <Link href={link.href} prefetch={false} className="inline-flex items-center gap-1 text-[#1F5EFF] hover:underline">
            {link.label}
            {link.label === 'Live price' ? <ExternalLink className="h-3 w-3" strokeWidth={1.8} /> : null}
          </Link>
        </span>
      ))}
    </div>
  );
}

function LeaderboardQuote({ quote }: { quote: PresetQuote }) {
  if (quote.status === 'exact') {
    return <span className="font-semibold tabular-nums text-text-primary">{quote.display}</span>;
  }
  return <span className="font-semibold text-[#1F5EFF]">Live quote</span>;
}

function MobileScenarioLeaderboard({ video }: { video: VideoPricingMatrixData }) {
  const currentRows = video.rows.filter((row) => row.highlightEligible);
  const legacyRows = video.rows.filter((row) => row.pricingGroup === 'legacy');

  return (
    <div className="border-b border-hairline p-4 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">Compare by scenario</h3>
        <Link href="#full-video-pricing-table" className="text-xs font-semibold text-[#1F5EFF] hover:underline">
          View full table
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {video.presets.map((preset) => {
          const rankedCurrentRows = rankRowsForPreset(currentRows, preset).slice(0, 5);
          const rankedLegacyRows = rankRowsForPreset(legacyRows, preset).slice(0, 4);
          return (
            <details
              key={preset.id}
              open={preset.id === '10s-1080p'}
              className="rounded-[8px] border border-hairline bg-bg"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-text-primary">
                <span>
                  {preset.label}
                  <span className="ml-2 text-xs font-medium text-text-muted">{preset.subLabel}</span>
                </span>
                <BadgeCheck className="h-4 w-4 text-text-muted" strokeWidth={1.8} />
              </summary>
              <ol className="border-t border-hairline">
                {rankedCurrentRows.length ? (
                  rankedCurrentRows.map((row, index) => {
                    const quote = row.quotes[preset.id];
                    return (
                      <li key={row.id} className="grid grid-cols-[auto_1fr_auto] gap-3 border-b border-hairline px-3 py-2 last:border-0">
                        <span className="text-xs font-semibold text-text-muted">{index + 1}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-text-primary">{row.engineName}</span>
                          <span className="block truncate text-xs text-text-muted">{quote.note ?? row.notes.join(' · ')}</span>
                        </span>
                        <span className="text-right text-sm">
                          <LeaderboardQuote quote={quote} />
                          <Link
                            href={row.links.find((link) => link.label === 'Live price')?.href ?? '/app'}
                            prefetch={false}
                            className="block text-[11px] font-semibold text-[#1F5EFF]"
                          >
                            Live price
                          </Link>
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-3 py-3 text-sm text-text-muted">No exact route for current-generation engines.</li>
                )}
              </ol>
              {rankedLegacyRows.length ? (
                <details className="border-t border-hairline">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-text-muted">
                    Include previous-generation routes
                  </summary>
                  <ol className="border-t border-hairline">
                    {rankedLegacyRows.map((row) => {
                      const quote = row.quotes[preset.id];
                      return (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2 text-xs last:border-0"
                        >
                          <span className="min-w-0 truncate text-text-secondary">
                            {row.engineName} <span className="text-text-muted">previous-gen</span>
                          </span>
                          <LeaderboardQuote quote={quote} />
                        </li>
                      );
                    })}
                  </ol>
                </details>
              ) : null}
            </details>
          );
        })}
      </div>
    </div>
  );
}

function RowGroup({
  description,
  rows,
  title,
  video,
}: {
  description: string;
  rows: VideoPricingRow[];
  title: string;
  video: VideoPricingMatrixData;
}) {
  return (
    <>
      <tr>
        <td colSpan={video.presets.length + 3} className="border-b border-hairline bg-bg px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-normal text-text-primary">{title}</span>
          <span className="ml-2 text-xs text-text-muted">{description}</span>
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.id} id={row.anchorId} className="h-[52px] scroll-mt-24">
          <th className="sticky left-0 z-10 border-b border-hairline bg-surface px-3 py-2 text-left align-middle">
            <div className="flex items-center gap-2.5">
              <EngineIcon engine={row.engineIcon} label={row.engineName} size={24} rounded="xl" className="rounded-[6px]" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-5 text-text-primary">{row.engineName}</span>
                <span className="block truncate text-[11px] text-text-muted">{row.variant ?? row.family}</span>
              </span>
            </div>
          </th>
          {video.presets.map((preset) => (
            <td key={preset.id} className="border-b border-hairline px-3 py-2 text-right align-middle">
              <PriceCell quote={row.quotes[preset.id]} canHighlight={row.highlightEligible} />
            </td>
          ))}
          <td className="border-b border-hairline px-3 py-2 align-middle text-xs text-text-secondary">
            <span className="block max-w-[220px] truncate">
              {row.limitsLabel}
              <span className="text-text-muted"> · {row.notes.join(' · ')}</span>
            </span>
          </td>
          <td className="border-b border-hairline px-3 py-2 align-middle">
            <InlineLinks links={row.links} />
          </td>
        </tr>
      ))}
    </>
  );
}

export function PricingVideoMatrixSection({ video }: { video: VideoPricingMatrixData }) {
  const recommendedRows = video.rows.filter((row) => row.pricingGroup === 'recommended');
  const legacyRows = video.rows.filter((row) => row.pricingGroup === 'legacy');

  return (
    <section id="video-pricing" className="rounded-[8px] border border-hairline bg-surface shadow-card">
      <div className="border-b border-hairline p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {video.highlights.map((highlight, index) => {
            const style = highlightStyles[index] ?? highlightStyles[0];
            const Icon = style.icon;
            const body = (
              <div className="flex min-h-[78px] items-center gap-3 rounded-[8px] border border-hairline bg-bg p-3">
                <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${style.tone}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-text-muted">{highlight.label}</span>
                  <span className="mt-1 block truncate text-sm font-semibold leading-5 text-text-primary">{highlight.value}</span>
                </span>
              </div>
            );
            return highlight.href ? (
              <Link key={highlight.label} href={highlight.href} className="block hover:opacity-85">
                {body}
              </Link>
            ) : (
              <div key={highlight.label}>{body}</div>
            );
          })}
        </div>
      </div>

      <nav className="overflow-x-auto border-b border-hairline" aria-label="Pricing surfaces">
        <div className="flex min-w-max gap-1 px-4">
          {surfaceTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${
                  tab.active
                    ? 'border-[#1F5EFF] text-[#1F5EFF]'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-b border-hairline p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-normal text-text-primary sm:text-2xl">
              AI video prices by engine
            </h2>
            <p className="mt-1 max-w-[780px] text-sm leading-6 text-text-secondary">
              Compare preset MaxVideoAI total prices for common video scenarios. Unsupported combinations are marked
              clearly. Open the app for the exact live quote before generation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-muted">
            <span className="inline-flex rounded-[8px] border border-hairline bg-bg p-1">
              <span className="rounded-[6px] bg-surface px-3 py-1.5 text-text-primary shadow-sm">USD</span>
              <span className="px-3 py-1.5">Credits</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Cheapest current-gen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-text-muted/50" />
              Not available
            </span>
          </div>
        </div>
      </div>

      <MobileScenarioLeaderboard video={video} />

      <div id="full-video-pricing-table" className="overflow-x-auto">
        <table className="min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-surface">
            <tr className="text-xs font-semibold text-text-muted">
              <th className="sticky left-0 z-30 w-[250px] border-b border-hairline bg-surface px-3 py-3">
                Engine / Variant
              </th>
              {video.presets.map((preset) => (
                <th key={preset.id} className="w-[132px] border-b border-hairline px-3 py-3 text-right">
                  <span className="block text-text-primary">{preset.label}</span>
                  <span className="block font-medium">{preset.subLabel}</span>
                </th>
              ))}
              <th className="w-[240px] border-b border-hairline px-3 py-3">Limits</th>
              <th className="w-[210px] border-b border-hairline px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <RowGroup
              title="Recommended video engines"
              description="Current-generation and recommended routes for new generations."
              rows={recommendedRows}
              video={video}
            />
            {legacyRows.length ? (
              <RowGroup
                title="Previous-generation and budget routes"
                description="Older or budget routes that may still be useful for low-cost tests."
                rows={legacyRows}
                video={video}
              />
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="border-t border-hairline px-4 py-3 text-xs leading-5 text-text-muted sm:px-5">
        Prices are current MaxVideoAI display prices for preset scenarios. Open the app for the exact live price before
        each generation, including provider limits, duration rounding and job-level rounding.
      </p>
    </section>
  );
}
