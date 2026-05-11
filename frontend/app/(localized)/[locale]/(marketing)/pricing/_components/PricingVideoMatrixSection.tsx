import { Link } from '@/i18n/navigation';
import type { PresetQuote, PricingHubLink, VideoPricingMatrixData } from '../_lib/pricingHubData';

function PriceCell({ quote }: { quote: PresetQuote }) {
  if (quote.status === 'exact') {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">{quote.display}</span>
        <div className="flex flex-wrap justify-end gap-1">
          {quote.isCheapest ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
              Cheapest
            </span>
          ) : null}
          {quote.note ? (
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-muted">
              {quote.note}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 text-text-muted">
      <span className="font-mono text-sm tabular-nums">—</span>
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
          <Link href={link.href} prefetch={false} className="text-[#356BE8] hover:underline">
            {link.label}
          </Link>
        </span>
      ))}
    </div>
  );
}

export function PricingVideoMatrixSection({ video }: { video: VideoPricingMatrixData }) {
  return (
    <section id="video-pricing" className="rounded-[8px] border border-hairline bg-surface shadow-card">
      <div className="border-b border-hairline p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-text-primary">AI video prices by engine</h2>
            <p className="mt-2 max-w-[780px] text-sm leading-6 text-text-secondary">
              Compare preset MaxVideoAI prices for common video scenarios. Unsupported combinations are marked clearly.
              Open the app for the exact live quote before generation.
            </p>
          </div>
          <Link
            href="/app"
            prefetch={false}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-hairline bg-bg px-4 text-sm font-semibold text-text-primary hover:border-text-muted"
          >
            Live price
          </Link>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {video.highlights.map((highlight) => {
            const body = (
              <div className="min-h-[74px] rounded-[8px] border border-hairline bg-bg p-3">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-text-muted">{highlight.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-text-primary">{highlight.value}</p>
              </div>
            );
            return highlight.href ? (
              <Link key={highlight.label} href={highlight.href} className="block hover:opacity-80">
                {body}
              </Link>
            ) : (
              <div key={highlight.label}>{body}</div>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-20 bg-surface">
            <tr className="text-xs font-semibold uppercase tracking-normal text-text-muted">
              <th className="sticky left-0 z-30 w-[240px] border-b border-hairline bg-surface px-4 py-3">
                Engine / variant
              </th>
              {video.presets.map((preset) => (
                <th key={preset.id} className="w-[130px] border-b border-hairline px-3 py-3 text-right">
                  {preset.label}
                </th>
              ))}
              <th className="w-[180px] border-b border-hairline px-3 py-3">Notes</th>
              <th className="w-[210px] border-b border-hairline px-3 py-3">Links</th>
            </tr>
          </thead>
          <tbody>
            {video.rows.map((row) => (
              <tr key={row.id} id={row.anchorId} className="scroll-mt-24 border-b border-hairline">
                <th className="sticky left-0 z-10 border-b border-hairline bg-surface px-4 py-3 text-left align-top">
                  <div className="text-sm font-semibold leading-5 text-text-primary">{row.engineName}</div>
                  <div className="mt-1 text-xs text-text-muted">{row.variant ?? row.family}</div>
                </th>
                {video.presets.map((preset) => (
                  <td key={preset.id} className="border-b border-hairline px-3 py-3 text-right align-top">
                    <PriceCell quote={row.quotes[preset.id]} />
                  </td>
                ))}
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

      <p className="border-t border-hairline px-5 py-4 text-xs leading-5 text-text-muted sm:px-6">
        Prices are current MaxVideoAI display prices for preset scenarios. The app shows the exact live price before each
        generation.
      </p>
    </section>
  );
}
