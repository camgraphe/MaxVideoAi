import type { AppLocale } from '@/i18n/locales';
import type { EngineCaps } from '@/types/engines';
import { getImageInputField } from '@/lib/image/inputSchema';
import { localizeSpecStatus } from './model-page-spec-status';
import type { KeySpecRow } from './model-page-specs-types';

export type CinematicSpecRow = { id: string; label: string; value: string };
export const cinematicSpecCopy = {
  en: { reviewed: 'Settings checked', feature: 'Setting', value: 'In MaxVideoAI', title: 'Specifications', context: 'Settings available in Create. The table describes MaxVideoAI’s implementation of this model.', copy: 'Copy table', copied: 'Copied', failed: 'Copy unavailable. Download the CSV instead.', csv: 'Download CSV', source: 'Source', references: 'Reference images', count: 'Images per request', background: 'Background', upTo: 'Up to', transparent: 'Transparent (PNG)', auto: 'Auto', opaque: 'Opaque', related: 'Explore other models' },
  fr: { reviewed: 'Réglages vérifiés', feature: 'Réglage', value: 'Dans MaxVideoAI', title: 'Caractéristiques', context: 'Réglages disponibles dans Create. Ce tableau décrit l’intégration de ce modèle dans MaxVideoAI.', copy: 'Copier le tableau', copied: 'Copié', failed: 'Copie indisponible. Téléchargez le CSV.', csv: 'Télécharger le CSV', source: 'Source', references: 'Images de référence', count: 'Images par requête', background: 'Arrière-plan', upTo: 'Jusqu’à', transparent: 'Transparent (PNG)', auto: 'Auto', opaque: 'Opaque', related: 'Explorer d’autres modèles' },
  es: { reviewed: 'Ajustes comprobados', feature: 'Ajuste', value: 'En MaxVideoAI', title: 'Características', context: 'Ajustes disponibles en Create. La tabla describe la integración de este modelo en MaxVideoAI.', copy: 'Copiar tabla', copied: 'Copiado', failed: 'Copia no disponible. Descarga el CSV.', csv: 'Descargar CSV', source: 'Fuente', references: 'Imágenes de referencia', count: 'Imágenes por solicitud', background: 'Fondo', upTo: 'Hasta', transparent: 'Transparente (PNG)', auto: 'Auto', opaque: 'Opaco', related: 'Explorar otros modelos' },
};

/** Complements the existing canonical specs with the exact image composer fields. No inferred provider limits. */
export function buildCinematicSpecRows(rows: KeySpecRow[], engine: EngineCaps, locale: AppLocale, isImage: boolean): CinematicSpecRow[] {
  const result = rows.filter(row => !row.id.startsWith('pricePer')).map(row => ({ id: row.id, label: row.label,
    value: (row.valueLines?.length ? row.valueLines : [row.value]).map(value => localizeSpecStatus(value, locale)).join(' · ') }));
  if (!isImage) return result;
  const copy = cinematicSpecCopy[locale];
  const reference = getImageInputField(engine, 'image_urls', 'i2i');
  const count = getImageInputField(engine, 'num_images', 't2i');
  const background = getImageInputField(engine, 'background', 't2i');
  if (typeof reference?.maxCount === 'number') result.push({ id: 'imageReferenceCount', label: copy.references, value: `${copy.upTo} ${reference.maxCount}` });
  if (typeof count?.min === 'number' && typeof count.max === 'number') result.push({ id: 'imageOutputCount', label: copy.count, value: count.min === count.max ? String(count.max) : `${count.min}–${count.max}` });
  if (background?.values?.length) result.push({ id: 'imageBackground', label: copy.background,
    value: background.values.map(value => ({ auto: copy.auto, opaque: copy.opaque, transparent: copy.transparent }[value] ?? value)).join(' · ') });
  return result;
}

const html = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const markdown = (value: string) => value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const csv = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

/** The visible rows, rich copy, text fallback and CSV share the same server-projected facts. */
export function buildCinematicSpecExports({ title, rows, source, locale, reviewedAt }: { reviewedAt?: string; title: string; rows: CinematicSpecRow[]; source: string; locale: AppLocale }) {
  const copy = cinematicSpecCopy[locale];
  const reviewed = reviewedAt ? `${copy.reviewed}: ${reviewedAt}` : '';
  return {
    text: `${title}\n\n${copy.context}${reviewed ? `\n${reviewed}` : ''}\n\n| ${copy.feature} | ${copy.value} |\n| --- | --- |\n${rows.map(row => `| ${markdown(row.label)} | ${markdown(row.value)} |`).join('\n')}\n\n${copy.source}: MaxVideoAI — ${source}`,
    html: `<h2>${html(title)}</h2><p>${html(copy.context)}</p>${reviewed ? `<p>${html(reviewed)}</p>` : ''}<table><thead><tr><th scope="col">${html(copy.feature)}</th><th scope="col">${html(copy.value)}</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${html(row.label)}</th><td>${html(row.value)}</td></tr>`).join('')}</tbody></table><p>${html(copy.source)}: <a href="${html(source)}">MaxVideoAI</a></p>`,
    csv: '\uFEFF' + [[title, copy.context], ...(reviewedAt ? [[copy.reviewed, reviewedAt]] : []), [copy.feature, copy.value], ...rows.map(row => [row.label, row.value]), [copy.source, source]].map(row => row.map(csv).join(',')).join('\r\n'),
  };
}
