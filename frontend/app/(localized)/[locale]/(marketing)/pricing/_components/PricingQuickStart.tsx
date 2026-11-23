import styles from './pricing-opening.module.css';
import { ArrowDownRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { VideoPricingHighlight } from '../_lib/pricingHubData';

/** Present the matrix's existing exact quotes; never calculate a second price. */
export function PricingQuickStart({
  highlights,
  title,
  note,
}: {
  highlights: VideoPricingHighlight[];
  title: string;
  note: string;
}) {
  const featured = highlights.filter((highlight) => highlight.featured && highlight.href);
  if (!featured.length) return null;

  return (
    <section aria-labelledby="pricing-quick-start-title" className={styles.quick}>
      <h2 id="pricing-quick-start-title" className="text-sm font-semibold text-text-primary">{title}</h2>
      <div className={styles.quickList}>
        {featured.map((highlight) => (
          <Link
            key={highlight.label}
            href={highlight.href!}
            prefetch={false}
            className={styles.quickItem}
            data-analytics-event="cta_click"
            data-analytics-cta-name="pricing_scenario"
            data-analytics-cta-location="pricing_hero"
            data-analytics-target-family="pricing"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5">{highlight.featured!.intent}</span>
              <span className="mt-1 block text-xs leading-5 text-text-secondary">{highlight.label}</span>
              <span className="mt-1 block text-sm font-semibold">{highlight.featured!.engineName}</span>
            </span>
            <span className="flex min-w-[8.5rem] shrink-0 items-center justify-between gap-3 sm:w-full sm:min-w-0">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{highlight.featured!.price}</span>
              <ArrowDownRight className="h-4 w-4 text-text-muted transition group-hover:translate-y-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-text-muted">{note}</p>
    </section>
  );
}
