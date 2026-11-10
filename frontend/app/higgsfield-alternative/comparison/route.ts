import sharp from 'sharp';
import { type NextRequest } from 'next/server';
import { getComparisonCopy } from '../../(localized)/[locale]/(marketing)/higgsfield-alternative/_content';
import { comparisonCsv, comparisonData, comparisonSvg } from '../../(localized)/[locale]/(marketing)/higgsfield-alternative/_lib/exports';
import { COMPARISON_CHECKED, COMPARISON_PATH } from '../../(localized)/[locale]/(marketing)/higgsfield-alternative/_lib/evidence';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import type { AppLocale } from '@/i18n/locales';

export const runtime = 'nodejs';
export const revalidate = 86400;
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') ?? 'en';
  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  if (!['en', 'fr', 'es'].includes(locale) || !['png', 'svg', 'csv', 'json', 'og'].includes(format)) {
    return new Response('Unsupported comparison language or format.', { status: 400 });
  }
  const copy = getComparisonCopy(locale as AppLocale);
  const canonical = getLocalizedUrl(locale as AppLocale, COMPARISON_PATH);
  const headers = new Headers({ 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex', 'Content-Language': locale });
  if (format === 'json') { headers.set('Content-Type', 'application/json; charset=utf-8'); return new Response(JSON.stringify(comparisonData(copy, locale as AppLocale, canonical), null, 2), { headers }); }
  const extension = format === 'og' ? 'png' : format;
  headers.set('Content-Disposition', `${format === 'og' ? 'inline' : 'attachment'}; filename="maxvideoai-higgsfield-${locale}-${COMPARISON_CHECKED}.${extension}"`);
  if (format === 'csv') { headers.set('Content-Type', 'text/csv; charset=utf-8'); return new Response(comparisonCsv(copy, locale as AppLocale, canonical), { headers }); }
  const { svg } = comparisonSvg(copy, canonical, format === 'og');
  if (format === 'svg') { headers.set('Content-Type', 'image/svg+xml; charset=utf-8'); headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"); return new Response(svg, { headers }); }
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  headers.set('Content-Type', 'image/png');
  return new Response(new Uint8Array(png), { headers });
}
