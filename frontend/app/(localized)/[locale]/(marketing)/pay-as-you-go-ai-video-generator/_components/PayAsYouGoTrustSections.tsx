import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import {
  PAYG_CONTAINER_CLASS_NAME,
  PayAsYouGoSectionHeader,
  PayAsYouGoSemanticIcon,
} from './PayAsYouGoSectionPrimitives';

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

export function PayAsYouGoRefundPolicySection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.refundPolicy.header} />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {data.refundPolicy.bullets.map((bullet) => (
            <div key={bullet.body} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
              <PayAsYouGoSemanticIcon id={bullet.icon} className="h-5 w-5 text-[#1F5EFF]" />
              <p className="mt-3 text-sm leading-6 text-text-secondary">{bullet.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoFaqSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader title={data.faq.title} />
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
