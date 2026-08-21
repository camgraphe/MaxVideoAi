import { EngineIcon } from '@/components/ui/EngineIcon';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import { PAYG_CONTAINER_CLASS_NAME, PayAsYouGoSectionHeader } from './PayAsYouGoSectionPrimitives';

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

export function PayAsYouGoPricePerModelSection({ data }: PayAsYouGoPageDataProps) {
  const priceHeaders = data.pricing.rows[0]?.priceCells ?? [];

  return (
    <section id="compare-price-per-model" className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PayAsYouGoSectionHeader {...data.pricing.header} />
          <Link href={data.pricing.fullMatrixHref} className="text-sm font-semibold text-[#1F5EFF] transition hover:underline">
            {data.pricing.fullMatrixLabel}
          </Link>
        </div>
        <div className="mt-6 overflow-x-auto rounded-[8px] border border-hairline bg-surface shadow-card">
          <table className="min-w-[840px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="px-4 py-3">{data.pricing.columns.model}</th>
                <th className="px-4 py-3">{data.pricing.columns.bestFor}</th>
                {priceHeaders.map((cell) => (
                  <th key={cell.label} className="px-4 py-3 text-right">
                    {cell.label}
                  </th>
                ))}
                <th className="px-4 py-3">{data.pricing.columns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.pricing.rows.map((row) => (
                <tr key={row.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <EngineIcon engine={row.engineIcon} imageAlt={`${row.engineName} ${data.common.aiVideoModelAlt}`} size={34} rounded="full" />
                      <div>
                        <p className="font-semibold text-text-primary">{row.engineName}</p>
                        <p className="text-xs text-text-muted">{row.family}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[270px] px-4 py-3 text-text-secondary">{row.bestFor}</td>
                  {row.priceCells.map((cell) => (
                    <td key={`${row.id}-${cell.label}`} className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold tabular-nums text-text-primary">{cell.displayValue}</span>
                      {cell.note ? <span className="block text-[11px] text-text-muted">{cell.note}</span> : null}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {row.modelHref ? (
                        <Link href={row.modelHref} className="text-xs font-semibold text-[#1F5EFF] hover:underline">
                          {data.pricing.modelLinkLabel}
                        </Link>
                      ) : null}
                      {row.compareHref ? (
                        <Link href={row.compareHref} className="text-xs font-semibold text-[#1F5EFF] hover:underline">
                          {data.pricing.compareLinkLabel}
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoPriceLookupShortcutsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.priceLookups.header} />
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.priceLookups.items.map((lookup) => (
            <Link
              key={lookup.id}
              href={lookup.href}
              className="group flex min-h-[220px] flex-col rounded-[8px] border border-hairline bg-bg p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <EngineIcon engine={lookup.engineIcon} imageAlt={`${lookup.engineIcon.label} ${data.common.aiVideoModelAlt}`} size={36} rounded="full" />
                <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-text-primary">
                  {lookup.price}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-micro text-text-muted">{lookup.query}</p>
              <h3 className="mt-2 text-base font-semibold leading-snug text-text-primary">{lookup.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{lookup.body}</p>
              {lookup.modelHref ? (
                <span className="mt-auto pt-4 text-xs font-semibold text-[#1F5EFF] group-hover:underline">{data.priceLookups.openRowLabel}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoExampleCostsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.exampleCosts.header} />
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.exampleCosts.items.map((cost) => (
            <Link key={cost.label} href={cost.href} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm transition hover:border-text-muted">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{cost.label}</p>
              <p className="mt-3 text-sm font-semibold text-text-primary">{cost.engine}</p>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{cost.price}</p>
              <p className="mt-1 text-xs font-semibold text-text-muted">{cost.context}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
