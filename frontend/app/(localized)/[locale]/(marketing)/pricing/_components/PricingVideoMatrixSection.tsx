import { ExternalLink, Gem, Grid2X2, Image, Music2, Video, Volume2, WandSparkles, Wrench, Zap } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { PresetQuote, PricingHubLink, VideoPricingMatrixData } from '../_lib/pricingHubData';

const highlightStyles = [
  { icon: Zap, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Volume2, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: WandSparkles, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' },
  { icon: Gem, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200' },
  { icon: Grid2X2, tone: 'bg-blue-50 text-[#356BE8] dark:bg-blue-400/10 dark:text-blue-200' },
] as const;

const surfaceTabs = [
  { label: 'Video', href: '#video-pricing', icon: Video, active: true },
  { label: 'Image', href: '#image-pricing', icon: Image, active: false },
  { label: 'Audio', href: '#audio-pricing', icon: Music2, active: false },
  { label: 'Tools & Upscale', href: '#tool-pricing', icon: Wrench, active: false },
] as const;

function PriceCell({ quote }: { quote: PresetQuote }) {
  if (quote.status === 'exact') {
    return (
      <div className="flex flex-col items-end gap-1">
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            quote.isCheapest ? 'text-emerald-700 dark:text-emerald-200' : 'text-text-primary'
          }`}
        >
          {quote.display}
        </span>
        {quote.isCheapest || quote.note ? (
          <div className="flex flex-wrap justify-end gap-1">
            {quote.isCheapest ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                Cheapest
              </span>
            ) : null}
            {quote.note ? <span className="text-[10px] leading-4 text-text-muted">{quote.note}</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 text-text-muted">
      <span className="text-[13px] tabular-nums">—</span>
      <span className="max-w-[120px] text-right text-[11px] leading-4">
        {quote.closest ? `${quote.closest.label}: ${quote.closest.display}` : quote.note}
      </span>
    </div>
  );
}

function InlineLinks({ links }: { links: PricingHubLink[] }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold">
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

export function PricingVideoMatrixSection({ video }: { video: VideoPricingMatrixData }) {
  return (
    <section id="video-pricing" className="rounded-[8px] border border-hairline bg-surface shadow-card">
      <div className="border-b border-hairline p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {video.highlights.map((highlight, index) => {
            const style = highlightStyles[index] ?? highlightStyles[0];
            const Icon = style.icon;
            const body = (
              <div className="flex min-h-[82px] items-center gap-3 rounded-[8px] border border-hairline bg-bg p-3">
                <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${style.tone}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <span>
                  <span className="block text-[11px] font-semibold text-text-muted">{highlight.label}</span>
                  <span className="mt-1 block text-sm font-semibold leading-5 text-text-primary">{highlight.value}</span>
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
              Compare normalized MaxVideoAI display rates per output second. Unsupported combinations are marked with —.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-muted">
            <span className="inline-flex rounded-[8px] border border-hairline bg-bg p-1">
              <span className="rounded-[6px] bg-surface px-3 py-1.5 text-text-primary shadow-sm">USD</span>
              <span className="px-3 py-1.5">Credits</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Cheapest
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-text-muted/50" />
              Not available
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-surface">
            <tr className="text-xs font-semibold text-text-muted">
              <th className="sticky left-0 z-30 w-[250px] border-b border-hairline bg-surface px-4 py-3">
                Engine / Variant
              </th>
              {video.presets.map((preset) => (
                <th key={preset.id} className="w-[140px] border-b border-hairline px-3 py-3 text-right">
                  <span className="block text-text-primary">{preset.label}</span>
                  <span className="block font-medium">{preset.subLabel}</span>
                </th>
              ))}
              <th className="w-[110px] border-b border-hairline px-3 py-3 text-right">Max duration</th>
              <th className="w-[190px] border-b border-hairline px-3 py-3">Notes</th>
              <th className="w-[210px] border-b border-hairline px-3 py-3">Links</th>
            </tr>
          </thead>
          <tbody>
            {video.rows.map((row) => (
              <tr key={row.id} id={row.anchorId} className="scroll-mt-24">
                <th className="sticky left-0 z-10 border-b border-hairline bg-surface px-4 py-3 text-left align-top">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-[6px] bg-text-primary text-[11px] font-bold text-bg">
                      {row.engineName.slice(0, 1)}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold leading-5 text-text-primary">{row.engineName}</span>
                      <span className="mt-0.5 block text-xs text-text-muted">{row.variant ?? row.family}</span>
                    </span>
                  </div>
                </th>
                {video.presets.map((preset) => (
                  <td key={preset.id} className="border-b border-hairline px-3 py-3 text-right align-top">
                    <PriceCell quote={row.quotes[preset.id]} />
                  </td>
                ))}
                <td className="border-b border-hairline px-3 py-3 text-right align-top text-xs font-semibold text-text-secondary">
                  {row.maxDurationLabel}
                </td>
                <td className="border-b border-hairline px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {row.notes.map((note) => (
                      <span
                        key={note}
                        className="rounded-full border border-hairline bg-bg px-2 py-0.5 text-[11px] font-semibold text-text-secondary"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="border-b border-hairline px-3 py-3 align-top">
                  <InlineLinks links={row.links} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-hairline px-4 py-3 text-xs leading-5 text-text-muted sm:px-5">
        Rates are current MaxVideoAI display prices per output second. The app shows the exact live price before each
        generation, including provider limits, duration rounding and job-level rounding.
      </p>
    </section>
  );
}
