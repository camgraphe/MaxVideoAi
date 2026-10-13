import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { PayAsYouGoHeroData, PayAsYouGoPageData } from '../_lib/payg-page-data';

function QuoteCardFrame({ quote, liveQuote, rows, model, price, context }: {
  quote: PayAsYouGoHeroData['hero']['quote'];
  liveQuote: string;
  rows: ReactNode;
  model: ReactNode;
  price: ReactNode;
  context?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[8px] border border-hairline bg-surface shadow-card">
      <div className="h-1 bg-[linear-gradient(90deg,#14A46C,#1F5EFF)]" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.consoleLabel}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{quote.title}</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-bg text-[#14A46C]">
            <Sparkles className="h-5 w-5" strokeWidth={1.9} />
          </span>
        </div>

        <div data-payg-quote-rows className="mt-5 grid min-h-[258px] content-start gap-2">
          {rows}
        </div>

        <div className="mt-3 rounded-[8px] border border-hairline bg-bg p-3">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.promptLabel}</p>
          <p className="mt-2 text-sm leading-6 text-text-primary">{quote.prompt}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-[8px] border border-hairline bg-bg p-3">
            <span className="block text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.modelLabel}</span>
            <span className="mt-1 block truncate font-semibold text-text-primary">{model}</span>
          </div>
          <div className="rounded-[8px] border border-hairline bg-bg p-3">
            <span className="block text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.exampleCostLabel}</span>
            <span data-payg-quote-amount className="mt-1 grid font-mono font-semibold tabular-nums text-text-primary">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1">{liveQuote}</span>
              <span className="col-start-1 row-start-1">{price}</span>
            </span>
            <span data-payg-quote-context className="mt-1 block min-h-12 sm:min-h-8 text-xs font-semibold text-text-muted">{context}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-[#14A46C]/25 bg-[#14A46C]/[0.08] px-3 py-2.5">
          <span className="text-sm font-semibold text-[#0F7A52]">{quote.chargeRuleLabel}</span>
          <span className="text-right text-sm font-semibold text-[#0F7A52]">{quote.chargeRuleValue}</span>
        </div>
      </div>
    </div>
  );
}

export function PayAsYouGoHeroQuoteCard({ data }: { data: PayAsYouGoPageData }) {
  const { quote } = data.hero;
  return (
    <QuoteCardFrame
      quote={quote}
      liveQuote={data.common.liveQuote}
      model={quote.sampleModelName}
      rows={quote.previewRows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-hairline bg-bg px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <EngineIcon engine={row.engineIcon} imageAlt={`${row.engineName} ${data.common.aiVideoModelAlt}`} size={30} rounded="full" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{row.engineName}</p>
              <p className="text-[11px] uppercase tracking-micro text-text-muted">{row.family}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-text-primary">
            {row.quoteLabel}
          </span>
        </div>
      ))}
      price={quote.sampleCost?.price ?? data.common.liveQuote}
      context={quote.sampleCost?.context}
    />
  );
}

/** Reserve the same card chrome without inventing a model, scenario or price. */
export function PayAsYouGoHeroQuotePending({ data }: { data: PayAsYouGoHeroData }) {
  return (
    <div data-payg-price-pending aria-hidden="true">
      <QuoteCardFrame quote={data.hero.quote} liveQuote={data.common.liveQuote}
        rows={Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 rounded-[8px] border border-hairline bg-bg px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-[30px] w-[30px] rounded-full bg-hairline" />
              <span className="block h-[36.5px] w-24 rounded bg-hairline" />
            </div>
            <span className="h-[26px] w-14 rounded-full bg-hairline" />
          </div>
        ))}
        model={<span className="block h-5 w-24 rounded bg-hairline" />}
        price={<span className="block h-5 w-16 rounded bg-hairline" />}
        context={<span className="block h-8 w-full rounded bg-hairline" />}
      />
    </div>
  );
}
