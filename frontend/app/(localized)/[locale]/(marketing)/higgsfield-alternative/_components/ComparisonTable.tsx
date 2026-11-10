import { Check, Clock3, ChevronDown } from 'lucide-react';
import type { ComparisonCell, ComparisonRow, ComparisonCopy } from '../_content/types';
import { sourceNumber } from '../_lib/evidence';
import styles from './comparison.module.css';

function Cell({ cell, brand, headers }: { cell: ComparisonCell; brand: string; headers: string }) {
  const Icon = cell.tone === 'condition' ? Clock3 : Check;
  return (
    <td role="cell" data-tone={cell.tone} headers={headers}>
      <span className={styles.mobileBrand} aria-hidden="true">{brand}</span>
      <details className={styles.cellDetails}>
        <summary><span className={styles.cellTitle}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /><strong>{cell.title}</strong></span><ChevronDown size={16} aria-hidden="true" /></summary>
        <p>{cell.detail}</p>
      </details>
    </td>
  );
}

export function ComparisonTable({ rows, copy, caption }: { rows: ComparisonRow[]; copy: ComparisonCopy['matrix']; caption: string }) {
  const tableId = rows[0].id;
  return (
    <div className={styles.tableWrap}>
      <table role="table" className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">{copy.task}</th><th role="columnheader" scope="col" id={`${tableId}-max`}>MaxVideoAI</th><th role="columnheader" scope="col" id={`${tableId}-higgs`}>Higgsfield</th></tr></thead>
        <tbody role="rowgroup">{rows.map((row) => (
          <tr role="row" key={row.id} id={row.id}>
            <th role="rowheader" scope="row" id={`${row.id}-label`}>
              <a className={styles.factAnchor} href={`#${row.id}`}>{row.label}</a>
              <span className={styles.references}>{row.sources.map((id) => (
                <a key={id} href={`#source-${id}`} aria-label={`${copy.sources} ${sourceNumber(id)}`}>[{sourceNumber(id)}]</a>
              ))}</span>
            </th>
            <Cell cell={row.max} brand="MaxVideoAI" headers={`${row.id}-label ${tableId}-max`} /><Cell cell={row.higgsfield} brand="Higgsfield" headers={`${row.id}-label ${tableId}-higgs`} />
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
