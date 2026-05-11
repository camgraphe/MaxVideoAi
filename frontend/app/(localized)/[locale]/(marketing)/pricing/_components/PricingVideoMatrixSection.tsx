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
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type {
  PresetQuote,
  PricingHubLink,
  VideoPricePreset,
  VideoPricingMatrixData,
  VideoPricingRow,
} from '../_lib/pricingHubData';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';

const highlightStyles = [
  { icon: Zap, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Sparkles, tone: 'bg-blue-50 text-[#356BE8] dark:bg-blue-400/10 dark:text-blue-200' },
  { icon: WandSparkles, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Volume2, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Gem, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200' },
  { icon: Grid2X2, tone: 'bg-blue-50 text-[#356BE8] dark:bg-blue-400/10 dark:text-blue-200' },
  { icon: Grid2X2, tone: 'bg-blue-50 text-[#356BE8] dark:bg-blue-400/10 dark:text-blue-200' },
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

function PriceCell({
  canHighlight,
  cheapestLabel,
  liveQuoteLabel,
  quote,
}: {
  canHighlight: boolean;
  cheapestLabel: string;
  liveQuoteLabel: string;
  quote: PresetQuote;
}) {
  if (quote.status === 'exact') {
    const isHighlighted = quote.isCheapest && canHighlight;
    return (
      <div
        className={`inline-flex min-h-8 flex-col items-end justify-center gap-0.5 rounded-[6px] px-1.5 ${
          isHighlighted ? 'bg-emerald-50/80 dark:bg-emerald-400/10' : ''
        }`}
        title={isHighlighted ? cheapestLabel : quote.rateDisplay}
      >
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            isHighlighted ? 'text-emerald-700 dark:text-emerald-200' : 'text-text-primary'
          }`}
        >
          {isHighlighted ? <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" /> : null}
          {quote.display}
        </span>
        {quote.note && !isHighlighted ? (
          <span className="text-[10px] leading-4 text-text-muted">{quote.note}</span>
        ) : null}
      </div>
    );
  }

  if (quote.status === 'live_quote') {
    return (
      <div className="flex min-h-9 flex-col items-end justify-center gap-0.5">
        <span className="text-[12px] font-semibold text-[#1F5EFF]">{liveQuoteLabel}</span>
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

function InlineLinks({
  links,
  livePriceLabel,
  moreLabel,
}: {
  links: PricingHubLink[];
  livePriceLabel: string;
  moreLabel: string;
}) {
  const liveLink = links.find((link) => link.label === livePriceLabel) ?? links[links.length - 1];
  const secondaryLinks = links.filter((link) => link !== liveLink);
  return (
    <div className="relative flex flex-nowrap items-center gap-x-1.5 whitespace-nowrap text-[11px] font-semibold">
      {liveLink ? (
        <Link href={liveLink.href} prefetch={false} className="inline-flex items-center gap-1 text-[#1F5EFF] hover:underline">
          {livePriceLabel}
          <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
        </Link>
      ) : null}
      {secondaryLinks.length ? (
        <>
          <span className="text-text-muted">·</span>
          <details className="group relative inline-block">
            <summary className="cursor-pointer list-none text-text-muted transition hover:text-text-primary [&::-webkit-details-marker]:hidden">
              {moreLabel}
            </summary>
            <span className="absolute right-0 top-full z-30 mt-1 hidden min-w-28 flex-col gap-1 rounded-[8px] border border-hairline bg-surface p-2 text-left shadow-card group-open:flex">
              {secondaryLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  prefetch={false}
                  className="text-text-secondary hover:text-[#1F5EFF] hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </span>
          </details>
        </>
      ) : null}
    </div>
  );
}

function LeaderboardQuote({ liveQuoteLabel, quote }: { liveQuoteLabel: string; quote: PresetQuote }) {
  if (quote.status === 'exact') {
    return <span className="font-semibold tabular-nums text-text-primary">{quote.display}</span>;
  }
  return <span className="font-semibold text-[#1F5EFF]">{liveQuoteLabel}</span>;
}

function MobileScenarioLeaderboard({ locale, video }: { locale: AppLocale; video: VideoPricingMatrixData }) {
  const copy = getPricingHubCopy(locale);
  const currentRows = video.rows.filter((row) => row.highlightEligible);
  const legacyRows = video.rows.filter((row) => row.pricingGroup === 'legacy');

  return (
    <div className="border-b border-hairline p-4 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">{copy.video.mobile.title}</h3>
        <Link href="#full-video-pricing-table" className="text-xs font-semibold text-[#1F5EFF] hover:underline">
          {copy.video.mobile.viewFullTable}
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
                  <span className="ml-2 text-xs font-medium text-text-muted">
                    {copy.video.presetSubLabels[preset.id] ?? preset.subLabel}
                  </span>
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
                          <LeaderboardQuote quote={quote} liveQuoteLabel={copy.liveQuote} />
                          <Link
                            href={row.links.find((link) => link.label === copy.links.livePrice)?.href ?? '/app'}
                            prefetch={false}
                            className="block text-[11px] font-semibold text-[#1F5EFF]"
                          >
                            {copy.links.livePrice}
                          </Link>
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-3 py-3 text-sm text-text-muted">{copy.video.mobile.noExactCurrentGen}</li>
                )}
              </ol>
              {rankedLegacyRows.length ? (
                <details className="border-t border-hairline">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-text-muted">
                    {copy.video.mobile.includeLegacy}
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
                            {row.engineName} <span className="text-text-muted">{copy.video.mobile.previousGen}</span>
                          </span>
                          <LeaderboardQuote quote={quote} liveQuoteLabel={copy.liveQuote} />
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
  locale,
  description,
  rows,
  title,
  video,
}: {
  locale: AppLocale;
  description: string;
  rows: VideoPricingRow[];
  title: string;
  video: VideoPricingMatrixData;
}) {
  const copy = getPricingHubCopy(locale);
  return (
    <>
      <tr>
        <td colSpan={video.presets.length + 3} className="border-b border-hairline bg-bg px-4 py-2">
          <span className="text-xs font-semibold tracking-normal text-text-primary">{title}</span>
          <span className="ml-2 text-xs text-text-muted">{description}</span>
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.id} id={row.anchorId} className="h-[50px] scroll-mt-24">
          <th className="sticky left-0 z-10 border-b border-hairline bg-surface px-3 py-1.5 text-left align-middle">
            <div className="flex items-center gap-2.5">
              <EngineIcon engine={row.engineIcon} label={row.engineName} size={24} rounded="xl" className="rounded-[6px]" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-5 text-text-primary">{row.engineName}</span>
                <span className="block truncate text-[11px] text-text-muted">{row.variant ?? row.family}</span>
              </span>
            </div>
          </th>
          {video.presets.map((preset) => (
            <td key={preset.id} className="border-b border-hairline px-2 py-1.5 text-right align-middle">
              <PriceCell
                quote={row.quotes[preset.id]}
                canHighlight={row.highlightEligible}
                cheapestLabel={copy.priceCellCheapest}
                liveQuoteLabel={copy.liveQuote}
              />
            </td>
          ))}
          <td className="border-b border-hairline px-3 py-1.5 align-middle text-[11px] text-text-secondary">
            <span className="block max-w-[180px] truncate" title={row.limitsLabel}>{row.limitsLabel}</span>
          </td>
          <td className="border-b border-hairline px-3 py-1.5 align-middle">
            <InlineLinks links={row.links} livePriceLabel={copy.links.livePrice} moreLabel={copy.links.more} />
          </td>
        </tr>
      ))}
    </>
  );
}

export function PricingVideoMatrixSection({ locale, video }: { locale: AppLocale; video: VideoPricingMatrixData }) {
  const copy = getPricingHubCopy(locale);
  const recommendedRows = video.rows.filter((row) => row.pricingGroup === 'recommended');
  const legacyRows = video.rows.filter((row) => row.pricingGroup === 'legacy');
  const surfaceTabs = [
    { label: copy.video.tabs.video, href: '#video-pricing', icon: Video, active: true },
    { label: copy.video.tabs.image, href: '#image-pricing', icon: Image, active: false },
    { label: copy.video.tabs.audio, href: '#audio-pricing', icon: Music2, active: false },
    { label: copy.video.tabs.tools, href: '#tool-pricing', icon: Wrench, active: false },
  ] as const;

  return (
    <section id="video-pricing" className="scroll-mt-24 space-y-3 sm:scroll-mt-28">
      <div>
        <div className="grid auto-rows-fr items-stretch gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {video.highlights.map((highlight, index) => {
            const style = highlightStyles[index] ?? highlightStyles[0];
            const Icon = style.icon;
            const body = (
              <div className="flex h-full min-h-[76px] items-center gap-3 rounded-[8px] border border-hairline bg-surface px-3 py-2.5 shadow-card">
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${style.tone}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-text-muted">{highlight.label}</span>
                  <span className="mt-1 block text-[13px] font-semibold leading-4 text-text-primary">{highlight.value}</span>
                </span>
              </div>
            );
            return highlight.href ? (
              <Link key={highlight.label} href={highlight.href} className="block h-full hover:opacity-85">
                {body}
              </Link>
            ) : (
              <div key={highlight.label} className="h-full">
                {body}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[8px] border border-hairline bg-surface shadow-card">
        <nav className="overflow-x-auto border-b border-hairline" aria-label={copy.video.ariaTabs}>
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
              {copy.video.title}
            </h2>
            <p className="mt-1 max-w-[780px] text-sm leading-6 text-text-secondary">
              {copy.video.intro}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-muted">
            <span className="inline-flex items-center rounded-[8px] border border-hairline bg-bg px-3 py-1.5 text-text-primary">
              {copy.video.currencyLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {copy.video.cheapestCurrentGen}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
      <div id="full-video-pricing-table" className="order-2 scroll-mt-24 overflow-x-auto md:order-1">
        <table className="min-w-[1220px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-surface">
            <tr className="text-xs font-semibold text-text-muted">
              <th className="sticky left-0 z-30 w-[250px] border-b border-hairline bg-surface px-3 py-2.5">
                {copy.video.tableHeaders.engine}
              </th>
              {video.presets.map((preset) => (
                <th key={preset.id} className="w-[118px] border-b border-hairline px-2 py-2.5 text-right">
                  <span className="block text-text-primary">{preset.label}</span>
                  <span className="block font-medium">{copy.video.presetSubLabels[preset.id] ?? preset.subLabel}</span>
                </th>
              ))}
              <th className="w-[190px] border-b border-hairline px-3 py-2.5">{copy.video.tableHeaders.caps}</th>
              <th className="w-[140px] border-b border-hairline px-3 py-2.5">{copy.video.tableHeaders.actions}</th>
            </tr>
          </thead>
          <tbody>
            <RowGroup
              locale={locale}
              title={copy.video.groups.recommendedTitle}
              description={copy.video.groups.recommendedDescription}
              rows={recommendedRows}
              video={video}
            />
            {legacyRows.length ? (
              <RowGroup
                locale={locale}
                title={copy.video.groups.legacyTitle}
                description={copy.video.groups.legacyDescription}
                rows={legacyRows}
                video={video}
              />
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="order-1 md:order-2">
        <MobileScenarioLeaderboard video={video} locale={locale} />
      </div>
      </div>

      <p className="border-t border-hairline px-4 py-3 text-xs leading-5 text-text-muted sm:px-5">
        {copy.video.globalNote}
      </p>
      </div>
    </section>
  );
}
