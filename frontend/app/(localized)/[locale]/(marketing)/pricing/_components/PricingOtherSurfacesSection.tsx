import type { AppLocale } from '@/i18n/locales';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { ImagePricingRow, OtherSurfacePricingData } from '../_lib/pricingHubData';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';
import { PricingTableScrollRegion } from './PricingTableScrollRegion';

function InlineLinks({ links }: { links: { label: string; href: LocalizedLinkHref }[] }) {
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

function ImageEngineName({ row }: { row: Pick<ImagePricingRow, 'engine' | 'modelHref'> }) {
  return row.modelHref ? (
    <Link href={row.modelHref} prefetch={false} className="text-text-primary transition hover:text-[#356BE8] hover:underline">
      {row.engine}
    </Link>
  ) : (
    <span>{row.engine}</span>
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

      <div id="image-pricing" className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:scroll-mt-28 sm:p-6">
        <h3 id="image-pricing-title" className="text-xl font-semibold tracking-normal text-text-primary">
          {copy.otherSurfaces.imageTitle}
        </h3>
        <PricingTableScrollRegion labelledBy="image-pricing-title" className="mt-4">
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
                  <td className="py-3 pr-4 font-semibold text-text-primary">
                    <ImageEngineName row={row} />
                  </td>
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
        </PricingTableScrollRegion>
      </div>

      <div id="audio-pricing" className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:scroll-mt-28 sm:p-6">
        <h3 id="audio-pricing-title" className="text-xl font-semibold tracking-normal text-text-primary">
          {copy.otherSurfaces.audioTitle}
        </h3>
        <PricingTableScrollRegion labelledBy="audio-pricing-title" className="mt-4">
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
        </PricingTableScrollRegion>
      </div>

      <div id="tool-pricing" className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:scroll-mt-28 sm:p-6">
        <h3 id="tool-pricing-title" className="text-xl font-semibold tracking-normal text-text-primary">
          {copy.otherSurfaces.toolTitle}
        </h3>
        <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">
          {copy.otherSurfaces.characterImageNote}
        </p>
        <PricingTableScrollRegion labelledBy="tool-pricing-title" className="mt-4">
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
              <tr id="character-recast-pricing" className="scroll-mt-24 border-b border-hairline last:border-0">
                <th scope="row" className="py-3 pr-4 font-semibold text-text-primary">{copy.tools.characterRecast}
                  <p className="mt-1 max-w-[240px] text-xs font-normal leading-5 text-text-secondary">{copy.otherSurfaces.recastPricingNote}</p>
                </th>
                {(['price720', 'price1080'] as const).map((key) => <td key={key} className="px-4 py-3 text-text-secondary">
                  <span className="text-xs font-semibold text-text-primary">{key === 'price720' ? '720p' : '1080p'}</span>
                  {data.recastExamples?.length ? data.recastExamples.map(example => <p key={example.outputSeconds} className="mt-2">
                    <strong className="block text-base tabular-nums text-text-primary">{example[key]}</strong>
                    <span className="text-xs">{copy.otherSurfaces.recastExample(example.outputSeconds, example.sourceSeconds)}</span>
                  </p>) : <p>{copy.liveQuote}</p>}
                </td>)}
                <td className="px-4 py-3 text-text-secondary">{copy.tools.recastUse}</td>
                <td className="py-3 pl-4">
                  <InlineLinks links={[
                    { label: copy.links.tool, href: { pathname: '/tools/character-builder', hash: 'recast' } },
                    { label: copy.links.livePrice, href: '/app/tools/character-builder?mode=recast' },
                  ]} />
                </td>
              </tr>
            </tbody>
          </table>
        </PricingTableScrollRegion>
      </div>
    </section>
  );
}
