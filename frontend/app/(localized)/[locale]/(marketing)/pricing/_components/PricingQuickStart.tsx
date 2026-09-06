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
    <section aria-labelledby="pricing-quick-start-title" className="container-page max-w-[1220px] pb-6 sm:pb-8">
      <h2 id="pricing-quick-start-title" className="text-sm font-semibold text-text-primary">{title}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {featured.map((highlight) => (
          <Link
            key={highlight.label}
            href={highlight.href!}
            prefetch={false}
            className="group flex items-center justify-between gap-4 rounded-xl border border-hairline bg-surface p-4 text-text-primary shadow-card transition hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-col sm:items-start"
            data-analytics-event="cta_click"
            data-analytics-cta-name="pricing_scenario"
            data-analytics-cta-location="pricing_hero"
            data-analytics-target-family="pricing"
          >
            <span className="min-w-0">
              <span className="block text-xs leading-5 text-text-secondary">{highlight.label}</span>
              <span className="mt-1 block text-sm font-semibold">{highlight.featured!.engineName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3 sm:w-full sm:justify-between">
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
