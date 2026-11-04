import { ArrowRight, ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import { PAYG_CONTAINER_CLASS_NAME, PayAsYouGoSectionHeader, PayAsYouGoSemanticIcon } from './PayAsYouGoSectionPrimitives';

type Props = { data: PayAsYouGoPageData };

export function PayAsYouGoRefundPolicySection({ data }: Props) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} grid gap-6 py-10 lg:grid-cols-[1fr_1fr] lg:gap-16`}>
        <PayAsYouGoSectionHeader title={data.refundPolicy.header.title} intro={data.refundPolicy.short} />
        <div>
          <ul className="space-y-2.5">
            {data.refundPolicy.bullets.map(bullet => <li key={bullet.body} className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
              <PayAsYouGoSemanticIcon id={bullet.icon} className="mt-1 h-4 w-4 shrink-0 text-brand" />{bullet.body}
            </li>)}
          </ul>
          <details className="group/refund mt-4 border-y border-hairline">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
              {data.refundPolicy.disclosure}<ChevronDown aria-hidden className="h-4 w-4 group-open/refund:rotate-180" />
            </summary>
            <p className="pb-4 text-sm leading-6 text-text-secondary">{data.refundPolicy.header.intro}</p>
          </details>
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoFaqSection({ data }: Props) {
  return (
    <section id="payg-questions" className="scroll-mt-20 bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} grid gap-6 py-12 sm:py-16 lg:grid-cols-[.6fr_1.4fr]`}>
        <div className="flex flex-col items-start">
          <PayAsYouGoSectionHeader title={data.faq.title} />
          <Link href="/app" prefetch={false} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-text-primary px-5 text-sm font-semibold text-bg hover:bg-brand">
            {data.hero.primaryCta}<ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
        <div className="divide-y divide-hairline border-y border-hairline">
          {data.faq.items.map(entry => <details key={entry.question} className="group/faq">
            <summary className="cursor-pointer list-none py-4 [&::-webkit-details-marker]:hidden">
              <h3 className="flex items-center justify-between gap-4 text-base font-semibold text-text-primary">
                {entry.question}<ChevronDown aria-hidden className="h-4 w-4 shrink-0 group-open/faq:rotate-180" />
              </h3>
            </summary>
            <p className="max-w-prose pb-5 text-sm leading-6 text-text-secondary">{entry.answer}</p>
          </details>)}
        </div>
      </div>
    </section>
  );
}
