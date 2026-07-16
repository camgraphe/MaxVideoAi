import { CheckCircle2 } from 'lucide-react';
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
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.workflow.header} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.workflow.items.map((item, index) => (
            <article key={item.title} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-text-primary text-sm font-semibold text-bg">
                  {index + 1}
                </span>
                <PayAsYouGoSemanticIcon id={item.icon} className="h-5 w-5 text-[#1F5EFF]" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
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
