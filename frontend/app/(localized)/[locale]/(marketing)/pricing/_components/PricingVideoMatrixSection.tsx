import { EngineIcon } from '@/components/ui/EngineIcon';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { PRICING_SLUG_MAP } from '../_lib/pricing-jsonld';
import { pricingOpeningCopy } from '../_lib/pricing-opening-copy';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';
import type { VideoPricingMatrixData, VideoPricingRow } from '../_lib/pricingHubData';
import { PricingTableScrollRegion } from './PricingTableScrollRegion';
import { PricingFamilyComparison } from './PricingFamilyComparison.client';
import styles from './pricing-families.module.css';

const families: Record<string, string> = {
  seedance: 'Seedance', kling: 'Kling', veo: 'Google Veo', gemini: 'Gemini Omni', wan: 'Wan',
  flux: 'FLUX', ltx: 'LTX', hailuo: 'MiniMax', luma: 'Luma', grok: 'Grok', 'happy-horse': 'Happy Horse',
};
const priority = ['seedance-2-5', 'seedance-2-5-flash', 'seedance-2-0-mini', 'kling-v4', 'kling-v4-flash'];
function rank(row: VideoPricingRow) {
  const index = priority.indexOf(row.id);
  return index < 0 ? priority.length : index;
}
function groupRows(rows: VideoPricingRow[]) {
  const groups = new Map<string, VideoPricingRow[]>(Object.keys(families).map(key => [key, []]));
  for (const row of rows) {
    const key = row.id.startsWith('gemini-omni') ? 'gemini' : row.family;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return Array.from(groups).filter(([, items]) => items.length);
}

export function PricingVideoMatrixSection({ locale, video, quotedOn }: { locale: AppLocale; video: VideoPricingMatrixData; quotedOn: string }) {
  const copy = pricingOpeningCopy[locale];
  const hub = getPricingHubCopy(locale);
  const canonical = buildMetadataUrls(locale, PRICING_SLUG_MAP, { englishPath: '/pricing' }).canonical;
  const presets = video.presets.map(preset => ({
    id: preset.id,
    label: preset.id === '10s-1080p-audio' ? '10 s · 1080p · ' + copy.audioOn : hub.video.presetLabels[preset.id] ?? preset.label,
  }));
  return <section id="video-pricing" className={styles.section}>
    <details id="full-video-pricing-table" className={styles.catalogue}>
      <summary><h2 id="video-pricing-table-title">{copy.catalogue}</h2><span>{video.rows.length} {copy.catalogueCount}</span></summary>
      {video.createCatalogue && video.createCatalogue.total > 0 && <p id="video-catalogue-scope">
        {hub.video.catalogueScope(video.createCatalogue.total, video.createCatalogue.current)}{' '}
        <Link href="/app" prefetch={false}>{hub.video.openCreate}</Link></p>}
      <PricingFamilyComparison locale={locale} presets={presets} canonical={canonical} date={quotedOn}>
        {groupRows(video.rows).map(([key, rows]) => <details className={styles.family} key={key} data-family={key}>
          <summary id={'family-' + key}>{families[key] ?? key}<small>{rows.length} {copy.catalogueCount}</small></summary>
          <PricingTableScrollRegion labelledBy={'family-' + key}>
            <table><thead><tr><th scope="col">{copy.model}</th>
              {presets.map(p => <th key={p.id} data-preset={p.id} scope="col">{p.label}</th>)}
              <th className={styles.pick} scope="col">{copy.add}</th>
            </tr></thead><tbody>{rows.sort((a,b) => rank(a) - rank(b)).map(row =>
              <tr key={row.id} id={row.anchorId} data-model={row.engineName}>
                <th scope="row"><div className={styles.model}><EngineIcon engine={row.engineIcon} label={row.engineName} size={24} rounded="xl" />
                  {row.modelHref ? <Link href={row.modelHref} prefetch={false}>{row.engineName}</Link> : row.engineName}</div>
                  <details className={styles.links}><summary>{copy.more}</summary><p>{row.limitsLabel}</p>
                    <a href={'#' + row.anchorId}>{copy.source}</a>
                    {row.links.map(link => <Link key={link.href} href={link.href} prefetch={false}>{link.label}</Link>)}
                    {['kling-3-standard', 'kling-3-pro'].includes(row.id) && ['10s-1080p', '10s-1080p-audio'].map(preset =>
                      <a key={preset} href={'/app?' + new URLSearchParams({ engine: row.id, mode: 't2v', pricingPreset: preset, lang: locale })}>{copy.quote} · {presets.find(p => p.id === preset)?.label}</a>)}
                  </details></th>
                {presets.map(p => {
                  const quote = row.quotes[p.id];
                  const price = quote.status === 'exact' ? quote.display : quote.status === 'live_quote' ? hub.liveQuote : '—';
                  return <td className="tabular-nums" key={p.id} data-preset={p.id} data-quote={[price, quote.note].filter(Boolean).join(' · ')}>
                    <strong>{price}</strong>{quote.note && <small>{quote.note}</small>}</td>;
                })}
                <td className={styles.pick}><input type="checkbox" aria-label={copy.add + ' ' + row.engineName} /></td>
              </tr>)}</tbody></table>
          </PricingTableScrollRegion>
        </details>)}
      </PricingFamilyComparison>
      <p>{hub.video.globalNote}</p>
    </details>
  </section>;
}
