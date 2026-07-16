import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  Eye,
  Film,
  Layers3,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { AppLocale } from '@/i18n/locales';
import { PayAsYouGoVideoShowcase } from './PayAsYouGoVideoShowcase';
import type { PaygIconId } from '../_content/types';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';

type PayAsYouGoPageViewProps = {
  locale: AppLocale;
  data: PayAsYouGoPageData;
  showcaseVideos: PayAsYouGoShowcaseVideo[];
};

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

const containerClassName = 'container-page max-w-[1220px]';

const ICONS_BY_ID: Record<PaygIconId, LucideIcon> = {
  model: Layers3,
  engine: SlidersHorizontal,
  preview: Eye,
  video: Film,
  refund: RotateCcw,
  duration: Film,
  resolution: Sparkles,
  audio: BadgeDollarSign,
  credits: CreditCard,
};

function SectionHeader({
  eyebrow,
  title,
  intro,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-micro text-brand">{eyebrow}</p> : null}
      <h2 className="mt-3 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">{title}</h2>
      {intro ? <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">{intro}</p> : null}
    </div>
  );
}

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

function HeroSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <header className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center`}>
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

function NaturalQuestionsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} grid gap-8 py-10 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start`}>
        <div>
          <SectionHeader {...data.naturalQuestions.header} />
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

function ModelTestingOrderSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader {...data.modelTesting.header} />
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

function AudienceFitSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.audienceFit.cards.map((card) => (
            <article key={card.title} className="rounded-[8px] border border-hairline bg-bg p-5 shadow-sm sm:p-6">
              <h2 className="text-2xl font-semibold tracking-normal text-text-primary">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">{card.body}</p>
              <ul className="mt-5 grid gap-2">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2 text-sm leading-6 text-text-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MeaningSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} grid gap-8 py-12 lg:grid-cols-[0.95fr_1.05fr]`}>
        <div>
          <SectionHeader title={data.meaning.title} intro={data.meaning.body} />
          <ul className="mt-5 grid gap-2">
            {data.meaning.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-sm leading-6 text-text-secondary">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHeader title={data.noSubscription.title} intro={data.noSubscription.body} />
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {data.noSubscription.cards.map((card) => (
              <article key={card.title} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SubscriptionComparisonSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader {...data.subscriptionComparison.header} />
        <div className="mt-6 overflow-x-auto rounded-[8px] border border-hairline bg-bg shadow-card">
          <table className="min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                {data.subscriptionComparison.columns.map((column) => (
                  <th key={column} className="px-4 py-3">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.subscriptionComparison.rows.map((row) => (
                <tr key={row.label} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-4 font-semibold text-text-primary">{row.label}</td>
                  <td className="px-4 py-4 text-text-secondary">{row.payg}</td>
                  <td className="px-4 py-4 text-text-secondary">{row.subscription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader {...data.workflow.header} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.workflow.items.map((step, index) => {
            const Icon = ICONS_BY_ID[step.icon];
            return (
              <article key={step.title} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-text-primary text-sm font-semibold text-bg">
                    {index + 1}
                  </span>
                  <Icon className="h-5 w-5 text-[#1F5EFF]" strokeWidth={1.9} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{step.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QuoteFactorsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader {...data.quoteFactors.header} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.quoteFactors.items.map((factor) => {
            const Icon = ICONS_BY_ID[factor.icon];
            return (
              <article key={factor.title} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
                <Icon className="h-5 w-5 text-[#14A46C]" strokeWidth={1.9} />
                <h3 className="mt-4 text-sm font-semibold text-text-primary">{factor.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{factor.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricePerModelSection({ data }: PayAsYouGoPageDataProps) {
  const priceHeaders = data.pricing.rows[0]?.priceCells ?? [];

  return (
    <section id="compare-price-per-model" className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader {...data.pricing.header} />
          <Link href={data.pricing.fullMatrixHref} className="text-sm font-semibold text-[#1F5EFF] transition hover:underline">
            {data.pricing.fullMatrixLabel}
          </Link>
        </div>
        <div className="mt-6 overflow-x-auto rounded-[8px] border border-hairline bg-surface shadow-card">
          <table className="min-w-[840px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="px-4 py-3">{data.pricing.columns.model}</th>
                <th className="px-4 py-3">{data.pricing.columns.bestFor}</th>
                {priceHeaders.map((cell) => (
                  <th key={cell.label} className="px-4 py-3 text-right">
                    {cell.label}
                  </th>
                ))}
                <th className="px-4 py-3">{data.pricing.columns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.pricing.rows.map((row) => (
                <tr key={row.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <EngineIcon engine={row.engineIcon} imageAlt={`${row.engineName} ${data.common.aiVideoModelAlt}`} size={34} rounded="full" />
                      <div>
                        <p className="font-semibold text-text-primary">{row.engineName}</p>
                        <p className="text-xs text-text-muted">{row.family}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[270px] px-4 py-3 text-text-secondary">{row.bestFor}</td>
                  {row.priceCells.map((cell) => (
                    <td key={`${row.id}-${cell.label}`} className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold tabular-nums text-text-primary">{cell.displayValue}</span>
                      {cell.note ? <span className="block text-[11px] text-text-muted">{cell.note}</span> : null}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {row.modelHref ? (
                        <Link href={row.modelHref} className="text-xs font-semibold text-[#1F5EFF] hover:underline">
                          {data.pricing.modelLinkLabel}
                        </Link>
                      ) : null}
                      {row.compareHref ? (
                        <Link href={row.compareHref} className="text-xs font-semibold text-[#1F5EFF] hover:underline">
                          {data.pricing.compareLinkLabel}
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PriceLookupShortcutsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader {...data.priceLookups.header} />
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.priceLookups.items.map((lookup) => (
            <Link
              key={lookup.id}
              href={lookup.href}
              className="group flex min-h-[220px] flex-col rounded-[8px] border border-hairline bg-bg p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <EngineIcon engine={lookup.engineIcon} imageAlt={`${lookup.engineIcon.label} ${data.common.aiVideoModelAlt}`} size={36} rounded="full" />
                <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-text-primary">
                  {lookup.price}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-micro text-text-muted">{lookup.query}</p>
              <h3 className="mt-2 text-base font-semibold leading-snug text-text-primary">{lookup.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{lookup.body}</p>
              {lookup.modelHref ? (
                <span className="mt-auto pt-4 text-xs font-semibold text-[#1F5EFF] group-hover:underline">{data.priceLookups.openRowLabel}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExampleCostsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader {...data.exampleCosts.header} />
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.exampleCosts.items.map((cost) => (
            <Link key={cost.label} href={cost.href} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm transition hover:border-text-muted">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{cost.label}</p>
              <p className="mt-3 text-sm font-semibold text-text-primary">{cost.engine}</p>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{cost.price}</p>
              <p className="mt-1 text-xs font-semibold text-text-muted">{cost.context}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function RefundPolicySection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader {...data.refundPolicy.header} />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {data.refundPolicy.bullets.map((bullet) => {
            const Icon = ICONS_BY_ID[bullet.icon];
            return (
              <div key={bullet.body} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
                <Icon className="h-5 w-5 text-[#1F5EFF]" strokeWidth={1.9} />
                <p className="mt-3 text-sm leading-6 text-text-secondary">{bullet.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader title={data.faq.title} />
        <div className="mt-6 divide-y divide-hairline rounded-[8px] border border-hairline bg-bg px-5 shadow-sm">
          {data.faq.items.map((entry) => (
            <article key={entry.question} className="py-5 first:pt-5 last:pb-5">
              <h3 className="text-base font-semibold text-text-primary">{entry.question}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{entry.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoPageView({ locale, data, showcaseVideos }: PayAsYouGoPageViewProps) {
  return (
    <main className="bg-bg">
      <HeroSection data={data} />
      <PayAsYouGoVideoShowcase videos={showcaseVideos} locale={locale} />
      <NaturalQuestionsSection data={data} />
      <ModelTestingOrderSection data={data} />
      <MeaningSection data={data} />
      <AudienceFitSection data={data} />
      <SubscriptionComparisonSection data={data} />
      <WorkflowSection data={data} />
      <QuoteFactorsSection data={data} />
      <PricePerModelSection data={data} />
      <PriceLookupShortcutsSection data={data} />
      <ExampleCostsSection data={data} />
      <RefundPolicySection data={data} />
      <FaqSection data={data} />
    </main>
  );
}
