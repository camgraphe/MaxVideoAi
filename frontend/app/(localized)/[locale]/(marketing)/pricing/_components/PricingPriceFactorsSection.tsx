import { Clock3, ImageIcon, Mic2, Monitor, Sparkles, type LucideIcon } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { DEFAULT_PRICE_FACTORS, type PriceFactorsContent } from '../_lib/pricingPageContent';

const PRICE_FACTOR_ICONS: LucideIcon[] = [Clock3, Monitor, ImageIcon, Mic2, Sparkles];

type PricingPriceFactorsSectionProps = {
  locale: AppLocale;
  priceFactors: PriceFactorsContent;
};

export function PricingPriceFactorsSection({
  locale,
  priceFactors,
}: PricingPriceFactorsSectionProps) {
  if (!priceFactors.points?.length) return null;

  return (
    <section aria-labelledby="price-factors" className="scroll-mt-28">
      <h2 id="price-factors" className="text-2xl font-semibold text-text-primary">
        {priceFactors.title ?? DEFAULT_PRICE_FACTORS[locale].title}
      </h2>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {priceFactors.points.map((point, index) => {
          const Icon = PRICE_FACTOR_ICONS[index % PRICE_FACTOR_ICONS.length];
          return (
            <article key={point} className="rounded-[18px] border border-hairline bg-surface p-4 shadow-card">
              <Icon className="h-5 w-5 text-text-secondary" strokeWidth={1.8} />
              <p className="mt-3 text-xs leading-5 text-text-secondary">{point}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
