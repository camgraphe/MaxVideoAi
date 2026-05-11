import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { OtherSurfacePricingData, PricingHubLink } from '../_lib/pricingHubData';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';

function InlineLinks({ links }: { links: PricingHubLink[] }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold">
      {links.map((link, index) => (
        <span key={`${link.label}-${link.href}`} className="inline-flex items-center gap-2">
          {index > 0 ? <span className="text-text-muted">·</span> : null}
          <Link href={link.href} prefetch={false} className="text-[#356BE8] hover:underline">
            {link.label}
          </Link>
        </span>
      ))}
    </div>
  );
}

export function PricingOtherSurfacesSection({ data, locale }: { data: OtherSurfacePricingData; locale: AppLocale }) {
  const copy = getPricingHubCopy(locale);
  return (
    <section className="space-y-5" aria-labelledby="other-pricing-title">
      <div>
        <h2 id="other-pricing-title" className="text-2xl font-semibold tracking-normal text-text-primary">
          {copy.otherSurfaces.title}
        </h2>
        <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">
          {copy.otherSurfaces.intro}
        </p>
      </div>

      <div id="image-pricing" className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
        <h3 className="text-xl font-semibold tracking-normal text-text-primary">{copy.otherSurfaces.imageTitle}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[940px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="py-3 pr-4">{copy.otherSurfaces.imageColumns.engine}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.imageColumns.standard}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.imageColumns.highQuality}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.imageColumns.reference}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.imageColumns.sizes}</th>
                <th className="py-3 pl-4">{copy.otherSurfaces.imageColumns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.imageRows.map((row) => (
                <tr key={row.id} id={row.anchorId} className="scroll-mt-24 border-b border-hairline last:border-0">
                  <td className="py-3 pr-4 font-semibold text-text-primary">{row.engine}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.standardImage}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.highQualityImage}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.reference}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.sizes}</td>
                  <td className="py-3 pl-4">
                    <InlineLinks links={row.links} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="audio-pricing" className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
        <h3 className="text-xl font-semibold tracking-normal text-text-primary">{copy.otherSurfaces.audioTitle}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="py-3 pr-4">{copy.otherSurfaces.audioColumns.mode}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.audioColumns.thirtySeconds}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.audioColumns.sixtySeconds}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.audioColumns.oneTwentySeconds}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.audioColumns.voiceClone}</th>
                <th className="py-3 pl-4">{copy.otherSurfaces.audioColumns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.audioRows.map((row) => (
                <tr key={row.id} id={row.anchorId} className="scroll-mt-24 border-b border-hairline last:border-0">
                  <td className="py-3 pr-4 font-semibold text-text-primary">{row.mode}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.thirtySeconds}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.sixtySeconds}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.oneTwentySeconds}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.voiceClone}</td>
                  <td className="py-3 pl-4">
                    <InlineLinks links={row.links} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="tool-pricing" className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
        <h3 className="text-xl font-semibold tracking-normal text-text-primary">{copy.otherSurfaces.toolTitle}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="py-3 pr-4">{copy.otherSurfaces.toolColumns.tool}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.toolColumns.standard}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.toolColumns.pro}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.toolColumns.bestUsedBefore}</th>
                <th className="py-3 pl-4">{copy.otherSurfaces.toolColumns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.toolRows.map((row) => (
                <tr key={row.id} id={row.anchorId} className="scroll-mt-24 border-b border-hairline last:border-0">
                  <td className="py-3 pr-4 font-semibold text-text-primary">{row.tool}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.standardOutput}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.proOutput}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.bestUsedBefore}</td>
                  <td className="py-3 pl-4">
                    <InlineLinks links={row.links} />
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
