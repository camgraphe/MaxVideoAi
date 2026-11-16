import type { AppLocale } from '@/i18n/locales';
import { cinematicSpecCopy, type CinematicSpecRow } from '../_lib/model-page-cinematic-specs';

export function ModelCinematicSpecTable({ rows, title, locale }: { rows: CinematicSpecRow[]; title: string; locale: AppLocale }) {
  const copy = cinematicSpecCopy[locale];
  return <table className="cinema-spec-table"><caption className="sr-only">{title} — {copy.value}</caption>
    <thead><tr><th scope="col">{copy.feature}</th><th scope="col">{copy.value}</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody>
  </table>;
}
