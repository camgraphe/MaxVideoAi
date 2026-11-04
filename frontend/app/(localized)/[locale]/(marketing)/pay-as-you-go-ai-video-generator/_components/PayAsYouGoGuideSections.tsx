import { getImageProps } from 'next/image';
import { CheckCircle2, Clapperboard, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import {
  PAYG_CONTAINER_CLASS_NAME,
  PayAsYouGoSectionHeader,
  PayAsYouGoSemanticIcon,
} from './PayAsYouGoSectionPrimitives';

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

export function PayAsYouGoMeaningSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} grid gap-8 py-12 lg:grid-cols-[0.95fr_1.05fr]`}>
        <div>
          <PayAsYouGoSectionHeader title={data.meaning.title} intro={data.meaning.body} />
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
          <PayAsYouGoSectionHeader title={data.noSubscription.title} intro={data.noSubscription.body} />
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

export function PayAsYouGoAudienceFitSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
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

export function PayAsYouGoSubscriptionComparisonSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.subscriptionComparison.header} />
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

export function PayAsYouGoWorkflowSection({ data }: PayAsYouGoPageDataProps) {
  const { workspace } = data.workflow;
  const desktop = getImageProps({
    src: '/assets/marketing/redesign/app-desktop-light-wide.webp',
    alt: workspace.alt, width: 1344, height: 840, sizes: '(min-width: 1024px) 54vw, 90vw',
  }).props;
  const mobile = getImageProps({
    src: '/assets/marketing/redesign/app-mobile-light-framed.webp',
    alt: workspace.alt, width: 378, height: 794, sizes: '90vw',
  }).props;
  return (
    <section data-payg-workflow="" className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-10 sm:py-14`}>
        <PayAsYouGoSectionHeader {...data.workflow.header} />
        <div className="mt-6 grid items-center gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
          <ol className="divide-y divide-hairline border-y border-hairline">
            {data.workflow.items.map((item, index) => (
              <li key={item.title} className="grid grid-cols-[2rem_1fr] gap-3 py-4">
                <span aria-hidden className="pt-0.5 font-mono text-sm tabular-nums text-brand">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <figure className="min-w-0">
            <div className="rounded-xl border border-hairline bg-surface-2 p-3 sm:p-5">
              <picture className="block aspect-[1.35] overflow-hidden rounded-md border border-hairline sm:aspect-[8/5]">
                <source media="(max-width: 639px)" srcSet={mobile.srcSet} sizes={mobile.sizes} width={378} height={794} />
                {/* Art direction shows the actual mobile composer and price at a readable scale. */}
                <img {...desktop} alt={workspace.alt} className="h-full w-full object-cover object-bottom sm:object-contain" />
              </picture>
            </div>
            <figcaption className="mt-3 text-sm leading-5 text-text-secondary">{workspace.caption}</figcaption>
          </figure>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {([
            [data.workflow.assistance.milo, '/ai-video-prompt-generator', Sparkles],
            [data.workflow.assistance.studio, '/studio', Clapperboard],
          ] as const).map(([item, href, Icon]) => (
            <div key={href} className="flex items-start gap-3 border-t border-hairline pt-5">
              <Icon aria-hidden className="mt-1 h-5 w-5 shrink-0 text-text-secondary" />
              <div>
                <Link href={href} prefetch={false} className="font-semibold text-text-primary underline underline-offset-4">{item.title}</Link>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoMcpPlanningSection({ data }: PayAsYouGoPageDataProps) {
  if (!data.mcpPlanning) return null;
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold tracking-normal text-text-primary">{data.mcpPlanning.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{data.mcpPlanning.body}</p>
        </div>
        <Link href={data.mcpPlanning.href} className="shrink-0 text-sm font-semibold text-brand hover:text-brandHover">
          {data.mcpPlanning.label} →
        </Link>
      </div>
    </section>
  );
}

export function PayAsYouGoQuoteFactorsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.quoteFactors.header} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.quoteFactors.items.map((item) => (
            <article key={item.title} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
              <PayAsYouGoSemanticIcon id={item.icon} className="h-5 w-5 text-[#14A46C]" />
              <h3 className="mt-4 text-sm font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
