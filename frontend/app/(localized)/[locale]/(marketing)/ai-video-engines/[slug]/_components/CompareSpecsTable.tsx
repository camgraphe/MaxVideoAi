import type { AppLocale } from '@/i18n/locales';
import type { CompareSpecRow } from '../_lib/compare-page-spec-rows';
import { renderSpecValue } from './CompareSpecValue';

export function CompareSpecsTable({ rows, locale, labels, leftName, rightName, criterionLabel }: {
  rows: CompareSpecRow[]; locale: AppLocale; labels: { pending: string; supported: string; notSupported: string };
  leftName: string; rightName: string; criterionLabel: string;
}) {
  return <table className="compare-spec-table">
    <caption className="sr-only">{leftName} / {rightName} — {criterionLabel}</caption>
    <thead><tr><th scope="col">{criterionLabel}</th><th scope="col">{leftName}</th><th scope="col">{rightName}</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.label}>
      <th scope="row">{row.label}</th>
      {[{ value: row.left, lines: row.sublines ?? (row.subline ? [row.subline] : []), name: leftName }, { value: row.right, lines: row.rightSublines ?? (row.rightSubline ? [row.rightSubline] : []), name: rightName }].map(({ value, lines, name }) => <td key={name}>
        <span className="compare-spec-mobile-name" aria-hidden="true">{name}</span>
        {renderSpecValue(value, locale, labels)}
        {lines.map(line => <small key={line}>{line}</small>)}
      </td>)}
    </tr>)}</tbody>
  </table>;
}
