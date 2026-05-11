import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { PopularPriceCheckRow } from '../_lib/pricingHubData';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';

export function PricingPopularChecksSection({ checks, locale }: { checks: PopularPriceCheckRow[]; locale: AppLocale }) {
  const copy = getPricingHubCopy(locale);
  return (
    <section className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-semibold tracking-normal text-text-primary">{copy.popularChecks.title}</h2>
      <div className="mt-4 overflow-x-auto">
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
                  <Link href={check.link.href} prefetch={false} className="text-xs font-semibold text-[#356BE8] hover:underline">
                    {check.link.label}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
