import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
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
    <div className="text-text-primary">
      <p className="text-xs font-semibold uppercase tracking-micro text-brand">{quote.consoleLabel}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="sr-only">{quote.exampleCostLabel}</span>
        <span data-payg-quote-amount className="grid font-mono text-xl font-semibold tabular-nums">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">{liveQuote}</span>
          <span className="col-start-1 row-start-1">{price}</span>
        </span>
        <span className="min-h-6 text-base font-semibold"><span className="sr-only">{quote.modelLabel} </span>{model}</span>
      </div>
      <p data-payg-quote-context className="mt-1 block min-h-6 text-sm text-text-secondary">{context}</p>
      <details className="group mt-1 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden">
          {quote.detailsLabel}<ChevronDown aria-hidden className="h-4 w-4 group-open:rotate-180" />
        </summary>
        <div className="grid gap-5 rounded-lg border border-hairline bg-surface p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.promptLabel}</p>
            <p className="mt-2 text-sm leading-6">{quote.prompt}</p>
            <p className="mt-3 text-sm text-text-secondary">{quote.chargeRuleLabel} · {quote.chargeRuleValue}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.title}</p>
            <div data-payg-quote-rows className="grid content-start gap-1">{rows}</div>
          </div>
        </div>
      </details>
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
              <p className="break-words text-sm font-semibold text-text-primary">{row.engineName}</p>
              <p className="text-xs text-text-secondary">{row.quoteContext ?? row.family}</p>
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
    <div data-payg-price-pending inert aria-hidden="true">
      <QuoteCardFrame quote={data.hero.quote} liveQuote={data.common.liveQuote}
        rows={null}
        model={<span className="block h-5 w-24 rounded bg-hairline" />}
        price={<span className="block h-5 w-16 rounded bg-hairline" />}
        context={<span className="block h-5 w-32 rounded bg-hairline" />}
      />
    </div>
  );
}
