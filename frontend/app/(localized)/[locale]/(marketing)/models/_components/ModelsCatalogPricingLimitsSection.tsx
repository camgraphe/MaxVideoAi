import { UIIcon } from '@/components/ui/UIIcon';
import type { ModelsCatalogPricingLimitItem } from '../_lib/models-catalog-decision-data';

type ModelsCatalogPricingLimitsSectionProps = {
  title: string;
  body: string;
  items: ModelsCatalogPricingLimitItem[];
};

export function ModelsCatalogPricingLimitsSection({ title, body, items }: ModelsCatalogPricingLimitsSectionProps) {
  return (
    <section
      id="pricing-limits"
      className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">{body}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <article key={item.title} className="rounded-[8px] border border-hairline bg-bg p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-brand">
              <UIIcon icon={item.icon} size={18} />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-text-primary">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
