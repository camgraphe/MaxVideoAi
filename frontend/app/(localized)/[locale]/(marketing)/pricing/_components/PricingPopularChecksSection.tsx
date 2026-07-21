import type { AppLocale } from '@/i18n/locales';
import type { PopularPriceCheckRow } from '../_lib/pricingHubData';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';
import { PricingTableScrollRegion } from './PricingTableScrollRegion';

export function PricingPopularChecksSection({ checks, locale }: { checks: PopularPriceCheckRow[]; locale: AppLocale }) {
  const copy = getPricingHubCopy(locale);
  return (
    <section className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <h2 id="popular-pricing-checks-title" className="text-xl font-semibold tracking-normal text-text-primary">
        {copy.popularChecks.title}
      </h2>
      <PricingTableScrollRegion labelledBy="popular-pricing-checks-title" className="mt-4">
        <table className="min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
              <th className="py-3 pr-4">{copy.popularChecks.columns.priceCheck}</th>
              <th className="px-4 py-3">{copy.popularChecks.columns.cheapestEngine}</th>
              <th className="px-4 py-3 text-right">{copy.popularChecks.columns.typicalPrice}</th>
              <th className="py-3 pl-4">{copy.popularChecks.columns.link}</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.id} className="border-b border-hairline last:border-0">
                <td className="py-3 pr-4 font-semibold text-text-primary">{check.priceCheck}</td>
                <td className="px-4 py-3 text-text-secondary">{check.engine}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-text-primary">
                  {check.price}
                </td>
                <td className="py-3 pl-4">
                  <a href={check.link.href} className="text-xs font-semibold text-[#356BE8] hover:underline">
                    {check.link.label}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PricingTableScrollRegion>
    </section>
  );
}
