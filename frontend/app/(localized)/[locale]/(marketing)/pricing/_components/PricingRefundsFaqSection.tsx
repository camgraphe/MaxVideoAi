import { Box } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';

type PricingFaqContent = {
  subtitle?: string;
  title?: string;
};

type PricingFaqEntry = {
  answer: string;
  question: string;
};

type PricingRefundsFaqSectionProps = {
  faq: PricingFaqContent;
  faqEntries: PricingFaqEntry[];
};

export function PricingRefundsFaqSection({ faq, faqEntries }: PricingRefundsFaqSectionProps) {
  return (
    <section id="pricing-faq" className="dark-section-neon mx-auto w-full max-w-[900px] stack-gap-lg">
      <div className="mx-auto w-full max-w-3xl text-center">
        <h2 className="text-3xl font-semibold text-text-primary sm:text-4xl">{faq.title ?? 'Pricing FAQ'}</h2>
        {faq.subtitle ? <p className="mt-3 text-base leading-7 text-text-secondary">{faq.subtitle}</p> : null}
      </div>
      <div className="w-full space-y-3">
        {faqEntries.map((entry) => (
          <details
            key={entry.question}
            className="dark-neon-panel group w-full rounded-card border border-hairline bg-surface p-5 shadow-card"
          >
            <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-text-primary">
              <span className="min-w-0">{entry.question}</span>
              <UIIcon icon={Box} size={18} className="flex-none text-text-muted transition group-open:rotate-45" />
            </summary>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
