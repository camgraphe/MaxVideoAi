import { BarChart3, CheckCircle2, ShieldCheck, WalletCards, type LucideIcon } from 'lucide-react';
import { FlagPill } from '@/components/FlagPill';

const REFUND_FEATURE_ICONS: LucideIcon[] = [ShieldCheck, WalletCards, CheckCircle2];

type RefundFeatureItem = {
  text: string;
  live: boolean;
};

type FaqEntry = {
  question: string;
  answer: string;
};

type PricingRefundsFaqSectionProps = {
  comingSoonLabel: string;
  faq: {
    title: string;
  };
  faqEntries: FaqEntry[];
  liveLabel: string;
  refundFeatureItems: readonly RefundFeatureItem[];
  refunds: {
    title: string;
  };
};

export function PricingRefundsFaqSection({
  comingSoonLabel,
  faq,
  faqEntries,
  liveLabel,
  refundFeatureItems,
  refunds,
}: PricingRefundsFaqSectionProps) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <article
        id="refunds-protections"
        className="scroll-mt-28 rounded-card border border-hairline bg-surface p-6 shadow-card"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-hairline bg-surface-3 text-text-secondary">
            <ShieldCheck className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <h2 className="text-2xl font-semibold text-text-primary">{refunds.title}</h2>
        </div>
        <ul className="mt-5 grid gap-4 text-sm text-text-secondary">
          {refundFeatureItems.map((item, index) => {
            const Icon = REFUND_FEATURE_ICONS[index % REFUND_FEATURE_ICONS.length];
            return (
              <li key={item.text} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 flex-none text-text-secondary" strokeWidth={1.9} />
                <span className="inline-flex flex-wrap items-center gap-2 leading-6">
                  {item.text}
                  <FlagPill live={item.live} liveLabel={liveLabel} soonLabel={comingSoonLabel} />
                </span>
              </li>
            );
          })}
        </ul>
      </article>
      <article className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-hairline bg-surface-3 text-text-secondary">
            <BarChart3 className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <h2 className="text-2xl font-semibold text-text-primary">{faq.title}</h2>
        </div>
        <dl className="mt-5 grid gap-4">
          {faqEntries.slice(0, 4).map((entry) => (
            <div key={entry.question}>
              <dt className="text-sm font-semibold text-text-primary">{entry.question}</dt>
              <dd className="mt-1 text-sm leading-6 text-text-secondary">{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  );
}
