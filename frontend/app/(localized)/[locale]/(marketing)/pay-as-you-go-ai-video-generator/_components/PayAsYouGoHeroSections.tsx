import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import { PAYG_CONTAINER_CLASS_NAME, PayAsYouGoSectionHeader } from './PayAsYouGoSectionPrimitives';

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

function HeroQuoteCard({ data }: PayAsYouGoPageDataProps) {
  const { quote } = data.hero;

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

        <div className="mt-5 grid gap-2">
          {quote.previewRows.map((row) => (
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
        </div>

        <div className="mt-3 rounded-[8px] border border-hairline bg-bg p-3">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.promptLabel}</p>
          <p className="mt-2 text-sm leading-6 text-text-primary">{quote.prompt}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-[8px] border border-hairline bg-bg p-3">
            <span className="block text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.modelLabel}</span>
            <span className="mt-1 block truncate font-semibold text-text-primary">{quote.sampleModelName}</span>
          </div>
          <div className="rounded-[8px] border border-hairline bg-bg p-3">
            <span className="block text-xs font-semibold uppercase tracking-micro text-text-muted">{quote.exampleCostLabel}</span>
            <span className="mt-1 block font-mono font-semibold tabular-nums text-text-primary">
              {quote.sampleCost?.price ?? data.common.liveQuote}
            </span>
            {quote.sampleCost?.context ? (
              <span className="mt-1 block text-xs font-semibold text-text-muted">{quote.sampleCost.context}</span>
            ) : null}
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

export function PayAsYouGoHeroSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <header className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center`}>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-micro text-brand">{data.hero.eyebrow}</p>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.04] tracking-normal text-text-primary sm:text-[54px]">
            {data.hero.title}
          </h1>
          <p className="mt-5 max-w-[760px] text-base leading-7 text-text-secondary sm:text-lg">{data.hero.intro}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              prefetch={false}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-text-primary px-5 text-sm font-semibold text-bg shadow-card transition hover:bg-text-primary/90"
            >
              {data.hero.primaryCta}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            <Link
              href={data.pricing.fullMatrixHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-hairline bg-surface px-5 text-sm font-semibold text-text-primary transition hover:border-text-muted"
            >
              {data.hero.secondaryCta}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.hero.trustItems.map((item) => (
              <span
                key={item}
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 text-[11px] font-semibold text-text-secondary"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#14A46C]" strokeWidth={1.9} />
                {item}
              </span>
            ))}
          </div>
        </div>
        <HeroQuoteCard data={data} />
      </div>
    </header>
  );
}

export function PayAsYouGoNaturalQuestionsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} grid gap-8 py-10 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start`}>
        <div>
          <PayAsYouGoSectionHeader {...data.naturalQuestions.header} />
          <div className="mt-5 rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
            <p className="text-sm font-semibold text-text-primary">{data.naturalQuestions.summaryLead}</p>
            <ul className="mt-3 grid gap-2">
              {data.naturalQuestions.summaryItems.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-text-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.naturalQuestions.items.map((item) => (
            <article key={item.question} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
              <h2 className="text-base font-semibold leading-snug text-text-primary">{item.question}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoModelTestingOrderSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.modelTesting.header} />
        <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.modelTesting.items.map((model, index) => (
            <li key={model.family}>
              <Link
                href={model.href}
                className="group flex h-full gap-4 rounded-[8px] border border-hairline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-bg font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <EngineIcon engine={model.engineIcon} imageAlt={`${model.family} ${data.common.aiVideoModelAlt}`} size={28} rounded="full" />
                    <p className="text-sm font-semibold text-text-primary">{model.family}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{model.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">
          {data.modelTesting.footer}
        </p>
      </div>
    </section>
  );
}
