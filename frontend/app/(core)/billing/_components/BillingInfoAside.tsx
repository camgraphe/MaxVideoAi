import { CheckCircle2 } from 'lucide-react';
import type { BillingCopy } from '../_lib/billing-copy';
import styles from './billing-page.module.css';

type BillingInfoAsideProps = {
  copy: BillingCopy;
};

export function BillingInfoAside({ copy }: BillingInfoAsideProps) {
  return (
    <aside className={styles.infoAside}>
      <section>
        <h2 className="text-lg font-semibold text-text-primary">{copy.refunds.title}</h2>
        <ul className={styles.protectionList}>
          {copy.refunds.points.map((point) => (
            <li key={point}>
              <CheckCircle2 size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.faqList}>
          <h3 className="text-sm font-semibold text-text-primary">{copy.faq.title}</h3>
          {copy.faq.entries.map((entry) => (
            <details key={entry.question}>
              <summary>{entry.question}</summary>
              <p>{entry.answer}</p>
            </details>
          ))}
      </section>
    </aside>
  );
}
