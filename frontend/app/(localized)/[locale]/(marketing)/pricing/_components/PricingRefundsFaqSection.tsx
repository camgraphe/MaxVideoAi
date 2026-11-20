import { Plus } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AppLocale } from '@/i18n/locales';
import { pricingOpeningCopy } from '../_lib/pricing-opening-copy';
import styles from './pricing-catalog.module.css';

type PricingFaqEntry = { answer: string; question: string };
type Props = { locale: AppLocale; faq: { title?: string; subtitle?: string }; faqEntries: PricingFaqEntry[] };

export function PricingRefundsFaqSection({ locale, faq, faqEntries }: Props) {
  const copy = pricingOpeningCopy[locale];
  // The localized dictionaries share the same ordered question set.
  const groups = [
    { label: copy.faqSettings, indexes: [0,5,10,11] },
    { label: copy.faqPayments, indexes: [6,7,9] },
    { label: copy.faqModels, indexes: [1,2,3,4,8] },
  ];
  return <section id="pricing-faq" aria-labelledby="pricing-faq-title" className={styles.faq}>
    <header><h2 id="pricing-faq-title">{faq.title ?? 'Pricing FAQ'}</h2>{faq.subtitle && <p>{faq.subtitle}</p>}</header>
    <div className={styles.faqGroups}>{groups.map(group => <details key={group.label} className={styles.topic}>
      <summary>{group.label}<Plus size={20} aria-hidden="true" /></summary>
      {group.indexes.map(index => {
        const entry = faqEntries[index];
        return entry && <details key={entry.question} className="group w-full" data-faq-question="">
          <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-text-primary">
            <span>{entry.question}</span><UIIcon icon={Plus} size={16} className="flex-none transition group-open:rotate-45" />
          </summary>
          <p>{entry.answer}</p>
        </details>;
      })}
    </details>)}</div>
  </section>;
}
