import styles from './pricing-catalog.module.css';
import { Plus } from 'lucide-react';
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
    <section id="pricing-faq" aria-labelledby="pricing-faq-title" className={styles.faq}>
      <div className="max-w-lg">
        <h2 id="pricing-faq-title">{faq.title ?? 'Pricing FAQ'}</h2>
        {faq.subtitle ? <p className="mt-3 text-base leading-7 text-text-secondary">{faq.subtitle}</p> : null}
      </div>
      <div className="w-full">
        {faqEntries.map((entry) => (
          <details
            key={entry.question}
            className="group w-full"
          >
            <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-text-primary">
              <span className="min-w-0">{entry.question}</span>
              <UIIcon icon={Plus} size={18} className="flex-none text-text-muted transition group-open:rotate-45" />
            </summary>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
