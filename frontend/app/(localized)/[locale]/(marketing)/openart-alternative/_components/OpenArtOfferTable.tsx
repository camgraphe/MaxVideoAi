import { ArrowDown } from 'lucide-react';
import type { OpenArtCopy } from '../_content/types';
import { OPENART_CHECKED, openArtCriteria, openArtSources, type OpenArtCriterion, type OpenArtSourceId } from '../_lib/evidence';
import styles from './openart.module.css';

const criteria = Object.keys(openArtCriteria) as OpenArtCriterion[];
const columns = [{ id: 'max', name: 'MaxVideoAI' }, { id: 'openart', name: 'OpenArt' }] as const;
const sourceNumbers = new Map<OpenArtSourceId, number>(openArtSources.map(({ id }, index) => [id, index + 1]));

export function OpenArtOfferTable({ copy, rows, labels, date }: {
  copy: OpenArtCopy['matrix'];
  rows: OpenArtCopy['rows'];
  labels: OpenArtCopy['sourceLabels'];
  date: string;
}) {
  return (
    <section className={styles.offer} aria-labelledby="openart-offer-title">
      <div className={styles.offerHead}>
        <h2 id="openart-offer-title">{copy.title}</h2>
        <a className={styles.textLink} href="#openart-sources">{copy.sources}<ArrowDown size={16} aria-hidden="true" /></a>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table} role="table">
          <caption className={styles.srOnly}>{copy.caption}</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">{copy.criterion}</th>
              {columns.map(({ id, name }) => <th id={`openart-column-${id}`} key={id} scope="col" role="columnheader">{name}</th>)}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {criteria.map((criterion) => {
              const row = rows[criterion];
              const rowId = `openart-criterion-${criterion}`;
              return (
                <tr role="row" key={criterion}>
                  <th id={rowId} scope="row" role="rowheader">{row.label}</th>
                  {columns.map(({ id, name }) => (
                    <td role="cell" headers={`${rowId} openart-column-${id}`} key={id}>
                      <span className={styles.mobileBrand} aria-hidden="true">{name}</span>
                      <p>{row[id]}</p>
                      <span className={styles.citations}>
                        {openArtCriteria[criterion][id].map((sourceId) => (
                          <a aria-label={labels[sourceId]} key={sourceId} href={`#openart-source-${sourceId}`}>[{sourceNumbers.get(sourceId)}]</a>
                        ))}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.scopeNote}><time dateTime={OPENART_CHECKED}>{date}</time> · {copy.note}</p>
    </section>
  );
}
